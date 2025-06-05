import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

require('dotenv').config({ path: __dirname + '/deployments/.env' });
const {
  SEPOLIA_API_URL,
  SEPOLIA_PRIVATE_KEY,
  ETHERSCAN_API_KEY,
  ETHEREUM_API_URL,
  ETHEREUM_PRIVATE_KEY,
} = process.env;

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000000,
      },
    },
  },
  defaultNetwork: 'sepolia',
  networks: {
    sepolia: {
      url: SEPOLIA_API_URL,
      accounts: [`0x${SEPOLIA_PRIVATE_KEY}`],
    },
    ethereum: {
      url: ETHEREUM_API_URL,
      accounts: [`0x${ETHEREUM_PRIVATE_KEY}`],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
