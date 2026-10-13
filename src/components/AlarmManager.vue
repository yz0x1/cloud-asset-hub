<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    fullscreen
    class="alarm-dlg"
  >
    <template #header>
      <div class="ak-dlg-hd">
        <div class="titles">
          <h4>告警管理</h4>
          <p>{{ row?.as_name || '临时' }} · 阿里云 TDS / 云安全中心</p>
        </div>
        <div class="meta">
          <span class="cloud-chip ali"><i class="prov-dot" data-k="alibaba_cloud"></i>阿里云</span>
          <el-tag size="small" effect="plain">共 {{ total }} 条事件</el-tag>
        </div>
      </div>
    </template>

    <el-tabs v-model="tab" class="alarm-tabs">
      <el-tab-pane label="告警处理" name="1">
        <div class="ak-toolbar">
          <el-button type="primary" :loading="loading" @click="refresh">刷新</el-button>
          <el-select
            v-model="statusFilter"
            clearable
            placeholder="请选择"
            style="width:160px"
          >
            <el-option
              v-for="o in statusOptions"
              :key="o.type"
              :label="o.label"
              :value="o.type"
            />
          </el-select>
          <el-select v-model="batchCode" placeholder="处理方式" style="width:180px">
            <el-option v-for="o in codes" :key="o.type" :label="o.label" :value="o.type" />
          </el-select>
          <el-button type="danger" :disabled="!selection.length" @click="handleSelected">
            处理选中{{ selection.length ? ` (${selection.length})` : '' }}
          </el-button>
          <el-button type="warning" @click="oneClick">一键关闭全部告警</el-button>
          <span class="grow"></span>
          <span class="muted">已补齐批量 / 一键 · 原版仅单条</span>
        </div>
        <div class="table-shell">
          <el-table
            :data="filteredList"
            height="calc(100vh - 250px)"
            border
            size="small"
            v-loading="loading"
            @selection-change="s => selection = s"
          >
            <el-table-column type="selection" width="45" align="center" />
            <el-table-column prop="InstanceName" label="机器名称" min-width="120" sortable align="center" show-overflow-tooltip />
            <el-table-column prop="AlarmEventName" label="事件名称" min-width="160" sortable align="center" show-overflow-tooltip />
            <el-table-column prop="AlarmEventType" label="事件类型" min-width="140" sortable align="center" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.AlarmEventTypeDisplay || row.AlarmEventType || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="Level" label="事件等级" width="100" sortable align="center">
              <template #default="{ row }">
                <span class="level-tag" :class="levelClass(row.Level)">{{ levelName(row.Level) }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="Desc" label="描述" width="220" sortable align="center" show-overflow-tooltip>
              <template #default="{ row }">{{ row.Desc || row.Description || '—' }}</template>
            </el-table-column>
            <el-table-column prop="EventStatus" label="事件状态" width="110" sortable align="center">
              <template #default="{ row }">
                <span class="status-pill" :class="statusClass(eventStatusOf(row))">
                  {{ statusName(eventStatusOf(row)) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="OccurrenceTime" label="发生时间" width="170" sortable align="center" />
            <el-table-column label="操作" width="180" align="center" fixed="right">
              <template #default="{ row }">
                <el-button link type="success" @click="openHandle(row)">告警处理</el-button>
                <el-button link type="primary" @click="showJson(row)">告警事件详情</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-pagination
          class="pager"
          layout="prev, pager, next, total"
          :total="total"
          :page-size="page.PageSize"
          :current-page="page.CurrentPage"
          @current-change="p => { page.CurrentPage = p; refresh() }"
        />
      </el-tab-pane>

      <el-tab-pane label="告警通知配置" name="2">
        <div class="ak-toolbar">
          <el-button type="primary" :loading="loading" @click="loadNotice">刷新通知配置</el-button>
          <el-button
            type="warning"
            :disabled="!noticeSelection.length"
            @click="openBatchNotice('selected')"
          >
            批量修改选中{{ noticeSelection.length ? ` (${noticeSelection.length})` : '' }}
          </el-button>
          <el-button type="danger" plain @click="openBatchNotice('all')">批量修改全部</el-button>
          <span class="grow"></span>
          <span class="muted">官方：Route=0 关闭；1短信/2邮件/4站内信（可组合）</span>
        </div>
        <div class="table-shell">
          <el-table
            :data="notices"
            height="calc(100vh - 230px)"
            border
            size="small"
            v-loading="loading"
            @selection-change="s => noticeSelection = s"
          >
            <el-table-column type="selection" width="45" align="center" />
            <el-table-column prop="Project" label="项目标识(code)" min-width="160" sortable align="center" show-overflow-tooltip />
            <el-table-column prop="Project" label="项目标识(名称)" min-width="200" sortable align="center" show-overflow-tooltip>
              <template #default="{ row }">{{ projectName(row.Project) }}</template>
            </el-table-column>
            <el-table-column prop="Route" label="通知方式" min-width="180" sortable align="center">
              <template #default="{ row }">
                <span class="status-pill" :class="Number(row.Route) === 0 ? 'bad' : 'ok'">
                  {{ routeName(row.Route) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="TimeLimit" label="通知的时间限制" min-width="200" sortable align="center">
              <template #default="{ row }">{{ timeLimitName(row.TimeLimit) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120" align="center">
              <template #default="{ row }">
                <el-button link type="primary" @click="editNotice(row)">通知修改</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="handleVisible" title="处理告警" width="400px" append-to-body>
      <el-select v-model="operationCode" clearable placeholder="请选择" style="width:100%">
        <el-option v-for="o in codes" :key="o.type" :label="o.label" :value="o.type" />
      </el-select>
      <template #footer>
        <el-button @click="handleVisible = false">取消</el-button>
        <el-button type="primary" @click="okHandle">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="noticeVisible" title="告警通知修改" width="700px" append-to-body>
      <div class="gj-config">
        <div class="gj-row">项目名称：{{ noticeForm.Project }}</div>
        <div class="gj-row">
          <span>通知方式：</span>
          <el-select v-model="noticeForm.Route" placeholder="请选择" style="width:260px">
            <el-option v-for="o in routes" :key="o.type" :label="o.name" :value="o.type" />
          </el-select>
        </div>
        <div class="gj-row">
          <span>通知时间限制：</span>
          <el-input v-model="noticeForm.TimeLimit" placeholder="通知时间限制" style="width:200px" />
          <span class="gj-tip">0：无限制。1：08:00-22:00时间段内发送通知。</span>
        </div>
      </div>
      <template #footer>
        <el-button @click="noticeVisible = false">取消</el-button>
        <el-button type="primary" @click="okNotice">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchNoticeVisible" title="批量修改通知方式" width="520px" append-to-body>
      <div class="gj-config">
        <div class="gj-row">
          <span>作用范围：</span>
          <el-tag type="info" effect="plain">
            {{ batchNoticeScope === 'all'
              ? `全部 ${notices.length} 项`
              : `已选 ${noticeSelection.length} 项` }}
          </el-tag>
        </div>
        <div class="gj-row">
          <span>通知方式：</span>
          <el-select v-model="batchNoticeForm.Route" placeholder="请选择目标通知方式" style="width:300px">
            <el-option v-for="o in routes" :key="o.type" :label="`${o.type} · ${o.name}`" :value="o.type" />
          </el-select>
        </div>
        <div class="gj-row">
          <span>时间限制：</span>
          <el-select v-model="batchNoticeForm.TimeLimitMode" style="width:300px">
            <el-option label="保持不变" value="keep" />
            <el-option label="0 · 无限制" :value="0" />
            <el-option label="1 · 仅 08:00-22:00 发送" :value="1" />
          </el-select>
        </div>
        <p class="gj-tip">
          依据阿里云 ModifyNoticeConfig：Route=0 关闭短信/邮件/站内信；设为 1~7 即开启对应通道组合。
        </p>
      </div>
      <template #footer>
        <el-button @click="batchNoticeVisible = false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="okBatchNotice">确定修改</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="jsonVisible" title="告警事件详情" width="720px" append-to-body>
      <pre class="ak-json">{{ jsonText }}</pre>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  OPERATION_CODES, ALI_GJ_STATUS, NOTICE_PROJECTS, NOTICE_ROUTES, NOTICE_TIME_LIMITS
} from '@/constants/clouds'
import {
  createTdsClientAli, DescribeSuspEvents, aliHandleSecurityEvents,
  aliDescribeNoticeConfig, aliModifyNoticeConfig,
  oneClickCloseAlarms, batchModifyNotices
} from '@/services/aliyun/tds'

const props = defineProps({ modelValue: Boolean, row: Object })
const emit = defineEmits(['update:modelValue'])

const codes = OPERATION_CODES
const statusOptions = ALI_GJ_STATUS
const routes = NOTICE_ROUTES

const tab = ref('1')
const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = reactive({ PageSize: 20, CurrentPage: 1 })
const selection = ref([])
const statusFilter = ref(null)
const batchCode = ref('ignore')

const handleVisible = ref(false)
const operationCode = ref('ignore')
const currentEvent = ref(null)

const jsonVisible = ref(false)
const jsonText = ref('')

const notices = ref([])
const noticeSelection = ref([])
const noticeVisible = ref(false)
const noticeForm = reactive({ Project: '', Route: 7, TimeLimit: 0 })
let noticeRowRaw = null

const batchNoticeVisible = ref(false)
const batchNoticeScope = ref('all') // 'all' | 'selected'
const batchNoticeForm = reactive({ Route: 0, TimeLimitMode: 'keep' })

function eventStatusOf(row) {
  if (!row) return undefined
  return row.EventStatus ?? row.Status
}

function statusName(s) {
  const hit = ALI_GJ_STATUS.find(x => x.type == s)
  return hit ? hit.label : '未知状态'
}

function levelName(lv) {
  if (lv === 'remind') return '提醒'
  if (lv === 'serious') return '紧急'
  if (lv === 'suspicious') return '可疑'
  return lv || '未知'
}

function projectName(t) {
  return (NOTICE_PROJECTS.find(x => x.type === t) || {}).name || t || '未知状态'
}

function routeName(t) {
  return (NOTICE_ROUTES.find(x => x.type == t) || {}).name || String(t)
}

function timeLimitName(t) {
  const hit = NOTICE_TIME_LIMITS.find(x => x.type == t)
  return hit ? hit.name : (t == null ? '—' : String(t))
}

function levelClass(lv) {
  const s = String(lv || '').toLowerCase()
  if (s === 'serious' || s.includes('危急') || s.includes('紧急') || s.includes('高')) return 'serious'
  if (s === 'suspicious' || s.includes('可疑') || s.includes('中')) return 'suspicious'
  if (s === 'remind' || s.includes('提醒') || s.includes('低')) return 'remind'
  return 'default'
}

function statusClass(s) {
  const n = Number(s)
  if (n === 1) return 'warn'
  if (n === 32 || n === 2 || n === 8) return 'ok'
  if (n === 64) return 'bad'
  return ''
}

/** 原版 HandleSecurityEvents 用 SecurityEventIds 字段 */
function eventIdOf(row) {
  if (!row) return ''
  const id = row.SecurityEventIds ?? row.SecurityEventId
  return id == null || id === '' ? '' : String(id)
}

const filteredList = computed(() => {
  if (statusFilter.value == null || statusFilter.value === '') return list.value
  return list.value.filter(r => eventStatusOf(r) == statusFilter.value)
})

async function refresh() {
  if (!props.row) return
  loading.value = true
  try {
    const c = createTdsClientAli(props.row.access_key, props.row.secret_key)
    const res = await DescribeSuspEvents(c, { ...page })
    list.value = res.SuspEvents || []
    total.value = res.TotalCount || 0
  } catch (e) {
    ElMessage.error('查询失败！' + (e.message || e))
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (v) => {
  if (v) {
    page.CurrentPage = 1
    statusFilter.value = null
    tab.value = '1'
    refresh()
  }
})
watch(tab, (n) => { if (n === '2') loadNotice() })

function openHandle(row) {
  currentEvent.value = row
  operationCode.value = 'ignore'
  handleVisible.value = true
}

function showJson(row) {
  const payload = row?.Details != null ? row.Details : row
  try {
    jsonText.value = typeof payload === 'string'
      ? JSON.stringify(JSON.parse(payload), null, 2)
      : JSON.stringify(payload, null, 2)
  } catch {
    jsonText.value = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  }
  jsonVisible.value = true
}

async function okHandle() {
  if (!operationCode.value) return ElMessage.error('请选择！')
  const id = eventIdOf(currentEvent.value)
  if (!id) return ElMessage.error('缺少 SecurityEventIds')
  loading.value = true
  try {
    const c = createTdsClientAli(props.row.access_key, props.row.secret_key)
    await aliHandleSecurityEvents(c, {
      OperationCode: operationCode.value,
      SecurityEventIds: [id]
    })
    ElMessage.success('处理告警成功！')
    handleVisible.value = false
    await refresh()
  } catch (e) {
    ElMessage.error('处理失败！' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

async function handleSelected() {
  if (!batchCode.value) return ElMessage.error('请选择！')
  const ids = selection.value.map(eventIdOf).filter(Boolean)
  if (!ids.length) return ElMessage.error('选中项缺少 SecurityEventIds')
  loading.value = true
  try {
    const c = createTdsClientAli(props.row.access_key, props.row.secret_key)
    await aliHandleSecurityEvents(c, {
      OperationCode: batchCode.value,
      SecurityEventIds: ids
    })
    ElMessage.success(`处理告警成功！(${ids.length})`)
    await refresh()
  } catch (e) {
    ElMessage.error('处理失败！' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

async function oneClick() {
  await ElMessageBox.confirm('将分页拉取并关闭全部安全告警（默认忽略）。是否继续？', '一键关闭告警')
  loading.value = true
  try {
    const r = await oneClickCloseAlarms(
      props.row.access_key,
      props.row.secret_key,
      batchCode.value || 'ignore',
      (p) => console.log('progress', p)
    )
    ElMessage.success(`一键关闭完成：成功 ${r.closed.length}，失败 ${r.failed.length}`)
    await refresh()
  } catch (e) {
    ElMessage.error(String(e.message || e))
  } finally {
    loading.value = false
  }
}

async function loadNotice() {
  loading.value = true
  try {
    const c = createTdsClientAli(props.row.access_key, props.row.secret_key)
    const res = await aliDescribeNoticeConfig(c)
    notices.value = res.NoticeConfigList || []
    noticeSelection.value = []
  } catch (e) {
    ElMessage.error('查询通知失败！' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

function editNotice(row) {
  noticeRowRaw = { ...row }
  noticeForm.Project = row.Project || ''
  noticeForm.Route = row.Route == null ? 7 : Number(row.Route)
  noticeForm.TimeLimit = row.TimeLimit == null ? 0 : row.TimeLimit
  noticeVisible.value = true
}

async function okNotice() {
  if (!noticeRowRaw) return
  loading.value = true
  try {
    const c = createTdsClientAli(props.row.access_key, props.row.secret_key)
    const payload = {
      ...noticeRowRaw,
      Project: noticeForm.Project,
      Route: Number(noticeForm.Route),
      TimeLimit: Number(noticeForm.TimeLimit)
    }
    await aliModifyNoticeConfig(c, payload)
    ElMessage.success('修改成功！')
    noticeVisible.value = false
    await loadNotice()
  } catch (e) {
    ElMessage.error('修改失败！' + (e.message || ''))
  } finally {
    loading.value = false
  }
}

function openBatchNotice(scope) {
  if (scope === 'selected' && !noticeSelection.value.length) {
    return ElMessage.warning('请先勾选要修改的通知类型')
  }
  batchNoticeScope.value = scope
  batchNoticeForm.Route = 0
  batchNoticeForm.TimeLimitMode = 'keep'
  batchNoticeVisible.value = true
}

async function okBatchNotice() {
  if (batchNoticeForm.Route == null || batchNoticeForm.Route === '') {
    return ElMessage.error('请选择目标通知方式')
  }
  const projects = batchNoticeScope.value === 'selected'
    ? noticeSelection.value.map(r => r.Project).filter(Boolean)
    : null
  const count = projects ? projects.length : notices.value.length
  const routeLabel = routeName(batchNoticeForm.Route)
  await ElMessageBox.confirm(
    `将把 ${count} 项通知方式改为「${routeLabel}」(Route=${batchNoticeForm.Route})。是否继续？`,
    '确认批量修改'
  )
  loading.value = true
  try {
    const opts = { route: Number(batchNoticeForm.Route), projects }
    if (batchNoticeForm.TimeLimitMode !== 'keep') {
      opts.timeLimit = Number(batchNoticeForm.TimeLimitMode)
    }
    const r = await batchModifyNotices(props.row.access_key, props.row.secret_key, opts)
    const ok = r.filter(x => x.ok).length
    const fail = r.length - ok
    ElMessage.success(`批量修改完成：成功 ${ok}${fail ? `，失败 ${fail}` : ''}`)
    batchNoticeVisible.value = false
    await loadNotice()
  } catch (e) {
    if (e !== 'cancel' && e?.toString?.() !== 'cancel') {
      ElMessage.error(String(e.message || e))
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.alarm-tabs :deep(.el-tabs__header) { margin-bottom: 12px; }
.table-shell {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.pager { margin-top: 12px; justify-content: flex-end; }
.gj-config { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; }
.gj-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.gj-tip { color: #909399; font-size: 12px; }
</style>
