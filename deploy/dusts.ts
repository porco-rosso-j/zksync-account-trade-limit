/*

    const abiCoder = new ethers.utils.AbiCoder();
    const encodedPair = abiCoder.encode(["address", "address"], [dai.address, _dai.address])
    const _pairAddress = utils.create2Address(
        factory.address,
        await factory.PAIR_HASH(),
        ethers.utils.keccak256(encodedPair),
        abiCoder.encode(["bytes"], ["0x"])
      );
    console.log("_pairAddress: ", _pairAddress)

*/