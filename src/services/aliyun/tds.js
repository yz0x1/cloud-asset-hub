import { aliRequest } from './rpc'

const EP = 'https://tds.aliyuncs.com'
const VER = '2018-12-03'

function base(ak, sk) {
  return { accessKeyId: ak, accessKeySecret: sk, endpoint: EP, apiVersion: VER }
}

export function createTdsClientAli(accessKeyId, accessKeySecret) {
  return { accessKeyId, accessKeySecret }
}

export function DescribeSuspEvents(client, page = {}) {
  return aliRequest({
    ...base(client.accessKeyId, client.accessKeySecret),
    action: 'DescribeSuspEvents',
    params: { CurrentPage: page.CurrentPage || 1, PageSize: page.PageSize || 20, ...page },
    options: { timeout: 50000 }
  })
}

export function aliHandleSecurityEvents(client, params) {
  return aliRequest({
    ...base(client.accessKeyId, client.accessKeySecret),
    action: 'HandleSecurityEvents',
    params
  })
}

export function aliDescribeNoticeConfig(client) {
  return aliRequest({
    ...base(client.accessKeyId, client.accessKeySecret),
    action: 'DescribeNoticeConfig',
    params: {}
  })
}

export function aliModifyNoticeConfig(client, params) {
  return aliRequest({
    ...base(client.accessKeyId, client.accessKeySecret),
    action: 'ModifyNoticeConfig',
    params
  })
}

export async function oneClickCloseAlarms(accessKeyId, accessKeySecret, operationCode = 'ignore', onProgress) {
  const client = createTdsClientAli(accessKeyId, accessKeySecret)
  const pageSize = 50
  let current = 1
  const closed = []
  const failed = []
  for (;;) {
    const res = await DescribeSuspEvents(client, { CurrentPage: current, PageSize: pageSize })
    const events = res.SuspEvents || []
    const total = res.TotalCount || 0
    onProgress && onProgress({ current, total, pageCount: events.length })
    if (!events.length) break
    const pending = events.filter((e) => {
      const st = e.EventStatus ?? e.Status
      return st == 1 || e.Dealed === 'N' || e.Dealed === false
    })
    const pool = pending.length ? pending : events
    const ids = pool
      .map((e) => {
        const id = e.SecurityEventIds ?? e.SecurityEventId
        return id == null || id === '' ? '' : String(id)
      })
      .filter(Boolean)
    if (ids.length) {
      try {
        await aliHandleSecurityEvents(client, { OperationCode: operationCode, SecurityEventIds: ids })
        closed.push(...ids)
      } catch {
        for (const id of ids) {
          try {
            await aliHandleSecurityEvents(client, { OperationCode: operationCode, SecurityEventIds: [id] })
            closed.push(id)
          } catch (e2) {
            failed.push({ id, error: String(e2.message || e2) })
          }
        }
      }
    }
    if (current * pageSize >= total) break
    current += 1
  }
  return { closed, failed }
}

/**
 * 批量修改通知配置。
 * @param {object} opts
 * @param {number} opts.route - Route 目标值（0=关闭，1/2/4/…/7 见 NOTICE_ROUTES）
 * @param {number|null|undefined} opts.timeLimit - 若传入则一并改 TimeLimit；null/undefined 表示保持原值
 * @param {string[]|null} opts.projects - 仅改这些 Project；空/null 表示全部
 */
export async function batchModifyNotices(accessKeyId, accessKeySecret, opts = {}) {
  const route = opts.route == null ? 0 : Number(opts.route)
  const timeLimit = opts.timeLimit
  const projectSet = opts.projects?.length
    ? new Set(opts.projects.map(String))
    : null
  const client = createTdsClientAli(accessKeyId, accessKeySecret)
  const res = await aliDescribeNoticeConfig(client)
  let list = res.NoticeConfigList || []
  if (projectSet) {
    list = list.filter((item) => projectSet.has(String(item.Project || item.project)))
  }
  const results = []
  for (const item of list) {
    try {
      const payload = { ...item, Route: route }
      if (timeLimit !== null && timeLimit !== undefined && timeLimit !== '') {
        payload.TimeLimit = Number(timeLimit)
      }
      await aliModifyNoticeConfig(client, payload)
      results.push({ ok: true, project: item.Project || item.project })
    } catch (e) {
      results.push({ ok: false, project: item.Project || item.project, error: String(e.message || e) })
    }
  }
  return results
}

/** @deprecated 兼容旧调用，等价于 batchModifyNotices(..., { route }) */
export async function oneClickMuteNotices(accessKeyId, accessKeySecret, route = 0) {
  return batchModifyNotices(accessKeyId, accessKeySecret, { route })
}
