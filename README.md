# BlockProof 🔗

**区块链电子文件存证系统** — 基于以太坊智能合约 + IPFS + SM3 国密哈希。

上传文件 → 计算哈希 → 存 IPFS → 写入链上合约 → 生成不可篡改的存证记录。任意第三方可通过哈希值验证文件是否被篡改。

## 快速开始

```bash
cd ~/Desktop/project_hjl && bash start.sh
```

浏览器打开 http://localhost:3000

## 功能

- 📤 **上传存证** — 单文件/批量上传，真实进度条
- 👤 **我的存证** — 按设备标识过滤个人记录，完整凭证详情
- 📋 **存证列表** — 分页查看所有记录，暗色卡片
- ✅ **验证工具** — 输入哈希值验证文件是否上链
- 📊 **趋势图** — 7天存证柱状图
- 🔐 **管理员控制台** — JWT 登录，6张指标卡、合约使用率环形图、设备 Top5、活跃热日历、操作按钮
- 🌙 **双主题** — 暗色/日间切换

## 技术栈

- **区块链**：Solidity 0.8.20 + Foundry Anvil
- **后端**：Python FastAPI + Web3.py + gmssl
- **前端**：React 18 + Tailwind CSS 3 + lucide-react
- **存储**：IPFS + SQLite
- **部署**：NixOS + nginx + Cloudflare Tunnel

## 文档

| 文档 | 说明 |
|------|------|
| `docs/ARCHITECTURE.md` | 架构总览、API、数据库、合约 |
| `docs/HISTORY.md` | 完整实现历史 |
| `docs/DEBUG.md` | 调试与故障排查 |
| `docs/worklog/` | 每日工作日志 |

## 公网地址

https://bigdogbarks.top (通过 Cloudflare Tunnel 反代)
