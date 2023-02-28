pragma solidity ^0.8.0;

// this is mock oracle
contract Oracle {
    // mock usd prices
    mapping(address => uint256) public mockPrices;

    function getAssetPrice(address _address) external view returns (uint256) {
        return mockPrices[_address];
    }

    function setPrices(address _address, uint256 _price) external {
        mockPrices[_address] = _price;
    }
}
