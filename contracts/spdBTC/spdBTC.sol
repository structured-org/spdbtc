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
import { ProductParams } from "./interfaces/IspdBTC.sol";

/**
 * @title spdBTC
 * @dev A contract that accepts WBTC as a deposit and mints spdBTC at a 1:1 ratio.
 */
contract spdBTC is ReentrancyGuardUpgradeable, ERC20Upgradeable, OwnableUpgradeable, PausableUpgradeable {
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
     * @dev bytes32(uint256(keccak256('spdbtc.min_deposit')) - 1)
     */
    bytes32 internal constant _MIN_DEPOSIT_SLOT = 0xbce62e68157802c8ed24d035b5c787ad5ebab2025c1271106a3de18b0576f850;

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
    struct BlacklistStorage {
        mapping(address => bool) value;    
    }
    function _getBlacklistStorage() internal pure returns (BlacklistStorage storage $) {
        assembly {
            $.slot := _BLACKLIST_SLOT
        }
    }

    // TODO: it is probably possible to send ERC20 tokens to blacklisted users
    // TODO: it is probably possible to send ERC20 tokens even when contract is paused

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

    ////////// MODIFIERS ////////

    /**
     * @dev Modifier to ensure the sender is not blacklisted.
     */
    modifier notBlacklisted() {
        require(!_getBlacklistStorage().value[msg.sender], "Address is blacklisted");
        _;
    }

    ////////// INITIALIZATION FUNCTIONS ////////

    /**
     * @notice Initializes the product.
     * @dev Can only be called by the owner and only once.
     * @param params Struct containing initialization parameters.
     */
    function initializeProduct(ProductParams memory params) initializer external {
        require(params.asset != address(0), "Asset address cannot be zero");
        require(params.custodian != address(0), "Custodian address cannot be zero");

        __ReentrancyGuard_init();
        __Ownable_init(msg.sender); // TODO: is it actually safe to pass msg.sender here?
        __ERC20_init(params.name, params.symbol);
        __Pausable_init();

        try IERC20Metadata(params.asset).decimals() returns (uint8 assetDecimals) {
            StorageSlot.getUint256Slot(_DECIMALS_SLOT).value = uint256(assetDecimals);
        } catch {
            // Revert if the asset contract doesn't expose decimals().
            revert("Asset contract does not support decimals()");
        }

        StorageSlot.getAddressSlot(_ASSET_SLOT).value = params.asset;
        StorageSlot.getUint256Slot(_MIN_DEPOSIT_SLOT).value = params.minDeposit;
        StorageSlot.getUint256Slot(_MAX_DEPOSIT_SLOT).value = params.maxDeposit;
        StorageSlot.getAddressSlot(_CUSTODIAN_SLOT).value = params.custodian;
    }

    ////////// READ FUNCTIONS ////////

    // TODO: asset, pause, blacklist getters

    /**
     * @notice Returns minimum deposit amount.
     * @return Minimum deposit amount.
     */
    function minDeposit() external view returns (uint256) {
        return StorageSlot.getUint256Slot(_MIN_DEPOSIT_SLOT).value;
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
    function custodianAccount() external view returns (address) {
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
     * @notice Updates the custodian address.
     * @dev Can only be called by the owner.
     * @param newCustodian The address of the new custodian.
     */
    function setCustodian(address newCustodian) external onlyOwner {
        require(newCustodian != address(0), "Zero address not allowed");
        StorageSlot.getAddressSlot(_CUSTODIAN_SLOT).value = newCustodian;
        emit CustodianSet(newCustodian);
    }

    /**
     * @notice Blacklists or unblacklists an address.
     * @dev Can only be called by the owner.
     * @param user The address to blacklist or unblacklist.
     * @param isBlacklisted Whether to blacklist or unblacklist the address.
     */
    function setBlacklisted(
        address user,
        bool isBlacklisted
    ) external onlyOwner {
        require(user != address(0), "Zero address not allowed");
        _getBlacklistStorage().value[user] = isBlacklisted;
        emit Blacklisted(user, isBlacklisted);
    }

    ////////// INTERNAL FUNCTIONS ////////

    /**
     * @notice Validates deposit parameters and contract state for deposits
     * @dev Checks minimum deposit, maximum deposit, and blacklist status
     * @param amount The amount of assets to deposit
     * @param receiver The address to receive the minted spdBTC
     */
    function _isValidDeposit(uint256 amount, address receiver) internal view {
        require(amount >= StorageSlot.getUint256Slot(_MIN_DEPOSIT_SLOT).value, "Deposit amount below minimum");
        require(!_getBlacklistStorage().value[_msgSender()], "Sender is blacklisted");
        require(!_getBlacklistStorage().value[receiver], "Receiver is blacklisted");

        uint256 maxAssets = StorageSlot.getUint256Slot(_MAX_DEPOSIT_SLOT).value;
        if (amount > maxAssets) {
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
        IERC20 asset = IERC20(StorageSlot.getAddressSlot(_ASSET_SLOT).value);

        uint256 allowance = asset.allowance(caller, address(this));
        require(allowance >= amount, "Insufficient allowance");
        // Transfer tokens from sender to custodian
        asset.safeTransferFrom(caller, StorageSlot.getAddressSlot(_CUSTODIAN_SLOT).value, amount);

        // Mint share tokens to receiver
        _mint(receiver, amount);
        emit Deposit(caller, receiver, amount, amount);
    }
}
