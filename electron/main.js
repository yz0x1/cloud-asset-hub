const { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage, Notification, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const cloud = require('./cloud-bridge')
const updater = require('./updater')
const syncPlan = require('./sync-plan')

const isDev = !app.isPackaged
/** 固定用户数据目录，避免改 package.json name 后资产「消失」 */
const STABLE_USER_DATA = path.join(app.getPath('appData'), 'king-akmanage')
try {
  if (!fs.existsSync(STABLE_USER_DATA)) fs.mkdirSync(STABLE_USER_DATA, { recursive: true })
  app.setPath('userData', STABLE_USER_DATA)
} catch (e) {
  console.error('[userData]', e)
}

const dataFile = () => path.join(app.getPath('userData'), 'akmanage-data.json')
let mainWindow = null
let tray = null

function emptyStore() {
  return { vpsList: [], storageAccounts: [], settings: {} }
}

/** 从旧目录迁移（name 曾用 king-akmanage-rebuilt / Electron 默认） */
function migrateStoreIfNeeded() {
  const dest = dataFile()
  if (fs.existsSync(dest)) {
    try {
      const cur = JSON.parse(fs.readFileSync(dest, 'utf8'))
      const n = (cur.storageAccounts || []).length + (cur.vpsList || []).length
      if (n > 0) return
    } catch {}
  }
  const appData = app.getPath('appData')
  const candidates = [
    path.join(appData, 'king-akmanage-rebuilt', 'akmanage-data.json'),
    path.join(appData, 'Electron', 'akmanage-data.json'),
    path.join(appData, '云资产管理工具', 'akmanage-data.json')
  ]
  for (const src of candidates) {
    if (!fs.existsSync(src) || path.resolve(src) === path.resolve(dest)) continue
    try {
      const raw = fs.readFileSync(src, 'utf8')
      const j = JSON.parse(raw)
      const n = (j.storageAccounts || []).length + (j.vpsList || []).length
      if (!n) continue
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      // 目标空或不存在则直接拷；目标空数组则覆盖
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest)
      } else {
        const cur = JSON.parse(fs.readFileSync(dest, 'utf8'))
        const cn = (cur.storageAccounts || []).length + (cur.vpsList || []).length
        if (cn === 0) fs.copyFileSync(src, dest)
      }
      console.log('[store] migrated from', src, '->', dest)
      return
    } catch (e) {
      console.error('[store] migrate fail', src, e)
    }
  }
}

function readStore() {
  migrateStoreIfNeeded()
  try { return JSON.parse(fs.readFileSync(dataFile(), 'utf8')) }
  catch { return emptyStore() }
}
function writeStore(data) {
  const file = dataFile()
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  // 只接受可序列化纯对象，防止渲染进程传来异常结构
  const plain = JSON.parse(JSON.stringify(data || {}))
  if (!Array.isArray(plain.vpsList)) plain.vpsList = []
  if (!Array.isArray(plain.storageAccounts)) plain.storageAccounts = []
  if (!plain.settings || typeof plain.settings !== 'object') plain.settings = {}
  fs.writeFileSync(file, JSON.stringify(plain, null, 2), 'utf8')
  return { ok: true, path: file, accounts: plain.storageAccounts.length }
}

function resolveAppIcon() {
  const candidates = [
    path.join(__dirname, '../build/icon.ico'),
    path.join(__dirname, '../build/icon.png'),
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, 'tray.png')
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function createWindow() {
  const icon = resolveAppIcon()
  // 隐藏 Electron 默认 File/Edit/View 菜单，更接近成品桌面应用
  try { Menu.setApplicationMenu(null) } catch {}
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: '云资产管理工具',
    icon: icon || undefined,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#eef1f6',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  mainWindow.once('ready-to-show', () => mainWindow.show())
  if (isDev) mainWindow.loadURL('http://127.0.0.1:5173')
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  mainWindow.on('close', (e) => {
    if (!app.isQuiting && tray) {
      e.preventDefault()
      mainWindow.hide()
    }
  })
}

function createTray() {
  const iconPath = resolveAppIcon() || path.join(__dirname, 'tray.png')
  let icon
  if (iconPath && fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
    if (!icon.isEmpty() && icon.getSize().width > 32) {
      icon = icon.resize({ width: 16, height: 16 })
    }
  } else {
    icon = nativeImage.createFromDataURL(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAALElEQVQoka3NMQEAAAgDINc/9K3hAx0Q0gGJgYGBgYGBgYGBgYGBgYGBgYGBgYEBFwY+AAGJ2n8oAAAAAElFTkSuQmCC'
    )
  }
  tray = new Tray(icon)
  tray.setToolTip('试试把文件拖到这里？ / 云资产管理工具')
  const rebuildMenu = () => {
    const menu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          if (mainWindow) { mainWindow.show(); mainWindow.focus() }
        }
      },
      {
        label: '上传文件到托盘空间',
        click: async () => {
          const r = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections']
          })
          if (r.canceled || !r.filePaths.length) return
          if (mainWindow) {
            mainWindow.show()
            mainWindow.webContents.send('tray:upload-files', r.filePaths.map(p => ({ path: p })))
          }
        }
      },
      {
        label: '上传文件夹到托盘空间',
        click: async () => {
          const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
          if (r.canceled || !r.filePaths.length) return
          const files = []
          const walk = (dir, base) => {
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, ent.name)
              if (ent.isDirectory()) walk(full, base)
              else if (ent.isFile()) {
                files.push({
                  path: full,
                  relativeKey: path.relative(base, full).split(path.sep).join('/')
                })
              }
            }
          }
          walk(r.filePaths[0], r.filePaths[0])
          if (mainWindow) {
            mainWindow.show()
            mainWindow.webContents.send('tray:upload-files', files)
          }
        }
      },
      {
        label: '检查更新',
        click: () => {
          if (mainWindow) {
            mainWindow.show()
            mainWindow.webContents.send('update:tray-check')
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.isQuiting = true
          app.quit()
        }
      }
    ])
    tray.setContextMenu(menu)
  }
  rebuildMenu()
  tray.on('double-click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
  })
  // macOS 托盘拖拽；Windows 用右键菜单上传
  try {
    tray.on('drop-files', (_e, files) => {
      if (mainWindow && files?.length) {
        mainWindow.webContents.send('tray:upload-files', files.map(p => ({ path: p })))
      }
    })
  } catch {}
}

function getRPC() { return require('@alicloud/pop-core') }
function makeClient({ accessKeyId, accessKeySecret, endpoint, apiVersion }) {
  const RPCClient = getRPC()
  return new RPCClient({ accessKeyId, accessKeySecret, endpoint, apiVersion })
}

app.whenReady().then(() => {
  ipcMain.handle('store:get', () => readStore())
  ipcMain.handle('store:set', (_e, data) => {
    try {
      return writeStore(data)
    } catch (e) {
      console.error('[store:set]', dataFile(), e)
      throw e
    }
  })
  ipcMain.handle('store:path', () => dataFile())

  ipcMain.handle('ali:request', async (_e, payload) => {
    const { accessKeyId, accessKeySecret, endpoint, apiVersion, action, params = {}, options = {} } = payload
    const client = makeClient({ accessKeyId, accessKeySecret, endpoint, apiVersion })
    return client.request(action, params, {
      method: options.method || 'POST',
      formatParams: false,
      timeout: options.timeout
    })
  })

  const wrap = (fn) => async (_e, payload) => {
    try { return { ok: true, data: await fn(payload) } }
    catch (err) { return { ok: false, error: String(err.message || err) } }
  }

  ipcMain.handle('cloud:tencentConsole', wrap(cloud.tencentConsole))
  ipcMain.handle('cloud:tencentCancel', wrap(cloud.tencentCancel))
  ipcMain.handle('cloud:tencentListUsers', wrap(cloud.tencentListUsers))
  ipcMain.handle('cloud:tencentRunCommand', wrap(cloud.tencentRunCommand))
  ipcMain.handle('cloud:tencentDescribeRegions', wrap(cloud.tencentDescribeRegions))
  ipcMain.handle('cloud:tencentDescribeInstances', wrap(cloud.tencentDescribeInstances))
  ipcMain.handle('cloud:huaweiConsole', wrap(cloud.huaweiConsole))
  ipcMain.handle('cloud:huaweiCancel', wrap(cloud.huaweiCancel))
  ipcMain.handle('cloud:awsConsole', wrap(cloud.awsConsole))
  ipcMain.handle('cloud:awsListUsers', wrap(cloud.awsListUsers))
  ipcMain.handle('cloud:awsCreateAccessKey', wrap(cloud.awsCreateAccessKey))
  ipcMain.handle('cloud:awsListPolicies', wrap(cloud.awsListPolicies))
  ipcMain.handle('cloud:ucloudListProjects', wrap(cloud.ucloudListProjects))
  ipcMain.handle('cloud:ucloudConsole', wrap(cloud.ucloudConsole))
  ipcMain.handle('cloud:ucloudCancel', wrap(cloud.ucloudCancel))
  ipcMain.handle('cloud:ucloudOrderList', wrap(cloud.ucloudOrderList))
  ipcMain.handle('cloud:ucloudListUsers', wrap(cloud.ucloudListUsers))
  ipcMain.handle('cloud:ucloudGetUserInfoList', wrap(cloud.ucloudGetUserInfoList))
  ipcMain.handle('cloud:ossListBuckets', wrap(cloud.ossListBuckets))
  ipcMain.handle('cloud:ossListObjects', wrap(cloud.ossListObjects))
  ipcMain.handle('cloud:httpRequest', wrap(cloud.httpRequest))
  ipcMain.handle('cloud:cosListObjects', wrap(cloud.cosListObjects))
  ipcMain.handle('cloud:cosListBuckets', wrap(cloud.cosListBuckets))
  ipcMain.handle('cloud:huaweiListUsers', wrap(cloud.huaweiListUsers))
  ipcMain.handle('cloud:tencentDescribeDomains', wrap(cloud.tencentDescribeDomains))
  ipcMain.handle('cloud:qiniuListBuckets', wrap(cloud.qiniuListBuckets))
  ipcMain.handle('cloud:qiniuListObjects', wrap(cloud.qiniuListObjects))
  ipcMain.handle('cloud:upyunListDir', wrap(cloud.upyunListDir))
  ipcMain.handle('cloud:s3ListBuckets', wrap(cloud.s3ListBuckets))
  ipcMain.handle('cloud:s3ListObjects', wrap(cloud.s3ListObjects))
  ipcMain.handle('cloud:qingstorListBuckets', wrap(cloud.qingstorListBuckets))
  ipcMain.handle('cloud:qingstorListObjects', wrap(cloud.qingstorListObjects))
  ;[
    'ossPutObject', 'ossGetObject', 'ossSignUrl', 'ossDeleteObject',
    'cosPutObject', 'cosGetObject', 'cosSignUrl', 'cosDeleteObject',
    's3PutObject', 's3GetObject', 's3SignUrl', 's3DeleteObject',
    'qiniuPutObject', 'qiniuGetObject', 'qiniuSignUrl', 'qiniuRefreshCdn', 'qiniuDeleteObject',
    'qingstorPutObject', 'qingstorGetObject', 'qingstorDeleteObject',
    'upyunPutObject', 'upyunGetObject', 'upyunDeleteObject',
    'ossMkdir', 'ossMoveObject', 'cosMkdir', 'cosMoveObject',
    's3Mkdir', 's3MoveObject', 'qiniuMoveObject',
    'qingstorMkdir', 'qingstorMoveObject', 'upyunMkdir', 'upyunMoveObject'
  ].forEach((name) => ipcMain.handle('cloud:' + name, wrap(cloud[name])))
  ipcMain.handle('cloud:randPass', () => cloud.randPass())

  ipcMain.handle('dialog:openFile', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'] })
    if (r.canceled || !r.filePaths.length) return null
    return r.filePaths[0]
  })
  ipcMain.handle('dialog:openFiles', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
    if (r.canceled || !r.filePaths.length) return []
    return r.filePaths
  })
  ipcMain.handle('dialog:openDirectory', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (r.canceled || !r.filePaths.length) return null
    return r.filePaths[0]
  })
  ipcMain.handle('dialog:openDirectories', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] })
    if (r.canceled || !r.filePaths.length) return []
    return r.filePaths
  })
  ipcMain.handle('dialog:saveFile', async (_e, defaultName) => {
    const r = await dialog.showSaveDialog({ defaultPath: defaultName || 'download.bin' })
    if (r.canceled || !r.filePath) return null
    return r.filePath
  })
  ipcMain.handle('temp:write', (_e, { name, base64 }) => {
    const safe = String(name || 'upload.bin').replace(/[\\/:*?"<>|]/g, '_')
    const p = path.join(os.tmpdir(), 'akmanage-' + Date.now() + '-' + safe)
    fs.writeFileSync(p, Buffer.from(base64, 'base64'))
    return p
  })
  // 递归列出目录内文件（文件夹上传）
  ipcMain.handle('fs:listFilesRecursive', (_e, dirs) => {
    const roots = Array.isArray(dirs) ? dirs : [dirs]
    const out = []
    const walk = (dir, base) => {
      let entries
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const ent of entries) {
        const full = path.join(dir, ent.name)
        if (ent.isDirectory()) walk(full, base)
        else if (ent.isFile()) {
          const rel = path.relative(base, full).split(path.sep).join('/')
          out.push({ localPath: full, relativeKey: rel })
        }
      }
    }
    for (const d of roots) {
      if (!d || !fs.existsSync(d)) continue
      walk(d, d)
    }
    return out
  })
  ipcMain.handle('fs:ensureDir', (_e, dir) => {
    fs.mkdirSync(dir, { recursive: true })
    return true
  })
  ipcMain.handle('path:join', (_e, parts) => path.join(...(parts || [])))
  ipcMain.handle('path:defaultDownload', () => path.join(app.getPath('downloads'), 'akmanage-download'))

  ipcMain.handle('sync:plan', (_e, { localDir, cloudFiles, mergeType }) => {
    return syncPlan.planSync(localDir, cloudFiles || [], mergeType || 0)
  })
  ipcMain.handle('sync:applyLocalDeletes', (_e, localDeletes) => {
    syncPlan.applyLocalDeletes(localDeletes || [])
    return true
  })
  ipcMain.handle('export:urls', (_e, { name, urls }) => {
    const dir = path.join(app.getPath('downloads'), 'akmanage')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, name || ('urls-' + Date.now() + '.txt'))
    fs.writeFileSync(file, (urls || []).join('\n'), 'utf8')
    shell.showItemInFolder(file)
    return file
  })
  ipcMain.handle('shell:openExternal', async (_e, url) => {
    if (!url) return false
    await shell.openExternal(String(url))
    return true
  })
  ipcMain.handle('notify:show', (_e, { message, title }) => {
    try {
      new Notification({ title: title || '云资产管理工具', body: message || '' }).show()
    } catch {}
    return true
  })
  ipcMain.handle('tray:updateTitle', (_e, title) => {
    if (tray) tray.setToolTip(title ? String(title) : '云资产管理工具')
    return true
  })

  ipcMain.handle('update:check', async (_e, payload = {}) => {
    try {
      const data = await updater.checkUpdate(payload)
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: String(err.message || err) }
    }
  })
  ipcMain.handle('update:download', async (e, payload = {}) => {
    try {
      const data = await updater.downloadUpdate(payload, (p) => {
        try { e.sender.send('update:progress', p) } catch {}
      })
      return { ok: true, data }
    } catch (err) {
      return { ok: false, error: String(err.message || err) }
    }
  })
  ipcMain.handle('update:pending', () => updater.getPending())
  ipcMain.handle('update:apply', (_e, payload = {}) => {
    try {
      return updater.applyPendingUpdate(payload)
    } catch (err) {
      return { ok: false, error: String(err.message || err) }
    }
  })
  ipcMain.handle('app:version', () => updater.pkg().version)
  ipcMain.handle('app:dataPath', () => dataFile())
  ipcMain.handle('app:userData', () => app.getPath('userData'))

  try { updater.tryRecoverNewAsar() } catch {}
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 有托盘时隐藏即可，真正退出走托盘菜单
    if (!tray) app.quit()
  }
})
app.on('before-quit', () => { app.isQuiting = true })
