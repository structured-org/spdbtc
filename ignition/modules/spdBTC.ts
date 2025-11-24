import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('spdBTC', (m) => {
  const impl = m.getParameter("spdbtc_implementation");
  const owner = m.getParameter("owner");
  // defaults to WBTC on Ethereum
  const asset = m.getParameter("asset", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599");
  const name = m.getParameter("name", "spdBTC");
  const symbol = m.getParameter("symbol", "spdBTC");
  const maxDeposit = m.getParameter("max_deposit", String(Math.pow(2, 52)));
  const custodian = m.getParameter("custodian");

  // XXX: The next line deploys a contract. I have no idea how to avoid that.
  //      I need to use this contract's ABI in this script though.
  const spdBTC = m.contract("SpdBTC");
  const initializeProductData = m.encodeFunctionCall(spdBTC, "initializeProduct",
    [
      {
        asset,
        name,
        symbol,
        maxDeposit,
        custodian,
      }
    ],
  );

  const proxy = m.contract('OssifiableProxy', [impl, owner, initializeProductData]);

  return { proxy };
});
