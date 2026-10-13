<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    width="680px"
    class="console-dlg"
    :close-on-click-modal="false"
  >
    <template #header>
      <div class="ak-dlg-hd">
        <div class="titles">
          <h4>{{ title }}</h4>
          <p>{{ row?.as_name || '未命名资产' }} · {{ row?.name || '-' }}</p>
        </div>
        <div class="meta">
          <span class="cloud-chip" :class="chipClass">
            <i class="prov-dot" :data-k="row?.key || ''"></i>{{ row?.name }}
          </span>
          <el-tag v-if="mode==='view'" size="small" type="success" effect="plain">只读</el-tag>
          <el-tag v-else-if="mode==='cancel'" size="small" type="danger" effect="plain">危险操作</el-tag>
          <el-tag v-else size="small" type="primary" effect="plain">接管</el-tag>
        </div>
      </div>
    </template>

    <template v-if="mode === 'view'">
      <template v-if="row?.console_data && (row.console_data.userName || row.console_data.password)">
        <div class="ak-cred-card">
          <div class="ak-cred-row">
            <span class="lab">登录页</span>
            <span class="val">{{ row.console_data.loginUrl || 'https://cloud.tencent.com/login/subAccount' }}</span>
            <el-button link type="primary" @click="copy(row.console_data.loginUrl || 'https://cloud.tencent.com/login/subAccount')">复制</el-button>
          </div>
          <div class="ak-cred-row">
            <span class="lab">主账号 ID</span>
            <span class="val">{{ row.console_data.OwnerUin || row.console_data.ownerUin || '（记录中无）' }}</span>
            <el-button
              v-if="row.console_data.OwnerUin || row.console_data.ownerUin"
              link type="primary"
              @click="copy(row.console_data.OwnerUin || row.console_data.ownerUin)"
            >复制</el-button>
            <span v-else></span>
          </div>
          <div class="ak-cred-row">
            <span class="lab">子用户名</span>
            <span class="val em">{{ row.console_data.userName }}</span>
            <el-button link type="primary" @click="copy(row.console_data.userName)">复制</el-button>
          </div>
          <div class="ak-cred-row">
            <span class="lab">密码</span>
            <span class="val em">{{ showPass ? row.console_data.password : '••••••••••••' }}</span>
            <span>
              <el-button link @click="showPass = !showPass">{{ showPass ? '隐藏' : '显示' }}</el-button>
              <el-button link type="primary" @click="copy(row.console_data.password)">复制</el-button>
            </span>
          </div>
          <div v-if="isAliRow" class="ak-cred-row">
            <span class="lab">阿里登录名</span>
            <span class="val">{{ row.console_data.userName }}@主账号ID或别名</span>
            <span></span>
          </div>
        </div>
        <div class="json-hd">
          <span>原始记录</span>
          <el-button link type="primary" @click="copy(JSON.stringify(row.console_data, null, 2))">复制 JSON</el-button>
        </div>
        <pre class="ak-json">{{ JSON.stringify(row.console_data, null, 2) }}</pre>
        <div class="link-row" v-if="row.console_data.loginUrl || row.console_data.consoleUrl">
          <el-button type="primary" plain @click="openUrl(row.console_data.loginUrl || row.console_data.consoleUrl)">
            打开登录地址
          </el-button>
        </div>
      </template>
      <template v-else>
        <div class="ak-empty" style="padding:36px 16px">
          <div class="ico">📋</div>
          <strong>暂无接管记录</strong>
          <p>本地记录会在「取消接管」成功后清空。若记得子用户名和密码，仍可直接去云厂商子用户登录页登录。</p>
        </div>
      </template>
    </template>

    <template v-else-if="mode === 'cancel'">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="确定要取消接管吗？"
        description="将尝试删除云上子用户并清空本地接管记录。若云上删除失败，本地账密会尽量保留。"
      />
      <div class="cancel-box" v-if="row?.console_data?.userName">
        <span class="lab">将清理用户</span>
        <code>{{ row.console_data.userName }}</code>
      </div>
    </template>

    <template v-else>
      <el-form label-width="120px" class="take-form">
        <el-form-item label="云厂商">
          <span class="cloud-chip" :class="chipClass">
            <i class="prov-dot" :data-k="row?.key || ''"></i>{{ row?.name }}
          </span>
        </el-form-item>
        <el-form-item v-if="needUser" label="新用户名">
          <el-input v-model="form.userName" placeholder="默认 console_king" />
        </el-form-item>
        <template v-if="isAws">
          <el-form-item label="接管区域" required>
            <el-input v-model="form.region" placeholder="如 us-east-1 / cn-north-1" />
          </el-form-item>
          <el-form-item label="令牌时间(秒)" required>
            <el-input-number v-model="form.sessionDuration" :min="900" :max="43200" />
          </el-form-item>
        </template>
        <template v-if="isUcloud">
          <el-form-item label="接码邮箱" required>
            <el-input v-model="form.email" />
          </el-form-item>
          <el-form-item label="项目" required>
            <el-select v-model="form.projectID" filterable style="width:100%" :loading="loading">
              <el-option v-for="p in projects" :key="p.ProjectId || p.ProjectID"
                :label="(p.ProjectName || p.ProjectId) + ' (' + (p.ProjectId||p.ProjectID) + ')'"
                :value="p.ProjectId || p.ProjectID" />
            </el-select>
            <el-button link type="primary" @click="loadProjects">刷新项目</el-button>
          </el-form-item>
        </template>
      </el-form>
      <el-alert type="info" :closable="false" show-icon :title="hint" />
    </template>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">关闭</el-button>
      <el-button v-if="mode==='cancel'" type="danger" :loading="loading" @click="doCancel">确认取消接管</el-button>
      <el-button v-if="mode==='console'" type="primary" :loading="loading" @click="doTakeover">执行接管</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { CLOUD_VPS } from '@/constants/clouds'
import {
  createRamClientAli, aliCreateUser, AttachPolicyToUser, CreateLoginProfile, GetAccountAlias,
  aliDetachPolicyFromUser, aliDeleteUser
} from '@/services/aliyun/ram'
import { takeover, cancelTakeover, listUcloudProjects } from '@/services/cloud'
import { useVpsStore } from '@/stores/vps'

const props = defineProps({ modelValue: Boolean, row: Object, mode: { type: String, default: 'console' } })
const emit = defineEmits(['update:modelValue'])
const store = useVpsStore()
const loading = ref(false)
const showPass = ref(false)
const projects = ref([])
const form = reactive({
  userName: 'console_king',
  password: '',
  region: 'us-east-1',
  sessionDuration: 3600,
  email: '',
  projectID: ''
})

const isAws = computed(() => props.row?.name === CLOUD_VPS.aws.name)
const isUcloud = computed(() => props.row?.name === CLOUD_VPS.ucloud.name)
const isAliRow = computed(() => props.row?.name === CLOUD_VPS.alibaba.name)
const needUser = computed(() => !isAws.value)
const title = computed(() => props.mode === 'cancel' ? '取消接管' : props.mode === 'view' ? '接管记录' : '控制台接管')
const chipClass = computed(() => {
  const n = props.row?.name || ''
  if (n === '阿里云') return 'ali'
  if (n === '腾讯云') return 'tx'
  if (n === '华为云') return 'hw'
  if (n === 'ucloud') return 'uc'
  if (n === 'AWS') return 'aws'
  return ''
})
const hint = computed(() => {
  const n = props.row?.name
  if (n === CLOUD_VPS.alibaba.name) return '阿里云：CreateUser → CreateLoginProfile → AttachPolicy(AdministratorAccess)'
  if (n === CLOUD_VPS.tencent.name) return '腾讯云：AddUser → AttachUserPolicy(PolicyId=1) → GetUserAppId'
  if (n === CLOUD_VPS.huawei.name) return '华为云：CreateUser → 加入 admin 用户组'
  if (n === CLOUD_VPS.aws.name) return 'AWS：STS GetFederationToken + 联邦登录 URL'
  if (n === CLOUD_VPS.ucloud.name) return 'UCloud：CreateUser → AttachPoliciesToUser(AdministratorAccess)'
  return ''
})

watch(() => props.modelValue, (v) => {
  if (v) showPass.value = false
  if (v && props.mode === 'console' && isUcloud.value) loadProjects()
})

function copy(t) {
  if (!t) return
  navigator.clipboard?.writeText(String(t)).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.error('复制失败')
  )
}
function openUrl(u) {
  if (!u) return
  if (window.akShell?.openExternal) window.akShell.openExternal(u)
  else window.open(u, '_blank')
}

function rowPlain() {
  try { return JSON.parse(JSON.stringify(props.row || {})) }
  catch { return { ...(props.row || {}) } }
}

async function loadProjects() {
  loading.value = true
  try {
    const row = rowPlain()
    projects.value = await listUcloudProjects(row) || []
  } catch (e) {
    ElMessage.error(e.message || String(e))
  } finally { loading.value = false }
}

async function doAliTakeover() {
  const row = rowPlain()
  const c = createRamClientAli(row.access_key, row.secret_key)
  let o = form.userName || 'console_king'
  if (!o.includes('@')) o += '@example.onaliyun.com'
  const pass = (window.akCloud && await window.akCloud.randPass()) || ('Ak@' + Math.random().toString(36).slice(2, 10) + '9')
  const u = await aliCreateUser(c, { UserName: o })
  await CreateLoginProfile(c, { UserName: o, Password: pass, PasswordResetRequired: false })
  await AttachPolicyToUser(c, { PolicyType: 'System', PolicyName: 'AdministratorAccess', UserName: o })
  const alias = await GetAccountAlias(c)
  return {
    primaryName: o,
    userName: o + '@' + alias.AccountAlias,
    password: pass,
    accountAlias: alias.AccountAlias,
    loginUrl: 'https://signin.aliyun.com',
    user: u.User,
    uuid: crypto.randomUUID?.() || String(Date.now())
  }
}

async function doTakeover() {
  loading.value = true
  try {
    const row = rowPlain()
    let console_data
    if (row.name === CLOUD_VPS.alibaba.name) {
      console_data = await doAliTakeover()
    } else {
      console_data = await takeover(row, { ...form })
    }
    await store.update({ id: row.id, console_data: JSON.parse(JSON.stringify(console_data)) })
    ElMessage.success('接管成功，正在保存接管信息')
    emit('update:modelValue', false)
  } catch (e) {
    ElMessage.error('接管失败：' + (e.message || e))
  } finally { loading.value = false }
}

async function doCancel() {
  loading.value = true
  try {
    const row = rowPlain()
    if (!row.console_data) throw new Error('暂无接管记录！')
    if (row.name === CLOUD_VPS.alibaba.name) {
      const user = row.console_data?.primaryName || row.console_data?.user?.UserName
      if (!user) throw new Error('暂无接管记录！')
      const c = createRamClientAli(row.access_key, row.secret_key)
      try {
        await aliDetachPolicyFromUser(c, { PolicyType: 'System', PolicyName: 'AdministratorAccess', UserName: user })
      } catch {}
      await aliDeleteUser(c, { UserName: user })
    } else if (row.name === CLOUD_VPS.aws.name) {
      // federation token — just clear local
    } else {
      await cancelTakeover(row)
    }
    await store.update({ id: row.id, console_data: null })
    ElMessage.success('取消接管成功')
    emit('update:modelValue', false)
  } catch (e) {
    const msg = String(e.message || e)
    if (msg.includes('本地接管记录已保留') || msg.includes('CANCEL_KEEP_LOCAL')) {
      ElMessage.warning(msg)
    } else {
      ElMessage.error(msg)
    }
  } finally { loading.value = false }
}
</script>

<style scoped>
.json-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 4px 0 8px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 550;
}
.link-row { margin-top: 12px; }
.cancel-box {
  margin-top: 14px;
  padding: 12px 14px;
  background: #fff7e6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.cancel-box .lab { color: var(--muted); font-size: 12px; }
.cancel-box code {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--title);
  font-weight: 600;
}
.take-form { margin-bottom: 12px; }
</style>
