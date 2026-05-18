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
**解决**：`steam-run npx hardhat node`。或直接改用 anvil。

### 1.4 fish shell 兼容
- heredoc（`cat << EOF`）在 fish 中卡死 → 用 `echo '...' > file`
- venv 激活用 `source venv/bin/activate.fish`（非 `venv/bin/activate`）

### 1.5 lsof 替代
NixOS 没有 lsof 但有 `fuser`。端口查杀：`fuser -k 3000/tcp`

### 1.6 venv _posixsubprocess 缺失
**症状**：pip install 报 `ModuleNotFoundError: No module named '_posixsubprocess'`
**根因**：NixOS 滚更升级 Python 版本，venv 内 symlink 指向旧 `.so`
**解决**：删 venv 重建
```fish
cd backend && rm -rf venv && python3 -m venv venv && source venv/bin/activate.fish && pip install -r requirements.txt
```

---

## 2. 前端编译/运行时问题

### 2.1 `as const` TypeScript 语法在 .jsx 中
**解决**：改用 CARD_DATA 常量数组 + values 索引

### 2.2 `page is not defined`
**解决**：全局搜索清除所有对已删除变量的引用

### 2.3 存证列表「暂无存证记录」
**解决**：清除所有已删变量引用

### 2.4 分页回弹
**根因**：useCallback 依赖 `[page]` + useEffect 依赖 fetchLogs → 改页产生新引用 → 效果重跑 → 跳回第 0 页
**解决**：EvidenceList/MyEvidence 自管理分页，App.js 只传初始数据

### 2.5 分页按钮不显示
**根因**：total 初始值 0，`Math.ceil(0/10)=1`，分页控件隐藏
**解决**：组件挂载时独立调 API 获取 total

### 2.6 dark class 挂错元素
**根因**：dark class 挂 `<div>`，CSS `html:not(.dark)` 永远不匹配
**解决**：`document.documentElement.classList.toggle("dark", isDark)`

### 2.7 useEffect 缺 hasDeviceId 依赖
**解决**：进门户改为 `window.location.reload()`，页面重载后所有状态全新

### 2.8 useEffect 内返回 JSX
**根因**：useEffect 里 `return <PortalPage />`
**解决**：JSX 只能从组件主体 return

### 2.9 npm run build hash 不变
**解决**：`sudo rm -rf node_modules/.cache && sudo mkdir -p node_modules/.cache && sudo chmod 777 node_modules/.cache`

### 2.10 npm start 报 eslint EACCES
**解决**：`sudo chmod -R ugo+rwX frontend/node_modules/.cache`

### 2.11 Card 发光动效诡异
**根因**：`.card-glow::before` 用 `conic-gradient` 只有一道紫色射线从中心旋转，hover 时像单点螺旋桨，不是边框发光
**解决**：删掉 `::before` 旋转射线，hover 时用 `box-shadow` 双层紫光晕 + `border-color` 过渡

---

## 3. 后端问题

### 3.1 `/logs` total 返回当前页数量
**解决**：先独立 `SELECT COUNT(*)` 获取真实总数

### 3.2 SQL 注入式引号嵌套
**解决**：SQL 内用单引号 `DATE('now', '-6 days')`，或用 Python 脚本替换而非纯 sed

### 3.3 device_id 查 stats 崩溃
**根因**：`Web3.to_checksum_address()` 不认 UUID 格式
**解决**：加 `Web3.is_address()` 前置判断

### 3.4 old anonymous 记录不可追溯
**决策**：device_id 是临时账户，按 key 精确统计 DB。旧 anonymous 记录无法回溯，接受历史损失。

### 3.5 权限：沙箱写文件后必须修权限
`sudo chmod 666 backend/main.py` 再写，写完后 `sudo chmod 644`

### 3.6 PDF 中文渲染为黑框（ZapfDingbats）
**症状**：PDF 中所有中文显示为符号/黑框
**根因**：Helvetica 无 CJK 字形，reportlab fallback 到 ZapfDingbats 符号字体
**修复**：注册 DroidSansFallback.ttf（CJK 回退字体），用 CJK_FONT 替代 Helvetica 渲染中文
```python
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
pdfmetrics.registerFont(TTFont("CJKFont", "/path/to/DroidSansFallback.ttf"))
```
**验证**：解压 PDF 流后搜索 `/F3`（ZapfDingbats）引用，0 次即修复成功

### 3.7 PDF QR 码渲染为黑框
**症状**：PDF 中 QR 码位置显示为黑色矩形
**根因**：`c.drawImage()` 读取 PNG 时 Pillow 解码失败（NixOS 常见），reportlab 不抛异常但画黑框
**修复**：用 reportlab 原生 `rect()` 遍历 qr.modules 二维矩阵画黑白方块，不依赖任何图像编码
```python
import qrcode
qr = qrcode.QRCode(box_size=4, border=2)
qr.add_data(url); qr.make(fit=True)
for row in range(n):
    for col in range(n):
        if matrix[row][col]:
            c.rect(x + col*ms, y + (n-1-row)*ms, ms, ms, fill=1, stroke=0)
```

---

## 4. 部署问题

### 4.1 nginx 500 Internal Server Error
**解决**：用 proxy 模式替代 root + tryFiles

### 4.2 Cloudflare 缓存不更新
**解决**：`npm run build` 产出带 hash 文件名，或 CF 后台 Purge Everything

### 4.3 上传 413 Request Entity Too Large
**解决**：nginx 配置加 `client_max_body_size 50M; proxy_request_buffering off;`

### 4.4 公网 API 返回 404（/api/stats）
**根因**：proxyPass 尾斜杠被吞，`/api` 前缀未剥
**解决**：`rewrite ^/api/?(.*)$ /$1 break;`

### 4.5 公网访问弹 Basic Auth
**解决**：basicAuthFile 只挂在需要认证的 location（`/vnc`）上

### 4.6 Cloudflare Tunnel 待机断连
**症状**：笔记本合盖唤醒后公网 502，本机服务正常
**解决**：`sudo systemctl restart cloudflared`

### 4.7 沙箱不能操作宿主机服务
无法执行：`nixos-rebuild switch`、`systemctl`、`pkill`、`npm start`
只能：读写文件、curl 验证、GitHub API push

### 4.8 二维码扫码 525 SSL 握手失败
**症状**：扫描证书二维码 → Cloudflare 525 error，但直接访问 `www.bigdogbarks.top` 正常
**根因**：二维码链接到 `bigdogbarks.top`（apex 域名，无 www），CF 上 apex 与 www 的 SSL/隧道配置不一致
**解决**：PDF 中 verify_url 改为 `https://www.bigdogbarks.top/?verify={hash}`

---

## 5. 前端 UI 问题

### 5.1 进度条卡在 90%
**解决**：用 axios `onUploadProgress` 获取真实上传进度

### 5.2 复制按钮静默失败
**根因**：`navigator.clipboard.writeText` 非 HTTPS 下无权限
**解决**：加 fallback `document.execCommand("copy")` + 临时 textarea

### 5.3 管理员入口不可见
**解决**：导航栏盾牌 + 「管理员」文字标签，紫色底 `opacity-60 hover:opacity-100`

### 5.4 仪表盘使用率 0%
**解决**：分母改为合约 MAX_RECENT=200

### 5.5 设备总数虚高
**解决**：后端新增 `total_device_count` 字段返回全量去重数
