/**
 * 京东云能力入口说明。
 * 实际 IPC 调用在 `@/services/cloud` → `electron/cloud-bridge.js` + `electron/jdcloud-signer.js`
 *
 * 文档依据：
 * - 签名：JDCLOUD2-HMAC-SHA256（IAM 全局 region=jdcloud-api）
 * - IAM：https://docs.jdcloud.com/cn/iam/api/
 * - 云主机 VM：https://docs.jdcloud.com/cn/virtual-machines/api/
 */
export const IMPLEMENTED = [
  'jdConsole',
  'jdCancel',
  'jdListUsers',
  'jdListPolicies',
  'jdCreateAccessKey',
  'jdDescribeRegions',
  'jdDescribeInstances',
  'jdDescribeAllInstances'
]

export const CAPABILITIES = {
  consoleTakeover: 'createSubUser → attachSubUserPolicy(JDCloudAdmin-New)',
  cancelTakeover: 'detachSubUserPolicy → deleteSubUser',
  listUsers: 'GET /subUsers',
  listPolicies: 'GET /policies（失败回退 builtin）',
  createAccessKey: 'createSubUserAccessKey',
  hostExpand: '内置地域表 + DescribeInstances 翻页',
  storageOss: 'S3 兼容（endpoint 形如 s3.{region}.jdcloud-oss.com）'
}
