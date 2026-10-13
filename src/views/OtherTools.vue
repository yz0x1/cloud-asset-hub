<template>
  <div class="other-page ak-panel">
    <div class="ak-panel-hd compact">
      <div>
        <h3>其他工具</h3>
        <p class="sub">钉钉 / 飞书 OpenAPI</p>
      </div>
    </div>

    <div class="ak-panel-bd tight">
      <el-tabs v-model="tab" class="other-tabs">
        <!-- 钉钉 -->
        <el-tab-pane label="钉钉工具" name="ding">
          <div class="tool-layout">
            <section class="cred-block">
              <div class="block-label">应用凭据</div>
              <el-form label-width="96px" class="cred-form" @submit.prevent>
                <el-form-item label="AppKey">
                  <el-input v-model="ding.appKey" placeholder="钉钉应用 AppKey" clearable />
                </el-form-item>
                <el-form-item label="AppSecret">
                  <el-input v-model="ding.appSecret" show-password placeholder="AppSecret" clearable />
                </el-form-item>
                <el-form-item label="Token">
                  <el-input v-model="ding.accessToken" placeholder="先点「获取 token」" clearable />
                </el-form-item>
                <el-form-item label="UserId">
                  <el-input v-model="ding.userId" placeholder="查用户 / 知识库前先填" clearable />
                </el-form-item>
              </el-form>
            </section>

            <section class="action-block">
              <div class="block-label">操作</div>
              <div class="btn-groups">
                <div class="btn-group">
                  <span class="group-lab">鉴权</span>
                  <div class="btn-row">
                    <el-button type="primary" :loading="loading" @click="getDingToken">获取 token</el-button>
                    <el-button :loading="loading" @click="getDingChat">应用信息</el-button>
                    <el-button :loading="loading" @click="getDingListadmin">管理员</el-button>
                  </div>
                </div>
                <div class="btn-group">
                  <span class="group-lab">查询</span>
                  <div class="btn-row">
                    <el-button :loading="loading" @click="getDingUser">用户信息</el-button>
                    <el-button :loading="loading" @click="getDingRole">角色信息</el-button>
                    <el-button :loading="loading" @click="getDingDepartment">部门列表</el-button>
                    <el-button type="primary" plain :loading="loading" @click="getDingKnowledge">企业知识库</el-button>
                  </div>
                </div>
                <div class="btn-group">
                  <span class="group-lab">写入</span>
                  <div class="btn-row">
                    <el-button type="warning" @click="bbVisible=true">创建公告</el-button>
                    <el-button type="success" @click="userVisible=true">创建用户</el-button>
                  </div>
                </div>
                <div class="btn-group">
                  <span class="group-lab">本地</span>
                  <div class="btn-row">
                    <el-button @click="saveDingCreds">保存凭据</el-button>
                    <el-button @click="dingLog=''">清空日志</el-button>
                  </div>
                </div>
              </div>
            </section>

            <section class="log-block">
              <div class="block-label row">
                <span>输出日志</span>
                <el-button link type="primary" @click="copyLog(dingLog)">复制</el-button>
              </div>
              <el-input
                id="dingdingTextarea"
                type="textarea"
                :rows="12"
                v-model="dingLog"
                readonly
                class="log-box"
                placeholder="操作结果会出现在这里"
              />
            </section>
          </div>
        </el-tab-pane>

        <!-- 飞书 -->
        <el-tab-pane label="飞书工具" name="feishu">
          <div class="tool-layout">
            <section class="cred-block">
              <div class="block-label">应用凭据</div>
              <el-form label-width="96px" class="cred-form" @submit.prevent>
                <el-form-item label="AppId">
                  <el-input v-model="feishu.appKey" placeholder="飞书 AppId" clearable />
                </el-form-item>
                <el-form-item label="AppSecret">
                  <el-input v-model="feishu.appSecret" show-password placeholder="AppSecret" clearable />
                </el-form-item>
                <el-form-item label="Token">
                  <el-input v-model="feishu.accessToken" placeholder="先点「获取 token」" clearable />
                </el-form-item>
              </el-form>
            </section>

            <section class="action-block">
              <div class="block-label">操作</div>
              <div class="btn-groups">
                <div class="btn-group">
                  <span class="group-lab">鉴权 / 查询</span>
                  <div class="btn-row">
                    <el-button type="primary" :loading="loading" @click="getFeiShuToken">获取 token</el-button>
                    <el-button :loading="loading" @click="getFeishuTenant">企业信息</el-button>
                  </div>
                </div>
                <div class="btn-group">
                  <span class="group-lab">本地</span>
                  <div class="btn-row">
                    <el-button @click="saveFeishuCreds">保存凭据</el-button>
                    <el-button @click="feishuLog=''">清空日志</el-button>
                  </div>
                </div>
              </div>
            </section>

            <section class="log-block">
              <div class="block-label row">
                <span>输出日志</span>
                <el-button link type="primary" @click="copyLog(feishuLog)">复制</el-button>
              </div>
              <el-input
                type="textarea"
                :rows="12"
                v-model="feishuLog"
                readonly
                class="log-box"
                placeholder="操作结果会出现在这里"
              />
            </section>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="bbVisible" title="创建钉钉公告" width="560px" :close-on-click-modal="false">
      <el-form label-width="120px">
        <el-form-item label="操作者userid" required>
          <el-input v-model="bb.operation_userid" placeholder="必填" />
        </el-form-item>
        <el-form-item label="标题" required><el-input v-model="bb.title" /></el-form-item>
        <el-form-item label="内容" required><el-input v-model="bb.content" type="textarea" :rows="4" /></el-form-item>
        <el-form-item label="作者"><el-input v-model="bb.author" /></el-form-item>
        <el-form-item label="公告类型">
          <el-select v-model="bb.private_level" style="width:100%">
            <el-option label="普通公告" :value="0" />
            <el-option label="保密公告" :value="20" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门ID列表">
          <el-input v-model="bb.deptid_list" placeholder="逗号分隔" />
        </el-form-item>
        <el-form-item label="接收人userid">
          <el-input v-model="bb.userid_list" placeholder="逗号分隔，最多1000" />
        </el-form-item>
        <el-form-item label="置顶">
          <el-switch v-model="bb.push_top" active-text="是" inactive-text="否" />
        </el-form-item>
        <el-form-item label="发DING">
          <el-switch v-model="bb.ding" active-text="是" inactive-text="否" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bbVisible=false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="dingBlackboardCreate">发送</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="userVisible" title="创建钉钉用户" width="480px" :close-on-click-modal="false">
      <el-form label-width="100px">
        <el-form-item label="姓名" required><el-input v-model="du.name" /></el-form-item>
        <el-form-item label="手机号" required><el-input v-model="du.mobile" /></el-form-item>
        <el-form-item label="部门ID" required>
          <el-input v-model="du.dept_id_list" placeholder="部门ID，多个逗号分隔" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userVisible=false">取消</el-button>
        <el-button type="primary" :loading="loading" @click="dingCreateUser">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { httpRequest } from '@/services/cloud'
import { loadStore, saveStore } from '@/services/store'

const tab = ref('ding')
const loading = ref(false)
const ding = reactive({ appKey: '', appSecret: '', accessToken: '', userId: '' })
const feishu = reactive({ appKey: '', appSecret: '', accessToken: '' })
const dingLog = ref('')
const feishuLog = ref('')
const bbVisible = ref(false)
const userVisible = ref(false)
const bb = reactive({
  operation_userid: '', title: '', content: '', author: '',
  private_level: 0, deptid_list: '', userid_list: '',
  push_top: true, ding: false
})
const du = reactive({ name: '', mobile: '', dept_id_list: '' })

onMounted(async () => {
  try {
    const data = await loadStore()
    const d = data.settings?.dingtalk || {}
    const f = data.settings?.feishu || {}
    Object.assign(ding, {
      appKey: d.appKey || '', appSecret: d.appSecret || '',
      accessToken: d.accessToken || '', userId: d.userId || ''
    })
    Object.assign(feishu, {
      appKey: f.appKey || '', appSecret: f.appSecret || '', accessToken: f.accessToken || ''
    })
  } catch {}
})

function now() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
function copyLog(t) {
  if (!t) return ElMessage.info('暂无日志')
  navigator.clipboard?.writeText(t).then(() => ElMessage.success('已复制'), () => ElMessage.error('复制失败'))
}

async function saveDingCreds() {
  const data = await loadStore()
  data.settings = data.settings || {}
  data.settings.dingtalk = { ...ding }
  await saveStore(data)
  ElMessage.success('钉钉凭据已保存')
}
async function saveFeishuCreds() {
  const data = await loadStore()
  data.settings = data.settings || {}
  data.settings.feishu = { ...feishu }
  await saveStore(data)
  ElMessage.success('飞书凭据已保存')
}

async function dingPost(url, body) {
  return httpRequest({
    url, method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

async function needToken() {
  if (!ding.accessToken) {
    ElMessage.error('accessToken 不能为空，请先获取 token！')
    return false
  }
  return true
}

async function getDingToken() {
  if (!ding.appKey || !ding.appSecret) return ElMessage.error('AppKey/AppSecret 不能为空！')
  loading.value = true
  try {
    const raw = await httpRequest({
      url: `https://oapi.dingtalk.com/gettoken?appkey=${encodeURIComponent(ding.appKey)}&appsecret=${encodeURIComponent(ding.appSecret)}`,
      method: 'GET'
    })
    const o = JSON.parse(raw)
    if (o.errcode) return ElMessage.error(o.errmsg)
    ding.accessToken = o.access_token
    dingLog.value += `\r时间：${now()} 获取token：\r ${o.access_token} 有效期：${o.expires_in} \r`
    ElMessage.success('token 已获取')
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function getDingChat() {
  if (!(await needToken())) return
  loading.value = true
  try {
    const raw = await dingPost(
      `https://oapi.dingtalk.com/topapi/org/getoaaprofile?access_token=${ding.accessToken}`,
      {}
    )
    dingLog.value += `\r时间：${now()} 获取应用信息：\r ${raw}  \r`
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function getDingListadmin() {
  if (!(await needToken())) return
  loading.value = true
  try {
    const raw = await dingPost(
      `https://oapi.dingtalk.com/topapi/user/listadmin?access_token=${ding.accessToken}`,
      {}
    )
    dingLog.value += `\r时间：${now()} 获取管理员：\r ${raw}  \r`
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function getDingUser() {
  if (!(await needToken())) return
  if (!ding.userId) return ElMessage.error('UserId 不能为空')
  loading.value = true
  try {
    const raw = await dingPost(
      `https://oapi.dingtalk.com/topapi/v2/user/get?access_token=${ding.accessToken}`,
      { userid: ding.userId }
    )
    dingLog.value += `\r时间：${now()} 获取用户信息：\r ${raw}  \r`
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function getDingRole() {
  if (!(await needToken())) return
  loading.value = true
  try {
    const raw = await dingPost(
      `https://oapi.dingtalk.com/topapi/role/list?access_token=${ding.accessToken}`,
      { size: 100, offset: 0 }
    )
    dingLog.value += `\r时间：${now()} 获取角色信息：\r ${raw}  \r`
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function getDingDepartment() {
  if (!(await needToken())) return
  loading.value = true
  try {
    const raw = await dingPost(
      `https://oapi.dingtalk.com/topapi/v2/department/listsub?access_token=${ding.accessToken}`,
      { dept_id: 1 }
    )
    dingLog.value += `\r时间：${now()} 获取部门列表：\r ${raw}  \r`
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function getDingKnowledge() {
  if (!(await needToken())) return
  if (!ding.userId) return ElMessage.error('UserId 不能为空')
  loading.value = true
  try {
    const raw = await httpRequest({
      url: `https://api.dingtalk.com/v2.0/wiki/spaces?operatorId=${encodeURIComponent(ding.userId)}&maxResults=50`,
      method: 'GET',
      headers: { 'x-acs-dingtalk-access-token': ding.accessToken }
    })
    dingLog.value += `\r时间：${now()} 获取企业知识库：\r ${raw}  \r`
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function dingBlackboardCreate() {
  if (!(await needToken())) return
  if (!bb.operation_userid || !bb.title || !bb.content) {
    return ElMessage.error('操作者 / 标题 / 内容 不能为空')
  }
  loading.value = true
  try {
    const body = {
      create_request: {
        operation_userid: bb.operation_userid,
        title: bb.title,
        content: bb.content,
        author: bb.author || undefined,
        private_level: bb.private_level,
        deptid_list: bb.deptid_list || undefined,
        userid_list: bb.userid_list || undefined,
        push_top: bb.push_top,
        ding: bb.ding
      }
    }
    const raw = await dingPost(
      `https://oapi.dingtalk.com/topapi/blackboard/create?access_token=${ding.accessToken}`,
      body
    )
    const o = JSON.parse(raw)
    dingLog.value += `\r时间：${now()} 创建公告：\r ${raw}  \r`
    if (o.errcode) return ElMessage.error(o.errmsg)
    bbVisible.value = false
    ElMessage.success('公告已创建')
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function dingCreateUser() {
  if (!(await needToken())) return
  if (!du.name || !du.mobile || !du.dept_id_list) {
    return ElMessage.error('姓名 / 手机号 / 部门ID 不能为空')
  }
  loading.value = true
  try {
    const body = {
      name: du.name,
      mobile: du.mobile,
      hide_mobile: false,
      dept_id_list: du.dept_id_list
    }
    const raw = await dingPost(
      `https://oapi.dingtalk.com/topapi/v2/user/create?access_token=${ding.accessToken}`,
      body
    )
    const o = JSON.parse(raw)
    if (o.errcode && o.errcode !== 40103) return ElMessage.error(o.errmsg)
    dingLog.value += `\r时间：${now()} 创建用户：\r ${JSON.stringify(o)}  \r`
    userVisible.value = false
    if (!o.errcode) ElMessage.success('用户已创建')
    else ElMessage.warning(o.errmsg || '已提交')
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function getFeiShuToken() {
  if (!feishu.appKey || !feishu.appSecret) return ElMessage.error('AppId/AppSecret 不能为空！')
  loading.value = true
  try {
    const raw = await httpRequest({
      url: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      body: JSON.stringify({ app_id: feishu.appKey, app_secret: feishu.appSecret })
    })
    const o = JSON.parse(raw)
    if (o.code) return ElMessage.error(o.msg)
    feishu.accessToken = o.tenant_access_token
    feishuLog.value += `\r时间：${now()} 获取飞书token：\r ${o.tenant_access_token} 有效期：${o.expire} \r`
    ElMessage.success('token 已获取')
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}

async function getFeishuTenant() {
  if (!feishu.accessToken) return ElMessage.error('accessToken 不能为空，请先获取token！')
  loading.value = true
  try {
    const raw = await httpRequest({
      url: 'https://open.feishu.cn/open-apis/tenant/v2/tenant/query',
      method: 'GET',
      headers: { Authorization: 'Bearer ' + feishu.accessToken }
    })
    const i = JSON.parse(raw)
    if (i.code) return ElMessage.error(i.msg)
    feishuLog.value += `\r时间：${now()} 获取企业信息：\r ${raw} \r`
  } catch (e) { ElMessage.error(e.message) }
  finally { loading.value = false }
}
</script>

<style scoped>
.other-page { min-height: calc(100vh - 88px); }
.ak-panel-hd.compact { padding: 12px 18px; }
.ak-panel-bd.tight { padding: 8px 18px 18px; }

.other-tabs :deep(.el-tabs__header) { margin-bottom: 12px; }
.other-tabs :deep(.el-tabs__nav-wrap::after) { height: 1px; }

.tool-layout {
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-width: 920px;
}

.cred-block,
.action-block,
.log-block {
  background: #fafbfd;
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px 10px;
}

.block-label {
  font-size: 12px;
  font-weight: 650;
  color: var(--muted);
  letter-spacing: 0.04em;
  text-transform: none;
  margin-bottom: 10px;
}
.block-label.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.cred-form { max-width: 560px; }
.cred-form :deep(.el-form-item) { margin-bottom: 14px; }
.cred-form :deep(.el-form-item__label) {
  color: var(--text);
  font-weight: 500;
}
.cred-form :deep(.el-input) { max-width: 420px; }

.btn-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.btn-group {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 10px;
  align-items: start;
}
.group-lab {
  font-size: 12px;
  color: var(--muted);
  padding-top: 8px;
  font-weight: 550;
}
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
/* 覆盖 Element 默认相邻按钮 margin，统一用 gap */
.btn-row :deep(.el-button) {
  margin-left: 0 !important;
  margin-right: 0 !important;
}

.log-box :deep(.el-textarea__inner) {
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  background: #0f1724;
  color: #d7e2f2;
  border-color: #1e2a3d;
  border-radius: 8px;
  min-height: 220px;
}
</style>
