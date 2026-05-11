// SPDX-License-Identifier: MIT
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
    string[] private _allHashes;

    event EvidenceCreated(
        string indexed fileHash,
        string fileName,
        address indexed uploader,
        uint256 timestamp,
        string ipfsCID
    );

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

    function uploadEvidence(
        string calldata fileHash,
        string calldata fileName,
        string calldata ipfsCID
    ) external whenNotPaused {
        require(bytes(fileHash).length > 0, "Empty hash");
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

    function pause() external onlyOwner {
        require(!paused, "Already paused");
        paused = true;
    }

    function unpause() external onlyOwner {
        require(paused, "Not paused");
        paused = false;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
