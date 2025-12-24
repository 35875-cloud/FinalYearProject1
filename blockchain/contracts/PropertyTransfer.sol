// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IPropertyRegistry {
    function getProperty(string memory _propertyId) external view returns (
        string memory propertyId,
        string memory ownerId,
        string memory ownerName,
        string memory ownerCnic,
        bool isApproved,
        bool isFrozen
    );
}

contract PropertyTransfer is AccessControl {
    bytes32 public constant LRO_ROLE = keccak256("LRO_ROLE");
    bytes32 public constant TEHSILDAR_ROLE = keccak256("TEHSILDAR_ROLE");
    
    IPropertyRegistry public propertyRegistry;
    
    struct Transfer {
        string transferId;
        string propertyId;
        string sellerId;
        string sellerCnic;
        string buyerId;
        string buyerCnic;
        string buyerName;
        string buyerFatherName;
        uint256 transferAmount;
        uint256 propertyTaxBuyer;
        uint256 propertyTaxSeller;
        uint256 totalAmount;
        string paymentChallanHash;
        uint256 initiatedDate;
        uint256 expiryDate;
        address approvedBy;
        bool isPaymentVerified;
        bool isApproved;
        bool isCompleted;
        TransferStatus status;
    }
    
    enum TransferStatus {
        PAYMENT_PENDING,
        PAYMENT_UPLOADED,
        PAYMENT_VERIFIED,
        APPROVED,
        COMPLETED,
        REJECTED,
        EXPIRED,
        CANCELLED
    }
    
    // Mappings
    mapping(string => Transfer) public transfers;
    mapping(string => bool) public transferExists;
    mapping(string => string[]) public propertyTransferHistory;
    
    // Tax rate (5% = 500 basis points)
    uint256 public constant TAX_RATE = 500; // 5%
    uint256 public constant BASIS_POINTS = 10000; // 100%
    
    // Events
    event TransferInitiated(
        string indexed transferId,
        string indexed propertyId,
        string sellerId,
        string buyerId,
        uint256 amount,
        uint256 timestamp
    );
    
    event PaymentUploaded(
        string indexed transferId,
        string challanHash,
        uint256 timestamp
    );
    
    event PaymentVerified(
        string indexed transferId,
        address indexed verifiedBy,
        uint256 timestamp
    );
    
    event TransferApproved(
        string indexed transferId,
        address indexed approvedBy,
        uint256 timestamp
    );
    
    event TransferCompleted(
        string indexed transferId,
        string indexed propertyId,
        string oldOwner,
        string newOwner,
        uint256 timestamp
    );
    
    event TransferRejected(
        string indexed transferId,
        address indexed rejectedBy,
        string reason,
        uint256 timestamp
    );
    
    constructor(address _propertyRegistryAddress) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        propertyRegistry = IPropertyRegistry(_propertyRegistryAddress);
    }
    
    /**
     * @dev Calculate tax amounts
     */
    function calculateTax(uint256 _amount) 
        public 
        pure 
        returns (uint256 buyerTax, uint256 sellerTax, uint256 total) 
    {
        buyerTax = (_amount * TAX_RATE) / BASIS_POINTS;
        sellerTax = (_amount * TAX_RATE) / BASIS_POINTS;
        total = _amount + buyerTax + sellerTax;
        return (buyerTax, sellerTax, total);
    }
    
    /**
     * @dev Initiate property transfer (Seller)
     */
    function initiateTransfer(
        string memory _transferId,
        string memory _propertyId,
        string memory _sellerId,
        string memory _sellerCnic,
        string memory _buyerId,
        string memory _buyerCnic,
        string memory _buyerName,
        string memory _buyerFatherName,
        uint256 _transferAmount,
        uint256 _durationDays
    ) public returns (bool) {
        require(!transferExists[_transferId], "Transfer ID already exists");
        require(_transferAmount > 0, "Amount must be greater than 0");
        
        // Calculate taxes
        (uint256 buyerTax, uint256 sellerTax, uint256 total) = calculateTax(_transferAmount);
        
        Transfer memory newTransfer = Transfer({
            transferId: _transferId,
            propertyId: _propertyId,
            sellerId: _sellerId,
            sellerCnic: _sellerCnic,
            buyerId: _buyerId,
            buyerCnic: _buyerCnic,
            buyerName: _buyerName,
            buyerFatherName: _buyerFatherName,
            transferAmount: _transferAmount,
            propertyTaxBuyer: buyerTax,
            propertyTaxSeller: sellerTax,
            totalAmount: total,
            paymentChallanHash: "",
            initiatedDate: block.timestamp,
            expiryDate: block.timestamp + (_durationDays * 1 days),
            approvedBy: address(0),
            isPaymentVerified: false,
            isApproved: false,
            isCompleted: false,
            status: TransferStatus.PAYMENT_PENDING
        });
        
        transfers[_transferId] = newTransfer;
        transferExists[_transferId] = true;
        propertyTransferHistory[_propertyId].push(_transferId);
        
        emit TransferInitiated(
            _transferId, 
            _propertyId, 
            _sellerId, 
            _buyerId, 
            _transferAmount, 
            block.timestamp
        );
        
        return true;
    }
    
    /**
     * @dev Upload payment challan (Buyer)
     */
    function uploadPaymentChallan(
        string memory _transferId,
        string memory _challanHash
    ) public returns (bool) {
        require(transferExists[_transferId], "Transfer does not exist");
        require(bytes(_challanHash).length > 0, "Challan hash required");
        require(
            transfers[_transferId].status == TransferStatus.PAYMENT_PENDING,
            "Invalid status for payment upload"
        );
        
        transfers[_transferId].paymentChallanHash = _challanHash;
        transfers[_transferId].status = TransferStatus.PAYMENT_UPLOADED;
        
        emit PaymentUploaded(_transferId, _challanHash, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Verify payment (LRO)
     */
    function verifyPayment(string memory _transferId) 
        public 
        onlyRole(LRO_ROLE) 
        returns (bool) 
    {
        require(transferExists[_transferId], "Transfer does not exist");
        require(
            transfers[_transferId].status == TransferStatus.PAYMENT_UPLOADED,
            "Payment not uploaded"
        );
        
        transfers[_transferId].isPaymentVerified = true;
        transfers[_transferId].status = TransferStatus.PAYMENT_VERIFIED;
        
        emit PaymentVerified(_transferId, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Approve transfer (Tehsildar)
     */
    function approveTransfer(string memory _transferId) 
        public 
        onlyRole(LRO_ROLE) 
        returns (bool) 
    {
        require(transferExists[_transferId], "Transfer does not exist");
        require(transfers[_transferId].isPaymentVerified, "Payment not verified");
        require(
            transfers[_transferId].status == TransferStatus.PAYMENT_VERIFIED,
            "Invalid status"
        );
        
        transfers[_transferId].isApproved = true;
        transfers[_transferId].approvedBy = msg.sender;
        transfers[_transferId].status = TransferStatus.APPROVED;
        
        emit TransferApproved(_transferId, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Complete transfer and change ownership (Tehsildar)
     */
    function completeTransfer(string memory _transferId) 
        public 
        onlyRole(TEHSILDAR_ROLE) 
        returns (bool) 
    {
        require(transferExists[_transferId], "Transfer does not exist");
        require(transfers[_transferId].isApproved, "Transfer not approved");
        require(
            transfers[_transferId].status == TransferStatus.APPROVED,
            "Invalid status"
        );
        
        transfers[_transferId].isCompleted = true;
        transfers[_transferId].status = TransferStatus.COMPLETED;
        
        emit TransferCompleted(
            _transferId,
            transfers[_transferId].propertyId,
            transfers[_transferId].sellerId,
            transfers[_transferId].buyerId,
            block.timestamp
        );
        
        return true;
    }
    
    /**
     * @dev Reject transfer (LRO/Tehsildar)
     */
    function rejectTransfer(string memory _transferId, string memory _reason) 
        public 
        returns (bool) 
    {
        require(transferExists[_transferId], "Transfer does not exist");
        require(
            hasRole(LRO_ROLE, msg.sender) || hasRole(TEHSILDAR_ROLE, msg.sender),
            "Not authorized"
        );
        
        transfers[_transferId].status = TransferStatus.REJECTED;
        
        emit TransferRejected(_transferId, msg.sender, _reason, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Get transfer details
     */
    function getTransfer(string memory _transferId) 
        public 
        view 
        returns (Transfer memory) 
    {
        require(transferExists[_transferId], "Transfer does not exist");
        return transfers[_transferId];
    }
    
    /**
     * @dev Get property transfer history
     */
    function getPropertyTransferHistory(string memory _propertyId) 
        public 
        view 
        returns (string[] memory) 
    {
        return propertyTransferHistory[_propertyId];
    }
}