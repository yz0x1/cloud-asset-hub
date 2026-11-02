import { defineStore } from 'pinia'
import { loadStore, saveStore } from '@/services/store'
import { CLOUD_VPS } from '@/constants/clouds'

const uid = () => 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const useVpsStore = defineStore('vps', {
  state: () => ({ list: [], loaded: false, showAk: false }),
  actions: {
    async init() {
      const data = await loadStore()
      const list = data.vpsList || []
      let patched = false
      this.list = list.map(r => {
        if (r?.id) return r
        patched = true
        return { ...r, id: uid() }
      })
      this.loaded = true
      if (patched) await this.persist()
    },
    async persist() {
      const data = await loadStore()
      data.vpsList = JSON.parse(JSON.stringify(this.list))
      await saveStore(data)
    },
    async add(row) {
      this.list.push({
        id: uid(),
        as_name: row.as_name || '',
        name: row.name,
        key: row.key,
        access_key: row.access_key,
        secret_key: row.secret_key,
        console_data: row.console_data || null,
        remark: row.remark || '',
        created_at: Date.now()
      })
      await this.persist()
    },
    async update(row) {
      const i = this.list.findIndex(x => x.id === row.id)
      if (i >= 0) {
        const prev = this.list[i]
        const next = { ...prev, ...row }
        // 改了 AK/SK 后旧主机缓存失效，避免展示错账号机器
        const akChanged = row.access_key != null && row.access_key !== prev.access_key
        const skChanged = row.secret_key != null && row.secret_key !== prev.secret_key
        if (akChanged || skChanged) {
          next.host_data = null
          next.host_count = null
          next.host_fetched_at = null
        }
        this.list[i] = JSON.parse(JSON.stringify(next))
        await this.persist()
      }
    },
    async remove(id) {
      this.list = this.list.filter(x => x.id !== id)
      await this.persist()
    },
    cloudMeta(name) {
      return Object.values(CLOUD_VPS).find(c => c.name === name) || null
    }
  }
})
