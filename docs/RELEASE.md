# 正式发布说明（对齐原版形态）

原版 `F:\云服务器\king-akmanage` 本质是：

**Electron 桌面应用** → 用 **electron-builder** 打成 Windows 安装包 / 绿色包。

不是单独的 `.exe` 原生程序（Go/C#），而是：

```
云资产管理工具.exe          ← Electron 壳
resources/app.asar          ← 业务代码（打包后的 Vue + Node）
locales / *.dll / *.pak     ← Chromium 运行时
```

你看到的 `cloud-0.1.2-win-x64.exe` 是 **NSIS 安装器**；装完后目录结构和原版 `king-akmanage\` 一样。

---

## 做到什么程度才算「能给别人用」

| 级别 | 产物 | 适用 |
|------|------|------|
| A. 开发态 | `npm start` | 自己调试 |
| B. 本机目录包 | `npm run dist` → `release/win-unpacked/` | 自己拷贝文件夹用 |
| **C. 正式分发（推荐）** | `npm run dist:win` | 给别人：安装包 + 绿色包 |
| D. 完整产品 | C + 签名 + 自动更新 CDN | 对外商用 / 少杀软误报 |

原版大约是 **C**：可安装、有卸载、有快捷方式、托盘、本地数据持久化。

本复刻已具备 C 所需脚手架；你本机执行打包即可。

---

## 一键打包（Windows）

在工程目录：

```bash
cd F:\CTF_比赛\逆向分析\king-akmanage-rebuilt_20261013
npm install
npm run dist:win
```

产物在 `release/`：

| 文件 | 说明 |
|------|------|
| `云资产管理工具-<version>-win-x64.exe` | **NSIS 安装包**（可选目录、桌面快捷方式） |
| `云资产管理工具-<version>-portable.exe` | **绿色单文件**（免安装，适合U盘） |
| `win-unpacked/` | 解压目录版（和原版 `king-akmanage\` 同类） |

把安装包或 portable 发给别人即可，**对方不需要装 Node / 不懂命令行**。

---

## 和原版的对应关系

| 原版 | 复刻版 |
|------|--------|
| `云资产管理工具.exe` | `win-unpacked/云资产管理工具.exe` |
| `resources/app.asar` | 同左（asar=true） |
| NSIS 安装器 | `npm run dist:nsis` |
| 用户数据本地存 | `%APPDATA%/king-akmanage/akmanage-data.json`（与安装目录无关） |
| 托盘上传 / 热更新 | 已实现（热更新需自备 CDN） |

---

## 可选增强（成熟度再上一档）

1. **代码签名**：买 EV/OV 证书，`electron-builder` 配 `certificateFile`，减少 SmartScreen「未知发布者」
2. **自动更新**：填设置里的更新基址 + `docs/update-example/version.json`
3. **改版本号**：改 `package.json` 的 `version` 再打包
4. **换图标**：替换 `build/icon.ico` / `build/icon.png`

---

## 常见问题

**Q：杀软拦截？**  
未签名的 Electron 包常见。自己用可加白；对外发建议签名。

**Q：只要一个 exe？**  
用 portable；或把 `win-unpacked` 整个文件夹 zip 发给别人。

**Q：体积为什么大？**  
Electron 自带 Chromium，原版也是 100MB+ 量级，正常。

**Q：安装后还能看到本机测试过的账号？**  
账号**没有打进 exe**。开发态与安装版共用 `%APPDATA%\king-akmanage\akmanage-data.json`。  
本机验收「全新安装」体验：删该文件，或设置 → 关于 →「清空本地资产」。发给别人时对方机器没有你的 AppData，不会带上你的 AK。

**Q：`Cannot find module 'call-bind-apply-helpers'`？**  
0.1.4 起已将此包列为直接依赖，避免 electron-builder 打包时未提升到 asar 顶层。请用新包重装。
