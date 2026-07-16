// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SomniaAgentRiskOracle
 * @dev On-chain risk registry for DeFi protocols on Somnia.
 * The Risk Agent reads from this oracle to base its veto decisions on real on-chain data.
 */
contract SomniaAgentRiskOracle is Ownable {

    struct ProtocolRisk {
        uint8 auditScore;         // 0-100: higher = better audited
        uint8 volatilityScore;    // 0-100: higher = more volatile
        uint8 liquidityScore;     // 0-100: higher = more liquid
        uint256 tvl;              // Total Value Locked in wei
        uint256 tvlPeak;          // All-time peak TVL
        uint256 lastIncidentTime; // Timestamp of last exploit/incident
        bool isAudited;
        bool isActive;
        string protocolName;
        string[] auditFirms;
    }

    mapping(address => ProtocolRisk) public protocolRisks;
    address[] public registeredProtocols;

    // Composite risk score thresholds
    uint8 public constant VETO_THRESHOLD = 70;   // Risk Agent auto-vetoes above this
    uint8 public constant CAUTION_THRESHOLD = 40; // Warning zone

    event ProtocolRegistered(address indexed protocol, string name, uint8 auditScore);
    event RiskUpdated(address indexed protocol, uint8 newCompositeScore);
    event IncidentReported(address indexed protocol, string description, uint256 timestamp);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @dev Compute a composite risk score for a protocol.
     * Higher score = higher risk. Risk Agent vetoes if > VETO_THRESHOLD.
     */
    function getCompositeRiskScore(address protocol) external view returns (uint8 score, string memory tier) {
        ProtocolRisk storage risk = protocolRisks[protocol];
        if (!risk.isActive) return (100, "UNKNOWN");

        // Weighted scoring: audit matters most, then liquidity, then volatility
        uint256 raw = 0;

        // Unaudited protocols get heavy penalty
        if (!risk.isAudited) raw += 40;
        else raw += uint256(100 - risk.auditScore) * 30 / 100;

        raw += uint256(risk.volatilityScore) * 25 / 100;
        raw += uint256(100 - risk.liquidityScore) * 20 / 100;

        // Recent incident penalty
        if (risk.lastIncidentTime > 0) {
            uint256 daysSinceIncident = (block.timestamp - risk.lastIncidentTime) / 1 days;
            if (daysSinceIncident < 180) {
                raw += 25 - (daysSinceIncident * 25 / 180);
            }
        }

        // TVL vs peak ratio — low TVL relative to peak is suspicious
        if (risk.tvlPeak > 0 && risk.tvl < risk.tvlPeak / 2) {
            raw += 10;
        }

        if (raw > 100) raw = 100;
        score = uint8(raw);

        if (score >= VETO_THRESHOLD) tier = "HIGH_RISK";
        else if (score >= CAUTION_THRESHOLD) tier = "CAUTION";
        else tier = "SAFE";
    }

    function registerProtocol(
        address protocol,
        string calldata name,
        uint8 auditScore,
        uint8 volatilityScore,
        uint8 liquidityScore,
        uint256 tvl,
        bool isAudited,
        string[] calldata auditFirms
    ) external onlyOwner {
        if (!protocolRisks[protocol].isActive) {
            registeredProtocols.push(protocol);
        }
        protocolRisks[protocol] = ProtocolRisk({
            auditScore: auditScore,
            volatilityScore: volatilityScore,
            liquidityScore: liquidityScore,
            tvl: tvl,
            tvlPeak: tvl,
            lastIncidentTime: 0,
            isAudited: isAudited,
            isActive: true,
            protocolName: name,
            auditFirms: auditFirms
        });
        emit ProtocolRegistered(protocol, name, auditScore);
    }

    function updateTVL(address protocol, uint256 newTvl) external onlyOwner {
        ProtocolRisk storage risk = protocolRisks[protocol];
        require(risk.isActive, "Protocol not registered");
        risk.tvl = newTvl;
        if (newTvl > risk.tvlPeak) risk.tvlPeak = newTvl;
    }

    function reportIncident(address protocol, string calldata description) external onlyOwner {
        protocolRisks[protocol].lastIncidentTime = block.timestamp;
        emit IncidentReported(protocol, description, block.timestamp);
    }

    function getProtocolData(address protocol) external view returns (ProtocolRisk memory) {
        return protocolRisks[protocol];
    }

    function getAllProtocols() external view returns (address[] memory) {
        return registeredProtocols;
    }
}
