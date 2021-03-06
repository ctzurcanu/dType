pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import './lib/ECVerify.sol';
import './dTypeInterface.sol';
import './dTypeLib.sol';

contract Alias {
    // general domain separation: domain.subdomain.leafsubdomain.resource
    // actor-related data: alice@socialnetwork.profile
    // identifying concepts: topicX#postY
    // general resource path definition: resourceRoot/resource

    string public constant signaturePrefix = '\x19Ethereum Signed Message:\n';
    uint256 public chainId;
    dTypeInterface public dType;

    struct Alias {
        address owner;
        uint64 nonce;
        bytes32 identifier;
    }

    // key: keccak256(dTypeIdentifier, separator, name)
    mapping(bytes32 => Alias) public aliases;

    // reverse alias
    // key: keccak256(dTypeIdentifier, identifier)
    // value: abi.encodePacked(separator, name)
    mapping(bytes32 => bytes) public reversealias;

    event AliasSet(bytes32 indexed dTypeIdentifier, bytes32 indexed identifier);

    constructor(address _dTypeAddress, uint256 _chainId) public {
        require(_dTypeAddress != address(0x0));
        require(_chainId > 0);

        dType = dTypeInterface(_dTypeAddress);
        chainId = _chainId;
    }

    function setAlias(bytes32 dTypeIdentifier, bytes1 separator, string memory name, bytes32 identifier, bytes memory signature) public {
        require(separator != bytes1(0));
        require(checkCharExists(name, separator) == false, 'Name contains separator');

        bytes32 key = getKey(dTypeIdentifier, separator, name);
        uint64 nonce = aliases[key].nonce;
        address owner = recoverAddress(dTypeIdentifier, separator, name, identifier, nonce + 1, signature);
        require(owner != address(0), 'No signer');

        bool remove = identifier == bytes32(0);
        bool exists = aliases[key].owner != address(0);
        bool isOwner = aliases[key].owner == owner;

        if (remove && !exists) revert('Alias is not set');

        if (remove && isOwner) {
            bytes32 reverseKey = getReverseKey(dTypeIdentifier, aliases[key].identifier);
            delete aliases[key];
            delete reversealias[reverseKey];
            emit AliasSet(dTypeIdentifier, identifier);
            return;
        }

        // Check if dtypeIdentifier exists, check if data identifier is in the storage contract
        // And data is owned by the signer
        checkdType(dTypeIdentifier, identifier);

        if (!exists) {
            aliases[key] = Alias(owner, 0, identifier);
        } else {
            require(isOwner, 'Not owner');
            bytes32 reverseKey = getReverseKey(dTypeIdentifier, aliases[key].identifier);
            aliases[key].identifier = identifier;
            delete reversealias[reverseKey];
        }
        reversealias[getReverseKey(dTypeIdentifier, identifier)] = abi.encodePacked(separator, name);
        aliases[key].nonce += 1;
        emit AliasSet(dTypeIdentifier, identifier);

        assert(nonce + 1 == aliases[key].nonce);
    }

    function checkdType(bytes32 dTypeIdentifier, bytes32 identifier) view public {
        bool success;
        bytes memory result;

        dTypeLib.dType memory typedata = dType.getByHash(dTypeIdentifier);
        require(typedata.contractAddress != address(0), 'Inexistent type');

        (success, result) = typedata.contractAddress.staticcall(abi.encodeWithSignature('isStored(bytes32)', identifier));
        require(success, 'isStored failed');
        require(keccak256(result) == keccak256(abi.encodePacked(uint256(1))), 'Not stored');

        // TODO check ownership
    }

    function getdTypeData(bytes32 dTypeIdentifier, bytes32 identifier) view public returns(bytes memory data) {
        bool success;
        bytes memory result;

        dTypeLib.dType memory typedata = dType.getByHash(dTypeIdentifier);
        (success, result) = typedata.contractAddress.staticcall(abi.encodeWithSignature('getByHash(bytes32)', identifier));
        require(success, 'Storage call failed');
        return result;
    }

    function getAliased(bytes32 dTypeIdentifier, bytes1 separator, string memory name) view public returns (bytes32 identifier) {
        bytes32 key = getKey(dTypeIdentifier, separator, name);
        return aliases[key].identifier;
    }

    function getReverse(bytes32 dTypeIdentifier, bytes32 identifier) view public returns (string memory) {
        return string(reversealias[getReverseKey(dTypeIdentifier, identifier)]);
    }

    // TODO remove
    function getAlias(bytes32 dTypeIdentifier, bytes1 separator, string memory name) view public returns(bytes32 identifier, bytes memory data) {
        bytes32 key = getKey(dTypeIdentifier, separator, name);
        return (aliases[key].identifier, getdTypeData(dTypeIdentifier, aliases[key].identifier));
    }

    function getAliasedData(bytes32 dTypeIdentifier, bytes1 separator, string memory name) view public returns (Alias memory aliasdata) {
        bytes32 key = getKey(dTypeIdentifier, separator, name);
        return aliases[key];
    }

    function getKey(bytes32 dTypeIdentifier, bytes1 separator, string memory name) pure internal returns (bytes32 key) {
        return keccak256(abi.encodePacked(dTypeIdentifier, separator, name));
    }

    function getReverseKey(bytes32 dTypeIdentifier, bytes32 identifier) pure internal returns (bytes32 key) {
        return keccak256(abi.encodePacked(dTypeIdentifier, identifier));
    }

    function checkCharExists(string memory name, bytes1 char) pure public returns (bool exists) {
        bytes memory encoded = bytes(name);
        for (uint256 i = 0; i < encoded.length; i++) {
            if (encoded[i] == char) {
                exists = true;
            }
        }
        return exists;
    }

    function strSplit( string memory name, bytes1 separator) public pure returns(string memory name1, string memory name2) {
        bytes memory nameb = bytes(name);
        bytes memory name1b = "";
        bool done1 = false;
        bytes memory name2b = "";
        for (uint256 i = 0; i < nameb.length - 1; i++){
            if (nameb[i] == separator){
                done1 = true;
            } else if (!done1) {
                name1b = abi.encodePacked(name1b, nameb[i]);
            }
            if (done1) {
                name2b = abi.encodePacked(name2b, nameb[i+1]);
            }
        }
        return (string(name1b), string(name2b));

    }

    function recoverAddress(
        bytes32 dTypeIdentifier,
        bytes1 separator,
        string memory name,
        bytes32 identifier,
        uint64 nonce,
        bytes memory signature
    )
        public
        view
        returns(address signer)
    {
        // 20 + 32 + 32 + 32 + 8 + 1 = 125
        string memory message_length = uintToString(125 + bytes(name).length);

        bytes memory data = abi.encodePacked(
          signaturePrefix,
          message_length,
          address(this),
          chainId,
          dTypeIdentifier,
          identifier,
          nonce,
          separator,
          name
        );
        signer = ECVerify.ecverify(keccak256(data), signature);
    }

    function uintToString(
        uint v)
        internal
        pure
        returns (string memory)
    {
        bytes32 ret;
        if (v == 0) {
            ret = '0';
        }
        else {
             while (v > 0) {
                ret = bytes32(uint(ret) / (2 ** 8));
                ret |= bytes32(((v % 10) + 48) * 2 ** (8 * 31));
                v /= 10;
            }
        }

        bytes memory bytesString = new bytes(32);
        uint charCount = 0;
        for (uint256 j=0; j<32; j++) {
            byte char = byte(bytes32(uint(ret) * 2 ** (8 * j)));
            if (char != 0) {
                bytesString[j] = char;
                charCount++;
            }
        }
        bytes memory bytesStringTrimmed = new bytes(charCount);
        for (uint256 j = 0; j < charCount; j++) {
            bytesStringTrimmed[j] = bytesString[j];
        }

        return string(bytesStringTrimmed);
    }
}
