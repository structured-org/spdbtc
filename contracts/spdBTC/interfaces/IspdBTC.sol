// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/**
 * @dev Struct for initialization parameters.
 */
struct ProductParams {
  address asset; // Address of the WBTC ERC20 contract.
  string name; // ERC20 token name.
  string symbol; // ERC20 token symbol.
  uint256 maxDeposit; // Maximum deposit amount.
  address custodian; // Custodian address.
}

/**
 * @dev Storage layout for the blacklist mapping.
 * Uses a struct to store the mapping at a specific storage slot.
 */
struct BlacklistStorage {
  mapping(address => bool) value;
}

/**
 * @dev Storage layout for the withdrawal request mapping.
 * Uses a struct to store the mapping at a specific storage slot.
 */
struct WithdrawalRequestsStorage {
  mapping(address => uint256) value;
}
