import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

export default buildModule('spdBTCImplementation', (m) => {
  const spd = m.contract('SpdBTC', []);
  return { spd };
});
