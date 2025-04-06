.PHONY: build test lint

build:
	@npx hardhat compile

test: build
	@npx hardhat test

lint:
	@npx solhint contracts/spdBTC.sol
