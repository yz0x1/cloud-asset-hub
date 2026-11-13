/**
 * 火山引擎 OpenAPI 签名（HMAC-SHA256）
 * 文档：https://docs.volcengine.com/docs/api-signature-call-guide/signature-method
 *
 * 约定：
 * - Action / Version 放 Query
 * - 签名放 Header（X-Date + Authorization）
 * - IAM 全局服务：iam.volcengineapi.com / Region=cn-beijing / Service=iam
 * - ECS：ecs.{region}.volcengineapi.com / Service=ecs / Version=2020-04-01
 */
const crypto = require('crypto')
const https = require('https')
const { URL } = require('url')

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data || '', 'utf8').digest('hex')
}

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function hmacHex(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex')
}

function pad2(n) {
  return n < 10 ? '0' + n : '' + n
}

function utcNow() {
  const d = new Date()
  return {
    xDate:
      d.getUTCFullYear() +
      pad2(d.getUTCMonth() + 1) +
      pad2(d.getUTCDate()) +
      'T' +
      pad2(d.getUTCHours()) +
      pad2(d.getUTCMinutes()) +
      pad2(d.getUTCSeconds()) +
      'Z',
    shortDate:
      d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate())
  }
}

/** 火山官方 URI 编码：空格为 %20，不编码 -_.~ */
function uriEncode(str, encodeSlash) {
  return encodeURIComponent(String(str ?? ''))
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/gi, encodeSlash ? '%2F' : '/')
}

function flattenParams(obj, prefix = '', out = {}) {
  if (obj == null) return out
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => {
      const key = prefix ? `${prefix}.${i + 1}` : String(i + 1)
      if (v != null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
        flattenParams(v, key, out)
      } else if (Array.isArray(v)) {
        flattenParams(v, key, out)
      } else if (v !== undefined && v !== null) {
        out[key] = String(v)
      }
    })
    return out
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v == null) continue
      if (Array.isArray(v) || (typeof v === 'object' && !(v instanceof Date))) {
        flattenParams(v, key, out)
      } else {
        out[key] = String(v)
      }
    }
    return out
  }
  if (prefix) out[prefix] = String(obj)
  return out
}

function canonicalQuery(params) {
  const keys = Object.keys(params).sort()
  return keys
    .map((k) => `${uriEncode(k, true)}=${uriEncode(params[k], true)}`)
    .join('&')
}

function signHeaders({
  method,
  host,
  path,
  query,
  headers,
  body,
  region,
  service,
  accessKeyId,
  secretKey,
  sessionToken
}) {
  const { xDate, shortDate } = utcNow()
  const payloadHash = sha256Hex(body || '')
  const hdr = {
    host,
    'x-date': xDate,
    'x-content-sha256': payloadHash,
    ...(headers || {})
  }
  if (sessionToken) hdr['x-security-token'] = sessionToken

  const signedHeaderKeys = Object.keys(hdr)
    .map((k) => k.toLowerCase())
    .sort()
  const canonicalHeaders = signedHeaderKeys
    .map((k) => {
      const raw = Object.entries(hdr).find(([hk]) => hk.toLowerCase() === k)?.[1]
      return `${k}:${String(raw).trim().replace(/\s+/g, ' ')}\n`
    })
    .join('')
  const signedHeaders = signedHeaderKeys.join(';')
  const canonicalRequest = [
    (method || 'GET').toUpperCase(),
    path || '/',
    canonicalQuery(query || {}),
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')

  const credentialScope = `${shortDate}/${region}/${service}/request`
  const stringToSign = [
    'HMAC-SHA256',
    xDate,
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n')

  const kDate = hmac(secretKey, shortDate)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  const kSigning = hmac(kService, 'request')
  const signature = hmacHex(kSigning, stringToSign)

  hdr.Authorization =
    `HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`

  return hdr
}

function request({
  accessKeyId,
  secretKey,
  sessionToken,
  method = 'GET',
  host,
  path = '/',
  region,
  service,
  action,
  version,
  params = {},
  body = '',
  contentType
}) {
  const flat = flattenParams({
    Action: action,
    Version: version,
    ...params
  })
  const qs = canonicalQuery(flat)
  const headers = signHeaders({
    method,
    host,
    path,
    query: flat,
    headers: contentType ? { 'content-type': contentType } : {},
    body: body || '',
    region,
    service,
    accessKeyId,
    secretKey,
    sessionToken
  })

  const urlPath = qs ? `${path}?${qs}` : path
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: host,
        path: urlPath,
        method: method.toUpperCase(),
        headers: {
          ...headers,
          ...(body
            ? { 'Content-Length': Buffer.byteLength(body || '', 'utf8') }
            : {})
        },
        timeout: 60000
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let json = null
          try {
            json = JSON.parse(text)
          } catch {
            json = { raw: text }
          }
          const meta = json?.ResponseMetadata
          const err = meta?.Error
          if (err || (res.statusCode && res.statusCode >= 400)) {
            const msg =
              err?.Message ||
              err?.Code ||
              json?.Message ||
              `HTTP ${res.statusCode}`
            const e = new Error(msg)
            e.code = err?.Code
            e.status = res.statusCode
            e.response = json
            return reject(e)
          }
          resolve(json)
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('火山引擎请求超时'))
    })
    if (body) req.write(body)
    req.end()
  })
}

/** IAM 全局 */
async function iam(accessKeyId, secretKey, action, params = {}, sessionToken) {
  return request({
    accessKeyId,
    secretKey,
    sessionToken,
    method: 'GET',
    host: 'iam.volcengineapi.com',
    region: 'cn-beijing',
    service: 'iam',
    action,
    version: '2018-01-01',
    params
  })
}

/** ECS 区域服务 */
async function ecs(accessKeyId, secretKey, region, action, params = {}, sessionToken) {
  const rid = region || 'cn-beijing'
  return request({
    accessKeyId,
    secretKey,
    sessionToken,
    method: 'GET',
    host: `ecs.${rid}.volcengineapi.com`,
    region: rid,
    service: 'ecs',
    action,
    version: '2020-04-01',
    params
  })
}

module.exports = {
  request,
  iam,
  ecs,
  flattenParams,
  uriEncode
}
