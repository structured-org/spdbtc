import { ethers, run } from 'hardhat';
import { FunctionFragment } from 'ethers';

require('dotenv').config({ path: __dirname + '.env' });
const OWNER = process.env.OWNER;
if (!process.env.CUSTODIAN) {
  throw new Error('CUSTODIAN must be specified');
}
const CUSTODIAN = process.env.CUSTODIAN!;
const MAX_DEPOSIT = process.env.MAX_DEPOSIT ?? String(Math.pow(2, 52));
// defaults to the address of WBTC on Ethereum
const ASSET = process.env.ASSET ?? '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
const SYMBOL = process.env.SYMBOL ?? 'spdBTC';
const NAME = process.env.NAME ?? SYMBOL;
if (!process.env.SPDBTC_IMPLEMENTATION) {
  throw new Error('SPDBTC_IMPLEMENTATION must be specified');
}
const SPDBTC_IMPLEMENTATION = process.env.SPDBTC_IMPLEMENTATION!;

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const owner = OWNER ?? deployer.address;

  const SpdBtc = await ethers.getContractFactory('SpdBTC');
  const OssifiableProxy = await ethers.getContractFactory('OssifiableProxy');

  const initializeProductFunction = (
    SpdBtc.interface.fragments.filter(
      (f) => f.type == 'function',
    ) as FunctionFragment[]
  ).find((f) => f.name == 'initializeProduct') as FunctionFragment;
  const initializeProductData = SpdBtc.interface.encodeFunctionData(
    initializeProductFunction,
    [
      {
        asset: ASSET,
        name: NAME,
        symbol: SYMBOL,
        maxDeposit: MAX_DEPOSIT,
        custodian: CUSTODIAN,
      },
    ],
  );
  const ossifiableProxy = await OssifiableProxy.deploy(
    SPDBTC_IMPLEMENTATION,
    owner,
    initializeProductData,
  );
  console.log(`spdBTC proxy address: ${await ossifiableProxy.getAddress()}`);

  console.log('Waiting until tx included in block + 16 blocks…');
  await ossifiableProxy.deploymentTransaction()?.wait(16);

  await run('verify', {
    address: await ossifiableProxy.getAddress(),
    constructorArgsParams: [
      SPDBTC_IMPLEMENTATION,
      owner,
      initializeProductData,
    ],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
