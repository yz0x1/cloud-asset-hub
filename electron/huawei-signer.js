/**
 * 华为云 APIG Signer — 对齐原版 renderer 内 Signer / HttpRequest
 * 关键修复：CanonicalURI 必须带尾部 `/`，否则鉴权失败被误报「aksk无效」
 */
const crypto = require('crypto')
const https = require('https')
const { URL } = require('url')

const ALG = 'SDK-HMAC-SHA256'
const HDR_DATE = 'X-Sdk-Date'
const HDR_CONTENT_SHA = 'x-sdk-content-sha256'

const hexTable = []
for (let i = 0; i < 256; i++) {
  hexTable[i] = '%' + ((i < 16 ? '0' : '') + i.toString(16)).toUpperCase()
}
// 与原版 noEscape 表一致：- . _ ~ 0-9 A-Z a-z
const noEscape = [
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1,
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0
]

function urlEncode(str) {
  if (typeof str !== 'string') str = String(str == null ? '' : str)
  let out = ''
  let last = 0
  for (let i = 0; i < str.length; ++i) {
    let c = str.charCodeAt(i)
    if (c < 0x80) {
      if (noEscape[c] === 1) continue
      if (last < i) out += str.slice(last, i)
      last = i + 1
      out += hexTable[c]
      continue
    }
    if (last < i) out += str.slice(last, i)
    if (c < 0x800) {
      last = i + 1
      out += hexTable[0xC0 | (c >> 6)] + hexTable[0x80 | (c & 0x3F)]
      continue
    }
    if (c < 0xD800 || c >= 0xE000) {
      last = i + 1
      out += hexTable[0xE0 | (c >> 12)] +
        hexTable[0x80 | ((c >> 6) & 0x3F)] +
        hexTable[0x80 | (c & 0x3F)]
      continue
    }
    ++i
    if (i >= str.length) throw new Error('ERR_INVALID_URI')
    const c2 = str.charCodeAt(i) & 0x3FF
    last = i + 1
    c = 0x10000 + (((c & 0x3FF) << 10) | c2)
    out += hexTable[0xF0 | (c >> 18)] +
      hexTable[0x80 | ((c >> 12) & 0x3F)] +
      hexTable[0x80 | ((c >> 6) & 0x3F)] +
      hexTable[0x80 | (c & 0x3F)]
  }
  if (last === 0) return str
  if (last < str.length) return out + str.slice(last)
  return out
}

function hashHex(data) {
  return crypto.createHash('sha256').update(data || '', 'utf8').digest('hex')
}
function hmacHex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex')
}
function pad2(n) { return n >= 10 ? '' + n : '0' + n }

function sdkDateNow() {
  const e = new Date()
  return '' + e.getUTCFullYear() + pad2(e.getUTCMonth() + 1) + pad2(e.getUTCDate()) +
    'T' + pad2(e.getUTCHours()) + pad2(e.getUTCMinutes()) + pad2(e.getUTCSeconds()) + 'Z'
}

/** 原版 CanonicalURI：分段 encode，且强制尾部 `/` */
function canonicalURI(uri) {
  const parts = String(uri || '/').split('/')
  const enc = parts.map(p => urlEncode(p))
  let o = enc.join('/')
  if (o[o.length - 1] !== '/') o += '/'
  return o
}

function canonicalQuery(query) {
  const keys = Object.keys(query || {}).sort()
  const a = []
  for (const k of keys) {
    const ek = urlEncode(k)
    const v = query[k]
    if (Array.isArray(v)) {
      const arr = [...v].sort()
      for (const item of arr) a.push(ek + '=' + urlEncode(item))
    } else {
      a.push(ek + '=' + urlEncode(v))
    }
  }
  return a.join('&')
}

function signedHeaderNames(headers) {
  return Object.keys(headers).map(k => k.toLowerCase()).sort()
}

function findHeader(headers, name) {
  const n = name.toLowerCase()
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === n) return headers[k]
  }
  return null
}

function canonicalRequest(req, signedNames) {
  let payloadHash = findHeader(req.headers, HDR_CONTENT_SHA)
  if (payloadHash == null) payloadHash = hashHex(req.body || '')
  const lower = {}
  for (const k of Object.keys(req.headers)) lower[k.toLowerCase()] = req.headers[k]
  const lines = signedNames.map(n => n + ':' + String(lower[n]).trim())
  return [
    req.method,
    canonicalURI(req.uri),
    canonicalQuery(req.query),
    lines.join('\n') + '\n',
    signedNames.join(';'),
    payloadHash
  ].join('\n')
}

function stringToSign(canonReq, date) {
  return [ALG, date, hashHex(canonReq)].join('\n')
}

/**
 * @param {{ method: string, host: string, uri: string, query?: object, headers?: object, body?: string }} req
 * @param {string} ak
 * @param {string} sk
 * @returns {{ hostname: string, path: string, method: string, headers: object }}
 */
function signRequest(req, ak, sk) {
  const headers = { ...(req.headers || {}) }
  let date = findHeader(headers, HDR_DATE)
  if (date == null) {
    date = sdkDateNow()
    headers[HDR_DATE] = date
  }
  // 非写方法清空 body（对齐原版）
  let body = req.body || ''
  const m = (req.method || 'GET').toUpperCase()
  if (m !== 'PUT' && m !== 'PATCH' && m !== 'POST') body = ''

  if (findHeader(headers, 'host') == null) headers.host = req.host

  const signedReq = {
    method: m,
    host: req.host,
    uri: req.uri || '/',
    query: req.query || {},
    headers,
    body
  }
  const names = signedHeaderNames(headers)
  const sig = hmacHex(sk, stringToSign(canonicalRequest(signedReq, names), date))
  headers.Authorization = `${ALG} Access=${ak}, SignedHeaders=${names.join(';')}, Signature=${sig}`

  const qs = canonicalQuery(signedReq.query)
  const path = encodeURI(signedReq.uri) + (qs ? ('?' + qs) : '')
  return {
    hostname: req.host,
    path,
    method: m,
    headers
  }
}

function parseUrlLike(url) {
  // 兼容 https://host/path?q=1 与 host/path?q=1
  let t = String(url || '')
  const scheme = t.indexOf('://')
  if (scheme !== -1) t = t.slice(scheme + 3)
  const query = {}
  const qIdx = t.indexOf('?')
  if (qIdx !== -1) {
    const raw = t.slice(qIdx + 1)
    t = t.slice(0, qIdx)
    for (const part of raw.split('&')) {
      if (!part) continue
      const eq = part.indexOf('=')
      let k, v
      if (eq >= 0) { k = part.slice(0, eq); v = part.slice(eq + 1) }
      else { k = part; v = '' }
      if (!k) continue
      k = decodeURI(k); v = decodeURI(v)
      if (query[k] === undefined) query[k] = [v]
      else query[k].push(v)
    }
  }
  const slash = t.indexOf('/')
  let host, uri
  if (slash === -1) { host = t; uri = '/' }
  else { host = t.slice(0, slash); uri = decodeURI(t.slice(slash)) }
  return { host, uri, query }
}

function request({ ak, sk, method, url, headers = {}, body = '', domainId }) {
  return new Promise((resolve, reject) => {
    const parsed = parseUrlLike(url)
    const h = { ...headers }
    if (domainId) h['X-Domain-Id'] = domainId
    if (!findHeader(h, 'Content-Type') && !findHeader(h, 'content-type')) {
      h['Content-Type'] = 'application/json'
    }
    const m = (method || 'GET').toUpperCase()
    const payload = (m === 'PUT' || m === 'PATCH' || m === 'POST') ? (body || '') : ''
    const opt = signRequest({
      method: m,
      host: parsed.host,
      uri: parsed.uri,
      query: parsed.query,
      headers: h,
      body: payload
    }, ak, sk)

    const req = https.request({
      hostname: opt.hostname,
      port: 443,
      path: opt.path,
      method: opt.method,
      headers: {
        ...opt.headers,
        'Content-Length': Buffer.byteLength(payload || '')
      }
    }, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        let parsedBody = data
        try { parsedBody = data ? JSON.parse(data) : data } catch {}
        resolve({ status: res.statusCode, data: parsedBody, raw: data })
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

module.exports = { request, signRequest, urlEncode, canonicalURI, canonicalQuery }
