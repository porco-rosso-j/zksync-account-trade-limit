/* global BigInt */
// ^ needed to get this code to work smh

// To be constructed from token_list.json
export class Token {
  constructor(chain, tokenNameEncoded, symbol, name, decimals) {
    this.chain = chain;
    this.tokenNameEncoded = tokenNameEncoded;
    this.symbol = symbol;
    this.name = name;
    this.decimals = decimals;
  }

  static fromJSON(obj) {
    return new Token(
      obj.chain,
      obj.token_name_encoded,
      obj.symbol,
      obj.name,
      obj.decimals
    );
  }

  getAddressFromEncodedTokenName() {
    if (this.tokenNameEncoded === "native") {
      return "native";
    }
    if (this.tokenNameEncoded.slice(0, 11) === "erc20,addr=") {
      return this.tokenNameEncoded.slice(11);
    }
    if (this.tokenNameEncoded.slice(0, 10) === "xc20,addr=") {
      return this.tokenNameEncoded.slice(10);
    }
    if (this.tokenNameEncoded.slice(0, 8) === "xc20,id=") {
      let suffix = BigInt(this.tokenNameEncoded.slice(8)).toString(16);
      // console.log("suffix =", tokenNameEncoded, tokenNameEncoded.slice(8), suffix);
      return "0xffffffff" + "0".repeat(32 - suffix.length) + suffix;
    }
    return "";
  }

  getTruncatedAddressFromEncodedTokenName() {
    let maxLength = 17;
    let fullAddress = this.getAddressFromEncodedTokenName(
      this.tokenNameEncoded
    );
    if (fullAddress.length <= maxLength) {
      return fullAddress;
    }
    return fullAddress.slice(0, maxLength - 3) + "...";
  }
}
