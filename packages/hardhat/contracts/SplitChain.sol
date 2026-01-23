// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SplitChain
 * @notice Simplified expense settlement contract - handles peer-to-peer ETH transfers only
 * @dev All group/expense data is stored off-chain in SQLite. Only settlements are on-chain.
 */
contract SplitChain {
    /// @notice Emitted when a debt is settled
    event Settlement(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 indexed groupId,
        uint256 timestamp
    );

    /// @notice Total settlements made through this contract
    uint256 public totalSettlements;

    /// @notice Total value settled through this contract
    uint256 public totalValueSettled;

    /**
     * @notice Settle a debt by sending ETH directly to creditor
     * @param creditor The address to pay
     * @param groupId Off-chain group reference (for event tracking)
     */
    function settle(address payable creditor, uint256 groupId) external payable {
        require(msg.value > 0, "Must send ETH");
        require(creditor != address(0), "Invalid creditor address");
        require(creditor != msg.sender, "Cannot pay yourself");

        // Transfer ETH to creditor
        (bool success, ) = creditor.call{value: msg.value}("");
        require(success, "Transfer failed");

        // Update stats
        totalSettlements++;
        totalValueSettled += msg.value;

        // Emit event for off-chain tracking
        emit Settlement(msg.sender, creditor, msg.value, groupId, block.timestamp);
    }

    /**
     * @notice Get contract statistics
     * @return settlements Total number of settlements
     * @return valueSettled Total ETH value settled
     */
    function getStats() external view returns (uint256 settlements, uint256 valueSettled) {
        return (totalSettlements, totalValueSettled);
    }
}
