# Cloud Asset Hub · 云资产管理工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-28-blue.svg)](https://www.electronjs.org/)
[![Vue3](https://img.shields.io/badge/Vue-3-green.svg)](https://vuejs.org/)

## 免责声明

Cloud Asset Hub 仅供安全与运维人员在**已获授权**的云账号上进行检测、运维与安全评估。未经授权，不得使用本工具对任何系统实施未授权访问或破坏性操作。因使用本工具所产生的直接或间接后果，由使用者自行承担。

请遵守相关法律法规及云服务商协议。

## 介绍

云安全向桌面工具，主要包含两个模块：

- **云存储工具**：对象存储资产接入，文件查看、上传、下载、删除、预览、目录管理等
- **云服务工具**：多云 AK/SK 管理，控制台接管，子用户查看，以及阿里云 RDS / 告警 / 远程命令等

## 软件架构

Electron + Vue 3 + Element Plus + Node.js

## 目前实现功能

| 云厂商 | 能力 |
|--------|------|
| 阿里云 | 控制台接管 / 取消接管、对象存储、远程命令回显、子用户列表、云数据库（RDS）、安全告警与通知配置 |
| 腾讯云 | 控制台接管 / 取消接管、对象存储、远程命令、子用户列表、域名列表 |
| 华为云 | 控制台接管 / 取消接管、子用户列表 |
| ucloud | 控制台接管 / 取消接管、子用户 / 主用户、订单查看 |
| AWS | 控制台接管、子用户列表、策略列表、IAM 密钥相关能力 |

## 云存储工具

支持厂商：七牛云、腾讯云 COS、青云 QingStor、阿里云 OSS、又拍云、AWS S3、京东云、金山云 KS3、MinIO。

常见能力：资产列表、存储桶浏览、上传 / 下载 / 删除 / 移动 / 预览、创建目录、分页；部分厂商支持自定义域名、CDN 刷新、图床样式等。

## 云服务工具

- 资产列表：多云 AK/SK 增删改查、本地持久化、导出
- 控制台接管 / 取消接管 / 接管记录
- 子用户列表（按厂商能力）
- 阿里云：告警处理与批量通知配置、RDS 管理、ECS 远程命令
- 腾讯云：远程命令、域名列表
- AWS：策略列表、IAM 相关操作
- ucloud：订单等信息查询

## License

[MIT](LICENSE) © yz0x1
