/** 托盘上传 — 对齐原版 tray.brand / bucket_name / bucket_dir */
import { loadStore } from './store'
import { storagePut } from './cloud'

export async function getTrayConfig() {
  const data = await loadStore()
  return data.settings?.tray || null
}

function putPayload(tray, localPath, objectKey) {
  const k = tray.brand
  const ak = { access_key: tray.access_key, secret_key: tray.secret_key }
  if (k === 'aliyun') {
    return { row: ak, opts: { region: tray.region || 'oss-cn-hangzhou', bucket: tray.bucket_name, key: objectKey, localPath } }
  }
  if (k === 'tencent') {
    return { row: ak, opts: { Bucket: tray.bucket_name, Region: tray.region || 'ap-guangzhou', Key: objectKey, localPath } }
  }
  if (k === 'qiniu') {
    return { row: ak, opts: { bucket: tray.bucket_name, key: objectKey, localPath } }
  }
  if (k === 'qingstor') {
    return { row: ak, opts: { bucket: tray.bucket_name, zone: tray.region || 'pek3a', key: objectKey, localPath } }
  }
  // s3-like
  return {
    row: ak,
    opts: {
      region: tray.region || 'us-east-1',
      endpoint: tray.endpoint || undefined,
      forcePathStyle: ['minio', 'ks3', 'jd'].includes(k),
      bucket: tray.bucket_name,
      key: objectKey,
      localPath
    }
  }
}

export async function uploadTrayFiles(files, onProgress) {
  const tray = await getTrayConfig()
  if (!tray?.brand || !tray?.bucket_name || !tray?.access_key) {
    throw new Error('请先设置上传空间[设置->托盘上传位置]')
  }
  const dir = tray.bucket_dir ? String(tray.bucket_dir).replace(/^\/+|\/+$/g, '') + '/' : ''
  let ok = 0
  const total = files.length
  for (let i = 0; i < files.length; i++) {
    const f = files[i]
    const localPath = f.path || f.localPath
    const name = f.relativeKey || localPath.split(/[/\\]/).pop()
    const key = dir + name
    onProgress && onProgress(`${i + 1}/${total}`, key)
    if (window.akSync?.trayTitle) await window.akSync.trayTitle(`(${i + 1}/${total}) ${name}`)
    const { row, opts } = putPayload(tray, localPath, key)
    await storagePut(tray.brand, row, opts)
    ok++
  }
  if (window.akSync?.trayTitle) await window.akSync.trayTitle('')
  return { ok, total, tray }
}
