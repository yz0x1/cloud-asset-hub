<template>
  <div class="ai-page cloud-page">
    <div class="assets-page ak-panel">
      <div class="assets-subnav">
        <button class="subnav-item" :class="{ on: subTab === 'list' }" @click="subTab = 'list'">资产列表</button>
        <button class="subnav-item" :class="{ on: subTab === 'form' }" @click="openAdd('custom')">添加密钥</button>
        <button class="subnav-item" :class="{ on: subTab === 'lab' }" @click="openLab()">试调</button>
      </div>

      <!-- 资产列表 -->
      <div v-if="subTab === 'list'" class="assets-list-pane">
        <div class="assets-toolbar">
          <div class="stats">
            <span class="stat-pill">共 {{ store.list.length }} 条</span>
            <span class="stat-pill soft">可用 {{ okCount }}</span>
            <span class="stat-pill soft">失败 {{ failCount }}</span>
          </div>
          <div class="toolbar-right">
            <el-input v-model="query" clearable placeholder="搜索名称 / Key / URL / 备注" style="width:240px" />
            <el-button @click="store.showKey = !store.showKey">{{ store.showKey ? '隐藏' : '显示' }}密钥</el-button>
            <el-button @click="exportAssets">导出</el-button>
            <el-button @click="importAssets">导入</el-button>
            <el-button @click="init">刷新</el-button>
            <el-button type="primary" @click="openAdd('custom')">添加密钥</el-button>
          </div>
        </div>

        <el-table
          v-if="filtered.length"
          :data="filtered"
          stripe
          border
          height="calc(100vh - 220px)"
          min-height="280"
        >
          <el-table-column type="index" label="No" width="58" />
          <el-table-column prop="name" label="名称" min-width="140" show-overflow-tooltip />
          <el-table-column label="API Key" min-width="170" show-overflow-tooltip>
            <template #default="{ row }">
              <code class="mono-cell">{{ store.showKey ? row.api_key : maskKey(row.api_key) }}</code>
            </template>
          </el-table-column>
          <el-table-column prop="base_url" label="Base URL" min-width="200" show-overflow-tooltip />
          <el-table-column prop="model" label="默认模型" width="130" show-overflow-tooltip />
          <el-table-column label="探测" width="150">
            <template #default="{ row }">
              <span v-if="row.probe_ok === true" class="status-pill ok" :title="probeTitle(row)">
                可用{{ row.probe_ms != null ? ` · ${row.probe_ms}ms` : '' }}
              </span>
              <span v-else-if="row.probe_ok === false" class="status-pill bad" :title="row.probe_error || ''">
                不可用
              </span>
              <span v-else class="muted">未验证</span>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" width="110" show-overflow-tooltip />
          <el-table-column label="操作" width="240" fixed="right">
            <template #default="{ row }">
              <div class="ops">
                <el-button link type="primary" :loading="probingId === row.id" @click="doProbe(row)">验证</el-button>
                <el-button link type="success" @click="openLab(row)">试调</el-button>
                <el-button link @click="openEdit(row)">编辑</el-button>
                <el-button link type="danger" @click="doRemove(row)">删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无 AI 密钥。点「添加密钥」，或用下方常见模板快速填入" />
      </div>

      <!-- 添加 / 编辑（自定义资产） -->
      <div v-else-if="subTab === 'form'" class="assets-form-pane">
        <div class="form-card">
          <h3 class="form-title">{{ form.id ? '编辑密钥' : '添加密钥' }}</h3>
          <p class="form-desc">
            面向资产盘点：录入挖掘/拿到的 Key，填 Base URL 后验证是否可用。协议统一为 OpenAI Compatible（/v1）。
          </p>

          <div v-if="!form.id" class="preset-row">
            <span class="preset-lab">常见模板</span>
            <el-button
              v-for="p in presets"
              :key="p.key"
              size="small"
              :type="form.preset === p.key ? 'primary' : 'default'"
              plain
              @click="applyPreset(p.key)"
            >{{ p.name }}</el-button>
          </div>

          <el-form label-width="110px" class="ai-form" @submit.prevent>
            <el-form-item label="名称" required>
              <el-input v-model="form.name" placeholder="自定义名称，如：某中转 / 目标环境 Key" />
            </el-form-item>
            <el-form-item label="API Key" required>
              <el-input v-model="form.api_key" show-password placeholder="sk-... / API Key" />
            </el-form-item>
            <el-form-item label="Base URL" required>
              <el-input v-model="form.base_url" placeholder="https://api.example.com/v1" />
              <div class="tip">
                {{ activePreset?.hint || '填到 /v1 即可，不要带 /chat/completions；中转、Ollama、厂商兼容网关均可' }}
              </div>
            </el-form-item>
            <el-form-item label="默认模型">
              <div class="model-row">
                <el-select
                  v-model="form.model"
                  filterable
                  allow-create
                  default-first-option
                  clearable
                  placeholder="手填或拉取列表"
                  style="flex:1"
                >
                  <el-option v-for="m in formModels" :key="m" :label="m" :value="m" />
                </el-select>
                <el-tooltip content="获取模型列表" placement="top">
                  <el-button :icon="Download" :loading="fetchingFormModels" @click="fetchFormModels" />
                </el-tooltip>
              </div>
            </el-form-item>
            <el-form-item label="Organization">
              <el-input v-model="form.organization" placeholder="可选" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="form.remark" placeholder="来源、目标、权限范围等" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveForm">保存</el-button>
              <el-button @click="subTab = 'list'">返回列表</el-button>
              <el-button :loading="probing" @click="probeForm">验证可用性</el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <!-- 试调 -->
      <div v-else class="lab-pane">
        <div class="lab-grid">
          <section class="lab-side">
            <div class="block-label">试调参数</div>
            <el-form label-width="88px" @submit.prevent>
              <el-form-item label="资产">
                <el-select v-model="lab.accountId" filterable style="width:100%" @change="onLabAccount">
                  <el-option
                    v-for="a in store.list"
                    :key="a.id"
                    :label="a.name"
                    :value="a.id"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="模型">
                <div class="model-row">
                  <el-select
                    v-model="lab.model"
                    filterable
                    allow-create
                    default-first-option
                    clearable
                    style="flex:1"
                    placeholder="选择或输入模型名"
                  >
                    <el-option v-for="m in lab.models" :key="m" :label="m" :value="m" />
                  </el-select>
                  <el-tooltip content="获取模型列表" placement="top">
                    <el-button
                      :icon="Download"
                      :loading="listing"
                      :disabled="!lab.accountId"
                      @click="loadModels"
                    />
                  </el-tooltip>
                </div>
              </el-form-item>
              <el-form-item label="Prompt">
                <el-input
                  v-model="lab.prompt"
                  type="textarea"
                  :rows="8"
                  placeholder="输入要发送的内容"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" :loading="chatting" :disabled="!lab.accountId || chatting" @click="doChat">发送</el-button>
                <el-button type="danger" plain :disabled="!chatting" @click="cancelChat">取消</el-button>
                <el-button @click="clearLabOut">清空输出</el-button>
              </el-form-item>
            </el-form>
          </section>
          <section class="lab-out">
            <div class="block-label row">
              <span>回复</span>
              <el-button link type="primary" @click="copyText(lab.reply)">复制</el-button>
            </div>
            <el-input v-model="lab.reply" type="textarea" :rows="10" readonly placeholder="模型回复将显示在这里" />
            <div class="block-label row" style="margin-top:12px">
              <span>原始 JSON</span>
              <el-button link type="primary" @click="copyText(lab.rawJson)">复制</el-button>
            </div>
            <el-input v-model="lab.rawJson" type="textarea" :rows="8" readonly class="raw-json" />
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import { AI_PRESETS } from '@/constants/clouds'
import { useAiStore } from '@/stores/ai'
import {
  listModels, chatCompletions, probeAccount, abortAiRequest,
  createAiRequestId, maskKey, validateBaseUrl
} from '@/services/ai/client'

const store = useAiStore()
const presets = AI_PRESETS
const subTab = ref('list')
const query = ref('')
const saving = ref(false)
const probing = ref(false)
const probingId = ref('')
const chatting = ref(false)
const listing = ref(false)
const fetchingFormModels = ref(false)
const formModels = ref([])
const chatRequestId = ref('')

const form = reactive({
  id: '',
  name: '',
  preset: 'custom',
  api_key: '',
  base_url: '',
  model: '',
  organization: '',
  remark: ''
})

const lab = reactive({
  accountId: '',
  model: '',
  prompt: '你好，请用一句话介绍你自己。',
  models: [],
  reply: '',
  rawJson: ''
})

const activePreset = computed(() => store.presetMeta(form.preset))
const okCount = computed(() => store.list.filter(x => x.probe_ok === true).length)
const failCount = computed(() => store.list.filter(x => x.probe_ok === false).length)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return store.list
  return store.list.filter(r =>
    [r.name, r.api_key, r.remark, r.base_url, r.model]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
})

function probeTitle(row) {
  const parts = []
  if (row.probe_at) parts.push(row.probe_at)
  if (row.probe_via) parts.push('via ' + row.probe_via)
  if (row.probe_models != null) parts.push(row.probe_models + ' models')
  return parts.join(' · ') || ''
}

function applyPreset(key) {
  const meta = store.presetMeta(key)
  form.preset = meta.key
  if (!form.id) form.name = meta.key === 'custom' ? '' : meta.name
  form.base_url = meta.base_url || ''
  form.model = meta.default_model || ''
  formModels.value = meta.default_model ? [meta.default_model] : []
}

function resetForm(presetKey = 'custom') {
  const meta = store.presetMeta(presetKey)
  form.id = ''
  form.preset = meta.key
  form.name = meta.key === 'custom' ? '' : meta.name
  form.api_key = ''
  form.base_url = meta.base_url || ''
  form.model = meta.default_model || ''
  form.organization = ''
  form.remark = ''
  formModels.value = meta.default_model ? [meta.default_model] : []
}

function openAdd(presetKey = 'custom') {
  resetForm(presetKey)
  subTab.value = 'form'
}

function openEdit(row) {
  Object.assign(form, {
    id: row.id,
    name: row.name,
    preset: row.preset || row.provider || 'custom',
    api_key: row.api_key,
    base_url: row.base_url,
    model: row.model || '',
    organization: row.organization || '',
    remark: row.remark || ''
  })
  formModels.value = row.model ? [row.model] : []
  subTab.value = 'form'
}

async function fetchFormModels() {
  if (!form.api_key?.trim() || !form.base_url?.trim()) {
    return ElMessage.error('请先填写 API Key 与 Base URL')
  }
  fetchingFormModels.value = true
  try {
    const r = await listModels({
      api_key: form.api_key,
      base_url: form.base_url,
      organization: form.organization
    })
    formModels.value = r.models || []
    if (!form.model && formModels.value[0]) form.model = formModels.value[0]
    ElMessage.success(`已获取 ${formModels.value.length} 个模型`)
  } catch (e) {
    ElMessage.error(String(e.message || e))
  } finally {
    fetchingFormModels.value = false
  }
}

function openLab(row) {
  subTab.value = 'lab'
  if (row?.id) {
    lab.accountId = row.id
    onLabAccount(row.id)
  } else if (!lab.accountId && store.list[0]) {
    lab.accountId = store.list[0].id
    onLabAccount(lab.accountId)
  }
}

function onLabAccount(id) {
  const a = store.list.find(x => x.id === id)
  if (!a) return
  lab.model = a.model || ''
  lab.models = a.model ? [a.model] : []
}

function currentLabAccount() {
  return store.list.find(x => x.id === lab.accountId) || null
}

async function init() {
  await store.init()
}

async function saveForm() {
  if (!form.name?.trim()) return ElMessage.error('请填写名称')
  if (!form.api_key?.trim()) return ElMessage.error('请填写 API Key')
  const urlErr = validateBaseUrl(form.base_url)
  if (urlErr) return ElMessage.error(urlErr)
  saving.value = true
  try {
    const payload = {
      id: form.id,
      name: form.name,
      preset: form.preset || 'custom',
      api_key: form.api_key,
      base_url: form.base_url,
      model: form.model,
      organization: form.organization,
      remark: form.remark
    }
    if (form.id) {
      await store.update(payload)
      ElMessage.success('已更新')
    } else {
      await store.add(payload)
      ElMessage.success('已保存')
    }
    subTab.value = 'list'
  } catch (e) {
    ElMessage.error(String(e.message || e))
  } finally {
    saving.value = false
  }
}

async function doRemove(row) {
  await ElMessageBox.confirm(`删除「${row.name}」？`, '删除确认')
  await store.remove(row.id)
  ElMessage.success('已删除')
  if (lab.accountId === row.id) {
    lab.accountId = ''
    lab.models = []
  }
}

async function runProbe(account) {
  const r = await probeAccount(account)
  if (r.via === 'models') {
    ElMessage.success(`可用（models）：${r.count} 个模型 · ${r.ms}ms`)
  } else {
    ElMessage.success(`可用（chat 回退）：${r.ms}ms`)
  }
  return r
}

async function doProbe(row) {
  probing.value = true
  probingId.value = row.id
  try {
    const r = await runProbe(row)
    await store.recordProbe(row.id, { ...r, ok: true })
    if (r.models?.length) {
      lab.accountId = row.id
      lab.models = r.models
      if (!lab.model && r.models[0]) lab.model = r.models[0]
    }
  } catch (e) {
    await store.recordProbe(row.id, { ok: false, error: String(e.message || e) })
    ElMessage.error(String(e.message || e))
  } finally {
    probing.value = false
    probingId.value = ''
  }
}

async function probeForm() {
  if (!form.api_key || !form.base_url) return ElMessage.error('请先填写 Key 与 Base URL')
  const urlErr = validateBaseUrl(form.base_url)
  if (urlErr) return ElMessage.error(urlErr)
  probing.value = true
  try {
    await runProbe({
      api_key: form.api_key,
      base_url: form.base_url,
      organization: form.organization,
      model: form.model
    })
  } catch (e) {
    ElMessage.error(String(e.message || e))
  } finally {
    probing.value = false
  }
}

async function loadModels() {
  const a = currentLabAccount()
  if (!a) return
  listing.value = true
  try {
    const r = await listModels(a)
    lab.models = r.models || []
    if (!lab.model && lab.models[0]) lab.model = lab.models[0]
    ElMessage.success(`已拉取 ${lab.models.length} 个模型`)
  } catch (e) {
    ElMessage.error(String(e.message || e))
  } finally {
    listing.value = false
  }
}

async function doChat() {
  const a = currentLabAccount()
  if (!a) return ElMessage.error('请选择资产')
  if (!lab.model) return ElMessage.error('请填写模型')
  if (!lab.prompt?.trim()) return ElMessage.error('请填写 Prompt')
  if (!a.base_url) return ElMessage.error('该资产缺少 Base URL')
  const rid = createAiRequestId('chat')
  chatRequestId.value = rid
  chatting.value = true
  lab.reply = '请求中…（可点「取消」，最长约 65 秒）'
  lab.rawJson = JSON.stringify({
    name: a.name,
    base_url: a.base_url,
    model: lab.model,
    api_key: maskKey(a.api_key),
    request_id: rid
  }, null, 2)
  try {
    const r = await chatCompletions(a, {
      model: lab.model,
      messages: [{ role: 'user', content: lab.prompt }],
      requestId: rid
    })
    if (chatRequestId.value !== rid) return
    lab.reply = r.content || '(空回复，请看原始 JSON)'
    lab.rawJson = JSON.stringify({
      ms: r.ms,
      model: r.model,
      note: r.note || undefined,
      usage: r.usage,
      raw: r.raw
    }, null, 2)
    ElMessage.success(`完成 · ${r.ms}ms`)
  } catch (e) {
    if (chatRequestId.value !== rid) return
    const msg = String(e.message || e)
    lab.reply = '失败：' + msg
    lab.rawJson = JSON.stringify({
      error: msg,
      name: a.name,
      base_url: a.base_url,
      model: lab.model
    }, null, 2)
    if (!msg.includes('已取消')) ElMessage.error(msg)
    else ElMessage.info('已取消')
  } finally {
    if (chatRequestId.value === rid) {
      chatting.value = false
      chatRequestId.value = ''
    }
  }
}

async function cancelChat() {
  const rid = chatRequestId.value
  if (!rid) return
  await abortAiRequest(rid)
  chatting.value = false
  chatRequestId.value = ''
  lab.reply = '已取消请求'
}

function clearLabOut() {
  lab.reply = ''
  lab.rawJson = ''
}

async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t || '')
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function exportAssets() {
  if (!store.list.length) return ElMessage.warning('暂无资产可导出')
  const payload = {
    version: 2,
    type: 'cloud-asset-hub-ai',
    exported_at: new Date().toISOString(),
    accounts: store.list
  }
  const text = JSON.stringify(payload, null, 2)
  const name = `ai-accounts-${new Date().toISOString().slice(0, 10)}.json`
  try {
    if (window.akDialog?.saveFile && window.akDialog?.writeText) {
      const p = await window.akDialog.saveFile(name)
      if (!p) return
      await window.akDialog.writeText({ path: p, text })
      ElMessage.success('已导出')
      return
    }
  } catch (e) {
    ElMessage.error('导出失败：' + (e.message || e))
    return
  }
  const blob = new Blob([text], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
  ElMessage.success('已导出')
}

async function importAssets() {
  try {
    let text = ''
    if (window.akDialog?.openFile && window.akDialog?.readText) {
      const p = await window.akDialog.openFile()
      if (!p) return
      text = await window.akDialog.readText(p)
    } else {
      return ElMessage.error('请在 Electron 中导入')
    }
    const data = JSON.parse(text)
    const rows = Array.isArray(data) ? data : (data.accounts || data.aiAccounts || [])
    if (!rows.length) return ElMessage.warning('文件中没有账户数据')
    const { added, skipped } = await store.importAccounts(rows)
    ElMessage.success(`导入完成：新增 ${added}，跳过 ${skipped}`)
  } catch (e) {
    ElMessage.error('导入失败：' + (e.message || e))
  }
}

onMounted(init)
</script>

<style scoped>
.ai-page { display: flex; flex-direction: column; gap: 14px; }
.assets-page { min-height: 420px; }
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
.mono-cell { font-family: var(--mono); font-size: 12px; color: var(--text); }
.assets-form-pane { padding: 20px 24px 28px; }
.ai-form { max-width: 680px; }
.model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.tip { color: #909399; font-size: 12px; margin-top: 4px; line-height: 1.4; }
.form-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 20px 24px;
  margin: 12px 0;
}
.form-title {
  margin: 0 0 8px;
  font-size: 16px;
  color: var(--title);
}
.form-desc {
  margin: 0 0 14px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
.preset-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.preset-lab {
  font-size: 12px;
  color: #606266;
  margin-right: 4px;
}
.ops { display: flex; flex-wrap: wrap; gap: 2px; }
.muted { color: #909399; font-size: 12px; }
.lab-pane { padding: 8px 12px 16px; }
.lab-grid {
  display: grid;
  grid-template-columns: minmax(320px, 420px) 1fr;
  gap: 16px;
  align-items: start;
}
.lab-side, .lab-out {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
}
.block-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--title);
  margin-bottom: 12px;
}
.block-label.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.raw-json :deep(textarea) {
  font-family: var(--mono);
  font-size: 12px;
}
@media (max-width: 960px) {
  .lab-grid { grid-template-columns: 1fr; }
}
</style>
