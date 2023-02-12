import json
from web3 import Web3

# Largely a clone of generate_token_list.py but this submits transactions to approve
# the tokens for each DEX

secret = "<REDACTED>"

'''
How to generate the unformatted_token_list.txt file
1. cargo run --example privadex_build_visualize_graph --features=dot
2. Replace UniversalTokenId { chain: SubstrateParachain(Polkadot, 2004) for moonbeam
3. Replace UniversalTokenId { chain: SubstrateParachain(Polkadot, 2006) for astar
4. Replace UniversalTokenId { chain: SubstrateRelayChain(Polkadot), native for polkadot|native
5. Regex replace id: ERC20\(ERC20Token \{ addr: (0x[0-9a-z]*) \}\) \} for erc20,addr=$1
6. Replace id: Native } for native
'''

with open('./erc20_abi.json', 'r') as a:
    erc20_abi = a.read()

escrow_address = Web3.toChecksumAddress('0x05a81d8564a3eA298660e34e03E5Eff9a29d7a2A')
web3_d = {
    'astar': Web3(Web3.HTTPProvider('https://astar.public.blastapi.io')),
    'moonbeam': Web3(Web3.HTTPProvider('https://moonbeam.public.blastapi.io')),
}

stellaswap_router = Web3.toChecksumAddress('0x70085a09d30d6f8c4ecf6ee10120d1847383bb57')
beamswap_router = Web3.toChecksumAddress('0x96b244391d98b62d19ae89b1a4dccf0fc56970c7')
arthswap_router = Web3.toChecksumAddress('0xe915d2393a08a00c5a463053edd31bae2199b9e7')

with open('./erc20_abi.json') as f:
    erc20_abi = json.load(f)

def approve_txn(web3, erc20_contract, spender):
    nonce = web3.eth.get_transaction_count(escrow_address)
    approve_txn = erc20_contract.functions.approve(
        spender, 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        ).buildTransaction(
            {
                'from': escrow_address,
                'nonce': nonce,
            }
        )
    signed_txn = web3.eth.account.sign_transaction(approve_txn, secret)
    tx_hash = web3.eth.send_raw_transaction(signed_txn.rawTransaction)
    tx_receipt = web3.eth.wait_for_transaction_receipt(tx_hash)
    print(f'Txn hash = {tx_hash.hex()}, receipt = {tx_receipt}')

tokens = []
with open('unformatted_token_list.txt', 'r') as f:
    for line in f:
        chain, token_name = line.split('|')
        chain, token_name = chain.strip(), token_name.strip()
        if token_name[:11] == 'erc20,addr=':
            contract_address = token_name[11:]
        elif token_name[:7] == 'xc20,id':
            suffix = str(hex(int(token_name[8:])))[2:]
            contract_address = '0xffffffff' + '0' * (32 - len(suffix)) + suffix
        else:
            print(line)
            continue
        web3 = web3_d[chain.strip()]
        erc20 = web3.eth.contract(address=Web3.toChecksumAddress(contract_address), abi=erc20_abi)
        new_token = {
            'chain': chain,
            'token_name_encoded': token_name,
            'symbol': erc20.functions.symbol().call(),
            'name': erc20.functions.name().call(),
            'decimals': erc20.functions.decimals().call(),
        }
        if chain == 'moonbeam':
            stellaswap_allowance = erc20.functions.allowance(escrow_address, stellaswap_router).call()
            beamswap_allowance = erc20.functions.allowance(escrow_address, beamswap_router).call()
            print(f'Token {token_name} ({new_token["symbol"]}): StellaSwap allowance = {stellaswap_allowance}, BeamSwap allowance = {beamswap_allowance}')
            if stellaswap_allowance == 0:
                approve_txn(web3, erc20, stellaswap_router)
            if beamswap_allowance == 0:
                approve_txn(web3, erc20, beamswap_router)
        elif chain == 'astar':
            arthswap_allowance = erc20.functions.allowance(escrow_address, arthswap_router).call()
            print(f'Token {token_name} ({new_token["symbol"]}): ArthSwap allowance = {arthswap_allowance}')
            if arthswap_allowance == 0:
                approve_txn(web3, erc20, arthswap_router)
        tokens.append(new_token)
