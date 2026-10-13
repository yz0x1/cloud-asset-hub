<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    width="720px"
    class="json-dlg"
  >
    <template #header>
      <div class="ak-dlg-hd">
        <div class="titles">
          <h4>{{ title }}</h4>
          <p>只读 JSON · 可一键复制</p>
        </div>
        <div class="meta">
          <el-button size="small" type="primary" plain @click="copy">复制全部</el-button>
        </div>
      </div>
    </template>
    <pre class="ak-json">{{ text }}</pre>
  </el-dialog>
</template>
<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
const props = defineProps({ modelValue: Boolean, title: { type: String, default: 'JSON' }, data: [Object, Array, String] })
const emit = defineEmits(['update:modelValue'])
const text = computed(() => typeof props.data === 'string' ? props.data : JSON.stringify(props.data, null, 2))
function copy() {
  navigator.clipboard?.writeText(text.value).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.error('复制失败')
  )
}
</script>
