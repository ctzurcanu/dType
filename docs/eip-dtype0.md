---
eip: <to be assigned>
title: dType: Decentralized Type System for EVM
author: Loredana Cirstea (@loredanacirstea), Christian Tzurcanu (@ctzurcanu)
discussions-to: <URL>
status: Draft
type: Standards Track
category (*only required for Standard Track): ERC
created: 2019-03-28
---


## Simple Summary

The EVM and related languages such as Solidity need consensus on an extensible Type System in order to further evolve into the Singleton Operating System (The World Computer).

## Abstract

We are proposing a decentralized Type System for Ethereum, to introduce data definition (and therefore ABI) consistency. This ERC focuses on defining an on-chain Type Registry (named `dType`) and a common interface for creating types, based on `struct`s.


## Motivation

In order to build a network of interoperable protocols on Ethereum, we need data standardization, to ensure a smooth flow of on-chain information. Off-chain, the Type Registry will allow a better analysis of blockchain data (e.g. for blockchain explorers) and creation of smart contract development tools for easily using existing types in a new smart contract.

The Type Registry can have a governance protocol for it's CRUD operations. However, this and other permission guards are not covered in the current proposal.

However, this is only the first phase. As defined in this document and in the future proposals that will be based on this one, we are proposing something more: a decentralized Type System with Data Storage. This means each Type can have a Storage Contract that stores data entries that are of that type. These data entries can originate from different protocols or developers and are aggregated within the same smart contract. In addition, developers can create libraries of `pure` functions that know how to interact and modify the data entries. This will effectively create the base for a general functional programming system on Ethereum, were developers can use previously created building blocks.

To summarize:

* We would like to have a good decentralized medium for integrating all Ethereum data, and relationships between the different types of data. Also a way to address the behavior related to each data type.
* Functional programming becomes easier. Functions like map, reduce, filter for data types are implemented by each type library.
* Solidity development tools could be transparently extended to include the created types (For example in IDEs like Remix). At a later point, Solidity itself can have native support for these types.
* The system can be easily extended to types pertaining to other languages. (With type definitions in the source (Swarm stored source code in the respective language))
* The dType database should be part of the System Registry for the Operating System of The World Computer


## Specification

### Type Definition

```
struct dType {
  address contractAddress;
  bytes32 source;
  string name;
  string[] types;
  string[] labels;
}
```

For storing the actual types, we propose the following format, which allows additional metadata to be attached to the type:
```
struct Type {
  dType data;
  uint256 index;
}
```

For example, some standard types can be defined as:
```
{
  "contractAddress": "0x0000000000000000000000000000000000000000",
  "source": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "name": "uint256",
  "types": [],
  "labels": []
}

{
  "contractAddress": "0x0000000000000000000000000000000000000000",
  "source": "0x0000000000000000000000000000000000000000000000000000000000000000",
  "name": "string",
  "types": [],
  "labels": []
}
```

Composed types can be defines as:
```
{
  "contractAddress": "0x105631C6CdDBa84D12Fa916f0045B1F97eC9C268",
  "source": <a SWARM hash for source files>,
  "name": "myBalance",
  "types": ["string", "uint256"],
  "labels": ["accountName", "amount"]
}
```

Composed types can be further composed:
```
{
  "contractAddress": "0x91E3737f15e9b182EdD44D45d943cF248b3a3BF9",
  "source": <a SWARM hash for source files>,
  "name": "myToken",
  "types": ["address", "myBalance"],
  "labels": ["token", "balance"]
}
```
That is: a `myToken` type will have the final data format: `(address,(string,uint256))` and a labeled format: `(address token, (string accountName, uint256 amount))`

### Type Registry Interface

```
contract dType {
    event LogNew(bytes32 indexed hash, uint256 indexed index);
    event LogUpdate(bytes32 indexed hash, uint256 indexed index);
    event LogRemove(bytes32 indexed hash, uint256 indexed index);

    function insert(dTypeLib.dType memory data) public returns (bytes32 dataHash)

    function remove(bytes32 typeHash) public returns(uint256 index)

    function count() public view returns(uint256 counter)

    function getTypeHash(string memory name) pure public returns (bytes32 typeHash)

    function getByHash(bytes32 typeHash) view public returns(Type memory dtype)

    function get(string memory name) view public returns(Type memory dtype)

    function isType(bytes32 typeHash) view public returns(bool isIndeed)
}
```

### Type Libraries

Bellow is an example of a type library. It can also implement helper functions for structuring and destructuring data. Map, filter, reduce functions should also be included.

```
pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

library myBalanceLib {

    struct myBalance {
        string accountName;
        uint256 amount;
    }

    function structureBytes(bytes memory data) pure public returns(myBalance memory balance)

    function destructureBytes(myBalance memory balance) pure public returns(bytes memory data)

    function map(
        address callbackAddr,
        bytes4 callbackSig,
        myBalance[] memory balanceArr
    )
        view
        internal
        returns (myBalance[] memory result)
}
```

Types can also use existing types in their composition. However, this will always result in a Directed Acyclic Graph.

```
library myTokenLib {
    using myBalanceLib for myBalanceLib.myBalance;

    struct myToken {
        address token;
        myBalanceLib.myBalance;
    }
}
```

### Type Contract

A type must implement a library and a contract that stores the Ethereum address of that library, along with other contract addresses related to that type (e.g. smart contract for storing the data entries for that type).

```
contract TypeRootContract {
  address public libraryAddress;
  address public storageAddress;

  constructor(address _library, address _storage) public {
    require(_library != address(0x0));
    libraryAddress = _library;
    storageAddress = _storage;
  }
}
```

## Rationale

For now, the Type Registry stores the minimum amount of information for the types, needed to allow off-chain tool to cache and search through the collection. This can be further extended, as the scope progresses:

* `address contractAddress` - defines the Ethereum address of the `TypeRootContract`
* `bytes32 source` - defines a Swarm hash where the source code of the type library and contracts can be found
* `string name` - the name of the type; the packed `bytes` encoding format can also be taken into consideration
* `string[] types` - the types of the first depth level internal components
* `string[] labels` - the names of the first depth level internal components

Note that we are proposing to define the `typeHash` as `keccak256(name)`. If the system is extended to other languages, we can define `typeHash` as `keccak256(language, name)`.
We also propose to not allow the update of existing types, in order to ensure backwards compatibility. The effort of having consensus on new types being added or removing unused ones is left to the governance system.
Initially, single word English names can be disallowed, to avoid name squatting.

We also recommend that the Type Library and Type Contract for a specific type should express the behavior pertinent strictly to the data structure. The additional behavior that is pertinent to the logic should later be added by external contract functions that use the respective type. This is an approach that will not pollute the data with behavior and allow for fine-grained upgrades by upgrading just the behavior/functions.


## Backwards Compatibility

This proposal does not affect extant Ethereum standards or implementations. It uses the present experimental version of ABIEncoderV2.

## Test Cases

Will be added.

## Implementation

In work implementation examples can be found at https://github.com/ctzurcanu/dType/tree/master/contracts/contracts.
This proposal will be updated with an appropriate implementation when consensus is reached on the specifications.


## Copyright
Copyright and related rights waived via [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
