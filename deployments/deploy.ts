import { ethers } from "hardhat";

async function main() {
  const spdBTC = await ethers.getContractFactory("spdBTC");
  const spd_Btc = await spdBTC.deploy(
    "0x0000000000000000000000000000000000000000",
    "spdBTC",
    "spdBTC"
  );
  console.log("Contract's address:", await spd_Btc.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
