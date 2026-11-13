## 亮点

本版本在既有阿里云 / 腾讯云 / 华为云 / AWS / UCloud 能力之上，**完整接入火山引擎、京东云、百度智能云**，补齐多云 AK 资产治理面。

### 新增厂商能力一览

| 厂商 | 控制台接管 | 子用户 / 策略 / CreateAccessKey | 主机明细 | 对象存储 |
|------|:----------:|:-------------------------------:|:--------:|:--------:|
| **火山引擎** | ✓ | ✓ | ECS 全地域 | TOS（S3 兼容） |
| **京东云** | ✓ | ✓ | 云主机全地域 | OSS（S3 兼容） |
| **百度智能云** | ✓ | ✓ | BCC 全地域 | BOS（S3 兼容） |

### 火山引擎

- 控制台接管 / 取消：CreateUser → CreateLoginProfile → AttachUserPolicy（`AdministratorAccess`）
- 子用户列表、策略列表、按用户创建 AccessKey
- ECS 主机明细：全地域并行拉取，结果本地缓存，再次展开不重拉
- 云助手远程命令（RunCommand）及结果回显
- 对象存储 TOS：S3 兼容（如 `tos-s3-cn-beijing.volces.com`）

### 京东云

- 控制台接管 / 取消：createSubUser → attachSubUserPolicy（`JDCloudAdmin-New`）
- 子用户列表、策略列表、CreateAccessKey
- 云主机明细：多地域并行查询 + 缓存复用
- 对象存储：S3 兼容（默认 `s3.cn-north-1.jdcloud-oss.com`）
- 登录地址自动拼接主账号 PIN

### 百度智能云

- 控制台接管 / 取消：CreateUser → CreateLoginProfile → AttachPolicy（`SystemAdminPolicy`）
- 子用户列表、策略列表、按用户创建 AccessKey
- BCC 主机明细：全地域并行、marker 翻页、本地缓存
- 对象存储 BOS：S3 兼容（默认 `s3.bj.bcebos.com`）

### 体验与工程

- 资产列表厂商标识扩展至火山 / 京东 / 百度
- 主机展开、存储资产、接管面板与上述厂商对齐
- 对未接入云助手的厂商拦截远程命令，避免误调腾讯 TAT
- 签名实现对齐官方规范：火山 HMAC-SHA256、京东 JDCLOUD2、百度 BCE Auth v1

## 修复

- 京东云 CreateAccessKey 路径与官方 SDK 对齐（`/subUser/{name}/accessKey`）
- 京东云取消接管时解绑策略改为 DELETE
- 百度策略列表路径修正为 `/v1/policy`
- 百度登录配置字段修正为 `needResetPassword`
- 百度请求 URI 签名与实际路径编码保持一致

## 下载

| 文件 | 说明 |
|------|------|
| CloudAssetHub-0.3.0-win-x64.exe | Windows NSIS 安装包 |
| CloudAssetHub-0.3.0-portable.exe | 绿色便携版 |

仅供已授权账号使用。请在合法授权范围内管理与评估云凭据。
