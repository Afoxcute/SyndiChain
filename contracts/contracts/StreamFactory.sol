// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";  // Added for security
import "../interfaces/IStreamPay.sol";

/**
 * @title StreamFactory
 * @dev Factory contract for creating standardized stream templates and managing stream types
 * @notice Makes it easy for users to create streams with pre-defined rates and purposes
 */
contract StreamFactory is Ownable, ReentrancyGuard {  // Added ReentrancyGuard

    IStreamPay public immutable streamPay;

    // Stream template structure
    struct StreamTemplate {
        string name;                    // "Freelance Developer", "Netflix Subscription"
        string streamType;              // "work", "subscription", "gaming"
        uint256 suggestedRate;          // Suggested wei per second
        uint256 minDuration;            // Minimum duration in seconds
        uint256 maxDuration;            // Maximum duration in seconds
        string description;             // Template description
        bool isActive;                  // Whether template can be used
        address creator;                // Who created this template
        uint256 usageCount;             // How many times it's been used
    }
    
    // Rate presets for common use cases
    struct RatePreset {
        string name;                    // "Minimum Wage", "Senior Developer"
        uint256 hourlyRateUSD;          // Rate in USD cents (e.g., 2500 = $25.00)
        uint256 weiPerSecond;           // Converted rate in wei/second
        string category;                // "work", "subscription", "gaming"
        bool isActive;
    }
    
    // Mappings
    mapping(uint256 => StreamTemplate) public templates;
    mapping(uint256 => RatePreset) public ratePresets;
    mapping(string => uint256[]) public templatesByType; // streamType => templateIds
    mapping(address => uint256[]) public userTemplates; // user => templateIds they created
    
    // Counters
    uint256 private nextTemplateId = 1;
    uint256 private nextPresetId = 1;
    
    // Configuration
    uint256 public templateCreationFee = 0.001 ether; // Fee to create custom template
    uint256 public maxTemplatesPerUser = 10;
    uint256 public constant MAX_TEMPLATE_NAME_LENGTH = 50;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 200;
    
    // Analytics
    uint256 public totalTemplatesCreated;
    uint256 public totalStreamsFromTemplates;
    mapping(string => uint256) public streamTypeUsage; // streamType => count
    
    // Events
    event TemplateCreated(
        uint256 indexed templateId,
        address indexed creator,
        string name,
        string streamType,
        uint256 suggestedRate
    );
    
    event TemplateUsed(
        uint256 indexed templateId,
        address indexed user,
        uint256 streamId,  // This will now have the actual stream ID
        uint256 actualRate
    );
    
    event RatePresetCreated(
        uint256 indexed presetId,
        string name,
        uint256 hourlyRateUSD,
        uint256 weiPerSecond
    );
    
    event TemplateDeactivated(uint256 indexed templateId);
    event ConfigUpdated(uint256 creationFee, uint256 maxTemplates);

    constructor(address _streamPay, address initialOwner) Ownable(initialOwner) {
        require(_streamPay != address(0), "StreamFactory: Invalid StreamPay address");
        streamPay = IStreamPay(_streamPay);
        
        // Create default rate presets
        _createDefaultPresets();
        
        // Create default templates
        _createDefaultTemplates();
    }
    
    /**
     * @dev Create a new stream template
     */
    function createTemplate(
        string memory name,
        string memory streamType,
        uint256 suggestedRate,
        uint256 minDuration,
        uint256 maxDuration,
        string memory description
    ) external payable nonReentrant {  // Added nonReentrant for security
        require(msg.value >= templateCreationFee, "StreamFactory: Insufficient fee");
        require(bytes(name).length > 0 && bytes(name).length <= MAX_TEMPLATE_NAME_LENGTH, "StreamFactory: Invalid name");
        require(bytes(streamType).length > 0, "StreamFactory: Stream type required");
        require(suggestedRate > 0, "StreamFactory: Rate must be positive");
        require(minDuration > 0 && maxDuration > minDuration, "StreamFactory: Invalid duration range");
        require(bytes(description).length <= MAX_DESCRIPTION_LENGTH, "StreamFactory: Description too long");
        require(userTemplates[msg.sender].length < maxTemplatesPerUser, "StreamFactory: Too many templates");
        
        uint256 templateId = nextTemplateId++;
        
        templates[templateId] = StreamTemplate({
            name: name,
            streamType: streamType,
            suggestedRate: suggestedRate,
            minDuration: minDuration,
            maxDuration: maxDuration,
            description: description,
            isActive: true,
            creator: msg.sender,
            usageCount: 0
        });
        
        // Add to mappings
        templatesByType[streamType].push(templateId);
        userTemplates[msg.sender].push(templateId);
        
        totalTemplatesCreated++;
        
        emit TemplateCreated(templateId, msg.sender, name, streamType, suggestedRate);
    }
    
    /**
     * @dev Create a stream using a template
     */
    function createStreamFromTemplate(
        uint256 templateId,
        address recipient,
        uint256 duration,
        uint256 customRate // 0 to use template rate
    ) external payable nonReentrant {  // Added nonReentrant for security
        // SECURITY: Check for zero address
        require(recipient != address(0), "StreamFactory: Invalid recipient address");
        
        StreamTemplate storage template = templates[templateId];
        require(template.isActive, "StreamFactory: Template not active");
        require(duration >= template.minDuration && duration <= template.maxDuration, "StreamFactory: Duration out of range");
        
        uint256 actualRate = customRate > 0 ? customRate : template.suggestedRate;
        uint256 totalAmount = actualRate * duration;
        require(msg.value >= totalAmount, "StreamFactory: Insufficient payment");

        // CRITICAL FIX: Capture the returned stream ID
        uint256 streamId = streamPay.createStream{value: totalAmount}(
            recipient,
            duration,
            template.streamType,
            template.description
        );
        
        // Update template usage
        template.usageCount++;
        totalStreamsFromTemplates++;
        streamTypeUsage[template.streamType]++;
        
        // Refund excess payment
        if (msg.value > totalAmount) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - totalAmount}("");
            require(success, "StreamFactory: Refund failed");
        }
        
        // CRITICAL FIX: Emit the actual stream ID instead of 0
        emit TemplateUsed(templateId, msg.sender, streamId, actualRate);
    }
    
    /**
     * @dev Create a rate preset (owner only)
     */
    function createRatePreset(
        string memory name,
        uint256 hourlyRateUSD,
        string memory category
    ) public onlyOwner {
        require(bytes(name).length > 0, "StreamFactory: Name required");
        require(hourlyRateUSD > 0, "StreamFactory: Rate must be positive");
        
        uint256 presetId = nextPresetId++;
        
        // Convert USD cents per hour to wei per second
        // Assuming 1 USD = 1000000000000000000 wei (1 ETH = $1000 example)
        uint256 weiPerSecond = (hourlyRateUSD * 1e18) / (1000 * 3600); // Simplified conversion
        
        ratePresets[presetId] = RatePreset({
            name: name,
            hourlyRateUSD: hourlyRateUSD,
            weiPerSecond: weiPerSecond,
            category: category,
            isActive: true
        });
        
        emit RatePresetCreated(presetId, name, hourlyRateUSD, weiPerSecond);
    }
    
    /**
     * @dev Get templates by stream type
     */
    function getTemplatesByType(string memory streamType) external view returns (uint256[] memory) {
        return templatesByType[streamType];
    }
    
    /**
     * @dev Get user's created templates
     */
    function getUserTemplates(address user) external view returns (uint256[] memory) {
        return userTemplates[user];
    }
    
    /**
     * @dev Get template details
     */
    function getTemplate(uint256 templateId) external view returns (
        string memory name,
        string memory streamType,
        uint256 suggestedRate,
        uint256 minDuration,
        uint256 maxDuration,
        string memory description,
        bool isActive,
        address creator,
        uint256 usageCount
    ) {
        StreamTemplate storage template = templates[templateId];
        return (
            template.name,
            template.streamType,
            template.suggestedRate,
            template.minDuration,
            template.maxDuration,
            template.description,
            template.isActive,
            template.creator,
            template.usageCount
        );
    }
    
    /**
     * @dev Get rate preset details
     */
    function getRatePreset(uint256 presetId) external view returns (
        string memory name,
        uint256 hourlyRateUSD,
        uint256 weiPerSecond,
        string memory category,
        bool isActive
    ) {
        RatePreset storage preset = ratePresets[presetId];
        return (
            preset.name,
            preset.hourlyRateUSD,
            preset.weiPerSecond,
            preset.category,
            preset.isActive
        );
    }
    
    /**
     * @dev Get all active template IDs. Sorting should be handled off-chain for gas efficiency.
     * OPTIMIZATION: Replaced gas-intensive on-chain sorting with simple ID return
     */
    function getActiveTemplateIds() external view returns (uint256[] memory) {
        uint256[] memory ids = new uint256[](totalTemplatesCreated);
        uint256 count = 0;
        
        for (uint256 i = 1; i < nextTemplateId; i++) {
            if (templates[i].isActive) {
                ids[count] = i;
                count++;
            }
        }
        
        // Resize the array to the actual count of active templates
        assembly {
            mstore(ids, count)
        }

        return ids;
    }
    
    /**
     * @dev Get factory statistics
     */
    function getFactoryStats() external view returns (
        uint256 templatesCreated,
        uint256 streamsFromTemplates,
        uint256 totalPresets,
        uint256 workStreams,
        uint256 subscriptionStreams,
        uint256 gamingStreams
    ) {
        return (
            totalTemplatesCreated,
            totalStreamsFromTemplates,
            nextPresetId - 1,
            streamTypeUsage["work"],
            streamTypeUsage["subscription"],
            streamTypeUsage["gaming"]
        );
    }
    
    // Internal functions
    /**
     * @dev Create default rate presets during deployment
     */
    function _createDefaultPresets() internal {
        // Work rates
        _internalCreateRatePreset("Minimum Wage", 1500, "work"); // $15.00/hour
        _internalCreateRatePreset("Junior Developer", 2500, "work"); // $25.00/hour  
        _internalCreateRatePreset("Senior Developer", 7500, "work"); // $75.00/hour
        _internalCreateRatePreset("Consultant", 15000, "work"); // $150.00/hour
        
        // Subscription rates
        _internalCreateRatePreset("Basic Subscription", 1000, "subscription"); // $10.00/month
        _internalCreateRatePreset("Premium Subscription", 2000, "subscription"); // $20.00/month
        
        // Gaming rates
        _internalCreateRatePreset("Casual Gaming", 100, "gaming"); // $1.00/hour
        _internalCreateRatePreset("Pro Gaming", 500, "gaming"); // $5.00/hour
    }
    
    /**
     * @dev Internal function to create rate presets without onlyOwner restriction
     */
    function _internalCreateRatePreset(
        string memory name,
        uint256 hourlyRateUSD,
        string memory category
    ) internal {
        uint256 presetId = nextPresetId++;
        
        // Convert USD cents per hour to wei per second
        uint256 weiPerSecond = (hourlyRateUSD * 1e18) / (1000 * 3600);
        
        ratePresets[presetId] = RatePreset({
            name: name,
            hourlyRateUSD: hourlyRateUSD,
            weiPerSecond: weiPerSecond,
            category: category,
            isActive: true
        });
        
        emit RatePresetCreated(presetId, name, hourlyRateUSD, weiPerSecond);
    }
    
    function _createDefaultTemplates() internal {
        // Work templates - Fixed: Use explicit integer conversions
        _createDefaultTemplate(
            "Freelance Web Developer",
            "work",
            uint256(5000 * 1e18) / uint256(1000 * 3600), // $50/hour to wei/second
            3600, // 1 hour min
            86400 * 7, // 1 week max
            "Hourly web development work"
        );
        
        _createDefaultTemplate(
            "Content Writing",
            "work", 
            uint256(2000 * 1e18) / uint256(1000 * 3600), // $20/hour
            1800, // 30 minutes min
            86400 * 3, // 3 days max
            "Content writing and copywriting services"
        );
        
        // Subscription templates
        _createDefaultTemplate(
            "Premium Content Access",
            "subscription",
            uint256(1000 * 1e18) / uint256(1000 * 86400 * 30), // $10/month to wei/second
            86400, // 1 day min
            86400 * 365, // 1 year max
            "Access to premium content and features"
        );
        
        // Gaming templates
        _createDefaultTemplate(
            "Play-to-Earn Rewards",
            "gaming",
            uint256(200 * 1e18) / uint256(1000 * 3600), // $2/hour
            300, // 5 minutes min
            86400, // 1 day max
            "Earn rewards for active gameplay"
        );
    }
    
    function _createDefaultTemplate(
        string memory name,
        string memory streamType,
        uint256 suggestedRate,
        uint256 minDuration,
        uint256 maxDuration,
        string memory description
    ) internal {
        uint256 templateId = nextTemplateId++;
        
        templates[templateId] = StreamTemplate({
            name: name,
            streamType: streamType,
            suggestedRate: suggestedRate,
            minDuration: minDuration,
            maxDuration: maxDuration,
            description: description,
            isActive: true,
            creator: owner(),
            usageCount: 0
        });
        
        templatesByType[streamType].push(templateId);
        totalTemplatesCreated++;
    }
    
    // Admin functions
    function deactivateTemplate(uint256 templateId) external onlyOwner {
        require(templates[templateId].creator != address(0), "StreamFactory: Template doesn't exist");
        templates[templateId].isActive = false;
        emit TemplateDeactivated(templateId);
    }
    
    function updateConfig(uint256 _templateCreationFee, uint256 _maxTemplatesPerUser) external onlyOwner {
        templateCreationFee = _templateCreationFee;
        maxTemplatesPerUser = _maxTemplatesPerUser;
        emit ConfigUpdated(_templateCreationFee, _maxTemplatesPerUser);
    }
    
    function updateRatePreset(uint256 presetId, uint256 newRate, bool isActive) external onlyOwner {
        require(ratePresets[presetId].hourlyRateUSD > 0, "StreamFactory: Preset doesn't exist");
        ratePresets[presetId].hourlyRateUSD = newRate;
        ratePresets[presetId].weiPerSecond = (newRate * 1e18) / (1000 * 3600);
        ratePresets[presetId].isActive = isActive;
    }
    
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "StreamFactory: No fees to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "StreamFactory: Withdrawal failed");
    }

    // Added: Receive function to handle direct ETH transfers
    receive() external payable {
        revert("StreamFactory: Direct ETH transfers not allowed. Use template functions.");
    }
}
