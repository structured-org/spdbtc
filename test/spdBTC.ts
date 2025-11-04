import { ethers } from 'hardhat';
import { expect } from 'chai';
import { FunctionFragment } from 'ethers';

describe('spdBTC', function () {
  const contracts: {
    tokenMinter?: any;
    spdBtc?: any;
  } = {};
  let owner: any;
  let custodian: any;
  let user1: any;
  let user2: any;

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    custodian = signers[1];
    user1 = signers[2];
    user2 = signers[3];

    const TokenMinter = await ethers.getContractFactory('TokenMinter');
    contracts.tokenMinter = await TokenMinter.deploy();

    const spdBTC = await ethers.getContractFactory('SpdBTC');
    const ossifiableProxy = await ethers.getContractFactory('OssifiableProxy');
    const spdBtcImplementation = await spdBTC.deploy();
    const initializeProductFunction = (
      spdBTC.interface.fragments.filter(
        (f) => f.type == 'function',
      ) as FunctionFragment[]
    ).find((f) => f.name == 'initializeProduct') as FunctionFragment;
    const initializeProductData = spdBTC.interface.encodeFunctionData(
      initializeProductFunction,
      [
        {
          asset: await contracts.tokenMinter.getAddress(),
          name: 'spdBTC',
          symbol: 'spdBTC',
          maxDeposit: Math.pow(2, 52),
          custodian: custodian.address,
        },
      ],
    );
    const ossifiableProxyImplementation = await ossifiableProxy.deploy(
      await spdBtcImplementation.getAddress(),
      owner.address,
      initializeProductData,
    );
    contracts.spdBtc = spdBTC.attach(
      await ossifiableProxyImplementation.getAddress(),
    );
  });

  it('Cannot initialize twice', async function () {
    await expect(
      contracts.spdBtc.initializeProduct({
        asset: await contracts.tokenMinter.getAddress(),
        name: 'spdBTC',
        symbol: 'spdBTC',
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

    await contracts.spdBtc.setBlacklisted(user1.address, true);

    const balance = await contracts.tokenMinter.balanceOf(owner.address);
    expect(balance).to.equal(mintAmount);
    await contracts.spdBtc.deposit(123, owner.address);

    const balanceSpdBtc = await contracts.spdBtc.balanceOf(owner.address);
    expect(balanceSpdBtc).to.equal(123);
  });

  it('Funds custodian after a deposit', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, user1.address);

    expect(
      await contracts.tokenMinter.balanceOf(custodian.address),
    ).to.be.equal(100n);
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
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'SenderBlacklisted');
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
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'ReceiverBlacklisted');
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
      contracts.spdBtc.connect(user1).transfer(user2.address, 50),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'ReceiverBlacklisted');
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
      contracts.spdBtc.connect(user1).transfer(user2.address, 50),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'SenderBlacklisted');
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
    await contracts.spdBtc.approve(user1.address, 100);
    await contracts.spdBtc.setBlacklisted(user1.address, true);

    await expect(
      contracts.spdBtc
        .connect(user1)
        .transferFrom(owner.address, user2.address, 50),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'SenderBlacklisted');
  });

  it('Cannot transfer when paused', async function () {
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

  it('Cannot transferFrom when paused', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.deposit(100, user1.address);
    await contracts.spdBtc.connect(user1).approve(owner.address, 50);
    await contracts.spdBtc.setContractPaused(true);

    await expect(
      contracts.spdBtc.transferFrom(user1.address, user2.address, 50),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'EnforcedPause');
  });

  it('Cannot deposit when paused', async function () {
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

  it('Cannot exceed max deposit', async function () {
    const mintAmount = ethers.parseUnits('1000', 18);
    await contracts.tokenMinter.mint(owner.address, mintAmount);
    await contracts.tokenMinter.allow(
      owner.address,
      await contracts.spdBtc.getAddress(),
    );
    await contracts.spdBtc.setMaxDeposit(500);
    await contracts.spdBtc.deposit(300, user1.address);

    await expect(
      contracts.spdBtc.deposit(300, user1.address),
    ).to.be.revertedWithCustomError(contracts.spdBtc, 'ExceededMaxDeposit');
  });

  describe('Withdrawals', function () {
    it('Cannot request more than available', async function () {
      const mintAmount = ethers.parseUnits('1000', 18);
      await contracts.tokenMinter.mint(user1.address, mintAmount);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);

      await expect(
        contracts.spdBtc.connect(user1).requestWithdrawal(400),
      ).to.be.revertedWithCustomError(
        contracts.spdBtc,
        'ERC20InsufficientBalance',
      );
    });

    it('Locks user funds after requesting a withdrawal', async function () {
      const mintAmount = ethers.parseUnits('1000', 18);
      await contracts.tokenMinter.mint(user1.address, mintAmount);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);

      expect(await contracts.spdBtc.withdrawalRequestOf(user1)).to.be.equal(0n);
      await contracts.spdBtc.connect(user1).requestWithdrawal(200);
      expect(await contracts.spdBtc.withdrawalRequestOf(user1)).to.be.equal(
        200n,
      );
      expect(await contracts.spdBtc.balanceOf(user1)).to.be.equal(100n);
      expect(
        await contracts.spdBtc.balanceOf(await contracts.spdBtc.getAddress()),
      ).to.be.equal(200n);
    });

    it('Cannot request withdrawal twice', async function () {
      const mintAmount = ethers.parseUnits('1000', 18);
      await contracts.tokenMinter.mint(user1.address, mintAmount);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);
      await contracts.spdBtc.connect(user1).requestWithdrawal(50);

      await expect(
        contracts.spdBtc.connect(user1).requestWithdrawal(100),
      ).to.be.revertedWithCustomError(
        contracts.spdBtc,
        'WithdrawalRequestExists',
      );
    });

    it('Refunds after cancelling a withdrawal', async function () {
      const mintAmount = ethers.parseUnits('1000', 18);
      await contracts.tokenMinter.mint(user1.address, mintAmount);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);
      await contracts.spdBtc.connect(user1).requestWithdrawal(200);

      await contracts.spdBtc.connect(user1).cancelWithdrawal();
      expect(await contracts.spdBtc.balanceOf(user1)).to.be.equal(300n);
      expect(
        await contracts.spdBtc.balanceOf(await contracts.spdBtc.getAddress()),
      ).to.be.equal(0n);
    });

    it('Is noop to cancel a non-existing request', async function () {
      const mintAmount = ethers.parseUnits('1000', 18);
      await contracts.tokenMinter.mint(user1.address, mintAmount);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);

      await contracts.spdBtc.connect(user1).cancelWithdrawal();
      expect(await contracts.spdBtc.balanceOf(user1)).to.be.equal(300n);
      expect(
        await contracts.spdBtc.balanceOf(await contracts.spdBtc.getAddress()),
      ).to.be.equal(0n);
    });

    it('Cannot process a withdrawal when it does not exist', async function () {
      await contracts.tokenMinter.mint(user1.address, 500);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);

      await expect(
        contracts.spdBtc.processWithdrawal(user1.address, 300),
      ).to.be.revertedWithCustomError(contracts.spdBtc, 'NoWithdrawalRequest');
    });

    it('Burns spdBTC and transfers WBTC after processing a request', async function () {
      await contracts.tokenMinter.mint(user1.address, 500);
      await contracts.tokenMinter.mint(owner.address, 1000);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.tokenMinter.allow(
        owner.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);
      await contracts.spdBtc.connect(user1).requestWithdrawal(200);

      await contracts.spdBtc.processWithdrawal(user1.address, 300);
      expect(await contracts.tokenMinter.balanceOf(user1)).to.be.equal(500n);
      expect(await contracts.tokenMinter.balanceOf(owner)).to.be.equal(700n);
      expect(
        await contracts.tokenMinter.balanceOf(custodian.address),
      ).to.be.equal(300n);
      expect(
        await contracts.spdBtc.balanceOf(await contracts.spdBtc.getAddress()),
      ).to.be.equal(0n);
    });

    it('Cannot request on pause', async function () {
      const mintAmount = ethers.parseUnits('1000', 18);
      await contracts.tokenMinter.mint(user1.address, mintAmount);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);
      await contracts.spdBtc.setContractPaused(true);

      await expect(
        contracts.spdBtc.connect(user1).requestWithdrawal(50),
      ).to.be.revertedWithCustomError(contracts.spdBtc, 'EnforcedPause');
    });

    it('Cannot cancel request on pause', async function () {
      const mintAmount = ethers.parseUnits('1000', 18);
      await contracts.tokenMinter.mint(user1.address, mintAmount);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);
      await contracts.spdBtc.connect(user1).requestWithdrawal(50);
      await contracts.spdBtc.setContractPaused(true);

      await expect(
        contracts.spdBtc.connect(user1).cancelWithdrawal(),
      ).to.be.revertedWithCustomError(contracts.spdBtc, 'EnforcedPause');
    });

    it('Cannot process request when paused', async function () {
      await contracts.tokenMinter.mint(user1.address, 500);
      await contracts.tokenMinter.mint(owner.address, 1000);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.tokenMinter.allow(
        owner.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);
      await contracts.spdBtc.connect(user1).requestWithdrawal(200);
      await contracts.spdBtc.setContractPaused(true);

      await expect(
        contracts.spdBtc.processWithdrawal(user1.address, 200),
      ).to.be.revertedWithCustomError(contracts.spdBtc, 'EnforcedPause');
    });

    it('Cannot process request to blacklisted user', async function () {
      await contracts.tokenMinter.mint(user1.address, 500);
      await contracts.tokenMinter.mint(owner.address, 1000);
      await contracts.tokenMinter.allow(
        user1.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.tokenMinter.allow(
        owner.address,
        await contracts.spdBtc.getAddress(),
      );
      await contracts.spdBtc.connect(user1).deposit(300, user1.address);
      await contracts.spdBtc.connect(user1).requestWithdrawal(200);
      await contracts.spdBtc.setBlacklisted(user1.address, true);

      await expect(
        contracts.spdBtc.processWithdrawal(user1.address, 200),
      ).to.be.revertedWithCustomError(contracts.spdBtc, 'ReceiverBlacklisted');
    });
  });
});
