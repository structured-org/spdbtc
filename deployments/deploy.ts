import { ethers } from 'hardhat';
import { FunctionFragment } from 'ethers';

require('dotenv').config({ path: __dirname + '.env' });
if (!process.env.OWNER) {
  throw new Error('OWNER must be specified');
}
const OWNER = process.env.OWNER!;
if (!process.env.CUSTODIAN) {
  throw new Error('CUSTODIAN must be specified');
}
const CUSTODIAN = process.env.CUSTODIAN!;
const MAX_DEPOSIT = process.env.MAX_DEPOSIT ?? String(Math.pow(2, 52));

const contracts: {
    tokenMinter?: any;
    spdBtc?: any;
  } = {};

async function main() {
  const TokenMinter = await ethers.getContractFactory('TokenMinter');
  contracts.tokenMinter = await TokenMinter.deploy();
  await contracts.tokenMinter.waitForDeployment();
  console.log(
    "Contract's address (token_minter):",
    await contracts.tokenMinter.getAddress(),
  );

  const spdBTC = await ethers.getContractFactory('SpdBTC');
  const ossifiableProxy = await ethers.getContractFactory('OssifiableProxy');
  const spdBtcImplementation = await spdBTC.deploy();
  await spdBtcImplementation.waitForDeployment();
  console.log(
    "Contract's address (spd_btc_implementation):",
    await spdBtcImplementation.getAddress(),
  );

  const initializeProductFunction = (
    spdBTC.interface.fragments.filter(
      (f) => f.type == 'function',
    ) as FunctionFragment[]
  ).find((f) => f.name == 'initializeProduct') as FunctionFragment;
  const initializeProductData = spdBTC.interface.encodeFunctionData(
    initializeProductFunction,
    [
      {
        asset: await contracts.tokenMinter.getAddress(),
        name: 'spdBTC',
        symbol: 'spdBTC',
        maxDeposit: MAX_DEPOSIT,
        custodian: CUSTODIAN,
      },
    ],
  );
  const ossifiableProxyImplementation = await ossifiableProxy.deploy(
    await spdBtcImplementation.getAddress(),
    OWNER,
    initializeProductData,
  );
  await ossifiableProxyImplementation.waitForDeployment();
  contracts.spdBtc = spdBTC.attach(
    await ossifiableProxyImplementation.getAddress(),
  );
  console.log("Contract's address (spd_btc):", await contracts.spdBtc.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
