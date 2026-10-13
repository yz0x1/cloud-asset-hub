const { contextBridge, ipcRenderer } = require('electron')
contextBridge.exposeInMainWorld('akStore', {
  get: () => ipcRenderer.invoke('store:get'),
  set: (data) => ipcRenderer.invoke('store:set', data),
  path: () => ipcRenderer.invoke('store:path')
})
contextBridge.exposeInMainWorld('akShell', {
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
})
contextBridge.exposeInMainWorld('akAli', {
  request: (payload) => ipcRenderer.invoke('ali:request', payload)
})
contextBridge.exposeInMainWorld('akDialog', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  openDirectories: () => ipcRenderer.invoke('dialog:openDirectories'),
  saveFile: (name) => ipcRenderer.invoke('dialog:saveFile', name),
  writeTemp: (payload) => ipcRenderer.invoke('temp:write', payload),
  listFilesRecursive: (dirs) => ipcRenderer.invoke('fs:listFilesRecursive', dirs),
  ensureDir: (dir) => ipcRenderer.invoke('fs:ensureDir', dir),
  pathJoin: (...parts) => ipcRenderer.invoke('path:join', parts),
  defaultDownload: () => ipcRenderer.invoke('path:defaultDownload')
})
contextBridge.exposeInMainWorld('akUpdate', {
  check: (payload) => ipcRenderer.invoke('update:check', payload),
  download: (payload) => ipcRenderer.invoke('update:download', payload),
  pending: () => ipcRenderer.invoke('update:pending'),
  apply: (payload) => ipcRenderer.invoke('update:apply', payload),
  version: () => ipcRenderer.invoke('app:version'),
  dataPath: () => ipcRenderer.invoke('app:dataPath'),
  userData: () => ipcRenderer.invoke('app:userData'),
  onProgress: (cb) => {
    const fn = (_e, p) => cb(p)
    ipcRenderer.on('update:progress', fn)
    return () => ipcRenderer.removeListener('update:progress', fn)
  },
  onTrayCheck: (cb) => {
    const fn = () => cb()
    ipcRenderer.on('update:tray-check', fn)
    return () => ipcRenderer.removeListener('update:tray-check', fn)
  }
})
contextBridge.exposeInMainWorld('akSync', {
  plan: (payload) => ipcRenderer.invoke('sync:plan', payload),
  applyLocalDeletes: (list) => ipcRenderer.invoke('sync:applyLocalDeletes', list),
  exportUrls: (payload) => ipcRenderer.invoke('export:urls', payload),
  notify: (payload) => ipcRenderer.invoke('notify:show', payload),
  trayTitle: (title) => ipcRenderer.invoke('tray:updateTitle', title),
  onTrayUpload: (cb) => {
    const fn = (_e, files) => cb(files)
    ipcRenderer.on('tray:upload-files', fn)
    return () => ipcRenderer.removeListener('tray:upload-files', fn)
  }
})
const cloud = (ch) => (payload) => ipcRenderer.invoke(ch, payload)
const cloudNames = [
  'tencentConsole', 'tencentCancel', 'tencentListUsers', 'tencentRunCommand',
  'tencentDescribeRegions', 'tencentDescribeInstances',
  'huaweiConsole', 'huaweiCancel',
  'awsConsole', 'awsListUsers', 'awsCreateAccessKey', 'awsListPolicies',
  'ucloudListProjects', 'ucloudConsole', 'ucloudCancel', 'ucloudOrderList', 'ucloudListUsers', 'ucloudGetUserInfoList',
  'ossListBuckets', 'ossListObjects', 'ossPutObject', 'ossGetObject', 'ossSignUrl', 'ossDeleteObject',
  'httpRequest',
  'cosListObjects', 'cosListBuckets', 'cosPutObject', 'cosGetObject', 'cosSignUrl', 'cosDeleteObject',
  'huaweiListUsers', 'tencentDescribeDomains',
  'qiniuListBuckets', 'qiniuListObjects', 'qiniuPutObject', 'qiniuGetObject', 'qiniuSignUrl', 'qiniuRefreshCdn', 'qiniuDeleteObject',
  'upyunListDir', 'upyunPutObject', 'upyunGetObject', 'upyunDeleteObject', 'upyunMkdir', 'upyunMoveObject',
  's3ListBuckets', 's3ListObjects', 's3PutObject', 's3GetObject', 's3SignUrl', 's3DeleteObject',
  'qingstorListBuckets', 'qingstorListObjects', 'qingstorPutObject', 'qingstorGetObject', 'qingstorDeleteObject',
  'qingstorMkdir', 'qingstorMoveObject',
  'ossMkdir', 'ossMoveObject', 'cosMkdir', 'cosMoveObject',
  's3Mkdir', 's3MoveObject', 'qiniuMoveObject'
]
const akCloud = {}
for (const n of cloudNames) akCloud[n] = cloud('cloud:' + n)
akCloud.randPass = () => ipcRenderer.invoke('cloud:randPass')
contextBridge.exposeInMainWorld('akCloud', akCloud)
