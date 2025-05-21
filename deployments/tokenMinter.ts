import { ethers, run } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const TokenMinter = await ethers.getContractFactory('TokenMinter');
  const tokenMinter = await TokenMinter.deploy();
  console.log(`Token minter address: ${await tokenMinter.getAddress()}`);

  console.log('Waiting until tx included in block + 16 blocks…');
  await tokenMinter.deploymentTransaction()?.wait(16);

  await run('verify', {
    address: await tokenMinter.getAddress(),
    constructorArgsParams: [],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
