import { ethers } from 'hardhat';
import { expect } from 'chai';

describe('TokenMinter', function () {
  const contracts: {
    tokenMinter?: any;
    spdBtc?: any;
  } = {};
  let owner: any;

  beforeEach(async function () {
    const [own] = await ethers.getSigners();
    owner = own;

    const TokenMinter = await ethers.getContractFactory('TokenMinter');
    contracts.tokenMinter = await TokenMinter.deploy();

    const spdBTC = await ethers.getContractFactory('spdBTC');
    contracts.spdBtc = await spdBTC.deploy(
      await contracts.tokenMinter.getAddress(),
      'spdBTC',
      'spdBTC',
    );
    await contracts.spdBtc.initializeProduct({
      minDeposit: 0,
      maxDeposit: Math.pow(2, 52),
      custodian: await contracts.spdBtc.getAddress(),
    });
  });

  it('Mint & Execute', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );

    const balance = await contracts.tokenMinter.balanceOf(owner.address);
    expect(balance).to.equal(mintAmount);
    await contracts.spdBtc.deposit(123, owner.address);

    const balanceSpdBtc = await contracts.spdBtc.balanceOf(owner.address);
    expect(balanceSpdBtc).to.equal(123);
  });
});
