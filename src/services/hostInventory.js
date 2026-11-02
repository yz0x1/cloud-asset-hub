import { CLOUD_VPS } from '@/constants/clouds'
import {
  createEcsClientAli, describeRegions, describeInstances
} from '@/services/aliyun/ecs'
import { tencentCvmRegions, tencentCvmInstances } from '@/services/cloud'

/** 进行中的拉取：同一资产不并发打两遍 */
const inflight = new Map()

/** 有限并发 map */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      out[i] = await fn(items[i], i)
    }
  }
  const n = Math.min(limit || 6, Math.max(items.length, 1))
  await Promise.all(Array.from({ length: n }, () => worker()))
  return out
}

/** 缓存只留展示/详情常用字段，避免把整包 ECS 写进 akmanage-data.json */
function slimAliInstance(i, rid) {
  return {
    InstanceId: i.InstanceId,
    InstanceName: i.InstanceName,
    Status: i.Status,
    Cpu: i.Cpu,
    Memory: i.Memory,
    OSName: i.OSName,
    StartTime: i.StartTime,
    ExpiredTime: i.ExpiredTime,
    RegionId: i.RegionId || rid,
    _RegionId: rid,
    PublicIpAddress: i.PublicIpAddress || null,
    EipAddress: i.EipAddress || null,
    InnerIpAddress: i.InnerIpAddress || null,
    InstanceType: i.InstanceType,
    ZoneId: i.ZoneId,
    CreationTime: i.CreationTime
  }
}

function slimTencentInstance(i, rid) {
  return {
    InstanceId: i.InstanceId,
    InstanceName: i.InstanceName || i.InstanceId,
    InstanceState: i.InstanceState,
    CPU: i.CPU,
    Memory: i.Memory,
    OsName: i.OsName,
    CreatedTime: i.CreatedTime,
    ExpiredTime: i.ExpiredTime,
    PublicIpAddresses: i.PublicIpAddresses || [],
    PrivateIpAddresses: i.PrivateIpAddresses || [],
    InstanceType: i.InstanceType,
    Region: i.Region || rid,
    _RegionId: rid
  }
}

export function supportsHostExpand(row) {
  return row?.name === CLOUD_VPS.alibaba.name || row?.name === CLOUD_VPS.tencent.name
}

/**
 * 拉取某 AK 下全地域有实例的分组
 * @param {object} row vps 资产
 * @param {{ concurrency?: number, onProgress?: (done:number,total:number)=>void, force?: boolean }} opts
 * @returns {Promise<{ groups: Array, fails: string[], total: number }>}
 */
export async function fetchHostGroups(row, opts = {}) {
  const key = String(row?.id || `${row?.name}:${row?.access_key || ''}`)
  if (!opts.force && inflight.has(key)) return inflight.get(key)

  const job = (async () => {
    const concurrency = opts.concurrency ?? 8
    const onProgress = opts.onProgress || (() => {})
    const fails = []
    const groups = []

    if (row.name === CLOUD_VPS.alibaba.name) {
      const c = createEcsClientAli(row.access_key, row.secret_key)
      const regRes = await describeRegions(c)
      const regs = regRes.Regions?.Region || []
      let done = 0
      onProgress(0, regs.length)
      const parts = await mapPool(regs, concurrency, async (reg) => {
        const rid = reg.RegionId
        try {
          const res = await describeInstances(c, { RegionId: rid, PageSize: 100 })
          const list = (res.Instances?.Instance || []).map(i => slimAliInstance(i, rid))
          return list.length
            ? { regionId: rid, localName: reg.LocalName || rid, list }
            : null
        } catch (e) {
          fails.push(`${rid}:${e.message || e}`)
          return null
        } finally {
          done += 1
          onProgress(done, regs.length)
        }
      })
      for (const g of parts) if (g) groups.push(g)
    } else if (row.name === CLOUD_VPS.tencent.name) {
      const regRes = await tencentCvmRegions(row)
      const regs = regRes.RegionSet || []
      let done = 0
      onProgress(0, regs.length)
      const parts = await mapPool(regs, concurrency, async (reg) => {
        const rid = reg.Region
        try {
          const res = await tencentCvmInstances(row, { region: rid, Limit: 100 })
          const list = (res.InstanceSet || []).map(i => slimTencentInstance(i, rid))
          return list.length
            ? { regionId: rid, localName: reg.RegionName || rid, list }
            : null
        } catch (e) {
          fails.push(`${rid}:${e.message || e}`)
          return null
        } finally {
          done += 1
          onProgress(done, regs.length)
        }
      })
      for (const g of parts) if (g) groups.push(g)
    } else {
      throw new Error('该厂商不支持主机明细')
    }

    const total = groups.reduce((n, g) => n + g.list.length, 0)
    return { groups, fails, total }
  })()

  inflight.set(key, job)
  try {
    return await job
  } finally {
    inflight.delete(key)
  }
}
