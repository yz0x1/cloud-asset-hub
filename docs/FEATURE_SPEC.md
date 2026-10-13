# king-akmanage 0.1.2 全量功能规格（REA + 静态还原）

> 源副本：`逆向分析/king-akmanage_云资产告警_20261009`  
> REA evidence_id：`ev_3bfec510234b82564667836ba5f67e4025029d97036dc21991c48339549ba0be`  
> Evidence bundle：`notes/rea/evidence_bundle.json`（约 314MB）  
> **未修改** `F:\云服务器`

## 0. 应用画像

| 项 | 值 |
|---|---|
| name | king-akmanage |
| cnname | 云资产管理工具 |
| version | 0.1.2 |
| 形态 | Electron + Vue2 + View Design + ElementUI |
| 入口 | dist/electron/main.js → renderer.js |
| 作者字符串 | 白帽安全的快乐 |

## 1. 顶层 Tab（3）

1. **云存储管理** — 多云对象存储浏览器（类图床/OSS 客户端）
2. **云服务器工具** — AK/SK 资产管理、控制台接管、告警、RDS、ECS 命令等
3. **其他工具** — `<other-tools>` 组件

## 2. 云存储管理（对象存储）

支持提供商（key / name / features）：

| key | name | features |
|-----|------|----------|
| qiniu | 七牛云 | urlUpload, customDomain, imageStyle, manualPrivateBucket, paging, refreshCDN |
| tencent | 腾讯云 | urlUpload, paging |
| qingstor | 青云 | urlUpload, paging |
| aliyun | 阿里云 | paging |
| upyun | 又拍云 | customDomain |
| aws | AWS-S3 | paging, manualPrivateBucket |
| jd | 京东云 | paging, manualPrivateBucket |
| ks3 | 金山云 | paging |
| minio | MinIO | paging, manualPrivateBucket |

通用能力（UI 按钮已还原）：上传/下载/删除/移动/预览、创建目录、刷新 CDN、自定义域名、HTTPS、图床样式、存储空间、直传开关、隐藏删除确认等。

## 3. 云服务器工具 — 多云 VPS/AK

云厂商（cloudVps）：

| key | name |
|-----|------|
| alibaba_cloud | 阿里云 |
| tencent_cloud | 腾讯云 |
| huawei_cloud | 华为云 |
| ucloud_cloud | ucloud |
| aws_cloud | AWS |

### 3.1 AK 资产管理
- 添加/编辑/删除 AKSK，列表展示（可打码）
- 本地持久化（electron-json-storage / `$storage`）

### 3.2 控制台接管 consoleCloud
- 阿里：`alibabaConsole` / `alibabaCancelConsoleCloud` / `alibabaViewUserListCloud`
- 腾讯：`tencentConsole` / Cancel / ViewUserList / ViewDomainList
- 华为：`huaweiConsole` / Cancel / ViewUserList
- UCloud：`aliUcloudConsole` / Cancel / ViewUserList / OrderList / GetUserInfoList
- AWS：`awsConsole` / ViewUserList / PoliciesList / getAwsUserList / createAwsByUser
- 另：`jdCloudConsole` / `jdViewUserListCloud`

接管动作：创建子用户、挂策略、开控制台登录、记录 console_data、取消接管（删用户/卸策略）。

### 3.3 告警管理（仅阿里云 UI）
- TDS `https://tds.aliyuncs.com` apiVersion `2018-12-03`
- `DescribeSuspEvents` / `HandleSecurityEvents` / `DescribeNoticeConfig` / `ModifyNoticeConfig`
- Tab：告警处理、告警通知配置
- 列表列（对齐原版）：机器名称 / 事件名称 / 事件类型 / 事件等级 / 描述 / 事件状态 / 发生时间
- 字段：`InstanceName`、`AlarmEventName`、`AlarmEventType`、`Level`、`Desc`、`EventStatus`、`OccurrenceTime`；处理用 `SecurityEventIds`
- 通知配置：项目 code+名称、Route 下拉（NOTICE_ROUTES）、TimeLimit 0/1；弹窗可改 Route/TimeLimit
- 缺口：非阿里空实现；单条处理；无一键全关（复刻版补齐）

### 3.4 云数据库 RDS（阿里）
- `openPopRds` / `rdsInit` / `rdsMordel`
- API：DescribeRegions/DBInstances/Accounts/Databases、Create/DeleteAccount、GrantPrivilege、
  Allocate/ReleasePublicConnection、ModifySecurityIps、DescribeDBInstanceIPArrayList/NetInfo
- Tab：云数据库资产列表、白名单、账号等
- 按钮：云数据库接管、单独初始化、全部初始化 RDS、添加/删除白名单

### 3.5 云主机命令（阿里/腾讯）
- 阿里：`aliCreateCommand` / `aliInvokeCommand` / `aliDescribeInvocationResults` / `aliDeleteCommand`
- 腾讯：`tencentRunCommand` / `tencentDescribeInstances` / `tencentDescribeRegions`

### 3.6 域名（腾讯）
- `tencentDescribeDomainNameList` / `tencentViewDomainListCloud`

## 4. 阿里 SDK 封装清单（业务）

createClient, describeRegions, describeInstances, runCommand,
aliCreateCommand, aliInvokeCommand, aliDescribeInvocationResults, aliDeleteCommand,
createImsClientAli, createRamClientAli, AttachPolicyToUser, GetAccountAlias, CreateLoginProfile,
aliCreateUser, aliDetachPolicyFromUser, aliDeleteUser, aliListUsers,
createTdsClientAli, aliDescribeNoticeConfig, aliModifyNoticeConfig, DescribeSuspEvents, aliHandleSecurityEvents,
aliCreateRdsClientAli + 全套 aliRds*

## 5. 复刻范围与优先级

P0 壳 + AK 管理 + 阿里告警（含一键关闭）+ 阿里接管/RDS 骨架  
P1 腾讯/华为/AWS/UCloud 接管与命令  
P2 九家对象存储浏览器  
P3 其他工具 / 热更新 / 托盘

## 6. 复刻工程路径

`逆向分析/king-akmanage-rebuilt_20261013/`


## 7. 复刻落地状态（2026-10-13）

见 `PROGRESS.md`。工程可 `npm start` 启动。
