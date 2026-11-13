/**
 * 百度智能云能力入口说明。
 * 实际 IPC 调用在 `@/services/cloud` → `electron/cloud-bridge.js` + `electron/baidu-signer.js`
 *
 * 文档依据：
 * - 签名：BCE Auth v1
 * - IAM：https://cloud.baidu.com/doc/IAM/s/gjwvz05f7
 * - BCC：https://cloud.baidu.com/doc/BCC/s/Gjwvz05f7 等实例 API
 */
export const IMPLEMENTED = [
  'baiduConsole',
  'baiduCancel',
  'baiduListUsers',
  'baiduListPolicies',
  'baiduCreateAccessKey',
  'baiduDescribeRegions',
  'baiduDescribeInstances',
  'baiduDescribeAllInstances'
]

export const CAPABILITIES = {
  consoleTakeover: 'CreateUser → UpdateUser(password) → AttachPolicy(SystemAdminPolicy)',
  cancelTakeover: 'DetachPolicy → DeleteUser',
  listUsers: 'GET /v1/user',
  listPolicies: 'GET /v1/policies（失败回退 builtin）',
  createAccessKey: 'POST /v1/user/{name}/accesskey',
  hostExpand: 'DescribeRegions + ListInstances(marker 翻页)',
  storageBos: 'S3 兼容 BOS（endpoint 形如 s3.{region}.bcebos.com）'
}
