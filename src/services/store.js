const empty = () => ({ vpsList: [], storageAccounts: [], settings: {} })

/** 去掉 Vue Proxy，避免 Electron IPC structuredClone 失败导致“保存成功但重启丢失” */
function toPlain(data) {
  try {
    return JSON.parse(JSON.stringify(data ?? empty()))
  } catch (e) {
    console.error('[akStore] serialize failed', e)
    return empty()
  }
}

function countAssets(d) {
  return (d?.storageAccounts?.length || 0) + (d?.vpsList?.length || 0)
}

function readLocal() {
  try {
    const raw = localStorage.getItem('akmanage-data')
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty()
  } catch {
    return empty()
  }
}

export async function loadStore() {
  let fileData = empty()
  try {
    if (window.akStore?.get) {
      const data = await window.akStore.get()
      if (data && typeof data === 'object') fileData = { ...empty(), ...data }
    }
  } catch (e) {
    console.error('[akStore] get failed, fallback localStorage', e)
  }
  const localData = readLocal()
  // 磁盘空但浏览器还有 → 回写磁盘（改名/迁移后常见）
  if (countAssets(fileData) === 0 && countAssets(localData) > 0) {
    try {
      if (window.akStore?.set) await window.akStore.set(toPlain(localData))
    } catch (e) {
      console.warn('[akStore] restore localStorage -> file failed', e)
    }
    return localData
  }
  // 两边都有时以磁盘为准，并同步到 localStorage
  if (countAssets(fileData) > 0) {
    try { localStorage.setItem('akmanage-data', JSON.stringify(toPlain(fileData))) } catch {}
    return fileData
  }
  return countAssets(localData) > 0 ? localData : fileData
}

export async function saveStore(data) {
  const plain = toPlain(data)
  // 双写：IPC 文件为主，localStorage 兜底（HMR/异常时不丢）
  try {
    localStorage.setItem('akmanage-data', JSON.stringify(plain))
  } catch (e) {
    console.warn('[akStore] localStorage fallback write failed', e)
  }
  if (window.akStore?.set) {
    try {
      await window.akStore.set(plain)
      return true
    } catch (e) {
      console.error('[akStore] set failed', e)
      throw new Error('账号持久化失败：' + (e.message || e))
    }
  }
  return true
}
