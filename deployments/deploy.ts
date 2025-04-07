import { ethers } from 'hardhat';

async function main() {
  const spdBtc = await ethers.getContractFactory('spdBTC');
  const tokenMinter = await ethers.getContractFactory('TokenMinter');
  const token_Minter = await tokenMinter.deploy();
  const spd_Btc = await spdBtc.deploy(
    await token_Minter.getAddress(),
    'spdBTC',
    'spdBTC',
  );
  console.log(
    "Contract's address (token_minter):",
    await token_Minter.getAddress(),
  );
  console.log("Contract's address (spd_btc):", await spd_Btc.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
