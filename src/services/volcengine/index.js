/**
 * 火山引擎能力入口说明。
 * 实际 IPC 调用在 `@/services/cloud` → `electron/cloud-bridge.js` + `electron/volc-signer.js`
 *
 * 文档依据：
 * - 签名：https://docs.volcengine.com/docs/api-signature-call-guide/signature-method
 * - IAM：https://api.volcengine.com/api-docs/view/overview?serviceCode=iam&version=2018-01-01
 * - ECS：https://api.volcengine.com/api-docs/view/overview?serviceCode=ecs&version=2020-04-01
 */
export const IMPLEMENTED = [
  'volcConsole',
  'volcCancel',
  'volcListUsers',
  'volcListPolicies',
  'volcCreateAccessKey',
  'volcListAccessKeys',
  'volcListAttachedUserPolicies',
  'volcDescribeRegions',
  'volcDescribeInstances',
  'volcDescribeAllInstances',
  'volcRunCommand',
  'volcDescribeInvocations'
]

export const CAPABILITIES = {
  consoleTakeover: 'CreateUser → CreateLoginProfile → AttachUserPolicy(AdministratorAccess)',
  cancelTakeover: 'DetachUserPolicy* → DeleteLoginProfile → DeleteUser',
  listUsers: 'ListUsers',
  listPolicies: 'ListPolicies',
  createAccessKey: 'CreateAccessKey',
  hostExpand: 'DescribeRegions + DescribeInstances(NextToken 拉全)',
  remoteCommand: 'RunCommand + DescribeInvocationResults 轮询回显',
  storageTos: 'S3 兼容 TOS（endpoint 形如 tos-s3-{region}.volces.com）'
}
