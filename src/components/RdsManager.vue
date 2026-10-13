<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    width="92%"
    top="3vh"
    class="rds-dlg"
  >
    <template #header>
      <div class="ak-dlg-hd">
        <div class="titles">
          <h4>云数据库资产</h4>
          <p>{{ row?.as_name || '' }} · 阿里云 RDS</p>
        </div>
        <div class="meta">
          <span class="cloud-chip ali"><i class="prov-dot" data-k="alibaba_cloud"></i>阿里云</span>
          <el-tag size="small" effect="plain">{{ flatInstances.length }} 实例</el-tag>
        </div>
      </div>
    </template>

    <div class="ak-toolbar">
      <el-tooltip content="注意全部初始化，会触发阿里云的异常的RDS资源遍历行为。慎用" placement="top">
        <el-button type="warning" :loading="loading" @click="rdsInitAll">全部初始化</el-button>
      </el-tooltip>
      <el-tooltip content="部分初始化建议不要选择多个区域遍历；注意点击后不会出现任何查询rds操作，避免出现告警，请手动选择初始化。" placement="top">
        <el-button type="primary" :loading="loading" @click="openPartial">部分初始化</el-button>
      </el-tooltip>
      <el-button :loading="loading" @click="loadRegions">加载地域</el-button>
      <el-select v-model="region" placeholder="地域" style="width:220px" filterable>
        <el-option v-for="r in regions" :key="r.RegionId" :label="r.LocalName || r.RegionId" :value="r.RegionId" />
      </el-select>
      <el-button :loading="loading" @click="loadInstances">刷新当前地域</el-button>
      <span class="grow"></span>
      <span class="muted">遍历多区域可能触发告警</span>
    </div>

    <el-alert v-if="initSummary" type="success" :closable="false" :title="initSummary" style="margin-bottom:10px" show-icon />

    <div class="table-shell">
    <el-table :data="flatInstances" height="480" v-loading="loading">
      <el-table-column prop="LocalName" label="区域" width="120" />
      <el-table-column prop="DBInstanceId" label="实例id" min-width="160">
        <template #default="{ row }"><code class="mono">{{ row.DBInstanceId }}</code></template>
      </el-table-column>
      <el-table-column prop="DBInstanceDescription" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column prop="Engine" label="类型" width="100" />
      <el-table-column prop="EngineVersion" label="版本" width="90" />
      <el-table-column prop="DBInstanceStatus" label="状态" width="110">
        <template #default="{ row }">
          <span class="status-pill" :class="row.DBInstanceStatus==='Running' ? 'ok' : 'warn'">{{ row.DBInstanceStatus }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="420" fixed="right">
        <template #default="{ row }">
          <div class="ops">
            <el-button link type="primary" @click="openInit(row)">单独初始化</el-button>
            <el-dropdown trigger="click" @command="(cmd) => onRdsMore(cmd, row)">
              <el-button link>更多</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="accounts">账号列表</el-dropdown-item>
                  <el-dropdown-item command="whitelist">白名单</el-dropdown-item>
                  <el-dropdown-item command="whiteEdit">改白名单</el-dropdown-item>
                  <el-dropdown-item command="net">实例信息</el-dropdown-item>
                  <el-dropdown-item command="delAccount" divided class="danger-item">删除账号</el-dropdown-item>
                  <el-dropdown-item command="delPublic" class="danger-item">删除外网</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <el-dialog v-model="jsonVisible" title="RDS 信息查看" width="720px" append-to-body>
      <pre class="ak-json">{{ jsonText }}</pre>
    </el-dialog>

    <el-dialog v-model="whiteVisible" title="修改白名单" width="480px" append-to-body>
      <el-form label-width="100px">
        <el-form-item label="实例">{{ whiteRow?.DBInstanceId }}</el-form-item>
        <el-form-item label="SecurityIps">
          <el-input v-model="whiteIps" type="textarea" :rows="3" placeholder="逗号分隔，如 1.2.3.4,0.0.0.0/0" />
        </el-form-item>
        <el-form-item label="组名">
          <el-input v-model="whiteGroup" placeholder="默认 default" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="whiteVisible=false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="saveWhite">保存白名单</el-button>
        <el-button type="danger" :loading="loading" @click="clearWhite">清空为 127.0.0.1</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="partialVisible" title="部分初始化rds" width="520px" append-to-body>
      <el-alert type="warning" :closable="false" style="margin-bottom:10px"
        title="可以选择部分区域加载，避免告警。不选择则不会查询。" />
      <el-select v-model="partialRegions" multiple filterable placeholder="选择区域" style="width:100%">
        <el-option v-for="r in regions" :key="r.RegionId" :label="(r.LocalName||'')+' -- '+r.RegionId" :value="r.RegionId" />
      </el-select>
      <template #footer>
        <el-button @click="partialVisible=false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="rdsInitPartial">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="initVisible" title="单独初始化 RDS" width="520px" append-to-body>
      <el-form label-width="110px">
        <el-form-item label="实例">{{ initRow?.DBInstanceId }}</el-form-item>
        <el-form-item label="高权限账号"><el-input v-model="initForm.user" placeholder="如 kingadmin" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="initForm.pass" show-password /></el-form-item>
        <el-form-item label="白名单IP"><el-input v-model="initForm.ips" placeholder="0.0.0.0/0 可能触发告警" /></el-form-item>
        <el-form-item>
          <el-checkbox v-model="initForm.doUser">创建超级账号</el-checkbox>
          <el-checkbox v-model="initForm.doPublic">申请外网地址</el-checkbox>
          <el-checkbox v-model="initForm.doWhite">修改白名单</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="initVisible=false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="runSingleInit">执行</el-button>
      </template>
    </el-dialog>
  </el-dialog>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  aliCreateRdsClientAli, aliRdsDescribeRegions, aliRdsDescribeDBInstances,
  aliRdsDescribeAccounts, aliRdsDescribeDBInstanceIPArrayList, aliRdsDescribeDBInstanceNetInfo,
  aliRdsCreateAccount, aliRdsAllocateInstancePublicConnection, aliRdsModifySecurityIps,
  aliRdsGrantAccountPrivilege, aliRdsDescribeDatabases,
  aliRdsDeleteAccount, aliRdsReleaseInstancePublicConnection
} from '@/services/aliyun/rds'
import { useVpsStore } from '@/stores/vps'

const props = defineProps({ modelValue: Boolean, row: Object })
const emit = defineEmits(['update:modelValue'])
const store = useVpsStore()
const loading = ref(false)
const regions = ref([])
const region = ref('')
const rdsData = ref([])
const initSummary = ref('')
const jsonVisible = ref(false)
const jsonText = ref('')
const initVisible = ref(false)
const initRow = ref(null)
function onRdsMore(cmd, row) {
  if (cmd === 'accounts') return act(row, 'accounts')
  if (cmd === 'whitelist') return act(row, 'whitelist')
  if (cmd === 'whiteEdit') return openWhite(row)
  if (cmd === 'net') return act(row, 'net')
  if (cmd === 'delAccount') return delAccount(row)
  if (cmd === 'delPublic') return delPublic(row)
}

const initForm = reactive({
  user: 'kingadmin',
  pass: 'King@' + Math.random().toString(36).slice(2, 8) + '9',
  ips: '0.0.0.0/0',
  doUser: true,
  doPublic: true,
  doWhite: true
})
const whiteVisible = ref(false)
const whiteRow = ref(null)
const whiteIps = ref('0.0.0.0/0')
const whiteGroup = ref('default')
const partialVisible = ref(false)
const partialRegions = ref([])

const flatInstances = computed(() => {
  const out = []
  for (const block of rdsData.value) {
    for (const inst of block.DBInstance || []) {
      out.push({ ...inst, LocalName: block.LocalName, RegionId: block.RegionId })
    }
  }
  return out
})

watch(() => props.modelValue, (v) => {
  if (v) {
    rdsData.value = props.row?.rds_data || []
    initSummary.value = rdsData.value.length
      ? `已缓存 ${rdsData.value.length} 个区域的 RDS 记录`
      : ''
  }
})

function client() {
  return aliCreateRdsClientAli(props.row.access_key, props.row.secret_key)
}

function uniqRegions(list) {
  const m = new Map()
  for (const r of list || []) if (!m.has(r.RegionId)) m.set(r.RegionId, r)
  return [...m.values()]
}

async function loadRegions() {
  loading.value = true
  try {
    const res = await aliRdsDescribeRegions(client())
    regions.value = uniqRegions(res.Regions?.RDSRegion || res.Regions?.Region || [])
    if (!region.value && regions.value[0]) region.value = regions.value[0].RegionId
  } catch (e) {
    ElMessage.error('加载地域失败：' + (e.message || e))
  } finally { loading.value = false }
}

async function loadInstances() {
  if (!region.value) return ElMessage.error('请选择地域')
  loading.value = true
  try {
    const res = await aliRdsDescribeDBInstances(client(), {
      RegionId: region.value, DBInstanceStatus: 'Running', PageSize: 100
    })
    const list = res.Items?.DBInstance || []
    const meta = regions.value.find(r => r.RegionId === region.value) || { RegionId: region.value, LocalName: region.value }
    const block = {
      ...meta,
      DBInstance: list.map(x => ({ ...x, uuid: crypto.randomUUID?.() || String(Date.now()) })),
      count: list.length,
      name: props.row.name,
      as_name: props.row.as_name,
      uuid: crypto.randomUUID?.() || String(Date.now())
    }
    rdsData.value = [block]
    await persist()
    ElMessage.success(`区域 ${meta.LocalName || region.value}：${list.length} 台`)
  } catch (e) {
    ElMessage.error('查询失败！')
  } finally { loading.value = false }
}

async function fetchRegionsForInit() {
  const c = client()
  const regRes = await aliRdsDescribeRegions(c)
  const regs = uniqRegions(regRes.Regions?.RDSRegion || [])
  regions.value = regs
  return regs
}

async function rdsInitByRegions(regs) {
  const c = client()
  const blocks = []
  let html = ''
  await Promise.all(regs.map(async (t) => {
    try {
      const r = await aliRdsDescribeDBInstances(c, {
        RegionId: t.RegionId, DBInstanceStatus: 'Running', PageSize: 100
      })
      const list = r.Items?.DBInstance || []
      if (list.length) {
        list.forEach(e => { e.uuid = crypto.randomUUID?.() || String(Math.random()) })
        blocks.push({
          RegionId: t.RegionId, LocalName: t.LocalName, RegionEndpoint: t.RegionEndpoint,
          ZoneId: t.ZoneId, ZoneName: t.ZoneName,
          DBInstance: list, count: r.PageRecordCount,
          name: props.row.name, as_name: props.row.as_name,
          uuid: crypto.randomUUID?.() || String(Math.random())
        })
        html += `区域名称：${t.LocalName} rds数量：${list.length}台；`
      }
    } catch (err) {
      console.warn(t.RegionId, err)
    }
  }))
  rdsData.value = blocks
  await persist()
  initSummary.value = blocks.length ? html : '查询完成，未查询到rds。'
  return blocks.length
}

async function rdsInitAll() {
  await ElMessageBox.confirm('将遍历全部地域查询 Running 状态 RDS（对齐原版 rdsInit）。继续？', '全部初始化rds')
  loading.value = true
  initSummary.value = ''
  try {
    const regs = await fetchRegionsForInit()
    if (!regs.length) {
      ElMessage.error('解析rds区域信息空')
      return
    }
    await rdsInitByRegions(regs)
    ElMessage.success('全部初始化完成')
  } catch (e) {
    ElMessage.error('初始化rds区域失败！')
  } finally { loading.value = false }
}

async function openPartial() {
  loading.value = true
  try {
    if (!regions.value.length) await fetchRegionsForInit()
    partialRegions.value = []
    partialVisible.value = true
  } catch (e) {
    ElMessage.error('加载地域失败：' + (e.message || e))
  } finally { loading.value = false }
}

async function rdsInitPartial() {
  if (!partialRegions.value.length) return ElMessage.error('接管区域不能为空！')
  loading.value = true
  try {
    const regs = regions.value.filter(r => partialRegions.value.includes(r.RegionId))
    await rdsInitByRegions(regs)
    partialVisible.value = false
    ElMessage.success('部分初始化完成')
  } catch (e) {
    ElMessage.error('初始化rds区域失败！')
  } finally { loading.value = false }
}

async function persist() {
  await store.update({ ...props.row, rds_data: rdsData.value })
}

async function act(row, type) {
  loading.value = true
  try {
    const c = client()
    let res
    if (type === 'accounts') res = await aliRdsDescribeAccounts(c, { DBInstanceId: row.DBInstanceId })
    else if (type === 'whitelist') res = await aliRdsDescribeDBInstanceIPArrayList(c, { DBInstanceId: row.DBInstanceId })
    else res = await aliRdsDescribeDBInstanceNetInfo(c, { DBInstanceId: row.DBInstanceId })
    jsonText.value = JSON.stringify(res, null, 2)
    jsonVisible.value = true
  } catch (e) {
    ElMessage.error(String(e.message || e))
  } finally { loading.value = false }
}

function openInit(row) {
  initRow.value = row
  initVisible.value = true
}

function openWhite(row) {
  whiteRow.value = row
  whiteIps.value = row.白名单 || '0.0.0.0/0'
  whiteGroup.value = 'default'
  whiteVisible.value = true
}

async function saveWhite() {
  if (!whiteRow.value || !whiteIps.value) return ElMessage.error('IP 不能为空')
  loading.value = true
  try {
    await aliRdsModifySecurityIps(client(), {
      DBInstanceId: whiteRow.value.DBInstanceId,
      SecurityIps: whiteIps.value,
      DBInstanceIPArrayName: whiteGroup.value || 'default'
    })
    for (const block of rdsData.value) {
      for (const inst of block.DBInstance || []) {
        if (inst.DBInstanceId === whiteRow.value.DBInstanceId) inst.白名单 = whiteIps.value
      }
    }
    await persist()
    whiteVisible.value = false
    ElMessage.success('白名单已更新')
  } catch (e) { ElMessage.error(String(e.message || e)) }
  finally { loading.value = false }
}

async function clearWhite() {
  whiteIps.value = '127.0.0.1'
  await saveWhite()
}

async function delAccount(row) {
  const cached = row.user?.AccountName
  let name = cached
  if (!name) {
    try {
      const { value } = await ElMessageBox.prompt('输入要删除的 AccountName', '删除账号', {
        inputPlaceholder: '如 kingadmin'
      })
      name = (value || '').trim()
    } catch { return }
  } else {
    await ElMessageBox.confirm(`确定删除账号 ${name}？`, '提示')
  }
  if (!name) return ElMessage.error('暂无可删除的用户！')
  loading.value = true
  try {
    await aliRdsDeleteAccount(client(), {
      DBInstanceId: row.DBInstanceId,
      AccountName: name
    })
    for (const block of rdsData.value) {
      for (const inst of block.DBInstance || []) {
        if (inst.DBInstanceId === row.DBInstanceId) inst.user = null
      }
    }
    await persist()
    ElMessage.success('删除账号成功！')
  } catch (e) {
    ElMessage.error('删除' + name + '失败！' + (e.message || e))
  } finally { loading.value = false }
}

async function delPublic(row) {
  let conn = row.外网地址记录?.外网地址
  if (!conn) {
    try {
      const net = await aliRdsDescribeDBInstanceNetInfo(client(), { DBInstanceId: row.DBInstanceId })
      const items = net.DBInstanceNetInfos?.DBInstanceNetInfo || []
      const pub = items.find(x => x.IPType === 'Public' || x.ConnectionStringType === 'Public')
      conn = pub?.ConnectionString
    } catch {}
  }
  if (!conn) return ElMessage.error('未申请过外网地址！')
  await ElMessageBox.confirm(`确定释放外网地址 ${conn}？`, '提示')
  loading.value = true
  try {
    await aliRdsReleaseInstancePublicConnection(client(), {
      DBInstanceId: row.DBInstanceId,
      CurrentConnectionString: conn
    })
    for (const block of rdsData.value) {
      for (const inst of block.DBInstance || []) {
        if (inst.DBInstanceId === row.DBInstanceId) inst.外网地址记录 = null
      }
    }
    await persist()
    ElMessage.success('删除外网地址成功！')
  } catch (e) {
    ElMessage.error('删除外网地址失败！' + (e.message || e))
  } finally { loading.value = false }
}

function defaultPort(engine) {
  if (engine === 'SQLServer') return '1433'
  if (engine === 'PostgreSQL') return '5432'
  return '3306'
}

async function runSingleInit() {
  const row = initRow.value
  if (!row) return
  loading.value = true
  const c = client()
  const result = {}
  try {
    if (initForm.doUser) {
      if (!initForm.user || !initForm.pass) throw new Error('账号密码不能为空')
      await aliRdsCreateAccount(c, {
        DBInstanceId: row.DBInstanceId,
        AccountName: initForm.user,
        AccountPassword: initForm.pass,
        AccountType: 'Super'
      })
      result.user = { AccountName: initForm.user }
      try {
        const dbs = await aliRdsDescribeDatabases(c, { DBInstanceId: row.DBInstanceId })
        const list = dbs.Databases?.Database || []
        for (const db of list.slice(0, 20)) {
          try {
            await aliRdsGrantAccountPrivilege(c, {
              DBInstanceId: row.DBInstanceId,
              AccountName: initForm.user,
              DBName: db.DBName,
              AccountPrivilege: 'ReadWrite'
            })
          } catch {}
        }
      } catch {}
    }
    if (initForm.doPublic) {
      const port = defaultPort(row.Engine)
      try {
        const a = await aliRdsAllocateInstancePublicConnection(c, {
          DBInstanceId: row.DBInstanceId,
          ConnectionStringPrefix: row.DBInstanceId + 'king',
          Port: port
        })
        result.外网地址记录 = { 外网地址: a.ConnectionString, 端口: port }
      } catch (e) {
        const s = String(e.message || e)
        if (s.includes('Other endpoint exist')) ElMessage.warning('已存在外网地址！')
        else if (s.includes('current instance state')) ElMessage.warning('当前实例正在执行其他操作，请等待稍后重试！')
        else throw e
      }
    }
    if (initForm.doWhite && initForm.ips) {
      await aliRdsModifySecurityIps(c, {
        DBInstanceId: row.DBInstanceId,
        SecurityIps: initForm.ips
      })
      result.白名单 = initForm.ips
    }
    // merge into cache
    for (const block of rdsData.value) {
      for (const inst of block.DBInstance || []) {
        if (inst.DBInstanceId === row.DBInstanceId) Object.assign(inst, result)
      }
    }
    await persist()
    jsonText.value = JSON.stringify(result, null, 2)
    jsonVisible.value = true
    initVisible.value = false
    ElMessage.success('单独初始化完成')
  } catch (e) {
    ElMessage.error(String(e.message || e))
  } finally { loading.value = false }
}
</script>

<style scoped>
.table-shell {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}
.ops { display: inline-flex; align-items: center; gap: 2px; }
.mono { font-family: var(--mono); font-size: 12px; }
:deep(.danger-item) { color: var(--danger) !important; }
</style>
