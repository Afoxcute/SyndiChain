// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title StreamPay
 * @dev Main contract for real-time per-second payment streams on Somnia
 * @notice This contract enables true per-second money flows updated on-chain in real-time
 */
contract StreamPay is ReentrancyGuard, Ownable, Pausable {
    
    struct Stream {
        address sender;                 // Who's paying
        address recipient;              // Who's receiving
        uint256 totalAmount;           // Total amount deposited
        uint256 flowRate;              // Wei per second
        uint256 startTime;             // When stream starts
        uint256 lastUpdateTime;        // Last time balance was updated
        uint256 stopTime;              // When stream ends
        uint256 amountWithdrawn;       // Total withdrawn by recipient
        uint256 realTimeBalance;       // Current streamed amount (updated real-time)
        bool isActive;                 // Stream status
        string streamType;             // "work", "subscription", "gaming", etc.
        string description;            // Stream description/purpose
    }

    // Core mappings
    mapping(uint256 => Stream) public streams;
    mapping(address => uint256[]) public userStreams; // User's stream IDs
    mapping(address => uint256[]) public recipientStreams; // Streams user receives
    
    // Active stream management for batch operations
    uint256[] public activeStreamIds;
    mapping(uint256 => uint256) private activeStreamIndex;
    
    // Stream counter and keeper
    uint256 private nextStreamId = 1;
    address public keeper;
    
    // Performance tracking (for demo/judging)
    uint256 public totalStreamsCreated;
    uint256 public totalUpdatesPerformed;
    uint256 public totalVolumeStreamed;
    uint256 public lastBatchUpdateTime;
    uint256 public activeStreamCount;
    
    // Rate limiting for keeper
    uint256 public constant MAX_BATCH_SIZE = 200;
    uint256 public constant MIN_UPDATE_INTERVAL = 1; // 1 second
    
    // Events
    event StreamCreated(
        uint256 indexed streamId, 
        address indexed sender, 
        address indexed recipient, 
        uint256 totalAmount, 
        uint256 flowRate,
        uint256 startTime, 
        uint256 stopTime,
        string streamType
    );
    
    event StreamUpdated(
        uint256 indexed streamId, 
        uint256 realTimeBalance, 
        uint256 timestamp
    );
    
    event Withdrawn(
        uint256 indexed streamId, 
        address indexed recipient, 
        uint256 amount, 
        uint256 timestamp
    );
    
    event StreamCancelled(
        uint256 indexed streamId, 
        address indexed sender, 
        address indexed recipient, 
        uint256 senderRefund, 
        uint256 recipientPayout
    );
    
    event BatchUpdatePerformed(
        uint256 streamsUpdated, 
        uint256 timestamp, 
        uint256 gasUsed
    );
    
    event KeeperUpdated(address indexed oldKeeper, address indexed newKeeper);

    modifier onlyKeeper() {
        require(msg.sender == keeper, "StreamPay: Only keeper can call this");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        keeper = initialOwner; // Owner is initial keeper
    }

    /**
     * @dev Creates a new payment stream
     * @param recipient Address that will receive the streamed funds
     * @param duration Duration of stream in seconds
     * @param streamType Type of stream ("work", "subscription", "gaming")
     * @param description Human readable description of the stream
     */
    function createStream(
        address recipient,
        uint256 duration,
        string memory streamType,
        string memory description
    ) external payable nonReentrant whenNotPaused returns (uint256 streamId) {
        require(msg.value > 0, "StreamPay: Amount must be greater than 0");
        require(recipient != address(0), "StreamPay: Invalid recipient");
        require(recipient != msg.sender, "StreamPay: Cannot stream to yourself");
        require(duration > 0, "StreamPay: Duration must be greater than 0");
        require(duration <= 365 days, "StreamPay: Duration too long");
        require(bytes(streamType).length > 0, "StreamPay: Stream type required");

        // Fixed: Added minimum amount check to prevent precision loss
        require(msg.value >= duration, "StreamPay: Amount too small for duration");
        
        uint256 flowRate = msg.value / duration;
        require(flowRate > 0, "StreamPay: Flow rate too low");

        streamId = nextStreamId++;
        uint256 startTime = block.timestamp;
        uint256 stopTime = startTime + duration;
        
        streams[streamId] = Stream({
            sender: msg.sender,
            recipient: recipient,
            totalAmount: msg.value,
            flowRate: flowRate,
            startTime: startTime,
            lastUpdateTime: startTime,
            stopTime: stopTime,
            amountWithdrawn: 0,
            realTimeBalance: 0,
            isActive: true,
            streamType: streamType,
            description: description
        });
        
        // Add to active streams
        activeStreamIds.push(streamId);
        activeStreamIndex[streamId] = activeStreamIds.length - 1;
        
        // Add to user mappings
        userStreams[msg.sender].push(streamId);
        recipientStreams[recipient].push(streamId);
        
        // Update stats
        totalStreamsCreated++;
        activeStreamCount++;
        totalVolumeStreamed += msg.value;
        
        emit StreamCreated(
            streamId, 
            msg.sender, 
            recipient, 
            msg.value, 
            flowRate,
            startTime, 
            stopTime,
            streamType
        );
    }
    
    /**
     * @dev Batch update multiple streams - CORE INNOVATION
     * @param streamIds Array of stream IDs to update
     * @notice This is what makes real-time streaming possible on Somnia
     * @notice CHANGE 1: Changed from onlyKeeper to public - allows AI agent to call directly
     */
    function batchUpdateStreams(uint256[] memory streamIds) 
        public  // ← CHANGED: Was 'external onlyKeeper', now 'public'
        nonReentrant 
        whenNotPaused 
    {
        require(streamIds.length <= MAX_BATCH_SIZE, "StreamPay: Batch too large");
        require(
            block.timestamp >= lastBatchUpdateTime + MIN_UPDATE_INTERVAL, 
            "StreamPay: Too frequent updates"
        );
        
        uint256 gasStart = gasleft();
        uint256 updatedCount = 0;
        
        for (uint256 i = 0; i < streamIds.length; i++) {
            if (_updateStreamBalance(streamIds[i])) {
                updatedCount++;
            }
        }
        
        totalUpdatesPerformed += updatedCount;
        lastBatchUpdateTime = block.timestamp;
        
        uint256 gasUsed = gasStart - gasleft();
        emit BatchUpdatePerformed(updatedCount, block.timestamp, gasUsed);
    }
    
    /**
     * @dev Internal function to update a single stream's balance
     * @param streamId The stream to update
     * @return success Whether the update was successful
     * @notice CHANGE 2: Added keeper reward logic here
     */
    function _updateStreamBalance(uint256 streamId) internal returns (bool success) {
        Stream storage stream = streams[streamId];
        
        if (!stream.isActive || block.timestamp <= stream.lastUpdateTime) {
            return false;
        }
        
        // Calculate time elapsed and new amount
        uint256 timeElapsed = block.timestamp - stream.lastUpdateTime;
        uint256 maxTimeElapsed = stream.stopTime > stream.lastUpdateTime ? 
            stream.stopTime - stream.lastUpdateTime : 0;
        
        if (maxTimeElapsed == 0) {
            _deactivateStream(streamId);
            return false;
        }
        
        // Use minimum of actual time elapsed and remaining time
        uint256 effectiveTimeElapsed = timeElapsed > maxTimeElapsed ? maxTimeElapsed : timeElapsed;
        uint256 newAmount = effectiveTimeElapsed * stream.flowRate;
        
        // ============ KEEPER REWARD LOGIC (NEW) ============
        uint256 keeperReward = (newAmount * 1) / 1000; // 0.1% reward

        if (keeperReward > 0 && newAmount > keeperReward) {
            // Add remaining to recipient's balance
            stream.realTimeBalance += (newAmount - keeperReward);
            
            // Pay keeper (msg.sender is the AI agent calling this)
            (bool rewardSuccess, ) = payable(msg.sender).call{value: keeperReward}("");
            require(rewardSuccess, "StreamPay: Keeper reward failed");
        } else {
            // If reward is 0 or larger than amount, just add full amount
            stream.realTimeBalance += newAmount;
        }
        // ============ END REWARD LOGIC ============
        
        stream.lastUpdateTime = block.timestamp;
        
        // Check if stream should be completed
        if (block.timestamp >= stream.stopTime) {
            _deactivateStream(streamId);
        }
        
        emit StreamUpdated(streamId, stream.realTimeBalance, block.timestamp);
        return true;
    }
    
    /**
     * @dev Get the current withdrawable balance for a stream (view function)
     * @param streamId The stream ID
     * @return Current balance available for withdrawal
     */
    function getCurrentBalance(uint256 streamId) external view returns (uint256) {
        return _getCurrentBalance(streamId);
    }
    
    /**
     * @dev Internal version of getCurrentBalance to avoid external call issues
     * @param streamId The stream ID
     * @return Current balance available for withdrawal
     */
    function _getCurrentBalance(uint256 streamId) internal view returns (uint256) {
        Stream storage stream = streams[streamId];
        if (!stream.isActive) return 0;
        
        uint256 currentTime = block.timestamp > stream.stopTime ? stream.stopTime : block.timestamp;
        if (currentTime <= stream.lastUpdateTime) {
            return stream.realTimeBalance - stream.amountWithdrawn;
        }
        
        uint256 timeElapsed = currentTime - stream.lastUpdateTime;
        uint256 additionalAmount = timeElapsed * stream.flowRate;
        uint256 totalBalance = stream.realTimeBalance + additionalAmount;
        
        return totalBalance > stream.amountWithdrawn ? totalBalance - stream.amountWithdrawn : 0;
    }
    
    /**
     * @dev Allows recipient to withdraw their earned funds
     * @param streamId The stream to withdraw from
     */
    function withdrawFromStream(uint256 streamId) external nonReentrant whenNotPaused {
        Stream storage stream = streams[streamId];
        require(stream.isActive, "StreamPay: Stream not active");
        require(msg.sender == stream.recipient, "StreamPay: Not the recipient");
        
        // Update stream balance first
        _updateStreamBalance(streamId);
        
        uint256 withdrawableAmount = stream.realTimeBalance - stream.amountWithdrawn;
        require(withdrawableAmount > 0, "StreamPay: No funds to withdraw");

        stream.amountWithdrawn += withdrawableAmount;
        
        (bool success, ) = payable(stream.recipient).call{value: withdrawableAmount}("");
        require(success, "StreamPay: Transfer failed");

        emit Withdrawn(streamId, stream.recipient, withdrawableAmount, block.timestamp);
    }
    
    /**
     * @dev Cancel a stream and refund both parties
     * @param streamId The stream to cancel
     */
    function cancelStream(uint256 streamId) external nonReentrant whenNotPaused {
        Stream storage stream = streams[streamId];
        require(stream.isActive, "StreamPay: Stream already inactive");
        require(
            msg.sender == stream.sender || msg.sender == stream.recipient,
            "StreamPay: Unauthorized"
        );
        
        // Update balance before cancellation
        _updateStreamBalance(streamId);
        
        uint256 recipientBalance = stream.realTimeBalance - stream.amountWithdrawn;
        uint256 totalUsed = stream.amountWithdrawn + recipientBalance;
        uint256 senderRefund = stream.totalAmount > totalUsed ? stream.totalAmount - totalUsed : 0;
        
        _deactivateStream(streamId);
        
        // Transfer funds
        if (recipientBalance > 0) {
            (bool success, ) = payable(stream.recipient).call{value: recipientBalance}("");
            require(success, "StreamPay: Recipient transfer failed");
        }
        
        if (senderRefund > 0) {
            (bool success, ) = payable(stream.sender).call{value: senderRefund}("");
            require(success, "StreamPay: Sender refund failed");
        }
        
        emit StreamCancelled(streamId, stream.sender, stream.recipient, senderRefund, recipientBalance);
    }
    
    /**
     * @dev Internal function to deactivate a stream
     * Fixed: Added safety check for empty array
     */
    function _deactivateStream(uint256 streamId) internal {
        Stream storage stream = streams[streamId];
        if (!stream.isActive || activeStreamIds.length == 0) return;
        
        stream.isActive = false;
        activeStreamCount--;
        
        // Remove from active streams array
        uint256 index = activeStreamIndex[streamId];
        uint256 lastStreamId = activeStreamIds[activeStreamIds.length - 1];
        
        activeStreamIds[index] = lastStreamId;
        activeStreamIndex[lastStreamId] = index;
        activeStreamIds.pop();
        delete activeStreamIndex[streamId];
    }
    
    // View functions for frontend and analytics
    function getStreamInfo(uint256 streamId) external view returns (
        address sender,
        address recipient,
        uint256 totalAmount,
        uint256 flowRate,
        uint256 startTime,
        uint256 stopTime,
        uint256 currentBalance,
        bool isActive,
        string memory streamType,
        string memory description
    ) {
        Stream storage stream = streams[streamId];
        uint256 currentBal = _getCurrentBalance(streamId);
        return (
            stream.sender,
            stream.recipient,
            stream.totalAmount,
            stream.flowRate,
            stream.startTime,
            stream.stopTime,
            currentBal,
            stream.isActive,
            stream.streamType,
            stream.description
        );
    }

    function getUserStreams(address user) external view returns (uint256[] memory) {
        return userStreams[user];
    }
    
    function getRecipientStreams(address recipient) external view returns (uint256[] memory) {
        return recipientStreams[recipient];
    }
    
    function getActiveStreamIds() external view returns (uint256[] memory) {
        return activeStreamIds;
    }
    
    function getProtocolStats() external view returns (
        uint256 totalStreams,
        uint256 totalUpdates,
        uint256 totalVolume,
        uint256 activeStreams,
        uint256 lastUpdate
    ) {
        return (
            totalStreamsCreated,
            totalUpdatesPerformed,
            totalVolumeStreamed,
            activeStreamCount,
            lastBatchUpdateTime
        );
    }
    
    // Admin functions
    function setKeeper(address newKeeper) external onlyOwner {
        require(newKeeper != address(0), "StreamPay: Invalid keeper address");
        address oldKeeper = keeper;
        keeper = newKeeper;
        emit KeeperUpdated(oldKeeper, newKeeper);
    }
    
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    // Emergency functions
    function emergencyWithdraw() external onlyOwner whenPaused {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "StreamPay: Emergency withdrawal failed");
    }

    // Added: Receive function to handle direct ETH transfers
    receive() external payable {
        revert("StreamPay: Direct ETH transfers not allowed. Use createStream()");
    }
}
