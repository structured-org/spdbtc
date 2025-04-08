import { ethers } from 'hardhat';

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
    custodian: '0x38F11A09610A8af2ef4997fe29c59aD6365f8D0c',
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
