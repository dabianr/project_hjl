# BlockProof 🔗

**区块链电子文件存证系统** — 基于以太坊智能合约 + IPFS + SM3 国密哈希。

上传文件 → 计算哈希 → 存 IPFS → 写入链上合约 → 生成不可篡改的存证记录 + PDF 证书。任意第三方可通过扫描证书二维码验证文件真伪。

## 快速启动

```bash
cd ~/Desktop/project_hjl && bash start.sh
```

浏览器打开 http://localhost:3000 或 https://www.bigdogbarks.top

## 功能

- 📤 **上传存证** — 单文件/批量上传，真实进度条
- 👤 **我的存证** — 按设备标识过滤个人记录，完整凭证详情
- 📋 **存证列表** — 分页查看所有记录，搜索/CSV导出/证书下载
- ✅ **验证工具** — 输入哈希值验证文件是否上链
- 📄 **PDF 证书** — 每条记录可下载存证证书，含二维码扫码验证
- 📊 **趋势图** — 7/30/90 天存证柱状图，可选时间范围
- 🔐 **管理员控制台** — JWT 登录，指标卡/环形图/设备Top5/热日历
- 🖥️ **门户页** — device_id 生成/折叠/复制/粘贴已有密钥
- 🌙 **双主题** — 暗色/日间切换，shimmer 骨架屏，按钮涟漪，卡片发光边框

## 技术栈

- **区块链**：Solidity 0.8.20 + Foundry Anvil（环形缓冲 MAX_RECENT=200）
- **后端**：Python FastAPI + Web3.py + gmssl + reportlab（14 个路由）
- **前端**：React 18 + Tailwind CSS 3 + lucide-react（14 个组件）
- **存储**：IPFS（Mock）+ SQLite
- **部署**：NixOS + nginx + Cloudflare Tunnel

## 文档

| 文档 | 说明 |
|------|------|
| `docs/ARCHITECTURE.md` | 架构总览、API、数据库、合约、目录结构 |
| `docs/HISTORY.md` | 完整实现历史与版本标记 |
| `docs/DEBUG.md` | 调试与故障排查（60+ 个已知问题） |
| `docs/worklog/` | 每日工作日志 |

## 公网地址

https://www.bigdogbarks.top （通过 Cloudflare Tunnel 反代）
