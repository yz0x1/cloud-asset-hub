/**
 * 京东云 OpenAPI 签名（JDCLOUD2-HMAC-SHA256）
 * 文档：https://docs.jdcloud.com/cn/general/api/signature
 * IAM 全局：iam.jdcloud-api.com，签名 region 用 jdcloud-api
 * VM：vm.jdcloud-api.com /v1/regions/{regionId}/instances
 */
const crypto = require('crypto')
const https = require('https')
const { URL } = require('url')

const ALG = 'JDCLOUD2-HMAC-SHA256'
const TERM = 'jdcloud2_request'

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf || '').digest('hex')
}
function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}
function pad2(n) { return n < 10 ? '0' + n : '' + n }
function utcStamp(d = new Date()) {
  return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate())
    + 'T' + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z'
}
function escapePath(path) {
  let out = ''
  for (let i = 0; i < path.length; i++) {
    const c = path.charCodeAt(i)
    const ch = path[i]
    if (
      (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57)
      || ch === '-' || ch === '.' || ch === '_' || ch === '~' || ch === '/'
    ) out += ch
    else out += '%' + c.toString(16).toUpperCase().padStart(2, '0')
  }
  return out || '/'
}
function canonicalQuery(qs) {
  if (!qs || !Object.keys(qs).length) return ''
  const keys = Object.keys(qs).sort()
  return keys.map(k => {
    const v = qs[k]
    const encK = encodeURIComponent(k).replace(/%20/g, '%20')
    const encV = encodeURIComponent(v == null ? '' : String(v)).replace(/%20/g, '%20')
    return `${encK}=${encV}`
  }).join('&').replace(/\+/g, '%20')
}

function resolveHost(service) {
  return `${String(service).toLowerCase()}.jdcloud-api.com`
}
function resolveSignRegion(region) {
  const r = String(region || '').trim()
  return r || 'jdcloud-api'
}

function request({
  accessKey, secretKey, service, region = '', method = 'GET',
  version = 'v1', path = '/', query = {}, body = '', sessionToken
}) {
  const host = resolveHost(service)
  const signRegion = resolveSignRegion(region)
  const methodU = String(method || 'GET').toUpperCase()
  const reqPath = escapePath(('/' + version + '/' + String(path || '').replace(/^\/+/, '')).replace(/\/+/g, '/'))
  const bodyBuf = Buffer.from(body || '', 'utf8')
  const payloadHash = sha256Hex(bodyBuf)
  const xDate = utcStamp()
  const nonce = crypto.randomUUID ? crypto.randomUUID() : ('n-' + Date.now())
  const headers = {
    host,
    'content-type': 'application/json',
    'x-jdcloud-date': xDate,
    'x-jdcloud-nonce': nonce
  }
  if (sessionToken) headers['x-jdcloud-security-token'] = sessionToken

  const headerNames = Object.keys(headers).map(k => k.toLowerCase()).sort()
  const canonicalHeaders = headerNames.map(n => {
    const raw = Object.entries(headers).find(([k]) => k.toLowerCase() === n)?.[1]
    return `${n}:${String(raw).trim()}`
  }).join('\n') + '\n'
  const signedHeaders = headerNames.join(';')
  const canonicalRequest = [
    methodU, reqPath, canonicalQuery(query), canonicalHeaders, signedHeaders, payloadHash
  ].join('\n')

  const shortDate = xDate.slice(0, 8)
  const scope = `${shortDate}/${signRegion}/${String(service).toLowerCase()}/${TERM}`
  const stringToSign = [ALG, xDate, scope, sha256Hex(canonicalRequest)].join('\n')
  const kDate = hmac('JDCLOUD2' + secretKey, shortDate)
  const kRegion = hmac(kDate, signRegion)
  const kService = hmac(kRegion, String(service).toLowerCase())
  const kSigning = hmac(kService, TERM)
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')
  headers.Authorization = `${ALG} Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const qs = canonicalQuery(query)
  const fullPath = qs ? `${reqPath}?${qs}` : reqPath

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: fullPath,
      method: methodU,
      headers: {
        ...headers,
        'Content-Length': bodyBuf.length
      },
      timeout: 60000
    }, (res) => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = text ? JSON.parse(text) : {} } catch { json = { raw: text } }
        if (res.statusCode >= 400 || json?.error) {
          const err = json?.error || {}
          const e = new Error(err.message || json?.message || `HTTP ${res.statusCode}`)
          e.code = err.code
          e.status = res.statusCode
          e.response = json
          return reject(e)
        }
        resolve(json)
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('京东云请求超时')) })
    if (bodyBuf.length) req.write(bodyBuf)
    req.end()
  })
}

async function iam(accessKey, secretKey, { method, path, query, body }) {
  return request({
    accessKey, secretKey, service: 'iam', region: '',
    method, version: 'v1', path, query, body: body ? JSON.stringify(body) : ''
  })
}

async function vm(accessKey, secretKey, region, { method = 'GET', path, query, body }) {
  return request({
    accessKey, secretKey, service: 'vm', region,
    method, version: 'v1', path, query, body: body ? JSON.stringify(body) : ''
  })
}

module.exports = { request, iam, vm, resolveHost, escapePath }
