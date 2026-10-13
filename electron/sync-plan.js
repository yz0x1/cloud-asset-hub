/**
 * 对齐原版 mergeType：0 合并 / 1 覆盖云盘 / 2 覆盖本地
 * 比对优先级：ETag(MD5) > size+mtime
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const MERGE = { normal: 0, coverCloud: 1, coverLocal: 2 }

function walkLocal(dir, base, out = []) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) walkLocal(full, base, out)
    else if (ent.isFile()) {
      if (/\.(log|delete|DS_Store)$/i.test(ent.name)) continue
      const rel = path.relative(base, full).split(path.sep).join('/')
      const st = fs.statSync(full)
      out.push({ path: full, key: rel, mtimeMs: st.mtimeMs, size: st.size })
    }
  }
  return out
}

/** 对齐原版 getEtag：本地文件 MD5，带引号 */
function getLocalEtag(filePath) {
  try {
    const hash = crypto.createHash('md5')
    hash.update(fs.readFileSync(filePath))
    return '"' + hash.digest('hex') + '"'
  } catch {
    return null
  }
}

function normEtag(e) {
  if (!e) return ''
  const s = String(e).trim()
  // 多分块上传 ETag 含 - 时不可与整文件 MD5 直接比
  if (s.includes('-')) return ''
  if (s.startsWith('"') && s.endsWith('"')) return s.toLowerCase()
  return ('"' + s.replace(/"/g, '') + '"').toLowerCase()
}

function sameContent(localPath, cf) {
  const localE = getLocalEtag(localPath)
  const cloudE = normEtag(cf.ETag || cf.etag)
  if (localE && cloudE && localE.toLowerCase() === cloudE) return true
  const st = fs.statSync(localPath)
  if (cf.size != null && Number(cf.size) === st.size) {
    const cloudTs = cf.lastModified ? new Date(cf.lastModified).getTime() : 0
    if (!cloudTs || Math.abs(st.mtimeMs - cloudTs) < 5000) return true
  }
  return false
}

/**
 * @param {string} localDir
 * @param {Array<{key:string,size?:number,lastModified?:string|number,ETag?:string}>} cloudFiles
 * @param {number} mergeType
 */
function planSync(localDir, cloudFiles, mergeType = 0) {
  const base = path.resolve(localDir)
  const uploads = []
  const downloads = []
  const deletes = []
  const localDeletes = []
  const cloudMap = new Map()
  for (const f of cloudFiles || []) {
    if (!f || !f.key || String(f.key).endsWith('/')) continue
    cloudMap.set(String(f.key).replace(/^\//, ''), f)
  }
  const locals = walkLocal(base, base)

  for (const [key, cf] of cloudMap) {
    const localPath = path.join(base, ...key.split('/'))
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      if (sameContent(localPath, cf)) continue
      const st = fs.statSync(localPath)
      const cloudTs = cf.lastModified ? new Date(cf.lastModified).getTime() : 0
      if (st.mtimeMs > cloudTs) uploads.push({ path: localPath, key })
      else downloads.push({ key, localPath })
    } else if (mergeType === MERGE.coverCloud) {
      deletes.push({ key })
    } else {
      downloads.push({ key, localPath })
    }
  }

  for (const loc of locals) {
    if (cloudMap.has(loc.key)) continue
    if (mergeType === MERGE.coverLocal) localDeletes.push({ path: loc.path })
    else uploads.push({ path: loc.path, key: loc.key })
  }

  return {
    uploads,
    downloads,
    deletes,
    localDeletes,
    baseDir: base,
    stats: {
      local: locals.length,
      cloud: cloudMap.size,
      upload: uploads.length,
      download: downloads.length,
      deleteCloud: deletes.length,
      deleteLocal: localDeletes.length
    }
  }
}

function applyLocalDeletes(localDeletes) {
  for (const d of localDeletes || []) {
    try {
      if (fs.existsSync(d.path)) fs.renameSync(d.path, d.path + '.delete')
    } catch {}
  }
}

module.exports = { planSync, walkLocal, applyLocalDeletes, getLocalEtag, MERGE }
