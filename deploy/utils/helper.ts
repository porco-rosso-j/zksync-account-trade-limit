import { ethers, BigNumber} from "ethers";

export const toBN = (x: string): BigNumber => {
    return ethers.utils.parseEther(x)
}