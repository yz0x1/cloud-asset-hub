/**
 * 热更新（对齐原版 electron-asar-hot-updater 思路）
 * version.json: { version, asar, force, notes }
 * 下载后写入 pending.json；apply 时替换 resources/app.asar 并 relaunch。
 */
const path = require('path')
const fs = require('fs')
const https = require('https')
const http = require('http')
const { app } = require('electron')

function pkg() {
  try { return require(path.join(__dirname, '../package.json')) }
  catch { return { version: '0.0.0', cdnPath: '' } }
}

function joinUrl(base, rel) {
  if (!rel) return base
  if (/^https?:\/\//i.test(rel)) return rel
  return String(base).replace(/\/+$/, '') + '/' + String(rel).replace(/^\/+/, '')
}

function fetchText(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume()
        return fetchText(joinUrl(url, res.headers.location), timeoutMs).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        res.resume()
        return reject(new Error('HTTP ' + res.statusCode))
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    const req = lib.get(url, { timeout: 120000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        try { fs.unlinkSync(dest) } catch {}
        return downloadFile(joinUrl(url, res.headers.location), dest, onProgress).then(resolve, reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        try { fs.unlinkSync(dest) } catch {}
        res.resume()
        return reject(new Error('HTTP ' + res.statusCode))
      }
      const total = Number(res.headers['content-length'] || 0)
      let got = 0
      res.on('data', (c) => {
        got += c.length
        if (onProgress && total) onProgress(Math.min(99, Math.floor((got / total) * 100)))
      })
      res.pipe(file)
      file.on('finish', () => {
        file.close(() => {
          if (onProgress) onProgress(100)
          resolve(dest)
        })
      })
    })
    req.on('error', (e) => {
      file.close()
      try { fs.unlinkSync(dest) } catch {}
      reject(e)
    })
  })
}

function cmpVer(a, b) {
  const pa = String(a).replace(/[^0-9.]/g, '').split('.').map(Number)
  const pb = String(b).replace(/[^0-9.]/g, '').split('.').map(Number)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

function updatesDir() {
  return path.join(app.getPath('userData'), 'updates')
}

function pendingPath() {
  return path.join(updatesDir(), 'pending.json')
}

function targetAsarPath() {
  // 打包后：.../resources/app.asar
  // 开发态：无 asar，返回 null（仅提示）
  if (!app.isPackaged) return null
  return path.join(process.resourcesPath, 'app.asar')
}

async function checkUpdate({ updateBaseUrl } = {}) {
  const meta = pkg()
  const base = (updateBaseUrl || meta.cdnPath || '').trim()
  if (!base) {
    return {
      ok: false,
      reason: 'NO_CDN',
      message: '未配置更新地址（settings.updateBaseUrl / package.cdnPath）',
      current: meta.version
    }
  }
  const infoUrl = joinUrl(base, 'version.json')
  const raw = await fetchText(infoUrl)
  let info
  try { info = JSON.parse(raw) } catch {
    throw new Error('version.json 解析失败')
  }
  const remote = info.version || info.name || ''
  const hasUpdate = remote && cmpVer(remote, meta.version) > 0
  return {
    ok: true,
    current: meta.version,
    remote,
    hasUpdate: !!hasUpdate,
    force: !!info.force,
    notes: info.notes || '',
    asarUrl: joinUrl(base, info.asar || info.url || 'app.asar'),
    infoUrl,
    packaged: app.isPackaged,
    targetAsar: targetAsarPath()
  }
}

async function downloadUpdate({ updateBaseUrl, asarUrl }, onProgress) {
  const check = await checkUpdate({ updateBaseUrl })
  if (!check.ok) return check
  if (!check.hasUpdate && !check.force) {
    return { ...check, downloaded: false, message: '已是最新版本' }
  }
  const url = asarUrl || check.asarUrl
  const dir = updatesDir()
  fs.mkdirSync(dir, { recursive: true })
  const dest = path.join(dir, `app-${check.remote || Date.now()}.asar`)
  await downloadFile(url, dest, onProgress)
  const pending = {
    version: check.remote,
    asarPath: dest,
    downloadedAt: Date.now()
  }
  fs.writeFileSync(pendingPath(), JSON.stringify(pending, null, 2))
  return {
    ...check,
    downloaded: true,
    asarPath: dest,
    message: app.isPackaged
      ? '更新包已下载，可点击「应用并重启」自动替换 app.asar'
      : '更新包已下载（开发模式无 asar，打包后可自动替换）'
  }
}

function getPending() {
  try { return JSON.parse(fs.readFileSync(pendingPath(), 'utf8')) }
  catch { return null }
}

function clearPending() {
  try { fs.unlinkSync(pendingPath()) } catch {}
}

/**
 * 替换 resources/app.asar 并重启。
 * Windows 上当前进程占用 asar 时，先写到 app.asar.new，再写 bat 启动脚本在退出后替换。
 */
function applyPendingUpdate({ relaunch = true } = {}) {
  const pending = getPending()
  if (!pending?.asarPath || !fs.existsSync(pending.asarPath)) {
    return { ok: false, error: '无待应用更新包' }
  }
  const target = targetAsarPath()
  if (!target) {
    return {
      ok: false,
      error: '当前为开发模式，无法替换 asar。请使用 electron-builder 打包后再热更。',
      asarPath: pending.asarPath
    }
  }

  const bak = target + '.bak'
  const next = target + '.new'
  try {
    fs.copyFileSync(pending.asarPath, next)
  } catch (e) {
    return { ok: false, error: '复制更新包失败：' + e.message }
  }

  if (process.platform === 'win32') {
    // 退出后用 cmd 替换（避开文件锁）
    const bat = path.join(updatesDir(), 'apply-update.bat')
    const exe = process.execPath
    const lines = [
      '@echo off',
      'timeout /t 2 /nobreak >nul',
      `if exist "${bak}" del /f /q "${bak}"`,
      `if exist "${target}" move /y "${target}" "${bak}"`,
      `move /y "${next}" "${target}"`,
      `start "" "${exe}"`,
      `del /f /q "%~f0"`
    ]
    fs.writeFileSync(bat, lines.join('\r\n'), 'utf8')
    const { spawn } = require('child_process')
    spawn('cmd.exe', ['/c', bat], { detached: true, stdio: 'ignore' }).unref()
    clearPending()
    if (relaunch) {
      setTimeout(() => { app.exit(0) }, 300)
    }
    return { ok: true, mode: 'deferred-bat', message: '正在退出并替换 asar…' }
  }

  // mac/linux：尝试直接替换
  try {
    if (fs.existsSync(target)) fs.renameSync(target, bak)
    fs.renameSync(next, target)
  } catch (e) {
    return { ok: false, error: '替换 asar 失败：' + e.message }
  }
  clearPending()
  if (relaunch) {
    app.relaunch()
    app.exit(0)
  }
  return { ok: true, mode: 'direct', message: '已替换并准备重启' }
}

/** 启动时：若存在未清掉的 .new，尝试落盘（罕见） */
function tryRecoverNewAsar() {
  const target = targetAsarPath()
  if (!target) return
  const next = target + '.new'
  if (!fs.existsSync(next)) return
  try {
    if (fs.existsSync(target)) fs.renameSync(target, target + '.bak')
    fs.renameSync(next, target)
  } catch {}
}

module.exports = {
  checkUpdate, downloadUpdate, getPending, clearPending,
  applyPendingUpdate, tryRecoverNewAsar, pkg, targetAsarPath
}
