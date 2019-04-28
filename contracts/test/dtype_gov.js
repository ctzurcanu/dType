const CT = require('./constants.js');
const UTILS = require('./utils.js');

const dType = artifacts.require('dType.sol');
const VoteResourceTypeStorage = artifacts.require('VoteResourceTypeStorage.sol');
const VotingFunctions = artifacts.require('VotingFunctions.sol');
const VotingMechanismStorage = artifacts.require('VotingMechanismTypeStorage.sol');
const VotingProcessStorage = artifacts.require('VotingProcessStorage.sol');
const PermissionFunctionStorage = artifacts.require('PermissionFunctionStorage.sol');
const ActionContract = artifacts.require('ActionContract.sol');

// const fsData = require('../data/fs_data.json');

contract('gov', async (accounts) => {
    let dtype, resourceStorage, votingfunc, vmStorage, vpStorage, permStorage, action;

    it('deploy', async () => {
        dtype = await dType.deployed();
        resourceStorage = await VoteResourceTypeStorage.deployed();
        votingfunc = await VotingFunctions.deployed();
        vmStorage = await VotingMechanismStorage.deployed();
        vpStorage = await VotingProcessStorage.deployed();
        permStorage = await PermissionFunctionStorage.deployed();
        action = await ActionContract.deployed();
    });

    it('gov test', async () => {
        // Trying to insert a new permission through ActionContract
        let newperm = {
            contractAddress: vmStorage.address,
            functionSig: UTILS.getSignature(vmStorage.abi, 'insert'),
            anyone: false,
            allowed: CT.EMPTY_ADDRESS,
            temporaryAction: UTILS.getSignature(vmStorage.abi, 'insert'),
            votingProcessDataHash: await vpStorage.typeIndex(0),
        }

        let encodedParams = web3.eth.abi.encodeParameters(
            permStorage.abi.find(fabi => fabi.name === 'insert').inputs,
            [newperm],
        );

        let permission = await permStorage.get(permStorage.address, UTILS.getSignature(permStorage.abi, 'insert'));
        assert.exists(permission.temporaryAction);
        assert.exists(permission.votingProcessDataHash);

        let votingProcess = await vpStorage.getByHash(permission.votingProcessDataHash);
        assert.exists(votingProcess.votingMechanismDataHash);
        assert.exists(votingProcess.funcHashYes);
        assert.exists(votingProcess.funcHashNo);

        let votingMechanism = await vmStorage.getByHash(votingProcess.votingMechanismDataHash);
        assert.exists(votingMechanism.processVoteFunctions);
        assert.exists(votingMechanism.processStateFunctions);
        assert.exists(votingMechanism.parameters);

        await action.run(
            permStorage.address,
            UTILS.getSignature(permStorage.abi, 'insert'),
            encodedParams,
            {from: accounts[0]}
        );

        let votingResourceHash = await resourceStorage.typeIndex(0);
        let votingResource = await resourceStorage.getByHash(votingResourceHash);
        assert.equal(votingResource.proponent, accounts[0]);
        assert.equal(votingResource.contractAddress, permStorage.address);
        assert.exists(votingResource.dataHash);
        assert.equal(votingResource.votingProcessDataHash, permission.votingProcessDataHash);
        assert.equal(votingResource.scoreyes, 0);
        assert.equal(votingResource.scoreno, 0);

        let newPermission;

        // TODO address should be set in ActionContract
        await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [false, 0, accounts[0]]));
        await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [false, 0, accounts[1]]));
        await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [false, 0, accounts[2]]));
        await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [true, 0, accounts[3]]));
        await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [true, 0, accounts[4]]));
        await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [true, 0, accounts[5]]));
        await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [true, 0, accounts[6]]));
        await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [true, 0, accounts[7]]));

        // Not yet enabled
        newPermission = await permStorage.getByHash(await permStorage.typeIndex(1));
        assert.equal(newPermission.anyone, false);
        assert.equal(newPermission.allowed, CT.EMPTY_ADDRESS);
        assert.equal(newPermission.temporaryAction, '0x00000000');
        assert.equal(newPermission.votingProcessDataHash, CT.EMPTY_BYTES);

        result = await action.vote(votingResourceHash, web3.eth.abi.encodeParameters(['bool','uint256','address'], [true, 0, accounts[8]]));

        newPermission = await permStorage.getByHash(await permStorage.typeIndex(1));
        assert.equal(newPermission.anyone, newperm.anyone);
        assert.equal(newPermission.allowed, newperm.allowed);
        assert.equal(newPermission.temporaryAction, newperm.temporaryAction);
        assert.equal(newPermission.votingProcessDataHash, newperm.votingProcessDataHash);
    });
});
