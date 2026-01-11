// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract PropertyRegistry is AccessControl {
    bytes32 public constant LRO_ROLE = keccak256("LRO_ROLE");
    bytes32 public constant TEHSILDAR_ROLE = keccak256("TEHSILDAR_ROLE");
    
    struct Property {
        string propertyId;
        string ownerId;
        string ownerName;
        string ownerCnic;
        string fatherName;
        string fardNo;
        string khasraNo;
        string khatooniNo;
        uint256 areaMarla;
        string propertyType;
        string district;
        string tehsil;
        string documentHash;
        uint256 registrationDate;
        address addedBy;
        address approvedBy;
        bool isApproved;
        bool isFrozen;
        PropertyStatus status;
    }
    
    enum PropertyStatus { 
        PENDING_APPROVAL, 
        APPROVED, 
        REJECTED, 
        FROZEN, 
        TRANSFERRED 
    }
    
    // Mappings
    mapping(string => Property) public properties;
    mapping(string => bool) public propertyExists;
    mapping(string => string[]) public ownerProperties; // CNIC => Property IDs
    
    // Events
    event PropertyRegistered(
        string indexed propertyId, 
        string indexed ownerId,
        address indexed addedBy,
        uint256 timestamp
    );
    
    event PropertyApproved(
        string indexed propertyId,
        address indexed approvedBy,
        uint256 timestamp
    );
    
    event PropertyFrozen(
        string indexed propertyId,
        address indexed frozenBy,
        string reason,
        uint256 timestamp
    );
    
    event PropertyUnfrozen(
        string indexed propertyId,
        address indexed unfrozenBy,
        uint256 timestamp
    );
    
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    /**
     * @dev Register new property (LRO only)
     */
    function registerProperty(
        string memory _propertyId,
        string memory _ownerId,
        string memory _ownerName,
        string memory _ownerCnic,
        string memory _fatherName,
        string memory _fardNo,
        string memory _khasraNo,
        string memory _khatooniNo,
        uint256 _areaMarla,
        string memory _propertyType,
        string memory _district,
        string memory _tehsil,
        string memory _documentHash
    ) public onlyRole(LRO_ROLE) returns (bool) {
        require(!propertyExists[_propertyId], "Property already exists");
        require(bytes(_propertyId).length > 0, "Property ID required");
        require(bytes(_ownerId).length > 0, "Owner ID required");
        
        Property memory newProperty = Property({
            propertyId: _propertyId,
            ownerId: _ownerId,
            ownerName: _ownerName,
            ownerCnic: _ownerCnic,
            fatherName: _fatherName,
            fardNo: _fardNo,
            khasraNo: _khasraNo,
            khatooniNo: _khatooniNo,
            areaMarla: _areaMarla,
            propertyType: _propertyType,
            district: _district,
            tehsil: _tehsil,
            documentHash: _documentHash,
            registrationDate: block.timestamp,
            addedBy: msg.sender,
            approvedBy: address(0),
            isApproved: false,
            isFrozen: false,
            status: PropertyStatus.PENDING_APPROVAL
        });
        
        properties[_propertyId] = newProperty;
        propertyExists[_propertyId] = true;
        ownerProperties[_ownerCnic].push(_propertyId);
        
        emit PropertyRegistered(_propertyId, _ownerId, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Approve property registration (Tehsildar only)
     */
    function approveProperty(string memory _propertyId) 
        public 
        onlyRole(LRO_ROLE) 
        returns (bool) 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        require(!properties[_propertyId].isApproved, "Already approved");
        
        properties[_propertyId].isApproved = true;
        properties[_propertyId].approvedBy = msg.sender;
        properties[_propertyId].status = PropertyStatus.APPROVED;
        
        emit PropertyApproved(_propertyId, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Freeze property (Tehsildar/Admin only)
     */
    function freezeProperty(string memory _propertyId, string memory _reason) 
        public 
        onlyRole(TEHSILDAR_ROLE) 
        returns (bool) 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        require(!properties[_propertyId].isFrozen, "Already frozen");
        
        properties[_propertyId].isFrozen = true;
        properties[_propertyId].status = PropertyStatus.FROZEN;
        
        emit PropertyFrozen(_propertyId, msg.sender, _reason, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Unfreeze property (Tehsildar/Admin only)
     */
    function unfreezeProperty(string memory _propertyId) 
        public 
        onlyRole(TEHSILDAR_ROLE) 
        returns (bool) 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        require(properties[_propertyId].isFrozen, "Not frozen");
        
        properties[_propertyId].isFrozen = false;
        properties[_propertyId].status = PropertyStatus.APPROVED;
        
        emit PropertyUnfrozen(_propertyId, msg.sender, block.timestamp);
        
        return true;
    }
    
    /**
     * @dev Get property details
     */
    function getProperty(string memory _propertyId) 
        public 
        view 
        returns (Property memory) 
    {
        require(propertyExists[_propertyId], "Property does not exist");
        return properties[_propertyId];
    }
    
    /**
     * @dev Get all properties owned by a CNIC
     */
    function getOwnerProperties(string memory _cnic) 
        public 
        view 
        returns (string[] memory) 
    {
        return ownerProperties[_cnic];
    }
    
    /**
     * @dev Grant LRO role (Admin only)
     */
    function grantLRORole(address _account) 
        public 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        grantRole(LRO_ROLE, _account);
    }
    
    /**
     * @dev Grant Tehsildar role (Admin only)
     */
    function grantTehsildarRole(address _account) 
        public 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        grantRole(TEHSILDAR_ROLE, _account);
    }
}