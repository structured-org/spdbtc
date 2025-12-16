import { defineConfig, configVariable } from 'hardhat/config';
import hardhatToolboxMochaEthers from '@nomicfoundation/hardhat-toolbox-mocha-ethers';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatTypechain from '@nomicfoundation/hardhat-typechain';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';
import hardhatEthersChaiMatchers from '@nomicfoundation/hardhat-ethers-chai-matchers';
import hardhatNetworkHelpers from '@nomicfoundation/hardhat-network-helpers';
import hardhatVerify from '@nomicfoundation/hardhat-verify';
import 'dotenv/config'

export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatTypechain,
    hardhatMocha,
    hardhatEthersChaiMatchers,
    hardhatNetworkHelpers,
    hardhatToolboxMochaEthers,
    hardhatVerify,
  ],
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000000,
      },
    },
  },
  networks: {
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('SEPOLIA_API_URL'),
      accounts: [configVariable('SEPOLIA_PRIVATE_KEY')],
    },
    ethereum: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('ETHEREUM_API_URL'),
      accounts: [configVariable('ETHEREUM_PRIVATE_KEY')],
    },
  },
  verify: {
    etherscan: {
      apiKey: configVariable('ETHERSCAN_API_KEY'),
    },
  },
});
