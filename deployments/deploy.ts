import { ethers } from 'hardhat';

require('dotenv').config({ path: __dirname + '.env' });
const { CUSTODIAN } = process.env;

async function main() {
  const spdBtc = await ethers.getContractFactory('spdBTC');
  const tokenMinter = await ethers.getContractFactory('TokenMinter');
  const token_Minter = await tokenMinter.deploy();
  await token_Minter.waitForDeployment();
  console.log(
    "Contract's address (token_minter):",
    await token_Minter.getAddress(),
  );
  const spd_Btc = await spdBtc.deploy(
    await token_Minter.getAddress(),
    'spdBTC',
    'spdBTC',
  );
  await spd_Btc.waitForDeployment();
  console.log("Contract's address (spd_btc):", await spd_Btc.getAddress());
  await spd_Btc.initializeProduct({
    minDeposit: 0,
    maxDeposit: BigInt(2 ** 52),
    custodian: CUSTODIAN,
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
