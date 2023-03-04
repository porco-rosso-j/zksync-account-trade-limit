//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

/**
@title SwapModuleDecoder Library that decodes arguments for swap from calldata 
@author Porco Rosso<porcorossoj89@gmail.com>
@notice this contract serves as a helper for GasPond to obtain argument values of swap functions in swapModule
*/

library SwapModuleDecoder {
    /**
    @notice this function decodes and returns argument values of functions in swapModuleUniV2.sol
    @param _calldata of swap functions such as swapETHForToken, swapTokenForETH and swapTokenForToken.
    @return tokenInAmount the input amount for swap
    @return path the swap path arrays that contains ERC20 tokenn addresses
    */
    function decodeSwapArgs(bytes memory _calldata)
        internal
        pure
        returns (uint256, address[] memory)
    {
        bytes memory data = extractCalldata(_calldata);

        (uint256 tokenInAmount, address[] memory path) = abi.decode(
            data,
            (uint256, address[])
        );

        return (tokenInAmount, path);
    }

    /**
    @notice this inner function extract calldata in a way that remove the first 4bytes(selector) from calldata
    @param _calldata of swap functions such as swapETHForToken, swapTokenForETH and swapTokenForToken.
    @return data calldata without selector, the first 4bytes of calldata.
    */
    function extractCalldata(bytes memory _calldata)
        internal
        pure
        returns (bytes memory)
    {
        bytes memory data;

        require(_calldata.length >= 4);

        assembly {
            let totalLength := mload(_calldata)
            let targetLength := sub(totalLength, 4)
            data := mload(0x40)

            mstore(data, targetLength)
            mstore(0x40, add(0x20, targetLength))
            mstore(add(data, 0x20), shl(0x20, mload(add(_calldata, 0x20))))

            for {
                let i := 0x1C
            } lt(i, targetLength) {
                i := add(i, 0x20)
            } {
                mstore(
                    add(add(data, 0x20), i),
                    mload(add(add(_calldata, 0x20), add(i, 0x04)))
                )
            }
        }

        return data;
    }
}
