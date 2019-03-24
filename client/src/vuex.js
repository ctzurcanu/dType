import Vue from 'vue';
import Vuex from 'vuex';
import DType from './constants';
import {getProvider, getContract} from './blockchain';

Vue.use(Vuex);

const dTypeStore = new Vuex.Store({
    state: {
        provider: null,
        wallet: null,
        contract: null,
        dtype: null,
        dtypes: [],
        DType,
    },
    mutations: {
        setProvider(state, provider) {
            state.provider = provider;
        },
        setWallet(state, wallet) {
            state.wallet = wallet;
        },
        setContract(state, contract) {
            state.contract = contract;
        },
        setType(state, dtype) {
            state.dtype = dtype;
        },
        setTypes(state, dtypes) {
            state.dtypes = dtypes;
        },
        addType(state, dtype) {
            state.dtypes.push(dtype);
        },
        updateType(state, index, dtype) {
            // We have a LogUpdate in remove(), this can log an empty struct
            if (dtype && state.dtypes[index]) {
                Object.assign(state.dtypes[index], dtype);
            }
        },
        removeType(state, index) {
            state.dtypes.splice(index, 1);
        },
    },
    actions: {
        setProvider({commit, state}) {
            return getProvider(state.DType).then(({provider, wallet}) => {
                commit('setProvider', provider);
                commit('setWallet', wallet);
            });
        },
        setContract({commit, state}) {
            const contractAddress = state.DType.contract.networks[
                String(state.provider.network.chainId)
            ].address;
            return getContract(
                contractAddress,
                state.DType.contract.abi,
                state.wallet,
            ).then((contract) => {
                commit('setContract', contract);
            });
        },
        async getTypeStruct({state}, hash) {
            let struct = await state.contract.getByHash(hash);
            struct.types = await state.contract.getTypes(hash);
            struct.data.typeHash = hash;
            // console.log('getTypeStruct', struct);
            return struct.data;
        },
        async setTypes({dispatch, commit, state}) {
            return state.contract.get(0, 'DType').then((dtype) => {
                commit('setType', dtype);
            }).then(() => {
                return state.contract.getIndex();
            }).then(async (hashes) => {
                for (let i = 0; i < hashes.length; i++) {
                    const dtype = await dispatch('getTypeStruct', hashes[i]);
                    commit('addType', dtype);
                }
            });
        },
        insertType({state}, dtype) {
            console.log('insert dtype', JSON.stringify(dtype));
            return state.contract.insert(dtype).then((tx) => {
                return tx.wait(2);
            }).then((receipt) => {
                console.log('receipt', receipt);
            });
        },
        insertBatchType({dispatch}, dtypeArray) {
            console.log('batchInsert', dtypeArray);
            for (let i = 0; i < dtypeArray.length; i++) {
                dispatch('insertType', dtypeArray[i]);
            }
        },
        updateType({state}, dtype) {
            console.log('update dtype', JSON.stringify(dtype));
            return state.contract.update(dtype.typeHash, dtype).then((tx) => {
                return tx.wait(2);
            }).then((receipt) => {
                console.log('receipt', receipt);
            });
        },
        removeType({state}, dtype) {
            console.log('delete dtype', JSON.stringify(dtype));
            return state.contract.remove(dtype.typeHash).then((tx) => {
                return tx.wait(2);
            }).then((receipt) => {
                console.log('receipt', receipt);
            });
        },
        watchAll({dispatch}) {
            return dispatch('watchInsert').then(() => {
                dispatch('watchUpdate');
            }).then(() => {
                dispatch('watchRemove');
            });
        },
        removeWatchers({state}) {
            return state.contract.removeAllListeners('LogNew')
                .removeAllListeners('LogUpdate')
                .removeAllListeners('LogRemove');
        },
        watchInsert({dispatch, commit, state}) {
            state.contract.on('LogNew', (typeHash, index) => {
                console.log('LogNew', typeHash, index);
                const typeIndex = state.dtypes.findIndex(dtype => dtype.typeHash === typeHash);
                if (typeIndex !== -1) return;
                dispatch('getTypeStruct', typeHash).then((struct) => {
                    commit('addType', struct);
                });
            });
        },
        watchUpdate({dispatch, commit, state}) {
            state.contract.on('LogUpdate', (typeHash, index) => {
                console.log('LogUpdate', typeHash, index, index.toNumber());
                const typeIndex = state.dtypes.findIndex(dtype => dtype.typeHash === typeHash);

                if (typeIndex === -1) return;
                dispatch('getTypeStruct', typeHash).then((struct) => {
                    commit('updateType', typeIndex, struct);
                });
            });
        },
        watchRemove({commit, state}) {
            state.contract.on('LogRemove', (typeHash) => {
                console.log('LogRemove', typeHash);
                const typeIndex = state.dtypes.findIndex(dtype => dtype.typeHash === typeHash);
                if (typeIndex > -1) {
                    commit('removeType', typeIndex);
                }
            });
        },
    },
});

export default dTypeStore;