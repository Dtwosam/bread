// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract MockPositionManagerNFT {
    error NotOwner();
    error ZeroAddress();

    uint256 public nextTokenId = 1;
    mapping(uint256 tokenId => address owner) public ownerOf;

    function mint(address to) external returns (uint256 tokenId) {
        if (to == address(0)) revert ZeroAddress();
        tokenId = nextTokenId++;
        ownerOf[tokenId] = to;
    }

    function transferFrom(address from, address to, uint256 tokenId) external {
        if (ownerOf[tokenId] != from || msg.sender != from) revert NotOwner();
        if (to == address(0)) revert ZeroAddress();
        ownerOf[tokenId] = to;
    }
}
