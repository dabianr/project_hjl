# BlockProof — 调试与故障排查

> 记录开发/部署过程中遇到的所有问题、根因和修复方案。

---

## 1. NixOS 环境问题

### 1.1 npm / pip not found
NixOS 不预装 npm/pip。通过 `systemPackages` 或在 `nix-shell` 内运行。
本项目在 `modules/development/javascript.nix` 和 `python.nix` 中配置。

### 1.2 pip 外管环境
NixOS 的 Python 是只读的，`pip install` 报 `externally-managed-environment`。
**解决**：使用 venv。
```fish
python3 -m venv venv
source venv/bin/activate.fish
pip install -r requirements.txt
```

### 1.3 Hardhat SIGBUS（地址对齐错误）
Hardhat 自带的 solc 预编译二进制与 NixOS 动态链接器不兼容。
**解决**：`steam-run npx hardhat node`。
**永久修复**：在 nixcfg 的 `nix-ld.libraries` 加 `glibc` 并 rebuild，之后硬帽子直接跑。
**注意**：`steam-run bash -c 'npx hardhat node &'` 会 SIGBUS，不要嵌套 bash。

### 1.4 fish shell 兼容
- heredoc（`cat << EOF`）在 fish 中卡死 → 用 `echo '...' > file`
- venv 激活用 `source venv/bin/activate.fish`（非 `venv/bin/activate`）
- start.sh 用 `#!/usr/bin/env bash` 不受 fish 影响

### 1.5 lsof 替代
NixOS 没有 lsof 但有 `fuser`。端口查杀：
```fish
fuser -k 3000/tcp
fuser -k 8001/tcp
```

---

## 2. 前端编译/运行时问题

### 2.1 `as const` TypeScript 语法在 .jsx 中
**症状**：`npm start` 报 `SyntaxError: Unexpected token`，指向 Dashboard.jsx
**根因**：.jsx 文件中用 `as const`，Babel 不识别
**解决**：改用 CARD_DATA 常量数组 + values 索引

### 2.2 `page is not defined`
**症状**：页面白屏，`ReferenceError: page is not defined`
**根因**：删除 page state 后残留了引用 page 的 useEffect
**解决**：全局搜索清除所有对已删除变量的引用

### 2.3 存证列表「暂无存证记录」
**症状**：上传文件后切换到列表页看不到记录
**根因**：fetchLogs 内残留已删变量（PAGE_SIZE、setTotalLogs），API 异常被空 catch 吞掉
**解决**：清除所有已删变量引用

### 2.4 分页回弹
**症状**：点击下页 → 闪烁 → 回到第 1 页
**根因**：useCallback 依赖 `[page]`，useEffect 依赖 fetchLogs。改页 → 新函数引用 → useEffect 重跑 → 回到第 0 页
**解决**：EvidenceList/MyEvidence 自管理分页，App.js 只传初始数据

### 2.5 分页按钮不显示
**症状**：分页控件消失
**根因**：total 初始值 0，`Math.ceil(0/10)=1`，分页因 `totalPages<=1` 隐藏
**解决**：组件挂载时独立调 API 获取 total

### 2.6 dark class 挂错元素
**症状**：深色主题下卡片为白色
**根因**：dark class 挂 `<div>`，CSS `html:not(.dark)` 永远不匹配
**解决**：`document.documentElement.classList.toggle("dark", isDark)`

### 2.7 useEffect 缺 hasDeviceId 依赖
**症状**：进门户页后 stats 不加载，your_evidence_count 为 0
**根因**：useEffect 只依赖 `[account]`，门户页切换只改 hasDeviceId，account 不变
**解决**：进门户改为 `window.location.reload()`，页面重载后所有状态全新。或用 `[account, hasDeviceId]` 依赖

### 2.8 useEffect 内返回 JSX
**症状**：React 报「Nothing was returned from render」
**根因**：写代码时在 useEffect 里 `return <PortalPage />`，JSX 只能从组件主体 return
**解决**：删除 useEffect 内的 JSX return

### 2.9 npm run build hash 不变
**症状**：改源文件后 `npm run build` 产出相同 hash
**根因**：webpack 的 babel-loader 缓存（`node_modules/.cache/babel-loader/`）未清
**解决**：`sudo rm -rf node_modules/.cache && sudo mkdir -p node_modules/.cache && sudo chmod 777 node_modules/.cache`

### 2.10 npm start 报 eslint EACCES
**症状**：`[eslint] EACCES: permission denied, open 'node_modules/.cache/.eslintcache'`
**根因**：沙箱创建的 `.eslintcache` 为 root 属主，宿主机用户写不进去
**解决**：`sudo chmod -R ugo+rwX frontend/node_modules/.cache`

---

## 3. 后端问题

### 3.1 `/logs` total 返回当前页数量
**根因**：`SELECT ... LIMIT ? OFFSET ?` 后 `len(rows)` 返回当前页行数
**解决**：先独立 `SELECT COUNT(*)` 获取真实总数

### 3.2 SQL 注入式引号嵌套
**根因**：sed 注入 Python 代码时，SQL 字符串内的双引号关闭了 Python 字符串
**解决**：SQL 内用单引号 `DATE('now', '-6 days')`，或用 Python 脚本替换而非纯 sed

### 3.3 device_id 查 stats 崩溃
**根因**：`Web3.to_checksum_address()` 不认 UUID 格式
**解决**：加 `Web3.is_address()` 前置判断，非地址直接跳过链上查询

### 3.4 old anonymous 记录不可追溯
**决策**：device_id 是临时账户，按 key 精确统计 DB。旧 anonymous 记录无法回溯到具体密钥，接受历史损失。

### 3.5 权限：沙箱写后端文件必须修权限
**解决**：`sudo chmod 666 backend/main.py` 再写，写完后 `sudo chmod 644`
`sudo chmod -R o+rX backend/` 保证目录可遍历

---

## 4. 部署问题

### 4.1 nginx 500 Internal Server Error
**根因**：NixOS nginx 模块的 `root` + `tryFiles` 组合不兼容
**解决**：回退到 proxy 模式（全部转发到 dev server）

### 4.2 Cloudflare 缓存不更新
**根因**：CF 边缘缓存 bundle.js（URL 不变则不刷新）
**解决**：`npm run build` 产出带 hash 文件名，或 CF 后台 Purge Everything，或 nginx 加 `Cache-Control: no-store`

### 4.3 上传 413 Request Entity Too Large
**根因**：nginx 默认 `client_max_body_size` 1MB
**解决**：nginx 配置加 `client_max_body_size 50M; proxy_request_buffering off;`

### 4.4 公网 API 返回 404（/api/stats）
**根因**：`proxyPass` 无尾斜杠，`/api/stats` 原样转发到没有 `/api` 前缀的后端
**解决**：`rewrite ^/api/?(.*)$ /$1 break;` 剥掉 `/api` 前缀
```nix
locations."/api" = {
  proxyPass = "http://127.0.0.1:8001";
  extraConfig = ''rewrite ^/api/?(.*)$ /$1 break;'';
};
```

### 4.5 公网访问弹 Basic Auth
**根因**：`basicAuthFile` 挂在 virtualHost 顶层
**解决**：只挂在需要认证的 location（`/vnc`）上

### 4.6 Cloudflare Tunnel 待机断连
**症状**：笔记本合盖唤醒后公网 502，本机服务正常
**根因**：cloudflared 进程在休眠时与 CF 边缘的 TCP 连接断开，唤醒后未自动重连
**解决**：`sudo systemctl restart cloudflared`
**预防**：NixOS 已配 `Restart=always`

### 4.7 沙箱不能操作宿主机服务
无法执行：`nixos-rebuild switch`、`systemctl`、`pkill`、`npm start`
只能：读写文件、curl 验证、GitHub API push

---

## 5. 前端 UI 问题

### 5.1 进度条卡在 90%
**根因**：用 setInterval 模拟进度
**解决**：用 axios `onUploadProgress` 获取真实上传进度

### 5.2 复制按钮静默失败
**根因**：`navigator.clipboard.writeText` 非 HTTPS 下无权限
**解决**：加 fallback `document.execCommand("copy")` + 临时 textarea

### 5.3 管理员入口不可见
**根因**：盾牌按钮用 `opacity-30` 几乎透明
**解决**：导航栏盾牌 + 「管理员」文字标签，紫色底 `opacity-60 hover:opacity-100`。PortalPage 底部保留三击隐藏入口

### 5.4 仪表盘使用率 0%
**根因**：分母用了 10000，18 条记录 `Math.round(18/10000*100)=0`
**解决**：分母改为合约 MAX_RECENT=200

### 5.5 设备总数虚高
**根因**：MiniStat 设备数取 `Object.keys(device_stats).length`，而 device_stats 只返回 Top5
**解决**：后端新增 `total_device_count` 字段返回全量去重数
