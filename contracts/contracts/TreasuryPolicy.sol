// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TreasuryPolicy
 * @dev Enforces on-chain policy rules that the SyndiChain Compliance Agent verifies against.
 * Hard limits that cannot be bypassed by any agent — only the DAO owner can modify.
 */
contract TreasuryPolicy is Ownable {

    struct Policy {
        uint256 dailyTransferLimit;   // Max STT transferable per 24h window
        uint256 singleTxLimit;        // Max STT per single transaction
        uint256 minLiquidityReserve;  // Min STT that must remain liquid
        bool requiresMultisig;        // Whether large txs need multisig approval
        uint256 multisigThreshold;    // Amount above which multisig is required
    }

    Policy public policy;

    // Allowlisted protocols the treasury can interact with
    mapping(address => bool) public allowlistedProtocols;
    mapping(address => string) public protocolNames;

    // Daily spend tracking
    uint256 public dailySpentAmount;
    uint256 public dailyWindowStart;

    // Approved pending transactions (from human-in-the-loop)
    mapping(bytes32 => bool) public approvedTransactions;
    mapping(bytes32 => uint256) public approvalExpiry;

    event PolicyUpdated(uint256 dailyLimit, uint256 singleTxLimit, uint256 minReserve);
    event ProtocolAllowlisted(address indexed protocol, string name);
    event ProtocolRemoved(address indexed protocol);
    event TransactionApproved(bytes32 indexed txHash, uint256 expiry);
    event TransactionExecuted(bytes32 indexed txHash);

    constructor(address initialOwner) Ownable(initialOwner) {
        // Sensible defaults for a DAO treasury
        policy = Policy({
            dailyTransferLimit: 10_000 ether,
            singleTxLimit: 5_000 ether,
            minLiquidityReserve: 1_000 ether,
            requiresMultisig: true,
            multisigThreshold: 2_000 ether
        });
        dailyWindowStart = block.timestamp;
    }

    /**
     * @dev Check if a proposed transaction complies with all policies.
     * Called by the Compliance Agent before presenting tx to human.
     */
    function checkCompliance(
        address protocol,
        uint256 amount,
        bytes32 txHash
    ) external view returns (bool compliant, string memory reason) {
        // Check protocol allowlist
        if (!allowlistedProtocols[protocol]) {
            return (false, "Protocol not on allowlist");
        }

        // Check single tx limit
        if (amount > policy.singleTxLimit) {
            return (false, "Exceeds single transaction limit");
        }

        // Check daily limit (approximate — exact check in execute)
        uint256 windowSpent = _currentWindowSpent();
        if (windowSpent + amount > policy.dailyTransferLimit) {
            return (false, "Would exceed daily transfer limit");
        }

        // Check if large tx needs prior approval
        if (policy.requiresMultisig && amount >= policy.multisigThreshold) {
            if (!approvedTransactions[txHash] || block.timestamp > approvalExpiry[txHash]) {
                return (false, "Large transaction requires human approval");
            }
        }

        return (true, "Compliant");
    }

    function _currentWindowSpent() internal view returns (uint256) {
        if (block.timestamp >= dailyWindowStart + 24 hours) {
            return 0; // New window — reset
        }
        return dailySpentAmount;
    }

    /**
     * @dev Record a spend against the daily limit. Only callable by approved agents.
     */
    function recordSpend(uint256 amount) external onlyOwner {
        if (block.timestamp >= dailyWindowStart + 24 hours) {
            dailyWindowStart = block.timestamp;
            dailySpentAmount = 0;
        }
        dailySpentAmount += amount;
    }

    /**
     * @dev Human approves a specific transaction hash from the war room UI.
     */
    function approveTransaction(bytes32 txHash, uint256 validForSeconds) external onlyOwner {
        approvedTransactions[txHash] = true;
        approvalExpiry[txHash] = block.timestamp + validForSeconds;
        emit TransactionApproved(txHash, approvalExpiry[txHash]);
    }

    function allowlistProtocol(address protocol, string calldata name) external onlyOwner {
        allowlistedProtocols[protocol] = true;
        protocolNames[protocol] = name;
        emit ProtocolAllowlisted(protocol, name);
    }

    function removeProtocol(address protocol) external onlyOwner {
        allowlistedProtocols[protocol] = false;
        emit ProtocolRemoved(protocol);
    }

    function updatePolicy(
        uint256 dailyLimit,
        uint256 singleTxLimit,
        uint256 minReserve,
        bool requireMultisig,
        uint256 multisigThreshold
    ) external onlyOwner {
        policy = Policy({
            dailyTransferLimit: dailyLimit,
            singleTxLimit: singleTxLimit,
            minLiquidityReserve: minReserve,
            requiresMultisig: requireMultisig,
            multisigThreshold: multisigThreshold
        });
        emit PolicyUpdated(dailyLimit, singleTxLimit, minReserve);
    }

    function getPolicy() external view returns (Policy memory) {
        return policy;
    }

    function getDailyRemaining() external view returns (uint256) {
        uint256 spent = _currentWindowSpent();
        return spent >= policy.dailyTransferLimit ? 0 : policy.dailyTransferLimit - spent;
    }
}
