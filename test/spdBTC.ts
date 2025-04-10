import { ethers } from 'hardhat';
import { expect } from 'chai';
import { FunctionFragment } from 'ethers';

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
});
