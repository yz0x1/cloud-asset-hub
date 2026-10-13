# Cloud Asset Hub · 云资产管理工具

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-28-blue.svg)](https://www.electronjs.org/)
[![Vue3](https://img.shields.io/badge/Vue-3-green.svg)](https://vuejs.org/)

多云账号与对象存储桌面工具（Electron + Vue3）：管理 AK/SK、浏览对象存储、控制台接管、阿里云安全告警 / RDS / 远程命令等。

仓库：https://github.com/yz0x1/cloud-asset-hub

## 功能概览

| 模块 | 能力 |
|------|------|
| 云存储 | 七牛 / 腾讯 COS / 青云 / 阿里 OSS / 又拍 / AWS S3 / 京东 / 金山 / MinIO 等 |
| 云服务器 | 多云 AK 资产、控制台接管 |
| 阿里云扩展 | 云安全中心告警处理与通知配置、RDS、ECS 远程命令 |
| 其他 | 本地资产持久化、导出、热更新配置 |

> 资产数据保存在本机 `%APPDATA%\king-akmanage\`，**不会**打进安装包，也不会进入本仓库。

## 安全提示

- 请勿把真实 AK/SK 提交到 Git
- 分享 exe / 源码都不会自动带上你的本机资产；换机器是空列表
- 本工具面向**自己有权限的云账号**运维与安全测试，请遵守云厂商与当地法律

## License

[MIT](LICENSE) © yz0x1
