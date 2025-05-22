# spdBTC

A vault contract, accepts WBTC as a deposit, mints back spdBTC at 1-1 ratio.

## Deploying

Before deployment takes place, make sure you have created an `.env` file in the `deployments/` directory.
There is an `.env.example` file to help you get started.

### Step 0. Deploy TokenMinter

TokenMinter is a mock contract which allows anyone to print infinite tokens, it is useful if you don't want to work
with real tokens just yet. Deploy it simply with `npm run deploy:tokenminter:NETWORK`, where `NETWORK` is
either `sepolia`or `ethereum`.

### Step 1. Deploy spdBTC implementation

Since the contract will always be behind proxy, the implementation itself requires zero configuration.
Just run `npm run deploy:spdbtc:NETWORK`, where `NETWORK` is either `sepolia`or `ethereum`.

### Step 2. Deploy OssifiableProxy

A call to proxy will call spdBTC construction, so this is the step where configuration happens.
You will have to prepare the following environment variables:
- `OWNER` - account which will own the proxy. Will be set to deployer wallet if omitted;
- `CUSTODIAN` - account which will hold all deposited tokens;
- `MAX_DEPOSIT` - a limit on total supply of deposited tokens, for example, if you want to limit it to 0.5WBTC, and WBTC has 6 decimals, set this variable to `'500000'`;
- `ASSET` - either the address of WBTC or TokenMinter obtained at step 0;
- `SYMBOL` - e.g. `testspdBTC`;
- `NAME` - e.g. `testspdBTC`;
- `SPDBTC_IMPLEMENTATION` - address obtained at step 1.

After exporting all required variables, run `npm run deploy:ossifiableproxy:NETWORK`, where
`NETWORK` is either `sepolia`or `ethereum`.

## Gotchas

After deployment, contract will store the caller's address as the owner. If that's not desired,
execute `transferOwnership(address)` and set a new owner.
