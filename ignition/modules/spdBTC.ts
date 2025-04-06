// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const spdBTCModule = buildModule("spdBTCMpodule", (m) => {
    const asset = m.getParameter("asset");
    const name = m.getParameter("name", "spdBTC");
    const symbol = m.getParameter("symbol", "spdBTC");

    const spd = m.contract("spdBTC", [asset, name, symbol]);
    return { spd };
});

export default spdBTCModule;
