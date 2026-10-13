/**
 * UCloud 能力入口说明。
 * 实际 IPC 调用在 `@/services/cloud` → `electron/cloud-bridge.js`
 *（项目列表 / 接管 / 取消 / 订单 / 用户）。
 */
export const IMPLEMENTED = [
  'ucloudListProjects',
  'ucloudConsole',
  'ucloudCancel',
  'ucloudOrderList',
  'ucloudListUsers',
  'ucloudGetUserInfoList'
]
