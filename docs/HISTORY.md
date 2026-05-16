# BlockProof — 实现历史

> 从 init 到完整平台，覆盖 91+ 次提交
> 周期：2026-05-11 → 至今

---

## 第一阶段：项目初始化（5月11日）

从 Vasto1/blockchain-evidence-system fork，搭建项目骨架。

- init — 基础目录结构、合约、后端、前端
- IPFS 异步化、RPC 重试装饰器、SQLite 依赖注入、合约事件补全、前端错误边界

## 第二阶段：批量上传与脚本（5月11日）

- batch-upload 端点（并发处理最多20文件）
- start.sh 一键启动脚本（链+后端+前端）
- README 加启动步骤，依赖检测脚本 check-deps.sh

## 第三阶段：链迁移与认证（5月11日）

- Hardhat node → Foundry anvil（NixOS 上 Hardhat SIGBUS）
- pytest 后端哈希函数测试（SM3/SHA-256）
- API_KEY 认证保护上传接口
- 合约环形缓冲 MAX_RECENT=200 替代无限数组

## 第四阶段：前端 UI 基础（5月11日）

- Toast 通知、骨架屏、Dark/Light 主题切换
- MetaMask 钱包连接（后来被踢出，变为可选）
- 上传/验证/列表三 tab 结构

## 第五阶段：Dashboard + 趋势图（5月11日）

- 四色统计卡片（链上总数/区块高度/个人存证/合约状态）
- ECharts 柱状图趋势（7天）
- App.js 大修，清除 sed 残留的僵尸代码

## 第六阶段：版本 1 完成（5月11-12日）

- start.sh 部署地址取 tail -1（合约非部署人地址）
- anvil 状态持久化（`--state .anvil --state-interval 10`）
- 折线图→柱状图优化，单点也有数据

## 第七阶段：端口迁移（5月12日）

- 后端 8000→8001（端口被 nginx 占用）
- 日志移出 /tmp 到项目 `.logs/` 目录
- 健康检查加重试

## 第八阶段：公网部署（5月12日）

- 前端 API_BASE 改为相对路径 `/api`，配合 nginx 反代
- nginx rewrite 剥 `/api` 前缀
- Cloudflare Tunnel 转发 443 → nginx:49514

## 第九阶段：UI 大优化（5月12日）

- 多色统计卡片（紫/青/绿/橙）
- count-up 数字递增动画
- 文件类型图标（PDF/图片/压缩包/通用）
- 上传真实进度（axios onUploadProgress）
- 复制按钮加 textarea fallback
- 相对时间显示

## 第十阶段：第二轮 UI 优化（5月12-13日）

- 错峰入场动画（stagger-enter）
- Tab 指示器 + 网络状态（绿/黄/红圆点）
- 空状态占位符
- ResultCard 复制按钮
- 彻底移除 `as const` TypeScript 语法

## 第十一阶段：分页修复（5月14日）

漫长调试分页回弹：
- `/logs` total 返回真实总数（SQL `COUNT(*)` 而非 `len(rows)`）
- EvidenceList 暗色卡片 `#1a1a2e`
- dark class 挂 `<html>` 修复证据卡片发白
- 分页回弹：使用 useRef → useState → 自管理分页
- 组件挂载时独立取 total
- 完整 DEBUG 文档记录所有问题

## 第十二阶段：管理员面板（5月14日）

- JWT 管理员登录（`POST /admin/login`）
- `require_admin` 依赖替换 `require_auth`
- 管理员状态/暂停/恢复/清理端点

## 第十三阶段：门户页 + 管理员控制台（5月14-15日）

核心功能上线：
- PortalPage.jsx：device_id 生成/折叠/复制、粘贴已有密钥
- AdminLogin.jsx：用户名密码浮层、JWT 存储
- AdminConsole.jsx：MiniStat 卡片、SVG RingChart、DeviceBar、ActivityTimeline、HeatCalendar

修复经历：
1. useEffect 内 return JSX → 编译报错
2. 密钥默认展开 → 折叠（ChevronDown/ChevronRight 图标）
3. 管理员入口透明不可见 → 导航栏 visible 按钮
4. 上传不传 uploader → 自动从 localStorage 取 device_id
5. stats 查 device_id 崩溃 → `Web3.is_address()` 防护
6. 复制 fallback → execCommand + textarea
7. 进门户后数据不加载 → `window.location.reload()`
8. device_id 不继承旧记录 + 设备数虚高 → 精确 DB 统计
9. 使用率 0% → 分母改 200
10. 设备总数取错 → 后端加 `total_device_count`

## 第十四阶段：我的存证 tab（5月16日）

- `/logs` 端点加 `uploader` 过滤参数
- MyEvidence.jsx 新建组件：分页/文件图标/完整凭证详情/复制按钮/骨架屏
- App.js 加「我的存证」tab

---

## 关键版本标记

| 版本 | 提交 | 说明 |
|------|------|------|
| v1 | `0c395ec0` | 基础存证功能完成 |
| v2 | `72f53f8a` | 公网部署成功 |
| v3 | `b95210f9` | 门户页+管理员控制台上线 |
| v4 | `ea352ea5` | 控制台仪表盘完成 |

## 项目文件树

```
project_hjl/
├── backend/
│   ├── main.py                  # FastAPI 入口（40+ 路由）
│   ├── blockchain_service.py    # Web3 合约交互
│   ├── auth.py                  # API_KEY + JWT
│   ├── database.py              # SQLite 初始化
│   ├── models.py                # Pydantic 模型
│   ├── config.py                # 环境变量
│   └── ipfs_service.py          # IPFS 上传
├── contracts/
│   └── EvidenceStorage.sol      # 存证合约
├── frontend/src/
│   ├── App.js                   # 根组件
│   └── components/              # 13 个组件
├── docs/
│   ├── ARCHITECTURE.md          # 架构文档
│   ├── HISTORY.md               # 本文
│   ├── DEBUG.md                 # 故障排查
│   └── worklog/                 # 每日工作日志
├── start.sh                     # 一键启动
└── README.md
```
