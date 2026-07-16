// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IStreamPay
 * @dev Interface for the StreamPay contract
 */
interface IStreamPay {

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
    
    // Core functions
    function createStream(
        address recipient,
        uint256 duration,
        string memory streamType,
        string memory description
    ) external payable returns (uint256 streamId);
    
    function batchUpdateStreams(uint256[] memory streamIds) external;
    
    function withdrawFromStream(uint256 streamId) external;
    
    function cancelStream(uint256 streamId) external;
    
    // View functions
    function getCurrentBalance(uint256 streamId) external view returns (uint256);
    
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
    );
    
    function getUserStreams(address user) external view returns (uint256[] memory);
    
    function getRecipientStreams(address recipient) external view returns (uint256[] memory);
    
    function getActiveStreamIds() external view returns (uint256[] memory);
    
    function getProtocolStats() external view returns (
        uint256 totalStreams,
        uint256 totalUpdates,
        uint256 totalVolume,
        uint256 activeStreams,
        uint256 lastUpdate
    );
}