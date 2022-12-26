// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarGateway } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol';
import { IAxelarGasService } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol';
import { ERC20 } from '@axelar-network/axelar-cgp-solidity/contracts/ERC20.sol';
import { AxelarExecutable } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/executables/AxelarExecutable.sol';
import { Upgradable } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/upgradables/Upgradable.sol';
import { StringToAddress, AddressToString } from '@axelar-network/axelar-gmp-sdk-solidity/contracts/StringAddressUtils.sol';

contract ERC20CrossChain is AxelarExecutable, ERC20, Upgradable {
    using StringToAddress for string;
    using AddressToString for address;

    error AlreadyInitialized();

    IAxelarGasService public immutable gasReceiver;
    uint8 a;

    constructor(
        address gateway_,
        address gasReceiver_,
        uint8 decimals_
    ) AxelarExecutable(gateway_) ERC20('', '', decimals_) {
        gasReceiver = IAxelarGasService(gasReceiver_);
    }

    function _setup(bytes calldata params) internal override {
        (string memory name_, string memory symbol_) = abi.decode(params, (string, string));
        if (bytes(name).length != 0) revert AlreadyInitialized();
        name = name_;
        symbol = symbol_;
    }

    function giveMe(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function transferRemote(
        string calldata destinationChain,
        address destinationAddress,
        uint256 amount
    ) public payable {
        _burn(msg.sender, amount);
        bytes memory payload = abi.encode(destinationAddress, amount);
        string memory stringAddress = address(this).toString();
        if (msg.value > 0) {
            gasReceiver.payNativeGasForContractCall{ value: msg.value }(
                address(this),
                destinationChain,
                stringAddress,
                payload,
                msg.sender
            );
        }
        gateway.callContract(destinationChain, stringAddress, payload);
    }

    function _execute(
        string calldata,
        string calldata sourceAddress,
        bytes calldata payload
    ) internal override {
        (address to, uint256 amount) = abi.decode(payload, (address, uint256));
        _mint(to, amount);
    }

    function contractId() external pure returns (bytes32) {
        return keccak256('example');
    }
}
