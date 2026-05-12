// SPDX-License-Identifier: MIT
// 存证合约 — 哈希+IPFS锚定在链上，不可篡改
pragma solidity ^0.8.20;

contract EvidenceStorage {
    struct Evidence {
        string fileHash;
        string fileName;
        address uploader;
        uint256 timestamp;
        string ipfsCID;
    }

    address public owner;
    bool public paused;
    uint256 public totalEvidenceCount;

    mapping(string => Evidence) private _evidenceByHash;
    mapping(address => uint256) private _uploaderEvidenceCount;

    // 最近存证的哈希列表，上限固定，用来快速浏览
    // 完整历史通过链下扫 EvidenceCreated 事件获取
    uint256 constant MAX_RECENT = 200;
    string[MAX_RECENT] private _recentHashes;
    uint256 private _recentCursor;

    // ── 事件（链下扫事件比读数组更高效）──
    event EvidenceCreated(
        string indexed fileHash, string fileName,
        address indexed uploader, uint256 timestamp, string ipfsCID
    );
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }
    modifier whenNotPaused() { require(!paused, "Contract paused"); _; }

    constructor() { owner = msg.sender; }

    function uploadEvidence(
        string calldata fileHash,
        string calldata fileName,
        string calldata ipfsCID
    ) external whenNotPaused {
        require(bytes(fileHash).length > 0, "Empty hash");
        require(bytes(_evidenceByHash[fileHash].fileHash).length == 0, "Already exists");

        _evidenceByHash[fileHash] = Evidence(fileHash, fileName, msg.sender, block.timestamp, ipfsCID);
        totalEvidenceCount++;
        _uploaderEvidenceCount[msg.sender]++;

        // 环形覆盖，只保留最近 MAX_RECENT 条
        _recentHashes[_recentCursor % MAX_RECENT] = fileHash;
        _recentCursor++;

        emit EvidenceCreated(fileHash, fileName, msg.sender, block.timestamp, ipfsCID);
    }

    function getEvidence(string calldata fileHash) external view returns (Evidence memory) {
        Evidence memory ev = _evidenceByHash[fileHash];
        require(bytes(ev.fileHash).length > 0, "Not found");
        return ev;
    }

    function verifyEvidence(string calldata fileHash) external view returns (bool, Evidence memory) {
        Evidence memory ev = _evidenceByHash[fileHash];
        return bytes(ev.fileHash).length > 0 ? (true, ev) : (false, Evidence("", "", address(0), 0, ""));
    }

    function getUploaderEvidenceCount(address uploader) external view returns (uint256) {
        return _uploaderEvidenceCount[uploader];
    }

    // 只返回最近 MAX_RECENT 条哈希，取代旧版无限数组
    function getRecentHashes() external view returns (string[MAX_RECENT] memory, uint256 total) {
        return (_recentHashes, _recentCursor < MAX_RECENT ? _recentCursor : MAX_RECENT);
    }

    function pause() external onlyOwner {
        require(!paused, "Already paused"); paused = true; emit ContractPaused(msg.sender);
    }
    function unpause() external onlyOwner {
        require(paused, "Not paused"); paused = false; emit ContractUnpaused(msg.sender);
    }
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid");
        address prev = owner; owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }
}
