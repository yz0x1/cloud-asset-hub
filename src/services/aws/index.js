/**
 * AWS 能力入口说明。
 * 实际 IPC 调用在 `@/services/cloud` → `electron/cloud-bridge.js`
 *（控制台接管 / IAM 用户 / CreateAccessKey / Policies）。
 */
export const IMPLEMENTED = [
  'awsConsole',
  'awsListUsers',
  'awsCreateAccessKey',
  'awsListPolicies'
]
