<template>
  <div class="app-shell">
    <header class="top">
      <div class="top-left">
        <div class="logo-mark" aria-hidden="true">
          <span>云</span>
        </div>
        <div class="brand-block">
          <div class="brand">云资产管理工具</div>
          <span class="ver">v{{ version }}</span>
        </div>
        <span class="top-divider" aria-hidden="true"></span>
        <nav class="tabs" role="tablist">
          <button
            v-for="t in tabs" :key="t.name"
            class="tab" :class="{ on: tab===t.name }"
            role="tab"
            :aria-selected="tab===t.name"
            @click="switchTab(t.name)"
          >{{ t.label }}</button>
        </nav>
      </div>
      <div class="actions">
        <button class="hdr-btn" @click="openSettings">
          <span class="hdr-ico">⚙</span>
          设置
        </button>
      </div>
    </header>
    <main class="body"><router-view /></main>

    <el-dialog v-model="settingsVisible" width="640px" class="settings-dlg" :close-on-click-modal="false">
      <template #header>
        <div class="ak-dlg-hd">
          <div class="titles">
            <h4>设置</h4>
            <p>下载目录 · 托盘上传 · 热更新</p>
          </div>
        </div>
      </template>
      <el-tabs v-model="settingsTab" class="settings-tabs">
        <el-tab-pane label="通用" name="general">
          <el-form label-width="140px">
            <el-form-item label="下载目录">
              <div class="row-inline">
                <el-input v-model="downloadDir" placeholder="默认 download 目录" readonly style="flex:1" />
                <el-button @click="pickDownloadDir">选择</el-button>
              </div>
              <div class="tip">对齐原版：文件下载优先落到此目录</div>
            </el-form-item>
            <el-form-item label="复制到粘贴板格式">
              <el-radio-group v-model="copyType">
                <el-radio value="url">url</el-radio>
                <el-radio value="markdown">markdown</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="私有链接过期(分)">
              <el-input-number v-model="deadlineMin" :min="1" :max="10080" />
            </el-form-item>
            <el-form-item label="预览图片样式">
              <el-input v-model="imageStyle" placeholder="七牛 imageView2/2/w/800" />
            </el-form-item>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="托盘上传位置" name="tray">
          <el-form label-width="120px">
            <el-form-item label="厂商">
              <el-select v-model="tray.brand" style="width:100%" @change="onTrayBrand">
                <el-option v-for="p in providers" :key="p.key" :label="p.name" :value="p.key" />
              </el-select>
            </el-form-item>
            <el-form-item label="已存账号">
              <el-select v-model="tray.accountId" clearable filterable style="width:100%" @change="onTrayAccount">
                <el-option v-for="a in trayAccounts" :key="a.id" :label="(a.name||a.key)+' / '+mask(a.access_key)" :value="a.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="AK"><el-input v-model="tray.access_key" /></el-form-item>
            <el-form-item label="SK"><el-input v-model="tray.secret_key" show-password /></el-form-item>
            <el-form-item label="Region/Zone"><el-input v-model="tray.region" placeholder="oss-cn-hangzhou / ap-guangzhou" /></el-form-item>
            <el-form-item label="Endpoint"><el-input v-model="tray.endpoint" placeholder="minio/ks3/jd 可选" /></el-form-item>
            <el-form-item label="Bucket">
              <el-input v-model="tray.bucket_name" placeholder="存储空间名称" />
            </el-form-item>
            <el-form-item label="目录前缀">
              <el-input v-model="tray.bucket_dir" placeholder="可选，如 uploads" />
            </el-form-item>
            <div class="tip">托盘右键「上传文件到托盘空间」；macOS 可拖文件到托盘图标。修改后保存即可（无需重启）。</div>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="热更新" name="update">
          <el-form label-width="120px">
            <el-form-item label="当前版本">{{ version }}</el-form-item>
            <el-form-item label="更新基址">
              <el-input v-model="updateBaseUrl" placeholder="https://cdn.example.com/akmanage/" />
              <div class="tip">需提供 version.json（version / asar / notes）</div>
            </el-form-item>
            <el-form-item label="远端版本">{{ remoteInfo?.remote || '-' }}</el-form-item>
            <el-form-item label="说明">{{ remoteInfo?.notes || '-' }}</el-form-item>
            <el-form-item label="进度"><el-progress :percentage="progress" /></el-form-item>
            <el-form-item v-if="pending" label="待应用包">
              <span class="mono">{{ pending.version }} · {{ pending.asarPath }}</span>
            </el-form-item>
            <div class="tip">打包版下载后点「应用并重启」会自动替换 resources/app.asar（Windows 退出后批处理替换）。</div>
          </el-form>
        </el-tab-pane>
        <el-tab-pane label="关于" name="about">
          <el-form label-width="120px">
            <el-form-item label="产品名称">云资产管理工具</el-form-item>
            <el-form-item label="版本">{{ version }}</el-form-item>
            <el-form-item label="数据文件">
              <div class="row-inline">
                <el-input v-model="dataPath" readonly style="flex:1" />
                <el-button @click="copyPath(dataPath)">复制</el-button>
              </div>
            </el-form-item>
            <el-form-item label="用户数据目录">
              <div class="row-inline">
                <el-input v-model="userDataDir" readonly style="flex:1" />
                <el-button @click="copyPath(userDataDir)">复制</el-button>
              </div>
              <div class="tip">资产不在安装目录/exe 内，而在本机 AppData。开发调试与正式安装共用同一目录，所以本机测过的账号会「跟着」安装版出现——不是打进了安装包。</div>
            </el-form-item>
            <el-form-item label="本地资产">
              <el-button type="danger" plain :loading="clearing" @click="clearLocalData">清空本地资产与设置</el-button>
              <div class="tip">仅清本机数据文件，不影响安装目录。清空后需重启窗口。</div>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="settingsVisible=false">关闭</el-button>
        <el-button @click="saveSettings">保存设置</el-button>
        <el-button type="primary" :loading="busy" @click="checkUpdate">检查更新</el-button>
        <el-button type="success" :loading="busy" :disabled="!remoteInfo?.hasUpdate && !remoteInfo?.force" @click="downloadUpdate">下载更新</el-button>
        <el-button type="warning" :loading="busy" :disabled="!pending" @click="applyUpdate">应用并重启</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { loadStore, saveStore } from '@/services/store'
import { STORAGE_PROVIDERS } from '@/constants/clouds'
import { uploadTrayFiles } from '@/services/trayUpload'

const router = useRouter()
const route = useRoute()
const tabs = [
  { name: 'storage', label: '云存储工具' },
  { name: 'server', label: '云服务工具' },
  { name: 'other', label: '其他工具' }
]
const tab = ref('storage')
const version = ref('0.1.6')
const settingsVisible = ref(false)
const settingsTab = ref('general')
const updateBaseUrl = ref('')
const downloadDir = ref('')
const dataPath = ref('')
const userDataDir = ref('')
const copyType = ref('url')
const deadlineMin = ref(60)
const imageStyle = ref('')
const providers = STORAGE_PROVIDERS
const storageAccounts = ref([])
const tray = reactive({
  brand: 'aliyun', accountId: '', access_key: '', secret_key: '',
  region: 'oss-cn-hangzhou', endpoint: '', bucket_name: '', bucket_dir: ''
})
const trayAccounts = computed(() =>
  storageAccounts.value.filter(a => !tray.brand || a.key === tray.brand))
const remoteInfo = ref(null)
const pending = ref(null)
const progress = ref(0)
const busy = ref(false)
const clearing = ref(false)
let offProgress = null
let offTray = null
let offTrayUpload = null
function mask(s) { return s ? s.slice(0, 4) + '****' + s.slice(-4) : '' }

watch(() => route.path, (p) => {
  if (p.includes('storage')) tab.value = 'storage'
  else if (p.includes('other')) tab.value = 'other'
  else tab.value = 'server'
}, { immediate: true })

function switchTab(name) {
  tab.value = name
  router.push('/' + name)
}

async function loadSettings() {
  const data = await loadStore()
  const s = data.settings || {}
  updateBaseUrl.value = s.updateBaseUrl || ''
  downloadDir.value = s.downloadDir || ''
  copyType.value = s.copyType || 'url'
  deadlineMin.value = s.deadlineMin || 60
  imageStyle.value = s.imageStyle || ''
  storageAccounts.value = data.storageAccounts || []
  const t = s.tray || {}
  Object.assign(tray, {
    brand: t.brand || 'aliyun',
    accountId: t.accountId || '',
    access_key: t.access_key || '',
    secret_key: t.secret_key || '',
    region: t.region || 'oss-cn-hangzhou',
    endpoint: t.endpoint || '',
    bucket_name: t.bucket_name || '',
    bucket_dir: t.bucket_dir || ''
  })
  if (!downloadDir.value && window.akDialog?.defaultDownload) {
    try { downloadDir.value = await window.akDialog.defaultDownload() } catch {}
  }
  if (window.akUpdate?.version) {
    try { version.value = await window.akUpdate.version() } catch {}
  }
  if (window.akUpdate?.pending) {
    try { pending.value = await window.akUpdate.pending() } catch {}
  }
  if (window.akUpdate?.dataPath) {
    try { dataPath.value = await window.akUpdate.dataPath() } catch {}
  }
  if (window.akUpdate?.userData) {
    try { userDataDir.value = await window.akUpdate.userData() } catch {}
  }
}
function copyPath(p) {
  if (!p) return
  navigator.clipboard?.writeText(p).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.error('复制失败')
  )
}
async function clearLocalData() {
  try {
    await ElMessageBox.confirm(
      '将清空本机全部云服务/云存储账号、设置与托盘配置。安装包本身不含这些数据。确认继续？',
      '清空本地资产',
      { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' }
    )
  } catch { return }
  clearing.value = true
  try {
    await saveStore({ vpsList: [], storageAccounts: [], settings: {} })
    storageAccounts.value = []
    ElMessage.success('已清空，请关闭并重新打开应用')
  } catch (e) { ElMessage.error(e.message) }
  finally { clearing.value = false }
}
function onTrayBrand() {
  tray.accountId = ''
}
function onTrayAccount() {
  const a = storageAccounts.value.find(x => x.id === tray.accountId)
  if (!a) return
  tray.access_key = a.access_key
  tray.secret_key = a.secret_key
  if (a.region) tray.region = a.region
  if (a.endpoint) tray.endpoint = a.endpoint
  tray.brand = a.key || tray.brand
}
async function pickDownloadDir() {
  if (!window.akDialog?.openDirectory) return ElMessage.error('请在 Electron 中运行')
  const d = await window.akDialog.openDirectory()
  if (d) downloadDir.value = d
}
async function openSettings() {
  await loadSettings()
  settingsVisible.value = true
}
async function saveSettings() {
  const data = await loadStore()
  data.settings = {
    ...(data.settings || {}),
    updateBaseUrl: updateBaseUrl.value.trim(),
    downloadDir: downloadDir.value.trim(),
    copyType: copyType.value,
    deadlineMin: deadlineMin.value,
    imageStyle: imageStyle.value,
    tray: {
      brand: tray.brand,
      accountId: tray.accountId,
      access_key: tray.access_key,
      secret_key: tray.secret_key,
      region: tray.region,
      endpoint: tray.endpoint,
      bucket_name: tray.bucket_name.trim(),
      bucket_dir: tray.bucket_dir.trim()
    }
  }
  await saveStore(data)
  ElMessage.success(settingsTab.value === 'tray' ? '托盘设置修改成功' : '下载路径修改成功')
}
async function checkUpdate() {
  if (!window.akUpdate) return ElMessage.error('请在 Electron 中运行')
  busy.value = true
  progress.value = 0
  try {
    await saveSettings()
    const r = await window.akUpdate.check({ updateBaseUrl: updateBaseUrl.value.trim() })
    if (!r.ok) throw new Error(r.error)
    remoteInfo.value = r.data
    if (r.data.reason === 'NO_CDN') ElMessage.warning(r.data.message)
    else if (r.data.hasUpdate) ElMessage.success('发现新版本：' + r.data.remote)
    else ElMessage.info('已是最新')
  } catch (e) { ElMessage.error(e.message) }
  finally { busy.value = false }
}
async function downloadUpdate() {
  if (!window.akUpdate) return
  busy.value = true
  try {
    const r = await window.akUpdate.download({ updateBaseUrl: updateBaseUrl.value.trim() })
    if (!r.ok) throw new Error(r.error)
    remoteInfo.value = r.data
    if (r.data.downloaded) pending.value = { version: r.data.remote, asarPath: r.data.asarPath }
    ElMessage.success(r.data.message || '完成')
  } catch (e) { ElMessage.error(e.message) }
  finally { busy.value = false }
}
async function applyUpdate() {
  if (!window.akUpdate?.apply) return ElMessage.error('请在 Electron 中运行')
  if (!pending.value) return ElMessage.warning('没有待应用的更新包')
  busy.value = true
  try {
    const r = await window.akUpdate.apply({ relaunch: true })
    if (!r?.ok) throw new Error(r?.error || '应用失败')
    ElMessage.success(r.message || '正在应用更新…')
  } catch (e) { ElMessage.error(e.message) }
  finally { busy.value = false }
}

async function handleTrayUpload(files) {
  if (!files?.length) return
  try {
    ElMessage.info('托盘上传开始：' + files.length + ' 个文件')
    const r = await uploadTrayFiles(files)
    ElMessage.success(`托盘上传完成 ${r.ok}/${r.total} → ${r.tray.bucket_name}`)
    if (window.akSync?.notify) {
      window.akSync.notify({ message: `托盘上传完成 ${r.ok}/${r.total}` })
    }
  } catch (e) {
    ElMessage.error(e.message)
    if (window.akSync?.notify) window.akSync.notify({ message: e.message })
    if (String(e.message).includes('托盘上传位置')) {
      settingsTab.value = 'tray'
      settingsVisible.value = true
    }
  }
}

onMounted(async () => {
  await loadSettings()
  if (window.akUpdate?.onProgress) offProgress = window.akUpdate.onProgress((p) => { progress.value = p })
  if (window.akUpdate?.onTrayCheck) {
    offTray = window.akUpdate.onTrayCheck(() => { settingsVisible.value = true; checkUpdate() })
  }
  if (window.akSync?.onTrayUpload) {
    offTrayUpload = window.akSync.onTrayUpload(handleTrayUpload)
  }
})
onBeforeUnmount(() => {
  offProgress && offProgress()
  offTray && offTray()
  offTrayUpload && offTrayUpload()
})
</script>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: transparent;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 0 22px;
  height: 58px;
  background: var(--header-bg);
  backdrop-filter: blur(12px);
  color: var(--header-text);
  border-bottom: 1px solid rgba(227, 232, 239, 0.9);
  box-shadow: 0 1px 0 rgba(255,255,255,0.8) inset, var(--shadow-sm);
  z-index: 10;
  position: sticky;
  top: 0;
}
.top-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
  flex: 1;
}
.logo-mark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(145deg, #4aa3f5 0%, #1f6fd1 100%);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(45, 140, 240, 0.28);
}
.brand-block {
  display: flex;
  align-items: baseline;
  gap: 8px;
  flex-shrink: 0;
}
.brand {
  font-size: 15px;
  font-weight: 700;
  color: var(--title);
  letter-spacing: 0.3px;
  font-family: var(--display);
}
.ver {
  font-size: 11px;
  color: var(--muted);
  font-family: var(--mono);
  background: var(--bg2);
  border: 1px solid var(--line);
  padding: 1px 7px;
  border-radius: 999px;
}
.top-divider {
  width: 1px;
  height: 22px;
  background: var(--line);
  flex-shrink: 0;
  margin: 0 4px;
}
.tabs {
  display: flex;
  gap: 3px;
  align-items: center;
  padding: 3px;
  border-radius: 10px;
  background: #f0f3f8;
  border: 1px solid var(--line);
  min-width: 0;
}
.tab {
  border: none;
  background: transparent;
  color: var(--text);
  padding: 7px 16px;
  border-radius: 7px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
  transition: color .15s, background .15s, box-shadow .15s;
}
.tab:hover { color: var(--accent); }
.tab.on {
  color: var(--accent-active);
  font-weight: 650;
  background: #fff;
  box-shadow: 0 1px 3px rgba(20, 28, 44, 0.08);
}
.actions { display: flex; justify-content: flex-end; flex-shrink: 0; }
.hdr-btn {
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
  padding: 6px 14px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: border-color .15s, color .15s, background .15s;
}
.hdr-ico { opacity: 0.7; font-size: 13px; }
.hdr-btn:hover {
  color: var(--accent);
  border-color: #a8cfff;
  background: var(--accent-soft);
}
.body {
  flex: 1;
  overflow: auto;
  padding: 10px 14px 16px;
}
.tip { font-size: 12px; color: var(--muted); margin-top: 4px; }
.mono { font-family: var(--mono); font-size: 12px; word-break: break-all; }
.row-inline { display: flex; gap: 8px; width: 100%; }
.settings-tabs :deep(.el-tabs__header) { margin-bottom: 14px; }
</style>
