// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenMinter is ERC20 {
    constructor() ERC20("Ticket", "TKT") { }

    function mint(address recepient, uint256 amount) public {
        _mint(recepient, amount);
    }

    function transfer(address from, address to, uint256 amount) public {
        _transfer(from, to, amount);
    }

    function allow(address owner, address spender) public {
        _approve(owner, spender, type(uint256).max, false);
    }
}