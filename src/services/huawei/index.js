/**
 * 华为云能力入口说明。
 * 实际 IPC 调用在 `@/services/cloud` → `electron/cloud-bridge.js`
 *（控制台接管 / 取消 / 用户列表）。
 */
export const IMPLEMENTED = [
  'huaweiConsole',
  'huaweiCancel',
  'huaweiListUsers'
]
