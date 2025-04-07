import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("spdBTC", function () {
  async function deployDefaultFixture() {
    const [owner] = await hre.ethers.getSigners();

    const spdBTCFactory = await hre.ethers.getContractFactory("spdBTC");
    const spdBTC = await spdBTCFactory.deploy(
      "0x0000000000000000000000000000000000000000", // TODO: mock ERC20 WBTC here
      "spdBTC",
      "spdBTC"
    );
    // TODO: call initializeProduct

    return { spdBTC, owner };
  }

  describe("Deployment", function () {
    it("Should have name", async function () {
      const { spdBTC } = await loadFixture(deployDefaultFixture);

      expect(await spdBTC.name()).to.equal("spdBTC");
    });
  });
});
