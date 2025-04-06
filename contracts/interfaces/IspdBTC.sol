// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
* @dev Struct for initialization parameters.
*/
struct ProductParams {
    uint minDeposit;     // Minimum deposit amount.
    uint maxDeposit;     // Maximum deposit amount.
    address custodian;   // Custodian address.
}
