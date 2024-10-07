// SPDX-License-Identifier: UNLICENSED 

pragma solidity ^0.8.9;

import "hardhat/console.sol"; // Importing console for debugging

contract Token {
    string public name = "My Token"; // Token name
    string public symbol = "DGT"; // Token symbol
    uint256 public totalSupply = 1000000; // Total supply of tokens
    address public owner; // Address of the contract owner
    mapping(address => uint256) balances; // Mapping to store balances of each address

    event Transfer(address indexed _from, address indexed _to, uint256 _value); // Event declaration

    constructor() {
        balances[msg.sender] = totalSupply; // Assign the total supply to the contract creator
        owner = msg.sender; // Set the owner to the contract creator
    }

    function transfer(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Not enough tokens"); // Check for sufficient balance
        require(to != address(0), "Invalid recipient address"); // Check for valid recipient
        console.log("Transferring from %s to %s %s tokens", msg.sender, to, amount); // Log transfer details
        balances[msg.sender] -= amount; // Deduct the amount from sender's balance
        balances[to] += amount; // Add the amount to recipient's balance
        emit Transfer(msg.sender, to, amount); // Emit the transfer event
    }

    function balanceOf(address account) external view returns (uint256) {
        return balances[account]; // Return the balance of the specified account
    }

    // Function to get total supply
    function getTotalSupply() external view returns (uint256) {
        return totalSupply; // Return the total supply
    }
}
