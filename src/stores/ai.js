import { defineStore } from 'pinia'
import { loadStore, saveStore } from '@/services/store'
import { AI_PRESETS } from '@/constants/clouds'

const uid = () => 'ai_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

function normalizeUrl(u) {
  return String(u || '').trim().replace(/\/+$/, '')
}

function emptyProbe() {
  return {
    probe_ok: null,
    probe_ms: null,
    probe_models: null,
    probe_via: '',
    probe_at: '',
    probe_error: ''
  }
}

export const useAiStore = defineStore('aiAccounts', {
  state: () => ({ list: [], loaded: false, showKey: false }),
  actions: {
    async init() {
      const data = await loadStore()
      this.list = (data.aiAccounts || []).map((row) => this.normalizeRow(row))
      this.loaded = true
    },
    /** 旧数据 provider → preset，保证列表可展示 */
    normalizeRow(row) {
      const preset = row.preset || row.provider || 'custom'
      return {
        ...emptyProbe(),
        ...row,
        preset,
        name: row.name || '未命名',
        base_url: normalizeUrl(row.base_url),
        api_key: row.api_key || '',
        model: row.model || '',
        organization: row.organization || '',
        remark: row.remark || ''
      }
    },
    async persist() {
      const data = await loadStore()
      data.aiAccounts = JSON.parse(JSON.stringify(this.list))
      await saveStore(data)
    },
    presetMeta(key) {
      return AI_PRESETS.find(p => p.key === key) || AI_PRESETS[0]
    },
    async add(row) {
      const api_key = (row.api_key || '').trim()
      if (!api_key) throw new Error('请填写 API Key')
      const base_url = normalizeUrl(row.base_url)
      if (!base_url) throw new Error('请填写 Base URL')
      const name = String(row.name || '').trim() || '未命名'
      if (this.list.some(x => x.api_key === api_key && x.base_url === base_url)) {
        throw new Error('相同 Key + Base URL 已保存，请勿重复添加')
      }
      const item = {
        id: uid(),
        name,
        preset: row.preset || 'custom',
        api_key,
        base_url,
        model: row.model || '',
        organization: row.organization || '',
        remark: row.remark || '',
        created_time: row.created_time || new Date().toISOString().replace('T', ' ').slice(0, 19),
        ...emptyProbe()
      }
      this.list.push(item)
      await this.persist()
      return item
    },
    async update(row) {
      const i = this.list.findIndex(x => x.id === row.id)
      if (i < 0) return
      const next = {
        ...this.list[i],
        ...row,
        name: String(row.name != null ? row.name : this.list[i].name).trim() || '未命名',
        base_url: normalizeUrl(row.base_url != null ? row.base_url : this.list[i].base_url),
        preset: row.preset || this.list[i].preset || 'custom'
      }
      delete next.provider
      this.list[i] = JSON.parse(JSON.stringify(next))
      await this.persist()
    },
    async remove(id) {
      this.list = this.list.filter(x => x.id !== id)
      await this.persist()
    },
    async recordProbe(id, result) {
      const i = this.list.findIndex(x => x.id === id)
      if (i < 0) return
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
      if (result && result.ok !== false && !result.error) {
        this.list[i] = {
          ...this.list[i],
          probe_ok: true,
          probe_ms: result.ms ?? null,
          probe_models: result.count ?? result.models?.length ?? null,
          probe_via: result.via || '',
          probe_at: now,
          probe_error: ''
        }
      } else {
        this.list[i] = {
          ...this.list[i],
          probe_ok: false,
          probe_ms: result?.ms ?? null,
          probe_models: null,
          probe_via: '',
          probe_at: now,
          probe_error: String(result?.error || result?.message || '探测失败')
        }
      }
      await this.persist()
    },
    async importAccounts(rows, { skipDup = true } = {}) {
      let added = 0
      let skipped = 0
      for (const raw of rows || []) {
        const api_key = String(raw.api_key || '').trim()
        const base_url = normalizeUrl(raw.base_url)
        if (!api_key || !base_url) {
          skipped += 1
          continue
        }
        if (skipDup && this.list.some(x => x.api_key === api_key && x.base_url === base_url)) {
          skipped += 1
          continue
        }
        this.list.push(this.normalizeRow({
          id: uid(),
          name: raw.name || '导入密钥',
          preset: raw.preset || raw.provider || 'custom',
          api_key,
          base_url,
          model: raw.model || '',
          organization: raw.organization || '',
          remark: raw.remark || '',
          created_time: raw.created_time || new Date().toISOString().replace('T', ' ').slice(0, 19)
        }))
        added += 1
      }
      if (added) await this.persist()
      return { added, skipped }
    }
  }
})
