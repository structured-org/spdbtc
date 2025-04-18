// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ReentrancyGuardUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import { ERC20Upgradeable } from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import { OwnableUpgradeable } from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";

import { StorageSlot } from "@openzeppelin/contracts/utils/StorageSlot.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ProductParams, BlacklistStorage } from "./interfaces/IspdBTC.sol";

/**
 * @title spdBTC
 * @dev A contract that accepts WBTC as a deposit and mints spdBTC at a 1:1 ratio.
 */
contract SpdBTC is
    ReentrancyGuardUpgradeable,
    ERC20Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    /**
     * @notice The underlying asset token contract (WBTC)
     * @dev bytes32(uint256(keccak256('spdbtc.asset')) - 1)
     */
    bytes32 internal constant _ASSET_SLOT = 0x5b176b224b19eac6047254b0ea3ab8942dfb79fc40feedc1f9a8173bbe4681fc;

    /**
     * @notice The number of decimals for this spdBTC token, mirroring the asset
     * @dev bytes32(uint256(keccak256('spdbtc.decimals')) - 1)
     */
    bytes32 internal constant _DECIMALS_SLOT = 0xb444bce2c2faee73cff3f3860f1e7aefa070df3bb7e677ea6c614d5fa351bcbd;

    /**
     * @dev bytes32(uint256(keccak256('spdbtc.max_deposit')) - 1)
     */
    bytes32 internal constant _MAX_DEPOSIT_SLOT = 0xefc9345aaccbddedbd416aca83be652dad079fbeb16a8b2bae7a6e1558da4b9c;

    /**
     * @dev bytes32(uint256(keccak256('spdbtc.custodian_address')) - 1)
     */
    bytes32 internal constant _CUSTODIAN_SLOT = 0xcf823567157e2d6a4051cedd374293e4fa81d2713ea60aa14bad53a5a43183f5;

    /**
     * @notice Blacklist functionality like in Tether
     * @dev bytes32(uint256(keccak256('spdbtc.blacklist')) - 1)
     */
    bytes32 internal constant _BLACKLIST_SLOT = 0x1b78fe6e90a13fd3613f6765435a41cc68067e7d36c75ef0614e997d5fdd5a52;

    /**
     * @dev Gets a pointer to the BlacklistStorage struct in storage.
     * @return $ A storage pointer to the BlacklistStorage struct.
     */
    function _getBlacklistStorage() internal pure returns (BlacklistStorage storage $) {
        assembly {
            $.slot := _BLACKLIST_SLOT
        }
    }

    /// @notice Custom error when the receiver of a deposit or transfer is blacklisted.
    error ReceiverBlacklisted(address receiver);
    /// @notice Custom error when the sender of a transaction (deposit, transfer) is blacklisted.
    error SenderBlacklisted(address sender);
    /// @notice Custom error when attempting to blacklist the zero address.
    error ZeroAddressNotAllowed();
    /// @notice Custom error when spender does not have enough allowance.
    error InsufficientAllowance(address owner, address spender, uint256 allowance, uint256 amountNeeded);
    /// @notice Custom error when attempting to seize funds from a non-blacklisted user.
    error FundsSeizedFromNonBlacklistedUser(address user);
    /// @notice Custom error when deposit exceeds the maximum limit.
    error ExceededMaxDeposit(address receiver, uint256 amount, uint256 maxAmount);

    /**
     * @notice Emitted when the custodian address is updated.
     * @param newCustodian The new custodian address.
     */
    event CustodianSet(address indexed newCustodian);

    /**
     * @notice Emitted when an address is blacklisted or unblacklisted.
     * @param user The affected address.
     * @param blacklisted Whether the address is blacklisted.
     */
    event Blacklisted(address indexed user, bool blacklisted);

    /**
     * @notice Emitted when funds are seized from a blacklisted address.
     * @param user The address whose funds were seized.
     * @param amount The amount of tokens seized.
     */
    event FundsSeized(address indexed user, uint256 amount);

    /**
     * @notice Emitted on a successful deposit.
     * @param caller The address initiating the deposit.
     * @param receiver The address receiving the spdBTC tokens.
     * @param assetAmount The amount of the underlying asset deposited.
     * @param sharesMinted The amount of spdBTC tokens minted.
     */
    event Deposit(
        address indexed caller,
        address indexed receiver,
        uint256 assetAmount,
        uint256 sharesMinted
    );

    /**
     * @notice Emitted when max deposit is updated.
     * @param newMaxDeposit New max deposit.
     */
    event MaxDepositSet(uint256 newMaxDeposit);

    ////////// MODIFIERS ////////

    /**
     * @dev Modifier to ensure the sender is not blacklisted.
     */
    modifier notBlacklisted() {
        if (_getBlacklistStorage().value[msg.sender]) {
            revert SenderBlacklisted(msg.sender);
        }
        _;
    }

    ////////// INITIALIZATION FUNCTIONS ////////

    /**
     * @notice Initializes the product.
     * @dev Can only be called by the owner and only once.
     * @param params Struct containing initialization parameters.
     */
    function initializeProduct(ProductParams memory params) external initializer {
        if (params.asset == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (params.custodian == address(0)) {
            revert ZeroAddressNotAllowed();
        }

        __ReentrancyGuard_init();
        __Ownable_init(msg.sender);
        __ERC20_init(params.name, params.symbol);
        __Pausable_init();

        try IERC20Metadata(params.asset).decimals() returns (uint8 assetDecimals) {
            StorageSlot.getUint256Slot(_DECIMALS_SLOT).value = uint256(assetDecimals);
        } catch {
            // Revert if the asset contract doesn't expose decimals().
            revert("Asset contract has no decimals()");
        }

        StorageSlot.getAddressSlot(_ASSET_SLOT).value = params.asset;
        StorageSlot.getUint256Slot(_MAX_DEPOSIT_SLOT).value = params.maxDeposit;
        StorageSlot.getAddressSlot(_CUSTODIAN_SLOT).value = params.custodian;
    }

    ////////// READ FUNCTIONS ////////

    /**
     * @notice Returns the address of the underlying asset token contract (WBTC).
     * @return Underlying asset token contract (WBTC).
     */
    function asset() external view returns (address) {
        return StorageSlot.getAddressSlot(_ASSET_SLOT).value;
    }

    /**
     * @notice Returns blacklist status for specified user.
     * @param who User address to query blacklist status for.
     * @return Is user blacklisted.
     */
    function isBlacklisted(address who) external view returns (bool) {
        return _getBlacklistStorage().value[who];
    }

    /**
     * @notice Returns maximum deposit amount.
     * @return Maximum deposit amount.
     */
    function maxDeposit() external view returns (uint256) {
        return StorageSlot.getUint256Slot(_MAX_DEPOSIT_SLOT).value;
    }

    /**
     * @notice Returns the custodian address.
     * @return Custodian address.
     */
    function custodianAccount() public view returns (address) {
        return StorageSlot.getAddressSlot(_CUSTODIAN_SLOT).value;
    }

    /**
     * @notice Returns the number of decimals used by this token.
     * @dev Overrides ERC20's default decimals() to match the underlying asset.
     * @return The number of decimals.
     */
    function decimals() public view virtual override returns (uint8) {
        return uint8(StorageSlot.getUint256Slot(_DECIMALS_SLOT).value);
    }

    ////////// DEPOSIT FUNCTIONS ////////

    /**
     * @notice Deposits WBTC into the vault in exchange for spdBTC tokens.
     * @param amount The amount of WBTC to deposit.
     * @param receiver The address to receive the minted spdBTC.
     * @return The amount of spdBTC minted.
     */
    function deposit(
        uint256 amount,
        address receiver
    )
        public
        nonReentrant
        whenNotPaused
        notBlacklisted
        returns (uint256)
    {
        _isValidDeposit(amount, receiver);
        _deposit(_msgSender(), receiver, amount);
        return amount;
    }

    ////////// TOKEN FUNCTIONS ////////

    function transfer(address to, uint256 value)
        public
        override
        nonReentrant
        whenNotPaused
        notBlacklisted
        returns (bool)
    {
        if (_getBlacklistStorage().value[to]) {
            revert ReceiverBlacklisted(to);
        }
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value)
        public
        override
        nonReentrant
        whenNotPaused
        notBlacklisted
        returns (bool)
    {
        if (_getBlacklistStorage().value[from]) {
            revert SenderBlacklisted(from);
        }
        if (_getBlacklistStorage().value[to]) {
            revert ReceiverBlacklisted(to);
        }
        return super.transferFrom(from, to, value);
    }

    ////////// ADMIN FUNCTIONS ////////

    /**
     * @notice Sets the paused state of the contract.
     * @dev Can only be called by the owner.
     * @param _paused Boolean indicating the new paused state.
     */
    function setContractPaused(bool _paused) external onlyOwner {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    /**
     * @notice Sets the max deposit limit of the contract.
     * @dev Can only be called by the owner.
     * @param _maxDeposit New max deposit.
     */
    function setMaxDeposit(uint256 _maxDeposit) external onlyOwner {
        StorageSlot.getUint256Slot(_MAX_DEPOSIT_SLOT).value = _maxDeposit;
        emit MaxDepositSet(_maxDeposit);
    }

    /**
     * @notice Updates the custodian address.
     * @dev Can only be called by the owner.
     * @param newCustodian The address of the new custodian.
     */
    function setCustodian(address newCustodian) external onlyOwner {
        if (newCustodian == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        StorageSlot.getAddressSlot(_CUSTODIAN_SLOT).value = newCustodian;
        emit CustodianSet(newCustodian);
    }

    /**
     * @notice Blacklists or unblacklists an address.
     * @dev Can only be called by the owner.
     * @param user The address to blacklist or unblacklist.
     * @param _isBlacklisted Whether to blacklist or unblacklist the address.
     */
    function setBlacklisted(
        address user,
        bool _isBlacklisted
    ) external onlyOwner {
        if (user == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        _getBlacklistStorage().value[user] = _isBlacklisted;
        emit Blacklisted(user, _isBlacklisted);
    }

    /**
     * @notice Seizes tokens from a blacklisted address and sends them to the custodian.
     * @dev Can only be called by the owner. The user must be blacklisted.
     * @param user The blacklisted address whose funds will be seized.
     */
    function seizeFunds(address user) external onlyOwner nonReentrant {
        if (!_getBlacklistStorage().value[user]) {
            revert FundsSeizedFromNonBlacklistedUser(user);
        }

        uint256 seizedAmount = balanceOf(user);
        if (seizedAmount > 0) {
            address custodian = custodianAccount();
            _transfer(user, custodian, seizedAmount);
            emit FundsSeized(user, seizedAmount);
        }
    }

    ////////// INTERNAL FUNCTIONS ////////

    /**
     * @notice Validates deposit parameters and contract state for deposits
     * @dev Checks minimum deposit, maximum deposit, and blacklist status
     * @param amount The amount of assets to deposit
     * @param receiver The address to receive the minted spdBTC
     */
    function _isValidDeposit(uint256 amount, address receiver) internal view {
        if (_getBlacklistStorage().value[receiver]) {
            revert ReceiverBlacklisted(receiver);
        }

        uint256 maxAssets = StorageSlot.getUint256Slot(_MAX_DEPOSIT_SLOT).value;
        if (totalSupply() + amount > maxAssets) {
            revert ExceededMaxDeposit(receiver, amount, maxAssets);
        }
    }

    /**
     * @notice Executes the common deposit/mint workflow.
     * @dev Verifies allowance, transfers assets to the custodian, mints spdBTC tokens, updates total deposits, and emits a Deposit event.
     * @param caller The address initiating the deposit.
     * @param receiver The address to receive the minted spdBTC tokens.
     * @param amount The amount of WBTC to deposit.
     */
    function _deposit(
        address caller,
        address receiver,
        uint256 amount
    ) internal {
        IERC20 _asset = IERC20(StorageSlot.getAddressSlot(_ASSET_SLOT).value);

        uint256 allowance = _asset.allowance(caller, address(this));
        if (allowance < amount) {
            revert InsufficientAllowance(caller, address(this), allowance, amount);
        }
        _asset.safeTransferFrom(caller, StorageSlot.getAddressSlot(_CUSTODIAN_SLOT).value, amount);

        _mint(receiver, amount);
        emit Deposit(caller, receiver, amount, amount);
    }
}
