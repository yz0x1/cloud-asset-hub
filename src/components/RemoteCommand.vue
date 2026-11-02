<template>
  <div class="cmd-panel ak-panel">
    <div class="ak-panel-hd">
      <div>
        <h3>命令执行区</h3>
        <p class="sub">对齐原版云助手 / TAT</p>
      </div>
      <el-tag size="small" effect="plain" type="primary">阿里云 ECS · 腾讯云 TAT</el-tag>
    </div>
    <div class="ak-panel-bd">
    <el-form label-width="110px" class="cmd-form">
      <el-form-item label="资产">
        <el-select v-model="vpsId" style="width:260px" filterable @change="onVps">
          <el-option v-for="v in runnable" :key="v.id" :label="(v.as_name||v.name)+' / '+v.name" :value="v.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="current" label="加载区域">
        <el-select v-model="selRegions" multiple filterable collapse-tags style="width:420px" placeholder="不选则仅用下方手动地域">
          <el-option v-for="r in regions" :key="r.RegionId" :label="(r.LocalName||'')+' -- '+r.RegionId" :value="r.RegionId" />
        </el-select>
        <el-tooltip content="如果不选择，默认使用手动地域。可以选择部分区域加载，避免告警" placement="top">
          <el-button style="margin-left:8px" :loading="loading" @click="loadRegions">拉地域</el-button>
        </el-tooltip>
        <el-button :loading="loading" @click="loadInstances">拉主机</el-button>
      </el-form-item>
      <el-form-item label="地域">
        <el-input v-model="form.region" placeholder="cn-hangzhou / ap-guangzhou" style="width:200px" />
      </el-form-item>
      <el-form-item label="实例">
        <el-select v-model="form.instanceId" filterable allow-create style="width:360px" placeholder="实例ID">
          <el-option v-for="i in instances" :key="i.InstanceId" :label="(i.InstanceName||'')+' / '+i.InstanceId" :value="i.InstanceId" />
        </el-select>
      </el-form-item>
      <el-form-item label="脚本类型">
        <el-select v-model="form.system_key" style="width:200px">
          <el-option label="RunShellScript" value="RunShellScript" />
          <el-option label="RunPowerShellScript" value="RunPowerShellScript" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="isAli" label="命令回显">
        <el-radio-group v-model="form.isEcho">
          <el-radio :value="true">
            <el-tooltip content="注意开启后，将会被留存历史命令记录，无法删除，通过历史命令信息查看功能，可以看到信息。" placement="top">
              <span>是</span>
            </el-tooltip>
          </el-radio>
          <el-radio :value="false">
            <el-tooltip content="阿里默认为官方提供的RunCommand函数，无回显。可以在对应历史信息记录中查看到." placement="top">
              <span>否</span>
            </el-tooltip>
          </el-radio>
        </el-radio-group>
        <el-button style="margin-left:12px" @click="showHistory">历史命令信息查看</el-button>
      </el-form-item>
      <el-form-item label="等待秒">
        <el-input-number v-model="form.time" :min="1" :max="60" />
        <span class="hint">命令结果等待时间：有时执行命令会出现没有及时查询到结果</span>
      </el-form-item>
      <el-form-item label="命令">
        <el-input v-model="form.cmd" type="textarea" :rows="4" placeholder="请输入命令" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="loading" @click="run">执行命令</el-button>
        <el-button v-if="output" @click="cmdOutVisible=true">本次记录</el-button>
      </el-form-item>
    </el-form>
    <el-input v-if="output" v-model="output" type="textarea" :rows="10" style="margin-top:6px" readonly />

    <!-- 对齐原版：按区域展示主机明细 + 详细信息 -->
    <div v-if="regionGroups.length" class="inst-panel">
      <div class="inst-panel-hd">
        <h4>主机明细</h4>
        <span class="sub">共 {{ instances.length }} 台 · 点击行可填入上方「实例 / 地域」</span>
      </div>
      <div v-for="g in regionGroups" :key="g.regionId" class="region-block">
        <div class="table-regionId">
          <div class="title">
            区域名称: {{ g.localName }}
            <el-button
              v-if="isAli"
              size="small"
              type="primary"
              link
              @click="showHistoryForRegion(g.regionId)"
            >历史命令信息查看</el-button>
          </div>
        </div>
        <el-table
          :data="g.list"
          size="small"
          border
          stripe
          highlight-current-row
          style="width:100%"
          @row-click="pickInstance"
        >
          <el-table-column prop="InstanceId" label="实例id" min-width="180" show-overflow-tooltip />
          <el-table-column label="主机名称" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ hostName(row) }}</template>
          </el-table-column>
          <el-table-column label="公网ip" min-width="120">
            <template #default="{ row }">
              <div v-for="(ip, i) in publicIps(row)" :key="i">{{ ip }}</div>
              <span v-if="!publicIps(row).length" class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="主机配置" min-width="110" align="center">
            <template #default="{ row }">{{ hostSpec(row) }}</template>
          </el-table-column>
          <el-table-column label="系统版本" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">{{ osName(row) }}</template>
          </el-table-column>
          <el-table-column label="运行状态" width="100" align="center">
            <template #default="{ row }">{{ statusText(row) }}</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ createTime(row) }}</template>
          </el-table-column>
          <el-table-column label="结束时间" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ expireTime(row) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" type="primary" link @click.stop="jsonView(row)">详细信息</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <JsonViewer v-model="jsonVisible" title="详细信息" :data="jsonData" />
    <el-dialog v-model="histVisible" title="历史命令信息查看" width="720px">
      <el-alert type="info" :closable="false" style="margin-bottom:8px"
        title="注意此处命令记录不会保存本地，需要看去对应的服务器点击历史命令信息查看。" />
      <pre class="json">{{ histText }}</pre>
    </el-dialog>
    <el-dialog v-model="cmdOutVisible" title="命令回显" width="700px">
      <pre class="json">{{ output }}</pre>
    </el-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useVpsStore } from '@/stores/vps'
import { CLOUD_VPS } from '@/constants/clouds'
import JsonViewer from '@/components/JsonViewer.vue'
import {
  createEcsClientAli, describeRegions, describeInstances,
  aliCreateCommand, aliInvokeCommand, aliDescribeInvocationResults, aliDeleteCommand,
  aliDescribeCommands, aliDescribeInvocations, runCommand
} from '@/services/aliyun/ecs'
import { runRemoteCommand, tencentCvmRegions, tencentCvmInstances } from '@/services/cloud'

const store = useVpsStore()
const runnable = computed(() => store.list.filter(v =>
  v.name === CLOUD_VPS.alibaba.name || v.name === CLOUD_VPS.tencent.name))
const isAli = computed(() => current.value?.name === CLOUD_VPS.alibaba.name)
const isTencent = computed(() => current.value?.name === CLOUD_VPS.tencent.name)
const vpsId = ref('')
const current = ref(null)
const loading = ref(false)
const output = ref('')
const regions = ref([])
const selRegions = ref([])
const instances = ref([])
const histVisible = ref(false)
const histText = ref('')
const cmdOutVisible = ref(false)
const jsonVisible = ref(false)
const jsonData = ref(null)
const form = reactive({
  region: '',
  instanceId: '',
  system_key: 'RunShellScript',
  cmd: 'whoami',
  time: 3,
  isEcho: true
})

const regionNameMap = computed(() => {
  const m = {}
  for (const r of regions.value) m[r.RegionId] = r.LocalName || r.RegionId
  return m
})

const regionGroups = computed(() => {
  const map = new Map()
  for (const inst of instances.value) {
    const rid = inst._RegionId || form.region || 'unknown'
    if (!map.has(rid)) {
      map.set(rid, {
        regionId: rid,
        localName: regionNameMap.value[rid] || rid,
        list: []
      })
    }
    map.get(rid).list.push(inst)
  }
  return [...map.values()]
})

function hostName(row) {
  return row.InstanceName || row.Name || row.hostName || '—'
}
function publicIps(row) {
  if (isAli.value) {
    const arr = row.PublicIpAddress?.IpAddress
    const fromPub = Array.isArray(arr) ? arr.filter(Boolean) : []
    if (fromPub.length) return fromPub
    const eip = row.EipAddress?.IpAddress
    return eip ? [eip] : []
  }
  if (isTencent.value) {
    return Array.isArray(row.PublicIpAddresses) ? row.PublicIpAddresses.filter(Boolean) : []
  }
  if (row.PublicIpAddress) return [row.PublicIpAddress]
  return []
}
function hostSpec(row) {
  if (isAli.value) {
    const cpu = row.Cpu ?? '—'
    const mem = row.Memory ?? '—'
    return `${cpu}核${mem}MB`
  }
  if (isTencent.value) {
    const cpu = row.CPU ?? row.Cpu ?? '—'
    const mem = row.Memory ?? '—'
    return `${cpu}核${mem}G`
  }
  return '—'
}
function osName(row) {
  return row.OSName || row.OsName || '—'
}
function statusText(row) {
  return row.Status || row.InstanceState || row.State || '—'
}
function createTime(row) {
  return row.StartTime || row.CreatedTime || row.CreateTime || row.LaunchTime || '—'
}
function expireTime(row) {
  return row.ExpiredTime || row.ExpireTime || '—'
}

function pickInstance(row) {
  form.instanceId = row.InstanceId
  if (row._RegionId) form.region = row._RegionId
}
function jsonView(row) {
  jsonData.value = row
  jsonVisible.value = true
}

function onVps(id) {
  current.value = store.list.find(x => x.id === id)
  instances.value = []
  regions.value = []
  selRegions.value = []
  if (current.value?.name === CLOUD_VPS.tencent.name) form.region = form.region || 'ap-guangzhou'
  if (current.value?.name === CLOUD_VPS.alibaba.name) form.region = form.region || 'cn-hangzhou'
}

/** 资产列表展开区点选实例 → 填入本命令区 */
function selectTarget(vpsRow, instance) {
  if (!vpsRow || !instance) return
  vpsId.value = vpsRow.id
  current.value = vpsRow
  const rid = instance._RegionId || form.region
  if (rid) form.region = rid
  form.instanceId = instance.InstanceId
  if (!instances.value.some(i => i.InstanceId === instance.InstanceId)) {
    instances.value = [...instances.value, instance]
  }
}

defineExpose({ selectTarget })

async function loadRegions() {
  if (!current.value) return
  loading.value = true
  try {
    if (isAli.value) {
      const c = createEcsClientAli(current.value.access_key, current.value.secret_key)
      const res = await describeRegions(c)
      regions.value = res.Regions?.Region || []
    } else if (isTencent.value) {
      const res = await tencentCvmRegions(current.value)
      regions.value = (res.RegionSet || []).map(r => ({
        RegionId: r.Region,
        LocalName: r.RegionName || r.Region
      }))
    } else {
      return
    }
    ElMessage.success(`地域 ${regions.value.length}`)
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function loadInstances() {
  if (!current.value) return
  const regs = selRegions.value.length ? selRegions.value : (form.region ? [form.region] : [])
  if (!regs.length) return ElMessage.error('请填写地域或选择加载区域')
  loading.value = true
  const all = []
  try {
    if (isAli.value) {
      const c = createEcsClientAli(current.value.access_key, current.value.secret_key)
      for (const rid of regs) {
        try {
          const res = await describeInstances(c, { RegionId: rid, PageSize: 100 })
          const list = res.Instances?.Instance || []
          list.forEach(i => { i._RegionId = rid })
          all.push(...list)
        } catch {}
      }
    } else if (isTencent.value) {
      for (const rid of regs) {
        try {
          const res = await tencentCvmInstances(current.value, { region: rid, Limit: 100 })
          const list = res.InstanceSet || []
          list.forEach(i => {
            i._RegionId = rid
            if (!i.InstanceName) i.InstanceName = i.InstanceId
          })
          all.push(...list)
        } catch {}
      }
    } else {
      return
    }
    instances.value = all
    if (all[0] && !form.instanceId) {
      form.instanceId = all[0].InstanceId
      form.region = all[0]._RegionId || form.region
    }
    ElMessage.success(`主机数量：${all.length}`)
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function runAliEcho() {
  const row = current.value
  const c = createEcsClientAli(row.access_key, row.secret_key)
  const b64 = btoa(unescape(encodeURIComponent(form.cmd)))
  const created = await aliCreateCommand(c, {
    RegionId: form.region,
    Type: form.system_key,
    ContentEncoding: 'Base64',
    CommandContent: b64,
    Name: 'test-' + Date.now(),
    'InstanceId.1': form.instanceId
  })
  if (!created.CommandId) throw new Error('命令创建失败')
  await aliInvokeCommand(c, {
    RegionId: form.region,
    CommandId: created.CommandId,
    'InstanceId.1': form.instanceId
  })
  await new Promise(r => setTimeout(r, form.time * 1000))
  const res = await aliDescribeInvocationResults(c, {
    RegionId: form.region, PageSize: 10, PageNumber: 1
  })
  const list = res.Invocation?.InvocationResults?.InvocationResult || []
  let out = '命令：' + form.cmd + ' 区域名称：' + form.region + '\r\n'
  let ok = false
  for (const item of list) {
    if (item.CommandId === created.CommandId) {
      if (item.Output) {
        try { out += atob(item.Output) } catch { out += item.Output }
        ok = true
      } else {
        ElMessage.error('命令调用状态：还未执行完成，可以调整等待时间')
      }
    }
  }
  if (ok) {
    try {
      await aliDeleteCommand(c, { CommandId: created.CommandId, RegionId: form.region })
    } catch {
      ElMessage.error('删除创建命令失败！可能当前命令未执行完成')
    }
  }
  return out
}

async function runAliNoEcho() {
  const row = current.value
  const c = createEcsClientAli(row.access_key, row.secret_key)
  const b64 = btoa(unescape(encodeURIComponent(form.cmd)))
  const res = await runCommand(c, {
    RegionId: form.region,
    Type: form.system_key,
    ContentEncoding: 'Base64',
    CommandContent: b64,
    'InstanceId.1': form.instanceId,
    Name: 'run-' + Date.now()
  })
  return '命令：' + form.cmd + ' 区域名称：' + form.region + '\r\n' + JSON.stringify(res, null, 2)
}

async function showHistoryForRegion(regionId) {
  const rid = regionId || form.region
  if (!current.value || !rid) return ElMessage.error('请填写完整')
  if (!isAli.value) return ElMessage.warning('历史命令信息查看目前仅支持阿里云')
  loading.value = true
  try {
    const c = createEcsClientAli(current.value.access_key, current.value.secret_key)
    const cmds = await aliDescribeCommands(c, { RegionId: rid, PageSize: 50, PageNumber: 1 })
    const inv = await aliDescribeInvocations(c, { RegionId: rid, PageSize: 50, PageNumber: 1 })
    histText.value = JSON.stringify({ region: rid, commands: cmds, invocations: inv }, null, 2)
    histVisible.value = true
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function showHistory() {
  return showHistoryForRegion(form.region)
}

async function run() {
  if (!current.value || !form.instanceId || !form.cmd || !form.region) {
    return ElMessage.error('请填写完整')
  }
  loading.value = true
  output.value = ''
  try {
    if (current.value.name === CLOUD_VPS.alibaba.name) {
      output.value = form.isEcho ? await runAliEcho() : await runAliNoEcho()
      ElMessage.success('执行命令成功')
    } else {
      const r = await runRemoteCommand({
        access_key: current.value.access_key,
        secret_key: current.value.secret_key,
        region: form.region,
        instanceId: form.instanceId,
        cmd: form.cmd,
        commandType: form.system_key,
        waitMs: form.time * 1000
      })
      output.value = '命令：' + form.cmd + ' 区域名称：' + form.region + '\r\n' + (r.output || JSON.stringify(r, null, 2))
      ElMessage.success('执行命令成功')
    }
  } catch (e) {
    ElMessage.error('执行命令失败：' + e.message)
  } finally { loading.value = false }
}
</script>

<style scoped>
.cmd-panel { margin-top: 0; }
.cmd-form { max-width: 920px; }
.hint { margin-left: 10px; font-size: 12px; color: var(--muted); }
.muted { color: var(--muted); }
.json {
  background: #0f1724;
  color: #d7e2f2;
  border: 1px solid #1e2a3d;
  border-radius: 8px;
  padding: 12px 14px;
  max-height: 60vh;
  overflow: auto;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
}
.inst-panel {
  margin-top: 18px;
  border-top: 1px solid var(--border, #1e2a3d);
  padding-top: 14px;
}
.inst-panel-hd {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 10px;
}
.inst-panel-hd h4 {
  margin: 0;
  font-size: 15px;
}
.inst-panel-hd .sub {
  font-size: 12px;
  color: var(--muted);
}
.region-block { margin-bottom: 16px; }
.table-regionId {
  margin-bottom: 6px;
}
.table-regionId .title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #e8eef8);
}
:deep(.el-table) { cursor: pointer; }
</style>
