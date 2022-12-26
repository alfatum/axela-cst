'use strict';

const {
    getDefaultProvider,
    constants: { AddressZero },
    utils: { defaultAbiCoder },
} = require('ethers');
const { deployUpgradable } = require('@axelar-network/axelar-gmp-sdk-solidity');

const ExampleProxy = require('../../artifacts/src/Proxy.sol/ExampleProxy.json');
const ERC20CrossChain = require('../../artifacts/src/cross-chain-token/ERC20CrossChain.sol/ERC20CrossChain.json');

const name = 'SPBSTU token';
const symbol = 'SITSPBSTU4';
const decimals = 13;

async function deploy(chain, wallet) {
    console.log(`Deploying contract for ${chain.name}.`);
    const contract = await deployUpgradable(
        chain.constAddressDeployer,
        wallet,
        ERC20CrossChain,
        ExampleProxy,
        [chain.gateway, chain.gasReceiver, decimals],
        [],
        defaultAbiCoder.encode(['string', 'string'], [name, symbol]),
        'cross-chain-token',
    );
    chain.crossChainToken = contract.address;
    console.log(`Deployed contract for ${chain.name} at ${chain.crossChainToken}.`);
}

async function test(chains, wallet, options) {
    const args = options.args || [];
    const getGasPrice = options.getGasPrice;
    for (const chain of chains) {
        const provider = getDefaultProvider(chain.rpc);
        chain.wallet = wallet.connect(provider);
        chain.contract = await deployUpgradable(
            chain.constAddressDeployer,
            chain.wallet,
            ERC20CrossChain,
            ExampleProxy,
            [chain.gateway, chain.gasReceiver, decimals],
            [],
            defaultAbiCoder.encode(['string', 'string'], [name, symbol]),
            'cross-chain-token',
        );
    }
    const source = chains.find((chain) => chain.name === (args[0] || 'Avalanche'));
    const destination = chains.find((chain) => chain.name === (args[1] || 'Fantom'));
    const amount = parseInt(args[2]) || 1e5;

    async function print() {
        console.log(`Balance at ${source.name} is ${await source.contract.balanceOf(wallet.address)}`);
        console.log(`Balance at ${destination.name} is ${await destination.contract.balanceOf(wallet.address)}`);
    }
    function sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, ms);
        });
    }
    const initialBalance = (await destination.contract.balanceOf(wallet.address)).toNumber();
    console.log('--- Initially ---');
    await print();

    const gasLimit = 3e5;
    const gasPrice = await getGasPrice(source, destination, AddressZero);
    await (await source.contract.giveMe(amount)).wait();
    console.log('--- Minting ---');
    await print();

    await (
        await source.contract.transferRemote(destination.name, wallet.address, amount, { value: BigInt(Math.floor(gasLimit * gasPrice)) })
    ).wait();

    while ((await destination.contract.balanceOf(wallet.address)).toNumber() === initialBalance) {
        await sleep(2000);
    }

    console.log('--- After ---');
    await print();
}

module.exports = {
    deploy,
    test,
};
