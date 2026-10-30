function accountPayload(account, extra = {}) {
  return {
    base_url: account.base_url,
    api_key: account.api_key,
    organization: account.organization || '',
    model: account.model || '',
    ...extra
  }
}

function unwrap(res) {
  if (!res) throw new Error('AI 桥未就绪，请在 Electron 中运行')
  if (res.ok === false) throw new Error(res.error || '请求失败')
  return res.data
}

function newRequestId(prefix = 'ai') {
  return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

/** 前端兜底超时，避免主进程卡住时按钮一直转圈 */
function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(label || (`请求超时（${Math.round(ms / 1000)}s）`))), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

export async function listModels(account, { requestId } = {}) {
  if (!window.akAi?.listModels) throw new Error('AI 桥未就绪，请在 Electron 中运行')
  const request_id = requestId || newRequestId('models')
  return unwrap(await withTimeout(
    window.akAi.listModels(accountPayload(account, { request_id })),
    35000,
    '获取模型列表超时（35s），请检查 Base URL / 网络'
  ))
}

export async function chatCompletions(account, { model, messages, temperature, requestId } = {}) {
  if (!window.akAi?.chat) throw new Error('AI 桥未就绪，请在 Electron 中运行')
  const request_id = requestId || newRequestId('chat')
  return unwrap(await withTimeout(
    window.akAi.chat(accountPayload(account, {
      model: model || account.model,
      messages,
      temperature,
      request_id
    })),
    65000,
    '试调请求超时（65s）。常见原因：Base URL 不可达、需代理、或中转站卡住'
  ))
}

export async function probeAccount(account, { requestId } = {}) {
  if (!window.akAi?.probe) throw new Error('AI 桥未就绪，请在 Electron 中运行')
  const request_id = requestId || newRequestId('probe')
  return unwrap(await withTimeout(
    window.akAi.probe(accountPayload(account, { request_id })),
    70000,
    '探测超时（70s），请检查 Base URL / 网络'
  ))
}

export async function abortAiRequest(requestId) {
  if (!requestId || !window.akAi?.abort) return false
  const r = await window.akAi.abort(requestId)
  return !!(r && r.aborted)
}

export function createAiRequestId(prefix) {
  return newRequestId(prefix)
}

export function maskKey(s) {
  const t = String(s || '')
  if (t.length <= 8) return t ? '****' : ''
  return t.slice(0, 4) + '****' + t.slice(-4)
}

/** 轻量校验 Base URL */
export function validateBaseUrl(url) {
  const u = String(url || '').trim()
  if (!u) return '请填写 Base URL'
  if (!/^https?:\/\//i.test(u)) return 'Base URL 需以 http:// 或 https:// 开头'
  if (/\/chat\/completions\/?$/i.test(u)) return 'Base URL 不要带 /chat/completions，填到 /v1 即可'
  return ''
}
