// SPDX-License-Identifier: MIT
// 铁子，这是存证合约本体
// 文件哈希、IPFS CID、上传人地址全部锚定在链上
// 改了什么：加了 OwnershipTransferred 事件，之前的 transferOwnership 偷偷摸摸改 owner
// 前端想监听都听不到，现在 emit event 了，透明！
// 另外注释全换成了人话

pragma solidity ^0.8.20;

contract EvidenceStorage {
    struct Evidence {
        string fileHash;    // 文件哈希，SM3 或 SHA-256，唯一索引
        string fileName;    // 原始文件名
        address uploader;   // 谁传的
        uint256 timestamp;  // 区块时间戳
        string ipfsCID;     // IPFS 内容标识
    }

    address public owner;
    bool public paused;
    uint256 public totalEvidenceCount;

    // 哈希 → 存证记录
    mapping(string => Evidence) private _evidenceByHash;
    // 地址 → 存证数量
    mapping(address => uint256) private _uploaderEvidenceCount;
    // 所有哈希列表（注意：无限增长，以后得上 The Graph）
    string[] private _allHashes;

    // ── 事件 ──

    event EvidenceCreated(
        string indexed fileHash,
        string fileName,
        address indexed uploader,
        uint256 timestamp,
        string ipfsCID
    );

    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);

    // 新增：所有权转移事件，之前缺这个，前端监听不了
    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    // ── 权限控制 ──

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ── 核心功能 ──

    function uploadEvidence(
        string calldata fileHash,
        string calldata fileName,
        string calldata ipfsCID
    ) external whenNotPaused {
        // 空哈希不行
        require(bytes(fileHash).length > 0, "Empty hash");
        // 防重复存证，同一哈希只存一次
        require(
            bytes(_evidenceByHash[fileHash].fileHash).length == 0,
            "Evidence already exists"
        );

        _evidenceByHash[fileHash] = Evidence({
            fileHash: fileHash,
            fileName: fileName,
            uploader: msg.sender,
            timestamp: block.timestamp,
            ipfsCID: ipfsCID
        });

        _allHashes.push(fileHash);
        totalEvidenceCount++;
        _uploaderEvidenceCount[msg.sender]++;

        emit EvidenceCreated(fileHash, fileName, msg.sender, block.timestamp, ipfsCID);
    }

    function getEvidence(
        string calldata fileHash
    ) external view returns (Evidence memory) {
        Evidence memory ev = _evidenceByHash[fileHash];
        require(bytes(ev.fileHash).length > 0, "Not found");
        return ev;
    }

    function verifyEvidence(
        string calldata fileHash
    ) external view returns (bool, Evidence memory) {
        Evidence memory ev = _evidenceByHash[fileHash];
        if (bytes(ev.fileHash).length > 0) return (true, ev);
        return (false, Evidence("", "", address(0), 0, ""));
    }

    function getUploaderEvidenceCount(address uploader) external view returns (uint256) {
        return _uploaderEvidenceCount[uploader];
    }

    function getAllEvidenceHashes(
        uint256 offset,
        uint256 limit
    ) external view returns (string[] memory, uint256) {
        uint256 len = _allHashes.length;
        if (offset >= len) return (new string[](0), len);
        uint256 end = offset + limit > len ? len : offset + limit;
        string[] memory result = new string[](end - offset);
        for (uint256 i = 0; i < result.length; i++) {
            result[i] = _allHashes[offset + i];
        }
        return (result, len);
    }

    // ── 合约管理 ──

    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
        emit ContractPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
        emit ContractUnpaused(msg.sender);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        // 记录旧 owner，发事件，然后切
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }
}
