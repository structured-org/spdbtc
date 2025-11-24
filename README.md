# spdBTC

A vault contract, accepts WBTC as a deposit, mints back spdBTC at 1-1 ratio.

## Deploying

Before deploying anything, copy `.env.example` to `.env` and fill it.

### Step 1. Deploy spdBTC implementation

Since the contract will always be behind proxy, the implementation itself requires zero configuration.
Just run `npx hardhat ignition deploy ignition/modules/spdBTCImplementation.ts --network ethereum --verify`.
Thenn, save resulting address for step 2.

### Step 2. Deploy OssifiableProxy

A call to proxy will call spdBTC construction, so this is the step where configuration happens.
Open `ignition/parameters.json` and fill it:
- `owner` - account which will own the proxy;
- `custodian` - account which will hold all deposited tokens;
- `spdbtc_implementation` - address obtained at step 1;
- `name` - e.g. `testspdBTC`;
- `symbol` - e.g. `testspdBTC`;
- `max_deposit` - a limit on total supply of deposited tokens, for example, if you want to limit it to 0.5WBTC, and WBTC has 6 decimals, set this variable to `'500000'`. If you don't set it, deposits will be unlimited;
- `asset` - address of WBTC.

Then, run `npx hardhat ignition deploy ignition/modules/spdBTC.ts --parameters ignition/parameters.json --network ethereum --verify`.

## Gotchas

After deployment, contract will store the caller's address as the owner. If that's not desired,
execute `transferOwnership(address)` and set a new owner.
