import { ethers } from 'hardhat';
import { expect } from 'chai';
import { FunctionFragment } from 'ethers';

describe('TokenMinter', function () {
  const contracts: {
    tokenMinter?: any;
    spdBtc?: any;
  } = {};
  let owner: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    const TokenMinter = await ethers.getContractFactory('TokenMinter');
    contracts.tokenMinter = await TokenMinter.deploy();

    const spdBTC = await ethers.getContractFactory('spdBTC');
    const ossifiableProxy = await ethers.getContractFactory('OssifiableProxy');
    const spdBtcImplementation = await spdBTC.deploy();
    const initializeProductFunction = (
      spdBTC.interface.fragments.filter(
        (f) => f.type == 'function',
      ) as FunctionFragment[]
    ).find((f) => f.name == 'initializeProduct') as FunctionFragment;
    const initializeProductData = spdBTC.interface.encodeFunctionData(
        initializeProductFunction, [
          {
            asset: await contracts.tokenMinter.getAddress(),
            name: 'spdBTC',
            symbol: 'spdBTC',
            minDeposit: 0,
            maxDeposit: Math.pow(2, 52),
            custodian: await spdBtcImplementation.getAddress(),
          }
        ]
    );
    const ossifiableProxyImplementation = await ossifiableProxy.deploy(
      await spdBtcImplementation.getAddress(),
      owner.address,
      initializeProductData,
    );
    contracts.spdBtc = spdBTC.attach(await ossifiableProxyImplementation.getAddress());
  });

  it('Cannot initialize twice', async function () {
    await expect(
      contracts.spdBtc.initializeProduct({
        asset: await contracts.tokenMinter.getAddress(),
        name: 'spdBTC',
        symbol: 'spdBTC',
        minDeposit: 1000,
        maxDeposit: Math.pow(2, 52),
        custodian: await contracts.spdBtc.getAddress(),
      }),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'InvalidInitialization');
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

  it('Cannot deposit from blacklisted address', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.spdBtc.setBlacklisted(user1.address, true);
    await contracts.tokenMinter.mint(user1.address, mintAmount);
    await contracts.tokenMinter.allow(
      user1.address,
      await contracts.spdBtc.getAddress(),
    );

    await expect(
      contracts.spdBtc.connect(user1).deposit(100, user2.address),
    ).to.be.revertedWith('Address is blacklisted');
  });

  it('Cannot deposit to blacklisted address', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.spdBtc.setBlacklisted(user2.address, true);
    await contracts.tokenMinter.mint(user1.address, mintAmount);
    await contracts.tokenMinter.allow(
      user1.address,
      await contracts.spdBtc.getAddress(),
    );

    await expect(
      contracts.spdBtc.connect(user1).deposit(100, user2.address),
    ).to.be.revertedWith('Receiver is blacklisted');
  });

  it('Cannot transfer tokens to blacklisted address', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.spdBtc.setBlacklisted(user2.address, true);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, user1.address);

    await expect(
      contracts.spdBtc.connect(user1).transfer(user2.address, 50)
    ).to.be.revertedWith('Receiver is blacklisted');
  });

  it('Cannot transfer tokens from blacklisted address', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, user1.address);
    await contracts.spdBtc.setBlacklisted(user1.address, true);

    await expect(
      contracts.spdBtc.connect(user1).transfer(user2.address, 50)
    ).to.be.revertedWith('Address is blacklisted');
  });

  it('Cannot transferFrom tokens to blacklisted address', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, user1.address);
    await contracts.spdBtc.connect(user1).approve(owner.address, 100);
    await contracts.spdBtc.setBlacklisted(user2.address, true);

    expect(
      contracts.spdBtc.transferFrom(user1.address, user2.address, 50),
    ).to.be.revertedWith('Receiver is blacklisted');
  });

  it('Cannot transferFrom tokens from blacklisted address', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, user1.address);
    await contracts.spdBtc.connect(user1).approve(owner.address, 100);
    await contracts.spdBtc.setBlacklisted(user1.address, true);

    expect(
      contracts.spdBtc.transferFrom(user1.address, user2.address, 50),
    ).to.be.revertedWith('Sender is blacklisted');
  });

  it('Blacklisted account cannot call transferFrom', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, owner.address);
    await contracts.spdBtc.approve(
      user1.address,
      100,
    );
    await contracts.spdBtc.setBlacklisted(user1.address, true);

    await expect(
      contracts.spdBtc.connect(user1).transferFrom(owner.address, user2.address, 50),
    ).to.be.revertedWith('Address is blacklisted');
  });

  it('Cannot transfer when paused', async function() {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, owner.address);
    await contracts.spdBtc.setContractPaused(true);

    await expect(
      contracts.spdBtc.transfer(user1.address, 50),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'EnforcedPause');
  });

  it('Cannot transferFrom when paused', async function() {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, user1.address);
    await contracts.spdBtc.connect(user1).approve(
      owner.address, 50,
    );
    await contracts.spdBtc.setContractPaused(true);

    await expect(
      contracts.spdBtc.transferFrom(user1.address, user2.address, 50),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'EnforcedPause');
  });

  it('Cannot deposit when paused', async function() {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.setContractPaused(true);

    await expect(
      contracts.spdBtc.deposit(100, owner.address),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'EnforcedPause');
  });
});
