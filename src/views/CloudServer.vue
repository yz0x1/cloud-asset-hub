<template>
  <div class="cloud-page">
    <div class="assets-page ak-panel">
      <div class="assets-subnav">
        <button
          class="subnav-item"
          :class="{ on: subTab === 'list' }"
          @click="switchTab('list')"
        >资产列表</button>
        <button
          v-for="c in clouds" :key="c.key"
          class="subnav-item"
          :class="{ on: subTab === c.key }"
          @click="switchTab(c.key)"
        >{{ c.name }}</button>
      </div>

      <!-- 资产列表 -->
      <div v-if="subTab === 'list'" class="assets-list-pane">
        <div class="assets-toolbar">
          <div class="stats">
            <span class="stat-pill">共 {{ store.list.length }} 条</span>
            <span
              v-for="s in vendorStats" :key="s.key"
              class="stat-pill soft"
              :title="s.name"
            >
              <i class="prov-dot" :data-k="s.key"></i>{{ s.name }} {{ s.count }}
            </span>
          </div>
          <div class="toolbar-right">
            <el-input
              v-model="query"
              clearable
              placeholder="搜索备注 / AK / 厂商"
              style="width: 220px"
            />
            <el-button @click="showAk = !showAk">{{ showAk ? '隐藏' : '显示' }}密钥</el-button>
            <el-button @click="init">刷新</el-button>
            <el-button type="primary" @click="switchTab(CLOUD_VPS.alibaba.key)">添加 AKSK</el-button>
          </div>
        </div>

        <el-table
          v-if="filtered.length"
          :data="filtered"
          stripe
          border
          height="calc(100vh - 380px)"
          min-height="280"
        >
          <el-table-column type="index" label="No" width="58" />
          <el-table-column prop="as_name" label="备注" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="as-name">{{ row.as_name || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="云厂商" width="120">
            <template #default="{ row }">
              <span class="cloud-chip" :class="chipClass(row)">
                <i class="prov-dot" :data-k="row.key || keyOf(row.name)"></i>
                {{ row.name }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="access_key" label="ak" min-width="180" show-overflow-tooltip>
            <template #default="{ row }">
              <code class="mono-cell">{{ showAk ? row.access_key : mask(row.access_key) }}</code>
            </template>
          </el-table-column>
          <el-table-column prop="secret_key" label="sk" width="140">
            <template #default="{ row }">
              <code class="mono-cell">{{ showAk ? row.secret_key : '********' }}</code>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <div class="ops">
                <el-button link type="primary" @click="doConsole(row)">接管</el-button>
                <el-button link @click="openEdit(row)">编辑</el-button>

                <el-dropdown trigger="click" @command="(cmd) => onMore(cmd, row)">
                  <el-button link type="primary">
                    更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
                  </el-button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <template v-if="row.name === ALI.name">
                        <el-dropdown-item command="alarm">告警管理</el-dropdown-item>
                        <el-dropdown-item command="rds">云数据库管理</el-dropdown-item>
                      </template>
                      <el-dropdown-item command="consoleView" :divided="row.name === ALI.name">接管记录</el-dropdown-item>
                      <el-dropdown-item command="consoleCancel">取消接管</el-dropdown-item>
                      <el-dropdown-item
                        v-if="canUsers(row)"
                        command="users"
                        divided
                      >子用户列表</el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.name === CLOUD_VPS.tencent.name"
                        command="domains"
                      >域名列表</el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.name === CLOUD_VPS.aws.name"
                        command="awsPolicies"
                      >策略列表</el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.name === CLOUD_VPS.aws.name"
                        command="awsBackdoor"
                      >创建后门</el-dropdown-item>
                      <el-dropdown-item
                        v-if="row.name === CLOUD_VPS.ucloud.name"
                        command="ucloudOrders"
                      >订单查看</el-dropdown-item>
                      <el-dropdown-item command="remove" divided class="danger-item">删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <div v-else class="ak-empty">
          <div class="ico">☁</div>
          <strong>还没有云服务资产</strong>
          <p>点击上方厂商 Tab 填写 AK/SK，或点「添加 AKSK」从阿里云开始</p>
          <el-button type="primary" @click="switchTab(CLOUD_VPS.alibaba.key)">添加第一组密钥</el-button>
        </div>
      </div>

      <!-- 厂商内嵌表单（对齐云存储） -->
      <div v-else class="assets-form-pane">
        <div class="form-head">
          <div>
            <h3 class="form-title">{{ form.id ? '编辑' : '设置' }}{{ activeCloud?.name }}密钥</h3>
            <p class="form-sub">保存后写入本地，重启仍保留 · 主操作在资产列表</p>
          </div>
          <el-button text type="primary" @click="switchTab('list')">← 返回列表</el-button>
        </div>
        <el-form label-width="110px" class="cred-form" @submit.prevent>
          <el-form-item label="备注名">
            <el-input v-model="form.as_name" placeholder="资产备注，如 prod / king2" style="max-width:420px" />
          </el-form-item>
          <el-form-item label="AccessKey">
            <el-input v-model="form.access_key" placeholder="请填入 ACCESS_KEY" style="max-width:420px" />
          </el-form-item>
          <el-form-item label="SecretKey">
            <el-input v-model="form.secret_key" show-password placeholder="请填入 SECRET_KEY" style="max-width:420px" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input
              v-model="form.remark"
              type="textarea"
              :rows="3"
              maxlength="120"
              show-word-limit
              placeholder="可选备注"
              style="max-width:420px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="submitForm">{{ form.id ? '保存修改' : '保存并生效' }}</el-button>
            <el-button @click="resetForm">重置</el-button>
            <el-button v-if="form.id" @click="cancelEdit">取消编辑</el-button>
          </el-form-item>
        </el-form>
        <p class="cred-hint">
          * {{ activeCloud?.name }}：控制台 → 访问密钥 / API 密钥。腾讯云建议子用户密钥；当前主账号若 ForbidAdd 将无法接管建用户。
        </p>
      </div>
    </div>

    <RemoteCommand />

    <AlarmManager v-model="alarmVisible" :row="alarmRow" />
    <RdsManager v-model="rdsVisible" :row="rdsRow" />
    <ConsolePanel v-model="consoleVisible" :row="consoleRow" :mode="consoleMode" />
    <JsonViewer v-model="jsonVisible" :title="jsonTitle" :data="jsonData" />

    <el-dialog v-model="awsPermVisible" width="640px" :close-on-click-modal="false">
      <template #header>
        <div class="perm-hd">
          <span>aws权限维持</span>
          <small>指定为某个IAM用户，创建访问密钥</small>
        </div>
      </template>
      <el-form label-width="90px">
        <el-form-item label="选择用户">
          <el-select v-model="awsUserName" filterable allow-create style="width:100%" placeholder="IAM UserName">
            <el-option v-for="u in awsUsers" :key="u.UserName" :label="u.UserName" :value="u.UserName" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="success" :loading="awsBusy" @click="doCreateAwsAk">创建aksk</el-button>
        <el-button type="primary" @click="awsPermVisible=false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { useVpsStore } from '@/stores/vps'
import { CLOUD_VPS } from '@/constants/clouds'
import AlarmManager from '@/components/AlarmManager.vue'
import RdsManager from '@/components/RdsManager.vue'
import ConsolePanel from '@/components/ConsolePanel.vue'
import RemoteCommand from '@/components/RemoteCommand.vue'
import JsonViewer from '@/components/JsonViewer.vue'
import { tencentUsers, tencentDomains, huaweiUsers, ucloudOrders, awsPolicies, awsCreateKey } from '@/services/cloud'
import { createRamClientAli, aliListUsers } from '@/services/aliyun/ram'

const store = useVpsStore()
const ALI = CLOUD_VPS.alibaba
const clouds = Object.values(CLOUD_VPS)
const subTab = ref('list')
const showAk = ref(false)
const query = ref('')
const form = reactive({
  id: '', as_name: '', name: ALI.name, key: ALI.key,
  access_key: '', secret_key: '', remark: ''
})
const alarmVisible = ref(false)
const alarmRow = ref(null)
const rdsVisible = ref(false)
const rdsRow = ref(null)
const consoleVisible = ref(false)
const consoleRow = ref(null)
const consoleMode = ref('console')
const jsonVisible = ref(false)
const jsonTitle = ref('JSON')
const jsonData = ref(null)
const awsPermVisible = ref(false)
const awsBusy = ref(false)
const awsRow = ref(null)
const awsUsers = ref([])
const awsUserName = ref('')

const activeCloud = computed(() => clouds.find(c => c.key === subTab.value) || ALI)
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return store.list
  return store.list.filter(r =>
    [r.as_name, r.name, r.access_key, r.remark, r.key].some(x => String(x || '').toLowerCase().includes(q))
  )
})
const vendorStats = computed(() =>
  clouds.map(c => ({
    ...c,
    count: store.list.filter(r => r.name === c.name || r.key === c.key).length
  })).filter(s => s.count > 0)
)

onMounted(() => init())
async function init() { await store.init() }
function mask(s) { return s ? s.slice(0, 4) + '****' + s.slice(-4) : '' }
function keyOf(name) {
  return clouds.find(c => c.name === name)?.key || ''
}
function chipClass(row) {
  const k = row.key || keyOf(row.name)
  if (k.includes('alibaba') || row.name === '阿里云') return 'ali'
  if (k.includes('tencent') || row.name === '腾讯云') return 'tx'
  if (k.includes('huawei') || row.name === '华为云') return 'hw'
  if (k.includes('ucloud')) return 'uc'
  if (k.includes('aws') || row.name === 'AWS') return 'aws'
  return ''
}
function canUsers(row) {
  return [ALI.name, CLOUD_VPS.tencent.name, CLOUD_VPS.huawei.name, CLOUD_VPS.aws.name, CLOUD_VPS.ucloud.name]
    .includes(row.name)
}
function switchTab(key) {
  subTab.value = key
  if (key !== 'list') {
    if (!form.id || form.key !== key) {
      Object.assign(form, {
        id: '', as_name: '', name: activeCloud.value.name, key,
        access_key: '', secret_key: '', remark: ''
      })
      // activeCloud depends on subTab; set explicitly
      const c = clouds.find(x => x.key === key)
      if (c) {
        form.name = c.name
        form.key = c.key
      }
    }
  }
}
function resetForm() {
  const c = activeCloud.value
  Object.assign(form, {
    id: '', as_name: '', name: c.name, key: c.key,
    access_key: '', secret_key: '', remark: ''
  })
}
function cancelEdit() {
  resetForm()
  subTab.value = 'list'
}
function openEdit(row) {
  Object.assign(form, {
    id: row.id,
    as_name: row.as_name || '',
    name: row.name,
    key: row.key || keyOf(row.name),
    access_key: row.access_key || '',
    secret_key: row.secret_key || '',
    remark: row.remark || ''
  })
  subTab.value = form.key || CLOUD_VPS.alibaba.key
}
async function submitForm() {
  if (!form.access_key || !form.secret_key) return ElMessage.error('请填写 AK / SK')
  const payload = { ...form }
  if (payload.id) await store.update(payload)
  else await store.add(payload)
  ElMessage.success('已保存')
  resetForm()
  subTab.value = 'list'
}
async function remove(row) {
  await ElMessageBox.confirm('确定删除该云服务资产？', '删除确认', { type: 'warning' })
  await store.remove(row.id)
}
function openAlarm(row) { alarmRow.value = row; alarmVisible.value = true }
function openRds(row) { rdsRow.value = row; rdsVisible.value = true }
function doConsole(row, mode = 'console') {
  consoleRow.value = row
  consoleMode.value = mode
  consoleVisible.value = true
}

function onMore(cmd, row) {
  if (cmd === 'alarm') {
    if (row.name !== ALI.name) return ElMessage.info('告警管理仅支持阿里云')
    return openAlarm(row)
  }
  if (cmd === 'rds') return openRds(row)
  if (cmd === 'console') return doConsole(row)
  if (cmd === 'consoleView') return doConsole(row, 'view')
  if (cmd === 'consoleCancel') return doConsole(row, 'cancel')
  if (cmd === 'users') return viewUsers(row)
  if (cmd === 'domains') return viewDomains(row)
  if (cmd === 'awsPolicies') return viewAwsPolicies(row)
  if (cmd === 'awsBackdoor') return openAwsBackdoor(row)
  if (cmd === 'ucloudOrders') return viewUcloudOrders(row)
  if (cmd === 'remove') return remove(row)
}

async function viewUsers(row) {
  try {
    let data
    if (row.name === ALI.name) {
      data = await aliListUsers(createRamClientAli(row.access_key, row.secret_key), { MaxItems: 100 })
    } else if (row.name === CLOUD_VPS.tencent.name) data = await tencentUsers(row)
    else if (row.name === CLOUD_VPS.huawei.name) data = await huaweiUsers(row)
    else if (row.name === CLOUD_VPS.aws.name) {
      if (!window.akCloud) throw new Error('请在 Electron 中运行')
      const r = await window.akCloud.awsListUsers({
        access_key: row.access_key, secret_key: row.secret_key, region: 'us-east-1'
      })
      if (!r.ok) throw new Error(r.error)
      data = r.data
    } else if (row.name === CLOUD_VPS.ucloud.name) {
      if (!window.akCloud) throw new Error('请在 Electron 中运行')
      const r = await window.akCloud.ucloudListUsers({
        access_key: row.access_key, secret_key: row.secret_key
      })
      if (!r.ok) throw new Error(r.error)
      data = r.data
    } else {
      return ElMessage.info('该云厂商用户列表待扩展')
    }
    jsonTitle.value = '子用户列表-' + row.name
    jsonData.value = data
    jsonVisible.value = true
  } catch (e) {
    ElMessage.error('查询失败：' + e.message)
  }
}
async function viewDomains(row) {
  try {
    const data = await tencentDomains(row)
    jsonTitle.value = '域名列表'
    jsonData.value = data
    jsonVisible.value = true
  } catch (e) {
    ElMessage.error('查询失败：' + e.message)
  }
}
async function viewAwsPolicies(row) {
  try {
    const data = await awsPolicies(row, { Scope: 'All' })
    jsonTitle.value = 'AWS 策略列表'
    jsonData.value = data
    jsonVisible.value = true
  } catch (e) { ElMessage.error(e.message) }
}
async function openAwsBackdoor(row) {
  awsRow.value = row
  awsUserName.value = ''
  awsUsers.value = []
  awsPermVisible.value = true
  try {
    if (!window.akCloud) throw new Error('请在 Electron 中运行')
    const r = await window.akCloud.awsListUsers({
      access_key: row.access_key, secret_key: row.secret_key, region: 'us-east-1'
    })
    if (!r.ok) throw new Error(r.error)
    const list = r.data?.Users || r.data?.users || r.data || []
    awsUsers.value = Array.isArray(list) ? list : []
  } catch (e) {
    ElMessage.warning('拉取用户列表失败，可手动输入用户名：' + (e.message || e))
  }
}
async function doCreateAwsAk() {
  if (!awsRow.value || !awsUserName.value) return ElMessage.error('请选择要创建的用户！')
  awsBusy.value = true
  try {
    const data = await awsCreateKey(awsRow.value, awsUserName.value.trim())
    jsonTitle.value = 'AWS 新建 AccessKey（请立即保存 Secret）'
    jsonData.value = data
    jsonVisible.value = true
    ElMessage.success('创建完成，已保存用户信息。')
  } catch (e) {
    const msg = e.message || String(e)
    if (msg.includes('LimitExceeded') || msg.includes('上限')) ElMessage.error('创建失败，该用户aksk 已到达上限。')
    else ElMessage.error(msg)
  } finally { awsBusy.value = false }
}
async function viewUcloudOrders(row) {
  try {
    const data = await ucloudOrders(row)
    jsonTitle.value = 'UCloud 订单列表'
    jsonData.value = data
    jsonVisible.value = true
  } catch (e) { ElMessage.error(e.message) }
}
</script>

<style scoped>
.cloud-page { display: flex; flex-direction: column; gap: 14px; }
.assets-page {
  min-height: 420px;
}
.assets-subnav {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(180deg, #fafbfd, #f5f7fb);
}
.subnav-item {
  border: 0;
  background: transparent;
  padding: 13px 14px;
  font-size: 13px;
  color: var(--text);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  white-space: nowrap;
  transition: color .15s, border-color .15s, background .15s;
}
.subnav-item:hover { color: var(--accent); }
.subnav-item.on {
  color: var(--accent-active);
  border-bottom-color: var(--accent);
  font-weight: 650;
  background: #fff;
}
.assets-list-pane { padding: 0 0 12px; background: #fff; }
.assets-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 10px;
  flex-wrap: wrap;
}
.stats { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.stat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-active);
  border: 1px solid #cfe3fb;
  font-weight: 550;
}
.stat-pill.soft {
  background: #f7f9fc;
  color: var(--text);
  border-color: var(--line);
  font-weight: 500;
}
.toolbar-right { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.as-name { font-weight: 550; color: var(--title); }
.mono-cell {
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text);
}
.ops {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-wrap: nowrap;
}
.assets-form-pane {
  padding: 28px 40px 36px;
  max-width: 720px;
}
.form-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}
.form-title {
  margin: 0;
  font-size: 18px;
  font-weight: 650;
  color: var(--title);
  letter-spacing: 0.02em;
}
.form-sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.cred-form :deep(.el-form-item__label) { color: var(--text); }
.cred-hint {
  margin: 8px 0 0 110px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
  max-width: 480px;
}
.panel.sub {
  padding: 14px 18px 8px;
}
.sub-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sub-hd strong {
  font-size: 14px;
  color: var(--title);
  margin-right: 10px;
}
.perm-hd { display: flex; flex-direction: column; gap: 4px; }
.perm-hd small { color: var(--muted); font-weight: normal; }
:deep(.danger-item) { color: var(--danger) !important; }
:deep(.danger-item:hover) { background: #fff1f0 !important; color: var(--danger) !important; }
</style>
