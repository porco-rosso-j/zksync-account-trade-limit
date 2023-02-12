const axios = require("axios");
const pino = require("pino");

const { ApiPromise, WsProvider, Keyring } = require("@polkadot/api");
const { typeDefinitions } = require("@polkadot/types");
const { ContractPromise } = require("@polkadot/api-contract");
const Phala = require("@phala/sdk");
const privadex_executor_contract = require("./privadex_executor_contract.json");

const logger = pino({ level: "debug" });

function loadPrivadexContractFile(address) {
  const metadata = privadex_executor_contract;
  // logger.info('Metadata:', metadata);
  // const constructor = metadata.V3.spec.constructors.find(c => c.label == 'default').selector;
  const constructor = metadata.V3.spec.constructors.find(
    (c) => c.label === "new"
  ).selector;
  const name = metadata.contract.name;
  const wasm = metadata.source.wasm;
  return { wasm, metadata, constructor, name, address };
}

async function contractApi(api, pruntimeUrl, contract) {
  const newApi = await api.clone().isReady;
  const phala = await Phala.create({
    api: newApi,
    baseURL: pruntimeUrl,
    contractId: contract.address,
    autoDeposit: true,
  });
  const contractApiInstance = new ContractPromise(
    phala.api,
    contract.metadata,
    contract.address
  );
  contractApiInstance.sidevmQuery = phala.sidevmQuery;
  contractApiInstance.instantiate = phala.instantiate;
  return contractApiInstance;
}

class PrivaDexAPI {
  #contractApi;
  #certSudo;

  constructor(contractApi, certSudo) {
    this.#contractApi = contractApi;
    this.#certSudo = certSudo;
  }

  static async initialize() {
    const nodeUrl = "wss://poc5.phala.network/ws";
    const pruntimeUrl = "https://poc5.phala.network/tee-api-1";
    const sudoAccount = "//Alice";

    const phatContractId = await axios.get("https://privadex-default-rtdb.firebaseio.com/phat-contract-id.json").then(res => res.data);
    const contractPrivadex = loadPrivadexContractFile(phatContractId);

    // Connect to the chain
    const wsProvider = new WsProvider(nodeUrl);
    const api = await ApiPromise.create({
      provider: wsProvider,
      types: {
        ...Phala.types,
        GistQuote: {
          username: "String",
          accountId: "AccountId",
        },
        ...typeDefinitions.contracts.types,
      },
    });

    // Prepare accounts
    const keyring = new Keyring({ type: "sr25519" });
    const sudo = keyring.addFromUri(sudoAccount);
    // logger.info(`Sudo has address ${sudo.address} with publicKey [${sudo.publicKey}]`);

    const certSudo = await Phala.signCertificate({ api, pair: sudo });
    // logger.info("certSudo (Alice):", certSudo)

    const privadexContractApi = await contractApi(
      api,
      pruntimeUrl,
      contractPrivadex
    );
    // logger.info("PrivaDEX API:", privadexContractApi, privadexContractApi.query);

    // privadexApi.query functions:
    // computeExecutionPlan
    // executionPlanStepForward
    // getAdmin
    // getEscrowEthAccountAddress
    // getExecPlan
    // getExecplanIds
    // initSecretKeys
    // quote
    // startSwap
    return new PrivaDexAPI(privadexContractApi, certSudo);
  }

  async execPlanIds() {
    const execPlanIds = await this.#contractApi.query.getExecplanIds(
      this.#certSudo,
      {}
    );
    return execPlanIds.output.isOk
      ? execPlanIds.output.asOk.map((uuid) => uuid.toString())
      : [];
  }

  async execPlan(execPlanId) {
    const res = await this.#contractApi.query.getExecPlan(
      this.#certSudo,
      {},
      execPlanId.replace("0x", "")
    );
    const printableRes = res.output.isOk ? res.output.asOk : res.output.asErr;
    logger.info(`Exec plan for ${execPlanId}: ${printableRes}`);
    return res;
  }

  async execPlanStepForward(execPlanId) {
    const res = await this.#contractApi.query.executionPlanStepForward(
      this.#certSudo,
      {},
      execPlanId.replace("0x", "")
    );
    const printableRes = res.output.isOk ? res.output.asOk : res.output.asErr;
    logger.info(`Step forward result for ${execPlanId}: ${printableRes}`);
    return res;
  }
}

async function sleep(t) {
  await new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}

async function main() {
  const privadexApi = await PrivaDexAPI.initialize();
  let execPlanUuid = process.argv[2];
  let x = await privadexApi.execPlanIds();
  console.log(x);
  await privadexApi.execPlan(execPlanUuid);
}

main()
  .then(process.exit)
  .catch((err) => console.error(err.message))
  .finally(() => process.exit(-1));
