/**
 * 腾讯云能力入口说明。
 * 实际 IPC 调用在 `@/services/cloud` → `electron/cloud-bridge.js`
 *（接管 / 用户列表 / 域名 / TAT / CVM 地域与实例）。
 */
export const IMPLEMENTED = [
  'tencentConsole',
  'tencentCancel',
  'tencentListUsers',
  'tencentDescribeDomains',
  'tencentRunCommand',
  'tencentDescribeRegions',
  'tencentDescribeInstances'
]
