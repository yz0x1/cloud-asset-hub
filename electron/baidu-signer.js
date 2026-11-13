/**
 * 百度智能云 BCE Auth v1 签名
 * 文档：https://cloud.baidu.com/doc/Reference/s/njwvz1yfu
 * IAM：iam.bj.baidubce.com
 * BCC：bcc.{region}.baidubce.com / bcc.baidubce.com（全局地域）
 */
const crypto = require('crypto')
const https = require('https')
const { URL } = require('url')

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data || '', 'utf8').digest('hex')
}
function hmacHex(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex')
}
function uriEncode(str, encodeSlash) {
  return encodeURIComponent(String(str ?? ''))
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/gi, encodeSlash ? '%2F' : '/')
}

function utcISO(d = new Date()) {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function canonicalUri(path) {
  if (!path) return '/'
  const parts = path.split('/').map(p => uriEncode(p, true))
  let out = parts.join('/')
  if (!out.startsWith('/')) out = '/' + out
  return out
}

function canonicalQuery(query) {
  const keys = Object.keys(query || {}).filter(k => k.toLowerCase() !== 'authorization').sort()
  return keys.map(k => `${uriEncode(k, true)}=${uriEncode(query[k], true)}`).join('&')
}

function sign({
  accessKey, secretKey, method = 'GET', host, path = '/', query = {},
  headers = {}, body = '', expireSeconds = 1800
}) {
  const methodU = String(method || 'GET').toUpperCase()
  const timestamp = utcISO()
  const authPrefix = `bce-auth-v1/${accessKey}/${timestamp}/${expireSeconds}`
  const hdr = {
    host,
    'content-type': headers['content-type'] || headers['Content-Type'] || 'application/json',
    'x-bce-date': timestamp,
    ...headers
  }
  // 默认只签 host（官方允许）；带上 x-bce-date 更稳
  const signedHeaderNames = ['host', 'x-bce-date'].sort()
  const canonicalHeaders = signedHeaderNames
    .map(n => {
      const raw = Object.entries(hdr).find(([k]) => k.toLowerCase() === n)?.[1]
      return `${n}:${uriEncode(String(raw || '').trim(), true)}`
    })
    .join('\n')
  const canonicalRequest = [
    methodU,
    canonicalUri(path),
    canonicalQuery(query),
    canonicalHeaders
  ].join('\n')
  const signingKey = hmacHex(secretKey, authPrefix)
  const signature = hmacHex(signingKey, canonicalRequest)
  hdr.Authorization = `${authPrefix}/${signedHeaderNames.join(';')}/${signature}`
  return hdr
}

function request({
  accessKey, secretKey, method = 'GET', host, path = '/', query = {}, body = ''
}) {
  const bodyStr = typeof body === 'string' ? body : (body ? JSON.stringify(body) : '')
  // 解码已编码 path 再统一 canonical，避免 encodeURIComponent 后二次编码
  let rawPath = path || '/'
  try { rawPath = decodeURIComponent(path) } catch { rawPath = path || '/' }
  const encPath = canonicalUri(rawPath)
  const headers = sign({
    accessKey, secretKey, method, host, path: rawPath, query,
    headers: { 'content-type': 'application/json' },
    body: bodyStr
  })
  const qs = canonicalQuery(query)
  const fullPath = qs ? `${encPath}?${qs}` : encPath

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: fullPath,
      method: String(method).toUpperCase(),
      headers: {
        ...headers,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      },
      timeout: 60000
    }, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
        if (res.statusCode >= 400) {
          const msg = json?.message || json?.code || `HTTP ${res.statusCode}`
          const e = new Error(msg)
          e.code = json?.code
          e.status = res.statusCode
          e.response = json
          return reject(e)
        }
        resolve(json)
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('百度云请求超时')) })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

async function iam(accessKey, secretKey, { method, path, query, body }) {
  return request({
    accessKey, secretKey, method, host: 'iam.bj.baidubce.com', path, query, body
  })
}

async function bcc(accessKey, secretKey, region, { method = 'GET', path, query, body }) {
  const host = region ? `bcc.${region}.baidubce.com` : 'bcc.baidubce.com'
  return request({ accessKey, secretKey, method, host, path, query, body })
}

module.exports = { request, iam, bcc, sign, uriEncode }
