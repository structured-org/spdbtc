// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/**
* @dev Struct for initialization parameters.
*/
struct ProductParams {
    address asset;       // Address of the WBTC ERC20 contract.
    string name;         // ERC20 token name.
    string symbol;       // ERC20 token symbol.
    uint256 minDeposit;  // Minimum deposit amount.
    uint256 maxDeposit;  // Maximum deposit amount.
    address custodian;   // Custodian address.
}
