# BlockProof 项目 Debug 文档

> 区块链电子文件存证系统 · 问题排查与修复记录

---

## 1. 前端编译错误

### 1.1 `as const` TypeScript 语法在 .jsx 文件中

**症状**: `npm start` 报 `SyntaxError: Unexpected token`，指向 Dashboard.jsx

**根因**: 在 .jsx 文件中使用了 TypeScript 的 `as const` 断言语法，Babel 不识别

**解决**: 改用 `CARD_DATA` 常量数组 + `values` 数组，完全避免 inline 对象数组中的 `as const`

```javascript
// ❌ 错误
[{ icon: Database, label: "总数", colorKey: "purple" } as const, ...]

// ✅ 正确
const CARD_DATA = [
  { icon: Database, label: "总数", key: "purple" },
  ...
];
const values = [stats.total_evidence_count, ...];
CARD_DATA.map((card, idx) => <StatCard icon={card.icon} value={values[idx]} colorKey={card.key} />)
```

---

## 2. 前端运行时错误

### 2.1 `page is not defined`

**症状**: 页面白屏，控制台报 `ReferenceError: page is not defined`

**根因**: 删除 `page` state 后，App.js 中残留了引用 `page` 的 `useEffect(() => { fetchLogs(page) }, [page])`

**解决**: 删除该 useEffect

---

### 2.2 存证列表显示"暂无存证记录"

**症状**: 上传文件后切换到存证列表页看不到任何记录

**根因**: `App.js` 的 `fetchLogs` 函数残留已删除变量 `PAGE_SIZE` 和 `setTotalLogs`，API 请求异常被空 `catch` 吞掉，`setLogs` 从未被调用

**解决**: 全局搜索并清除所有对已删除变量的引用

---

### 2.3 存证列表翻页自动回弹到第一页

**症状**: 点击下一页后页面指示闪烁然后回到第 1 页

**根因**: `useCallback` 依赖 `[page]`，`useEffect` 又依赖 `fetchLogs`。改页 → 生成新函数引用 → useEffect 重跑 → 强制回到第 0 页

**解决**: EvidenceList 用本地 `useState` 管理分页，App.js 只传初始数据和 refresh 函数

```javascript
// ❌ 错误：跨组件传 page 状态
<EvidenceList page={page} onPageChange={setPage} />

// ✅ 正确：EvidenceList 自管理分页
const [page, setPage] = useState(0);
const fetchPage = async (p) => { /* 调 API */ };
```

---

### 2.4 分页按钮不显示

**症状**: 翻页修复后分页控件消失

**根因**: `total` 状态初始值 0，`Math.ceil(0/10) = 1`，分页因 `totalPages <= 1` 隐藏

**解决**: 组件挂载时独立调 API 获取总记录数

```javascript
React.useEffect(() => {
  axios.get(apiBase + "/logs", { params: { limit: 1, offset: 0 } })
    .then(({ data }) => setTotal(data.total || 0));
}, [apiBase]);
```

---

## 3. 样式问题

### 3.1 暗色模式下卡片为白色

**症状**: 深色主题下存证列表卡片为浅灰色/白色

**根因**: `dark` class 挂在根 `<div>` 上，CSS 选择器 `html:not(.dark)` 检查的是 `<html>` 元素，永远匹配不到，日间颜色覆盖了暗色

**解决**: `document.documentElement.classList.toggle("dark", isDark)`

```javascript
useEffect(() => {
  document.documentElement.classList.toggle("dark", theme === "dark");
}, [theme]);
```

---

## 4. 部署相关

### 4.1 nginx 500 Internal Server Error

**症状**: nginx 配置 `root` + `tryFiles` 后访问返回 500

**根因**: 疑似 NixOS nginx 模块不支持 `root` 与 `tryFiles` 的组合

**解决**: 回退到 proxy 模式

---

### 4.2 Cloudflare 缓存不更新

**症状**: 代码已更新但公网访问始终为旧版本

**根因**: Cloudflare 边缘缓存了 `bundle.js`（URL 不变，缓存不失效）

**方案 A**: Cloudflare 后台 Caching → Purge Everything（临时有效）
**方案 B**: `npm run build` 产出 hash 文件名（`main.abc123.js`），每次 build 文件名不同
**方案 C**: 生产 build 由 nginx 托管静态文件（需解决 500 问题）
**最优**: Proxy 到 dev server + 清 Cloudflare 缓存

---

### 4.3 上传文件返回 413 Request Entity Too Large

**症状**: 上传 >1MB 文件失败

**根因**: nginx 默认 `client_max_body_size` 为 1MB

**解决**: nginx 配置加 `client_max_body_size 50M;`
```nix
extraConfig = ''
  client_max_body_size 50M;
  proxy_request_buffering off;
'';
```

---

### 4.4 公网 API 返回 404

**症状**: `/api/stats` 返回 `{"detail":"Not Found"}`

**根因**: `proxyPass` 无尾斜杠，`/api/stats` 原样转发到后端（后端没有 `/api` 路由）

**解决**: `rewrite ^/api/?(.*)$ /$1 break;` 剥掉 `/api` 前缀

```nix
locations."/api" = {
  proxyPass = "http://127.0.0.1:8001";
  extraConfig = ''
    rewrite ^/api/?(.*)$ /$1 break;
  '';
};
```

---

### 4.5 公网访问弹 Basic Auth 密码框

**症状**: 通过域名访问时要求输入用户名密码

**根因**: `basicAuthFile` 挂在 virtualHost 顶层，所有路由都需要认证

**解决**: 只挂在需要认证的 location（`/vnc`）上

---

## 5. 后端问题

### 5.1 `/logs` 返回的 total 是当前页数量

**症状**: 前端分页显示"1/1"无法翻页

**根因**: `SELECT ... LIMIT ? OFFSET ?` 后 `len(rows)` 返回的是当前页行数

**解决**: 先独立查询 `SELECT COUNT(*)` 获取真实总数

```python
count_cursor = await db.execute("SELECT COUNT(*) FROM operation_logs")
total_row = await count_cursor.fetchone()
total_count = total_row[0] if total_row else 0
```

---

## 6. 基础设施

### 6.1 anvil 重启后数据丢失

**症状**: 本地链重启后所有存证数据消失

**根因**: anvil 是内存链，重启清零

**解决**: `anvil --state .anvil/ --state-interval 30` 每 30 秒自动存盘

---

### 6.2 端口 8000 被占用

**症状**: 启动后端时报 `address already in use`

**根因**: NixOS nginx 或其他服务占用了 8000 端口

**解决**: 改用 8001 端口，变量化 `BACKEND_PORT=8001`

---

### 6.3 日志文件权限冲突

**症状**: `nohup ... > /tmp/xxx.log` 报"权限不够"

**根因**: `/tmp` 文件由不同用户创建，跨 sudo 执行时重定向失败

**解决**: 日志写到项目目录 `.logs/`

---

## 7. 沙箱使用限制

| 操作 | 可行 | 替代方案 |
|------|------|---------|
| 读写项目文件 | ✅ `sudo cp / tee` | - |
| curl 验证服务 | ✅ | - |
| GitHub API push | ✅ | 代替 git push |
| `npm run build` | ✅ | 需 sudo |
| 杀宿主机进程 | ❌ | 用户手动 `pkill` |
| `nixos-rebuild` | ❌ | 用户手动 |
| `systemctl` | ❌ | 用户手动 |
| 启动/重启服务 | ❌ | 写入 Desktop 文档让用户执行 |
