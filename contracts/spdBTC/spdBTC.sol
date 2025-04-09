// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ProductParams } from "./interfaces/IspdBTC.sol";

/**
 * @title spdBTC
 * @dev A contract that accepts WBTC as a deposit and mints spdBTC at a 1:1 ratio.
 */
contract spdBTC is ERC20, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    /// @notice The underlying asset token contract (WBTC)
    IERC20 public immutable asset;

    /// @notice The number of decimals for this spdBTC token, mirroring the asset.
    uint8 private _decimals;

    /// @notice Minimum deposit amount
    uint public minDeposit;

    /// @notice Maximum deposit amount per address (can be set during initialization)
    uint public maxDeposit;

    /// @notice Contract initialization timestamp
    uint public initializationTime;

    /// @notice Custodian address
    address private _custodian;

    /// @notice Whether the product is paused
    bool public paused;

    // Blacklist functionality as Tether
    mapping(address => bool) public blacklisted;

    /// @notice Custom error when deposit exceeds the maximum limit.
    error ExceededMaxDeposit(address receiver, uint amount, uint maxAmount);

    /**
     * @notice Emitted when the product is initialized.
     */
    event ProductInitialized();

    /**
     * @notice Emitted when the custodian address is updated.
     * @param newCustodian The new custodian address.
     */
    event CustodianSet(address indexed newCustodian);

    /**
     * @notice Emitted when the contract's pause state is updated.
     * @param paused The new pause state.
     */
    event ContractPaused(bool paused);

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
        uint assetAmount,
        uint sharesMinted
    );

    ////////// MODIFIERS ////////

    /**
     * @dev Modifier to ensure the contract is not paused.
     */
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    /**
     * @dev Modifier to ensure the sender is not blacklisted.
     */
    modifier notBlacklisted() {
        require(!blacklisted[msg.sender], "Address is blacklisted");
        _;
    }

    /**
     * @dev Modifier to ensure the contract is initialized.
     */
    modifier whenInitialized() {
        require(initializationTime > 0, "Contract not initialized");
        _;
    }

    ////////// CONSTRUCTOR ////////

    /**
     * @notice Constructor to initialize the spdBTC contract.
     * @param asset_ Address of the WBTC ERC20 contract.
     * @param name_ The name of the ERC20 token representing spdBTC.
     * @param symbol_ The symbol of the ERC20 token representing spdBTC.
     */
    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_
    )
        ERC20(name_, symbol_)
        Ownable(msg.sender)
    {
        require(address(asset_) != address(0), "Asset address cannot be zero");
        asset = asset_;

        try IERC20Metadata(address(asset_)).decimals() returns (uint8 assetDecimals) {
            _decimals = assetDecimals;
        } catch {
            // Revert if the asset contract doesn't expose decimals().
            revert("Asset contract does not support decimals()");
        }
    }

    ////////// INITIALIZATION FUNCTIONS ////////

    /**
     * @notice Initializes the product.
     * @dev Can only be called by the owner and only once.
     * @param params Struct containing initialization parameters.
     */
    function initializeProduct(ProductParams memory params) external onlyOwner {
        require(initializationTime == 0, "Product already initialized");
        require(params.custodian != address(0), "Custodian address cannot be zero");

        minDeposit = params.minDeposit;
        maxDeposit = params.maxDeposit;
        _custodian = params.custodian;
        initializationTime = block.timestamp;
        paused = false;

        emit ProductInitialized();
    }

    ////////// READ FUNCTIONS ////////

    /**
     * @notice Returns the custodian address.
     * @return Custodian address.
     */
    function custodianAccount() external view whenInitialized returns (address) {
        return _custodian;
    }

    /**
     * @notice Returns the number of decimals used by this token.
     * @dev Overrides ERC20's default decimals() to match the underlying asset.
     * @return The number of decimals.
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    ////////// DEPOSIT FUNCTIONS ////////

    /**
     * @notice Deposits WBTC into the vault in exchange for spdBTC tokens.
     * @param amount The amount of WBTC to deposit.
     * @param receiver The address to receive the minted spdBTC.
     * @return The amount of spdBTC minted.
     */
    function deposit(
        uint amount,
        address receiver
    )
        public
        nonReentrant
        whenNotPaused
        notBlacklisted
        whenInitialized
        returns (uint)
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
        paused = _paused;
        emit ContractPaused(_paused);
    }

    /**
     * @notice Updates the custodian address.
     * @dev Can only be called by the owner.
     * @param newCustodian The address of the new custodian.
     */
    function setCustodian(address newCustodian) external onlyOwner {
        require(newCustodian != address(0), "Zero address not allowed");
        _custodian = newCustodian;
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
        blacklisted[user] = isBlacklisted;
        emit Blacklisted(user, isBlacklisted);
    }

    ////////// INTERNAL FUNCTIONS ////////

    /**
     * @notice Validates deposit parameters and contract state for deposits
     * @dev Checks minimum deposit, maximum deposit, and blacklist status
     * @param amount The amount of assets to deposit
     * @param receiver The address to receive the minted spdBTC
     */
    function _isValidDeposit(uint amount, address receiver) internal view {
        require(amount >= minDeposit, "Deposit amount below minimum");
        require(!blacklisted[_msgSender()], "Sender is blacklisted");
        require(!blacklisted[receiver], "Receiver is blacklisted");

        uint maxAssets = maxDeposit;
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
        uint amount
    ) internal {
        // Use the stored asset state variable
        uint allowance = asset.allowance(caller, address(this));
        require(allowance >= amount, "Insufficient allowance");
        // Transfer tokens from sender to custodian
        asset.safeTransferFrom(caller, _custodian, amount);

        // Mint share tokens to receiver
        _mint(receiver, amount);
        emit Deposit(caller, receiver, amount, amount);
    }
}