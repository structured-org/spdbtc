// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

/**
* @dev Struct for initialization parameters.
*/
struct ProductParams {
    uint minDeposit;     // Minimum deposit amount.
    uint maxDeposit;     // Maximum deposit amount.
    address custodian;   // Custodian address.
}
