import { ethers, run } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  const SpdBtc = await ethers.getContractFactory('SpdBTC');
  const spdBtc = await SpdBtc.deploy();
  console.log(`spdBTC implementation address: ${await spdBtc.getAddress()}`);

  console.log('Waiting until tx included in block + 16 blocks…');
  await spdBtc.deploymentTransaction()?.wait(16);

  await run('verify', {
    address: await spdBtc.getAddress(),
    constructorArgsParams: [],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
