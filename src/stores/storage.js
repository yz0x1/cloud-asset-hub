import { defineStore } from 'pinia'
import { loadStore, saveStore } from '@/services/store'

const uid = () => 'st_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const useStorageStore = defineStore('storageAccounts', {
  state: () => ({ list: [], loaded: false }),
  actions: {
    async init() {
      const data = await loadStore()
      this.list = data.storageAccounts || []
      this.loaded = true
    },
    async persist() {
      const data = await loadStore()
      // 深拷贝去 Proxy，避免 IPC clone 失败 / 字段丢失
      data.storageAccounts = JSON.parse(JSON.stringify(this.list))
      await saveStore(data)
    },
    async add(row) {
      const access_key = row.access_key || ''
      if (access_key && this.list.some(x => x.key === row.key && x.access_key === access_key)) {
        throw new Error('当前 AK 已经保存过，不可重复保存，请在资产列表查看')
      }
      const item = {
        id: uid(),
        name: row.name || '',
        key: row.key,
        access_key,
        secret_key: row.secret_key || '',
        sts_token: row.sts_token || '',
        region: row.region || '',
        endpoint: row.endpoint || '',
        service_name: row.service_name || '',
        domain: row.domain || '',
        notes: row.notes || row.remark || '',
        internal: !!row.internal,
        paging: row.paging !== false,
        temporary: !!row.temporary,
        created_at: row.created_at || Date.now()
      }
      this.list.push(item)
      await this.persist()
      const check = await loadStore()
      if (!(check.storageAccounts || []).some(x => x.id === item.id)) {
        throw new Error('账号已添加但未写入磁盘，请重试或检查 Electron 权限')
      }
      return item
    },
    async update(row) {
      const i = this.list.findIndex(x => x.id === row.id)
      if (i >= 0) {
        this.list[i] = { ...this.list[i], ...row }
        await this.persist()
      }
    },
    async remove(id) {
      this.list = this.list.filter(x => x.id !== id)
      await this.persist()
    }
  }
})
