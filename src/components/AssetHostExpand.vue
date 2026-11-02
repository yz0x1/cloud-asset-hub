<template>
  <div class="host-expand">
    <template v-if="!supported">
      <div class="hint">当前厂商暂不支持在列表展开查看主机明细（仅阿里云 ECS / 腾讯云 CVM）。</div>
    </template>
    <template v-else>
      <div class="bar">
        <span class="meta">
          <template v-if="state.loading">
            正在拉取… {{ state.progressText || '' }}
          </template>
          <template v-else-if="state.loaded">
            共 {{ total }} 台
            <span v-if="fetchedAtText" class="cache"> · 缓存于 {{ fetchedAtText }}</span>
            <span v-if="state.error" class="warn">（部分地域失败）</span>
          </template>
          <template v-else>展开后自动查询；结果会缓存，再次展开不重拉</template>
        </span>
        <el-button size="small" :loading="state.loading" @click="load(true)">刷新主机</el-button>
      </div>

      <el-alert
        v-if="!state.loading && state.loaded && !groups.length"
        type="info"
        :closable="false"
        title="查询完成，未查询到可用主机。"
        style="margin-bottom:8px"
      />

      <div v-for="g in groups" :key="g.regionId" class="region-block">
        <div class="table-regionId">
          <div class="title">
            区域名称: {{ g.localName }}
            <el-button
              v-if="isAli"
              size="small"
              type="primary"
              link
              :loading="histLoading === g.regionId"
              @click="showHistory(g.regionId)"
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
          @row-click="(r) => emit('pick', r)"
        >
          <el-table-column prop="InstanceId" label="实例id" min-width="170" show-overflow-tooltip />
          <el-table-column label="主机名称" min-width="130" show-overflow-tooltip>
            <template #default="{ row: r }">{{ hostName(r) }}</template>
          </el-table-column>
          <el-table-column label="公网ip" min-width="110">
            <template #default="{ row: r }">
              <div v-for="(ip, i) in publicIps(r)" :key="i">{{ ip }}</div>
              <span v-if="!publicIps(r).length" class="muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="主机配置" min-width="100" align="center">
            <template #default="{ row: r }">{{ hostSpec(r) }}</template>
          </el-table-column>
          <el-table-column label="系统版本" min-width="130" show-overflow-tooltip>
            <template #default="{ row: r }">{{ osName(r) }}</template>
          </el-table-column>
          <el-table-column label="运行状态" width="96" align="center">
            <template #default="{ row: r }">{{ statusText(r) }}</template>
          </el-table-column>
          <el-table-column label="创建时间" min-width="140" show-overflow-tooltip>
            <template #default="{ row: r }">{{ createTime(r) }}</template>
          </el-table-column>
          <el-table-column label="结束时间" min-width="140" show-overflow-tooltip>
            <template #default="{ row: r }">{{ expireTime(r) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="96" align="center" fixed="right">
            <template #default="{ row: r }">
              <el-button size="small" type="primary" link @click.stop="jsonView(r)">详细信息</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>

    <JsonViewer v-model="jsonVisible" title="详细信息" :data="jsonData" />
    <el-dialog v-model="histVisible" title="历史命令信息查看" width="720px" append-to-body>
      <el-alert type="info" :closable="false" style="margin-bottom:8px"
        title="注意此处命令记录不会保存本地，需要看去对应的服务器点击历史命令信息查看。" />
      <pre class="json">{{ histText }}</pre>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CLOUD_VPS } from '@/constants/clouds'
import { useVpsStore } from '@/stores/vps'
import JsonViewer from '@/components/JsonViewer.vue'
import { supportsHostExpand, fetchHostGroups } from '@/services/hostInventory'
import {
  createEcsClientAli, aliDescribeCommands, aliDescribeInvocations
} from '@/services/aliyun/ecs'

const props = defineProps({
  row: { type: Object, required: true },
  active: { type: Boolean, default: false }
})
const emit = defineEmits(['pick'])
const store = useVpsStore()

const isAli = computed(() => props.row?.name === CLOUD_VPS.alibaba.name)
const isTencent = computed(() => props.row?.name === CLOUD_VPS.tencent.name)
const supported = computed(() => supportsHostExpand(props.row))

const state = reactive({
  loading: false,
  loaded: false,
  error: '',
  groups: [],
  fetchedAt: 0,
  progressText: ''
})
const groups = computed(() => state.groups)
const total = computed(() => state.groups.reduce((n, g) => n + g.list.length, 0))
const fetchedAtText = computed(() => {
  if (!state.fetchedAt) return ''
  const d = new Date(state.fetchedAt)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
})

const jsonVisible = ref(false)
const jsonData = ref(null)
const histVisible = ref(false)
const histText = ref('')
const histLoading = ref('')

function applyCache(row) {
  if (!row?.host_data || !Array.isArray(row.host_data)) return false
  state.groups = row.host_data
  state.fetchedAt = row.host_fetched_at || 0
  state.loaded = true
  state.error = ''
  return true
}

watch(
  () => [props.active, props.row?.id, props.row?.host_fetched_at],
  ([active]) => {
    if (!supported.value) return
    // 优先吃本地缓存（折叠再展开 / 组件重挂载都不重拉）
    if (applyCache(props.row)) return
    if (active && !state.loaded && !state.loading) load(false)
  },
  { immediate: true }
)

function hostName(r) {
  return r.InstanceName || r.Name || r.hostName || '—'
}
function publicIps(r) {
  if (isAli.value) {
    const arr = r.PublicIpAddress?.IpAddress
    const fromPub = Array.isArray(arr) ? arr.filter(Boolean) : []
    if (fromPub.length) return fromPub
    // 仅绑了 EIP、没有 PublicIpAddress 时
    const eip = r.EipAddress?.IpAddress
    return eip ? [eip] : []
  }
  if (isTencent.value) {
    return Array.isArray(r.PublicIpAddresses) ? r.PublicIpAddresses.filter(Boolean) : []
  }
  return r.PublicIpAddress ? [r.PublicIpAddress] : []
}
function hostSpec(r) {
  if (isAli.value) return `${r.Cpu ?? '—'}核${r.Memory ?? '—'}MB`
  if (isTencent.value) return `${r.CPU ?? r.Cpu ?? '—'}核${r.Memory ?? '—'}G`
  return '—'
}
function osName(r) { return r.OSName || r.OsName || '—' }
function statusText(r) { return r.Status || r.InstanceState || r.State || '—' }
function createTime(r) { return r.StartTime || r.CreatedTime || r.CreateTime || r.LaunchTime || '—' }
function expireTime(r) { return r.ExpiredTime || r.ExpireTime || '—' }

function jsonView(r) {
  jsonData.value = r
  jsonVisible.value = true
}

async function load(force) {
  if (!supported.value || !props.row) return
  if (state.loading) return
  if (!force && applyCache(props.row)) return
  if (!props.row.id) {
    ElMessage.error('资产缺少 id，请删除后重新添加')
    return
  }

  const firstFetch = !props.row.host_fetched_at
  state.loading = true
  state.error = ''
  state.progressText = ''
  try {
    const { groups: gs, fails, total: n } = await fetchHostGroups(props.row, {
      concurrency: 8,
      force: !!force,
      onProgress: (done, all) => {
        state.progressText = `${done}/${all} 地域`
      }
    })
    state.groups = gs
    state.loaded = true
    state.fetchedAt = Date.now()
    if (fails.length) state.error = fails.slice(0, 3).join('; ')

    // 持久化到资产行：再次展开 / 重启后可直接用
    await store.update({
      id: props.row.id,
      host_data: gs,
      host_count: n,
      host_fetched_at: state.fetchedAt
    })

    if (force || firstFetch) {
      ElMessage.success(n ? `主机数量：${n}` : '未查询到可用主机')
    }
  } catch (e) {
    state.error = e.message || String(e)
    ElMessage.error('拉取主机失败：' + state.error)
  } finally {
    state.loading = false
    state.progressText = ''
  }
}

async function showHistory(regionId) {
  if (!isAli.value || !props.row || !regionId) return
  histLoading.value = regionId
  try {
    const c = createEcsClientAli(props.row.access_key, props.row.secret_key)
    const cmds = await aliDescribeCommands(c, { RegionId: regionId, PageSize: 50, PageNumber: 1 })
    const inv = await aliDescribeInvocations(c, { RegionId: regionId, PageSize: 50, PageNumber: 1 })
    histText.value = JSON.stringify({ region: regionId, commands: cmds, invocations: inv }, null, 2)
    histVisible.value = true
  } catch (e) {
    ElMessage.error(e.message || String(e))
  } finally {
    histLoading.value = ''
  }
}

defineExpose({ load })
</script>

<style scoped>
.host-expand {
  padding: 8px 12px 14px;
  background: #f7f9fc;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.meta { font-size: 12px; color: var(--muted, #64748b); }
.cache { color: #64748b; }
.warn { color: #d97706; }
.hint {
  padding: 10px 4px;
  font-size: 12px;
  color: var(--muted, #64748b);
}
.region-block { margin-bottom: 12px; }
.table-regionId { margin-bottom: 4px; }
.table-regionId .title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--title, #0f172a);
}
.muted { color: var(--muted, #94a3b8); }
.json {
  background: #0f1724;
  color: #d7e2f2;
  border: 1px solid #1e2a3d;
  border-radius: 8px;
  padding: 12px 14px;
  max-height: 60vh;
  overflow: auto;
  font-family: var(--mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.5;
}
:deep(.el-table) { cursor: pointer; background: #fff; }
</style>
