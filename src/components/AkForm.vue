<template>
  <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)"
    :title="form.id ? '编辑 AKSK' : '添加 AKSK'" width="520px">
    <el-form label-width="90px">
      <el-form-item label="备注名"><el-input v-model="form.as_name" placeholder="资产备注" /></el-form-item>
      <el-form-item label="云厂商">
        <el-select v-model="form.name" style="width:100%" @change="onCloud">
          <el-option v-for="c in clouds" :key="c.key" :label="c.name" :value="c.name" />
        </el-select>
      </el-form-item>
      <el-form-item label="AccessKey"><el-input v-model="form.access_key" /></el-form-item>
      <el-form-item label="SecretKey"><el-input v-model="form.secret_key" show-password /></el-form-item>
      <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" @click="submit">保存并生效</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, watch } from 'vue'
import { CLOUD_VPS } from '@/constants/clouds'
const props = defineProps({ modelValue: Boolean, edit: Object })
const emit = defineEmits(['update:modelValue', 'save'])
const clouds = Object.values(CLOUD_VPS)
const form = reactive({ id: '', as_name: '', name: '阿里云', key: 'alibaba_cloud', access_key: '', secret_key: '', remark: '' })
watch(() => props.edit, (e) => {
  Object.assign(form, e || { id: '', as_name: '', name: '阿里云', key: 'alibaba_cloud', access_key: '', secret_key: '', remark: '' })
}, { immediate: true })
function onCloud(name) {
  const c = clouds.find(x => x.name === name)
  if (c) form.key = c.key
}
function submit() { emit('save', { ...form }); emit('update:modelValue', false) }
</script>
