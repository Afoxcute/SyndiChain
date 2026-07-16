// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../interfaces/IStreamPay.sol";

/**
 * @title StreamKeeper
 * @dev Automated system that updates streams every second to enable real-time balance updates
 * @notice This is what makes the "magic" happen - streams update automatically without user intervention
 */
contract StreamKeeper is Ownable, Pausable {
    
    IStreamPay public immutable streamPay;
    
    // Keeper configuration
    uint256 public updateInterval = 1; // seconds
    uint256 public maxBatchSize = 100;
    uint256 public maxGasPerUpdate = 500000;
    
    // Performance tracking
    uint256 public totalUpdateCycles;
    uint256 public totalStreamsProcessed;
    uint256 public totalGasUsed;
    uint256 public lastUpdateTime;
    uint256 public averageGasPerStream;
    
    // Keeper management
    mapping(address => bool) public authorizedKeepers;
    uint256 public keeperCount;
    
    // Update batching
    uint256 private currentBatchIndex;
    bool private isUpdating;
    
    // Events
    event UpdateCycleCompleted(
        uint256 indexed cycle,
        uint256 streamsProcessed,
        uint256 gasUsed,
        uint256 timestamp
    );
    
    event KeeperAuthorized(address indexed keeper);
    event KeeperRevoked(address indexed keeper);
    event ConfigUpdated(uint256 interval, uint256 batchSize, uint256 maxGas);
    event UpdateFailed(uint256 cycle, string reason);
    
    modifier onlyAuthorizedKeeper() {
        require(authorizedKeepers[msg.sender], "StreamKeeper: Not authorized");
        _;
    }
    
    modifier notUpdating() {
        require(!isUpdating, "StreamKeeper: Update in progress");
        _;
    }
    
    constructor(address _streamPay, address initialOwner) Ownable(initialOwner) {
        require(_streamPay != address(0), "StreamKeeper: Invalid StreamPay address");
        streamPay = IStreamPay(_streamPay);
        
        // Owner is initially authorized keeper
        authorizedKeepers[initialOwner] = true;
        keeperCount = 1;
        emit KeeperAuthorized(initialOwner);
    }
    
    /**
     * @dev Main keeper function - processes all active streams in batches
     * @notice This should be called every second by the keeper bot
     */
    function performUpkeep() external onlyAuthorizedKeeper whenNotPaused notUpdating {
        require(
            block.timestamp >= lastUpdateTime + updateInterval,
            "StreamKeeper: Too frequent updates"
        );
        
        isUpdating = true;
        uint256 gasStart = gasleft();
        uint256 streamsProcessed = 0;
        
        try this._executeUpdate() returns (uint256 processed) {
            streamsProcessed = processed;
            totalUpdateCycles++;
            totalStreamsProcessed += streamsProcessed;
            lastUpdateTime = block.timestamp;
            
            uint256 gasUsed = gasStart - gasleft();
            totalGasUsed += gasUsed;
            
            // Update average gas per stream
            if (totalStreamsProcessed > 0) {
                averageGasPerStream = totalGasUsed / totalStreamsProcessed;
            }
            
            emit UpdateCycleCompleted(totalUpdateCycles, streamsProcessed, gasUsed, block.timestamp);
            
        } catch Error(string memory reason) {
            emit UpdateFailed(totalUpdateCycles + 1, reason);
        } catch {
            emit UpdateFailed(totalUpdateCycles + 1, "Unknown error");
        }
        
        isUpdating = false;
    }
    
    /**
     * @dev Internal function to execute the update cycle
     * @return processed Number of streams processed
     * Fixed: Changed from view to make actual state changes
     */
    function _executeUpdate() external returns (uint256 processed) {
        require(msg.sender == address(this), "StreamKeeper: Internal function");
        
        uint256[] memory activeStreamIds = streamPay.getActiveStreamIds();
        uint256 totalStreams = activeStreamIds.length;
        
        if (totalStreams == 0) {
            return 0;
        }
        
        // Calculate how many batches we need
        uint256 batchCount = (totalStreams + maxBatchSize - 1) / maxBatchSize;
        uint256 processedStreams = 0;
        
        for (uint256 i = 0; i < batchCount; i++) {
            uint256 startIndex = i * maxBatchSize;
            uint256 endIndex = startIndex + maxBatchSize;
            if (endIndex > totalStreams) {
                endIndex = totalStreams;
            }
            
            // Create batch array
            uint256[] memory batch = new uint256[](endIndex - startIndex);
            for (uint256 j = startIndex; j < endIndex; j++) {
                batch[j - startIndex] = activeStreamIds[j];
            }
            
            // Process batch
            streamPay.batchUpdateStreams(batch);
            processedStreams += batch.length;
            
            // Gas check - if we're running low, stop here
            if (gasleft() < maxGasPerUpdate) {
                break;
            }
        }
        
        return processedStreams;
    }
    
    /**
     * @dev Check if upkeep is needed (for automation systems)
     * @return upkeepNeeded Whether upkeep should be performed
     * @return performData Data to pass to performUpkeep (empty for now)
     * Fixed: Corrected typo "somniatream" to "streamPay"
     */
    function checkUpkeep(bytes calldata /* checkData */) 
        external 
        view 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        upkeepNeeded = (
            !paused() &&
            !isUpdating &&
            block.timestamp >= lastUpdateTime + updateInterval &&
            streamPay.getActiveStreamIds().length > 0
        );
        performData = "";
    }
    
    /**
     * @dev Get detailed keeper statistics for dashboard
     */
    function getKeeperStats() external view returns (
        uint256 cycles,
        uint256 streamsProcessed,
        uint256 gasUsed,
        uint256 avgGasPerStream,
        uint256 lastUpdate,
        uint256 activeStreams,
        bool isActive
    ) {
        return (
            totalUpdateCycles,
            totalStreamsProcessed,
            totalGasUsed,
            averageGasPerStream,
            lastUpdateTime,
            streamPay.getActiveStreamIds().length,
            !paused() && !isUpdating
        );
    }
    
    /**
     * @dev Calculate estimated gas cost for next update cycle
     */
    function estimateNextUpdateCost() external view returns (uint256 estimatedGas) {
        uint256[] memory activeStreams = streamPay.getActiveStreamIds();
        uint256 totalStreams = activeStreams.length;
        
        if (totalStreams == 0) {
            return 0;
        }
        
        uint256 batchCount = (totalStreams + maxBatchSize - 1) / maxBatchSize;
        
        // Base gas per batch call + gas per stream
        uint256 baseBatchGas = 50000; // Estimated overhead per batch
        uint256 gasPerStream = averageGasPerStream > 0 ? averageGasPerStream : 10000;
        
        return (batchCount * baseBatchGas) + (totalStreams * gasPerStream);
    }
    
    // Configuration functions
    function updateConfig(
        uint256 _updateInterval,
        uint256 _maxBatchSize,
        uint256 _maxGasPerUpdate
    ) external onlyOwner {
        require(_updateInterval > 0, "StreamKeeper: Invalid interval");
        require(_maxBatchSize > 0, "StreamKeeper: Invalid batch size");
        require(_maxGasPerUpdate > 100000, "StreamKeeper: Gas limit too low");
        
        updateInterval = _updateInterval;
        maxBatchSize = _maxBatchSize;
        maxGasPerUpdate = _maxGasPerUpdate;
        
        emit ConfigUpdated(_updateInterval, _maxBatchSize, _maxGasPerUpdate);
    }
    
    // Keeper management
    function authorizeKeeper(address keeper) external onlyOwner {
        require(keeper != address(0), "StreamKeeper: Invalid address");
        require(!authorizedKeepers[keeper], "StreamKeeper: Already authorized");
        
        authorizedKeepers[keeper] = true;
        keeperCount++;
        emit KeeperAuthorized(keeper);
    }
    
    function revokeKeeper(address keeper) external onlyOwner {
        require(authorizedKeepers[keeper], "StreamKeeper: Not authorized");
        require(keeperCount > 1, "StreamKeeper: Cannot revoke last keeper");
        
        authorizedKeepers[keeper] = false;
        keeperCount--;
        emit KeeperRevoked(keeper);
    }
    
    // Emergency functions
    function pause() external onlyOwner {
        _pause();
    }
    
    function unpause() external onlyOwner {
        _unpause();
    }
    
    function emergencyUpdateStream(uint256 streamId) external onlyOwner {
        uint256[] memory singleStream = new uint256[](1);
        singleStream[0] = streamId;
        streamPay.batchUpdateStreams(singleStream);
    }
    
    // View functions for monitoring
    function canPerformUpkeep() external view returns (bool) {
        return (
            !paused() &&
            !isUpdating &&
            block.timestamp >= lastUpdateTime + updateInterval &&
            streamPay.getActiveStreamIds().length > 0
        );
    }
    
    function getNextUpdateTime() external view returns (uint256) {
        return lastUpdateTime + updateInterval;
    }
    
    function getActiveStreamCount() external view returns (uint256) {
        return streamPay.getActiveStreamIds().length;
    }
    
    function isKeeperAuthorized(address keeper) external view returns (bool) {
        return authorizedKeepers[keeper];
    }

    // Added: Receive function to handle direct ETH transfers
    receive() external payable {
        revert("StreamKeeper: Direct ETH transfers not allowed");
    }
}
