import { createRouter, createWebHashHistory } from 'vue-router'
import StorageManager from '@/views/StorageManager.vue'
import CloudServer from '@/views/CloudServer.vue'
import AiManager from '@/views/AiManager.vue'
import OtherTools from '@/views/OtherTools.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/storage' },
    { path: '/storage', component: StorageManager, meta: { title: '云存储管理' } },
    { path: '/server', component: CloudServer, meta: { title: '云服务器工具' } },
    { path: '/ai', component: AiManager, meta: { title: '云AI密钥' } },
    { path: '/other', component: OtherTools, meta: { title: '其他工具' } }
  ]
})
