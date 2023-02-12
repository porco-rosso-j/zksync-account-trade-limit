import json
from web3 import Web3

'''
How to generate the unformatted_token_list.txt file
1. cargo run --example privadex_build_visualize_graph --features=dot
2. Replace UniversalTokenId { chain: SubstrateParachain(Polkadot, 2004) for moonbeam
3. Replace UniversalTokenId { chain: SubstrateParachain(Polkadot, 2006) for astar
4. Replace UniversalTokenId { chain: SubstrateRelayChain(Polkadot), native for polkadot|native
5. Regex replace id: ERC20\(ERC20Token \{ addr: (0x[0-9a-z]*) \}\) \} for erc20,addr=$1
6. Replace id: Native } for native
'''

web3_d = {
    'astar': Web3(Web3.HTTPProvider('https://astar.public.blastapi.io')),
    'moonbeam': Web3(Web3.HTTPProvider('https://moonbeam.public.blastapi.io')),
}

with open('./erc20_abi.json') as f:
    erc20_abi = json.load(f)

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
        tokens.append(new_token)

with open('token_list.json', 'w') as f:
    json.dump(tokens, f, indent=4)
