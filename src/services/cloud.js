import { CLOUD_VPS } from '@/constants/clouds'

function need() {
  if (!window.akCloud) throw new Error('请在 Electron 中运行（npm start）')
}
/** Electron IPC 只能传可结构化克隆的纯数据；Vue Proxy 会报 An object could not be cloned */
function plain(v) {
  if (v == null) return v
  try { return JSON.parse(JSON.stringify(v)) }
  catch { return v }
}
async function unwrap(p) {
  const r = await p
  if (!r.ok) throw new Error(r.error || 'cloud api failed')
  return r.data
}

export async function takeover(row, form = {}) {
  need()
  const name = row.name
  const base = plain({ access_key: row.access_key, secret_key: row.secret_key })
  const f = plain(form) || {}
  if (name === CLOUD_VPS.alibaba.name) throw new Error('ALIBABA_LOCAL')
  if (name === CLOUD_VPS.tencent.name) {
    return unwrap(window.akCloud.tencentConsole({ ...base, userName: f.userName }))
  }
  if (name === CLOUD_VPS.huawei.name) {
    return unwrap(window.akCloud.huaweiConsole({ ...base, userName: f.userName }))
  }
  if (name === CLOUD_VPS.aws.name) {
    return unwrap(window.akCloud.awsConsole({
      ...base, region: f.region, sessionDuration: f.sessionDuration
    }))
  }
  if (name === CLOUD_VPS.ucloud.name) {
    return unwrap(window.akCloud.ucloudConsole({
      ...base, userName: f.userName, email: f.email, projectID: f.projectID
    }))
  }
  throw new Error('未知云厂商')
}

export async function cancelTakeover(row) {
  need()
  const name = row.name
  const base = plain({
    access_key: row.access_key,
    secret_key: row.secret_key,
    console_data: row.console_data || null
  })
  if (name === CLOUD_VPS.tencent.name) return unwrap(window.akCloud.tencentCancel(base))
  if (name === CLOUD_VPS.huawei.name) return unwrap(window.akCloud.huaweiCancel(base))
  if (name === CLOUD_VPS.ucloud.name) return unwrap(window.akCloud.ucloudCancel(base))
  if (name === CLOUD_VPS.alibaba.name) throw new Error('ALIBABA_LOCAL')
  if (name === CLOUD_VPS.aws.name) throw new Error('AWS 联邦令牌无需取消用户，清空本地记录即可')
  throw new Error('未知云厂商')
}

export async function runRemoteCommand(payload) {
  need()
  return unwrap(window.akCloud.tencentRunCommand(payload))
}

export async function listUcloudProjects(row) {
  need()
  return unwrap(window.akCloud.ucloudListProjects({ access_key: row.access_key, secret_key: row.secret_key }))
}

export async function ossBuckets(row, region) {
  need()
  return unwrap(window.akCloud.ossListBuckets({ access_key: row.access_key, secret_key: row.secret_key, region }))
}

export async function ossObjects(row, opts = {}) {
  need()
  return unwrap(window.akCloud.ossListObjects({
    access_key: row.access_key, secret_key: row.secret_key, ...opts
  }))
}

export async function cosBuckets(row) {
  need()
  return unwrap(window.akCloud.cosListBuckets({ access_key: row.access_key, secret_key: row.secret_key }))
}

export async function cosObjects(row, opts = {}) {
  need()
  return unwrap(window.akCloud.cosListObjects({
    access_key: row.access_key, secret_key: row.secret_key, ...opts
  }))
}

export async function tencentUsers(row) {
  need()
  return unwrap(window.akCloud.tencentListUsers({ access_key: row.access_key, secret_key: row.secret_key }))
}

export async function tencentDomains(row) {
  need()
  return unwrap(window.akCloud.tencentDescribeDomains({ access_key: row.access_key, secret_key: row.secret_key }))
}

export async function huaweiUsers(row) {
  need()
  return unwrap(window.akCloud.huaweiListUsers({ access_key: row.access_key, secret_key: row.secret_key }))
}

export async function httpRequest(opts) {
  need()
  return unwrap(window.akCloud.httpRequest(opts))
}

export async function qiniuBuckets(row) {
  need()
  return unwrap(window.akCloud.qiniuListBuckets({ access_key: row.access_key, secret_key: row.secret_key }))
}

export async function qiniuObjects(row, opts = {}) {
  need()
  return unwrap(window.akCloud.qiniuListObjects({
    access_key: row.access_key, secret_key: row.secret_key, ...opts
  }))
}

export async function upyunObjects({ service, operator, password, path }) {
  need()
  return unwrap(window.akCloud.upyunListDir({ service, operator, password, path }))
}

export async function s3Buckets(row, opts = {}) {
  need()
  return unwrap(window.akCloud.s3ListBuckets({
    access_key: row.access_key,
    secret_key: row.secret_key,
    region: opts.region,
    endpoint: opts.endpoint,
    forcePathStyle: opts.forcePathStyle
  }))
}

export async function s3Objects(row, opts = {}) {
  need()
  return unwrap(window.akCloud.s3ListObjects({
    access_key: row.access_key,
    secret_key: row.secret_key,
    ...opts
  }))
}

export async function qingstorBuckets(row) {
  need()
  return unwrap(window.akCloud.qingstorListBuckets({
    access_key: row.access_key, secret_key: row.secret_key
  }))
}

export async function qingstorObjects(row, { bucket, zone, prefix }) {
  need()
  return unwrap(window.akCloud.qingstorListObjects({
    access_key: row.access_key, secret_key: row.secret_key, bucket, zone, prefix
  }))
}

function cred(row) {
  return { access_key: row?.access_key, secret_key: row?.secret_key }
}

export async function storagePut(provider, row, opts) {
  need()
  const c = cred(row)
  if (provider === 'aliyun') return unwrap(window.akCloud.ossPutObject({ ...c, ...opts }))
  if (provider === 'tencent') return unwrap(window.akCloud.cosPutObject({ ...c, ...opts }))
  if (provider === 'qiniu') return unwrap(window.akCloud.qiniuPutObject({ ...c, ...opts }))
  if (provider === 'qingstor') return unwrap(window.akCloud.qingstorPutObject({ ...c, ...opts }))
  if (provider === 'upyun') return unwrap(window.akCloud.upyunPutObject(opts))
  if (['aws', 'minio', 'ks3', 'jd'].includes(provider)) {
    return unwrap(window.akCloud.s3PutObject({ ...c, ...opts }))
  }
  throw new Error('该提供商暂不支持上传')
}

export async function storageGet(provider, row, opts) {
  need()
  const c = cred(row)
  if (provider === 'aliyun') return unwrap(window.akCloud.ossGetObject({ ...c, ...opts }))
  if (provider === 'tencent') return unwrap(window.akCloud.cosGetObject({ ...c, ...opts }))
  if (provider === 'qiniu') return unwrap(window.akCloud.qiniuGetObject({ ...c, ...opts }))
  if (provider === 'qingstor') return unwrap(window.akCloud.qingstorGetObject({ ...c, ...opts }))
  if (provider === 'upyun') return unwrap(window.akCloud.upyunGetObject(opts))
  if (['aws', 'minio', 'ks3', 'jd'].includes(provider)) {
    return unwrap(window.akCloud.s3GetObject({ ...c, ...opts }))
  }
  throw new Error('该提供商暂不支持下载')
}

export async function storageSign(provider, row, opts) {
  need()
  const c = cred(row)
  if (provider === 'aliyun') return unwrap(window.akCloud.ossSignUrl({ ...c, ...opts }))
  if (provider === 'tencent') return unwrap(window.akCloud.cosSignUrl({ ...c, ...opts }))
  if (provider === 'qiniu') return unwrap(window.akCloud.qiniuSignUrl({ ...c, ...opts }))
  if (['aws', 'minio', 'ks3', 'jd'].includes(provider)) {
    return unwrap(window.akCloud.s3SignUrl({ ...c, ...opts }))
  }
  throw new Error('该提供商暂不支持预签名')
}

export async function storageDelete(provider, row, opts) {
  need()
  const c = cred(row)
  if (provider === 'aliyun') return unwrap(window.akCloud.ossDeleteObject({ ...c, ...opts }))
  if (provider === 'tencent') return unwrap(window.akCloud.cosDeleteObject({ ...c, ...opts }))
  if (provider === 'qiniu') return unwrap(window.akCloud.qiniuDeleteObject({ ...c, ...opts }))
  if (provider === 'qingstor') return unwrap(window.akCloud.qingstorDeleteObject({ ...c, ...opts }))
  if (provider === 'upyun') return unwrap(window.akCloud.upyunDeleteObject(opts))
  if (['aws', 'minio', 'ks3', 'jd'].includes(provider)) {
    return unwrap(window.akCloud.s3DeleteObject({ ...c, ...opts }))
  }
  throw new Error('该提供商暂不支持删除')
}

export async function qiniuRefreshCdn(row, urls) {
  need()
  return unwrap(window.akCloud.qiniuRefreshCdn({
    access_key: row.access_key, secret_key: row.secret_key, urls
  }))
}

export async function storageMkdir(provider, row, opts) {
  need()
  const c = cred(row)
  if (provider === 'aliyun') return unwrap(window.akCloud.ossMkdir({ ...c, ...opts }))
  if (provider === 'tencent') return unwrap(window.akCloud.cosMkdir({ ...c, ...opts }))
  if (provider === 'qingstor') return unwrap(window.akCloud.qingstorMkdir({ ...c, ...opts }))
  if (provider === 'upyun') return unwrap(window.akCloud.upyunMkdir(opts))
  if (['aws', 'minio', 'ks3', 'jd'].includes(provider)) {
    return unwrap(window.akCloud.s3Mkdir({ ...c, ...opts }))
  }
  throw new Error('该提供商暂不支持建目录')
}

export async function storageMove(provider, row, opts) {
  need()
  const c = cred(row)
  if (provider === 'aliyun') return unwrap(window.akCloud.ossMoveObject({ ...c, ...opts }))
  if (provider === 'tencent') return unwrap(window.akCloud.cosMoveObject({ ...c, ...opts }))
  if (provider === 'qiniu') return unwrap(window.akCloud.qiniuMoveObject({ ...c, ...opts }))
  if (provider === 'qingstor') return unwrap(window.akCloud.qingstorMoveObject({ ...c, ...opts }))
  if (provider === 'upyun') return unwrap(window.akCloud.upyunMoveObject(opts))
  if (['aws', 'minio', 'ks3', 'jd'].includes(provider)) {
    return unwrap(window.akCloud.s3MoveObject({ ...c, ...opts }))
  }
  throw new Error('该提供商暂不支持移动')
}

export async function tencentCvmRegions(row) {
  need()
  return unwrap(window.akCloud.tencentDescribeRegions({
    access_key: row.access_key, secret_key: row.secret_key
  }))
}

export async function tencentCvmInstances(row, { region, Offset = 0, Limit = 100 } = {}) {
  need()
  return unwrap(window.akCloud.tencentDescribeInstances({
    access_key: row.access_key, secret_key: row.secret_key, region, Offset, Limit
  }))
}

export async function ucloudOrders(row, opts = {}) {
  need()
  return unwrap(window.akCloud.ucloudOrderList({
    access_key: row.access_key, secret_key: row.secret_key, ...opts
  }))
}

export async function awsPolicies(row, opts = {}) {
  need()
  return unwrap(window.akCloud.awsListPolicies({
    access_key: row.access_key, secret_key: row.secret_key,
    region: opts.region || 'us-east-1', Scope: opts.Scope || 'Local'
  }))
}

export async function awsCreateKey(row, UserName) {
  need()
  return unwrap(window.akCloud.awsCreateAccessKey({
    access_key: row.access_key, secret_key: row.secret_key,
    region: 'us-east-1', UserName
  }))
}
