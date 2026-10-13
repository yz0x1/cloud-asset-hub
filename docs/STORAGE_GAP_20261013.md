# 云存储缺口规格（REA + renderer 深挖 2026-10-13）

## REA

- 本次 `analyze_javascript_application`（extracted/app directory）
- evidence_id: `ev_5fbd9a6149b006ebeddd44e5e9f6ece194932d890985e47e7ff959ce434eb951`
- export: `notes/rea/storage_deep_20261013.json`（约 629MB）

## 原版云存储能力（从 renderer UI 文案 / features 还原）

### 空间级
- 多厂商卡片进入「存储空间」
- 保存/查找 AK（formItem: access_key/secret_key/region/endpoint/service_name/sts/paging…）
- features 开关：urlUpload / customDomain / imageStyle / manualPrivateBucket / paging / refreshCDN

### 对象级操作（原版按钮文案）
- 上传 / 下载 / 删除 / 移动
- 创建目录
- 预览（含预览图片样式）
- 刷新 CDN
- 复制路径 / 复制到粘贴板样式（Markdown 外链）
- 全选
- 覆盖上传确认（「目标文件已存在,是否覆盖上传」）
- 直接上传不显示确认框 / 直接删除不显示确认框
- 隐藏删除按钮（配置项）
- 私有空间提示
- 分页 / 开启分页

### 复刻版已有
列表、上传下载删除、预签名、预览、建目录、移动、批量删、拖拽、URL 直传、CDN、部分开关

### 本轮必须补
1. **文件浏览器布局**：左空间列表 + 右对象表 + 面包屑前缀导航（目录钻取）
2. **复制路径 / Markdown 外链**
3. **重命名**（move 到同目录新名）
4. **分页**（MaxKeys + marker/continuation）
5. **覆盖上传确认**
6. **界面美化**（运维控制台风格，非默认 Element 灰白）
