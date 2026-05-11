# NixOS 环境调试记录

## 问题：npm / pip 未找到

NixOS 不预装 npm/pip，通过 nix-shell 或配置 systemPackages 解决。
本项目已在 `modules/development/javascript.nix` 和 `python.nix` 中配置。

## 问题：pip 无法安装（外管环境）

NixOS 的 Python 是只读的，直接 `pip install` 报错：
`error: externally-managed-environment`

解决：使用 venv
```fish
python3 -m venv venv
source venv/bin/activate.fish
pip install -r requirements.txt
```

## 问题：Hardhat SIGBUS（地址对齐错误）

Hardhat 自带的 solc 是预编译二进制，与 NixOS 动态链接器不兼容。
`nix-shell -p nodejs solc` 也无效，因为 Hardhat 忽略系统 solc。

解决：使用 steam-run 包一层
```fish
NIXPKGS_ALLOW_UNFREE=1 nix-shell -p nodejs solc steam-run --run "steam-run npx hardhat node"
```

steam-run 提供标准 Linux 运行时环境，让 Hardhat 的 solc 正常执行。

## 问题：steam-run 隔离网络，部署连不上链

steam-run 内的 Hardhat 链对外不可见。
合约编译已在之前完成，所以部署可直接用 npx：
```fish
npx hardhat run contracts/deploy.js --network localhost
```
（链需在另一个终端用 steam-run 保持运行）

## 问题：fish shell 兼容性

- heredoc (`cat << EOF`) 在 fish 中会卡死 → 改用 `echo '...' > file`
- venv 激活用 `source venv/bin/activate.fish`（非 `venv/bin/activate`）

## 最终启动方案

1. 启动链（终端1）：steam-run 包 hardhat node
2. 部署合约（终端1或2）：npx hardhat run deploy.js
3. 后端（终端2）：venv + uvicorn
4. 前端（终端3）：npm start
