pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

library dTypeLib {

    enum LangChoices { Solidity, JavaScript, Python }

    enum TypeChoices {
        Type,
        Event,
        PayableFunction,
        StateFunction,
        ViewFunction,
        PureFunction
    }

    struct dType {
        LangChoices lang;
        TypeChoices typeChoice;
        bool hasOutput;
        address contractAddress;
        bytes32 source;
        string name;
        string[] types;
        string[] labels;
    }

    function structure(
        LangChoices lang,
        TypeChoices typeChoice,
        bool hasOutput,
        address contractAddress,
        bytes32 source,
        string memory name,
        string[] memory types,
        string[] memory labels
    )
        public
        pure
        returns(dType memory dtype)
    {
        return dType(lang, typeChoice, hasOutput, contractAddress, source, name, types, labels);
    }

    function structureBytes(bytes memory data)
        pure
        internal
        returns(dType memory dtype)
    {
        (dtype) = abi.decode(data, (dType));
    }

    function destructureBytes(dType memory dtype)
        pure
        internal
        returns(bytes memory data)
    {
        return abi.encode(dtype);
    }
}
