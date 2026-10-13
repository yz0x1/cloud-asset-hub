/** 统一走 Electron 主进程 @alicloud/pop-core；无 Electron 时给出明确错误 */
export async function aliRequest({ accessKeyId, accessKeySecret, endpoint, apiVersion, action, params, options }) {
  if (!window.akAli || !window.akAli.request) {
    throw new Error('云 API 需在 Electron 中运行（npm start）。浏览器 Vite 模式仅可调试 UI。')
  }
  return window.akAli.request({
    accessKeyId, accessKeySecret, endpoint, apiVersion, action, params: params || {}, options: options || {}
  })
}
