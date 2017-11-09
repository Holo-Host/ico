# Holo contracts
This repository holds the three smart contracts that constitute the on-chain part of Holo's sale of hosting credit.

1. **HoloSupply:** a contract that receives update messages that increase the credit supply based on predicted demand for services of the Holo hosting network.
2. **HoloSale:** a limited time period contract that accepts purchase requests for Holo credit and handles those requests, according to the supply available. (See 1.)
3. **HoloCredits:** an ERC20 contract that mints credit receipt tokens during the sale period and can destroy tokens in the later phase, when they are converted to Holo “fuel” once the Holo network launches.


## Context
Holo will be selling hosting credits at a fixed price and with a dynamic cap in the form of an ERC20 token that acts as a surrogate for hosting credits that we will provide as a Holochain app once the Holo network has launched. A set of coordinated Ethereum contracts manage the supply and purchase of these credits over the sale period.

## Design Principles
1. We take a strategy of splitting the contracts as small logical units as possible and to re-use as much code as we can that has been written and tested by others.
2. We inject contract addresses after creation to keep the ability to update a single contract and have the remaining ones changed to talk to the new one.
3. All our contracts are based on the zeppelin-solidity library.  In some cases, where we needed to make modifications, we copy-pasted the zeppelin code and then made minor changes.
4. We use SafeMath for all mathematical functions.
5. All code is checked by truffle tests.
6. The contracts have roles that allow certain actions (i.e. updater, minter, owner) that are usually updatable by the owner.
7. Of course, we pay attention to the gas usage of our code and try optimize where possible (and we actually had to change the specification of how our sale should work because of how Ethereum inherently limits certain kinds of computations due to gas costs)

## Sale Mechanics
We want to run a sale that is as inclusive as possible, meaning that as many future Holo users can take part as possible, versus having a few rich people buying all the tokens within minutes.

We also want to act responsibly by having a meaningful cap on the amount of tokens we allow ourselves to sell, instead of just raising as much as possible.

In order to meet these criteria:

1. We are also doing **crowdfunding on Indiegogo** starting prior to the fuel sale with the crowdfund running alongside the token sale for four weeks. Sales from the crowdfunding serve as predictive indicators for the first year demand for participation in Holo. Each day's sales activity of hosting boxes and developer events expands the supply of tokens according to a fixed formula which means the token supply is not a fixed number. **Once per day, the newly released amount of fuel units will be written to the blockchain enabling further fuel/token sales**. If all tokens are sold-out, nobody can buy tokens until the next update releases more (which of course can be expanded by purchasing from the crowdfunding campaign).
2. We don't allow any single wallet to buy more than 10% of the fuel supply of each day.
3. We log the amount of available fuel and sold fuel for each day of the sale period and will make these statistics visible on our fuel sale web-page.
4. After the sale period ends, we mint tokens for the team such that the team will get the 25% of the total number of tokens in existence. Thus, during the sale **only 75% of the fuel**, calculated based on the crowdfunding statistics, **is made available for sale** so we don't artificially increase the supply with the tokens minted for the team.

## Contract Design and Associations
All three contracts will be deployed by us separately (potentially from different owner accounts) and then injected into each other as need. The following deploy script is doing this and is used in some of the tests:

```javascript
async () => {
    // we get 10 Holos per 1 ETH
    let rate = web3.toWei(10, 'ether')/1
    // we don't accept payments below 0.1 ETH
    let min = web3.toWei(100, 'finney')
    // we don't want to sell if somebody would buy more than 10% of today's supply
    let maxPercent = 10;
    sale = await HoloSale.new(web3.eth.blockNumber + 10, web3.eth.blockNumber + 500, rate, min, maxPercent, wallet)
    supply_contract = await HoloSupply.new()
    token = await HoloCredits.new()
    await token.setMinter(sale.address)
    await sale.setSupplyContract(supply_contract.address)
    await sale.setTokenContract(token.address)
    await sale.setUpdater(updater)
  }
```



### HoloSupply
***inherits from Zeppelin's Ownable***

This simple contract implements an increasing **totalSupply** value that can be increased during the token sale, via its **addTokens()** function.  This function can only be called by the *updater* - an address that is set by the contract owner during initialization, and that can be modified by the contract owner.  This contract also calculates the 75% and offers the function supplyAvailableForSale() which is used by the HoloSale contract.

### HoloSale
***inherits from Zeppelin's Ownable and Pausable***

This is a crowdsale contract based on Zepplin's [Crowdsale.sol](https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/crowdsale/Crowdsale.sol). The main difference is the supply cap per day and the lower and upper bounds on incoming funds.

HoloSale knows the addresses of both HoloSupply and HoloReceipt and calls supplyAvailableForSale() and mint(), mintingFinished() on them respectively.

### HoloCredits
***inherits from Zeppelin's Ownable***
This contract acts as a standard ERC20 token as implemented by the zeppelin library with three additions:

1. it adds a *minter* role that can call the **mint()** function to create new tokens only during a minting period.  The HoloSale contract address is the minter.  The minting period is closed by the contract owner calling the **finishMinting()** function.
2. it does not allow transfers during the initial minting period.
3. it adds a *destroyer* role that can call a **burn()** function to record destroyed tokens.  We will write a HoloRedeem contract by the launch of the Holo network that will be used to destroy the tokens produced by this contract as part of redeeming them for Holo fuel.

## Install, testing and deploy
This project uses the [Truffle framework](http://truffleframework.com/) which you install with:

```npm install -g truffle```

In order to run the tests you will also need [Ethereum testrpc](https://github.com/ethereumjs/testrpc):

```npm install -g ethereumjs-testrpc```

And then cd into the repository and install all other dependencies with:

```npm install```

### Running the tests

Open another shell window and start testrpc there with ```testrpc``` and leave it running.

Now from the repository's directory you should be able to deploy the contracts
on testrpc's testing blockchain by running:

```truffle migrate```

Then run the tests with:

```truffle test```


## Oyente output:
```
$ oyente -s all.sol
WARNING:root:You are using an untested version of z3. 4.5.0 is the officially tested version
WARNING:root:You are using evm version 1.7.2. The supported version is 1.6.6
WARNING:root:You are using solc version 0.4.18, The latest supported version is 0.4.17
INFO:root:Contract all.sol:HoloCredits:
INFO:oyente.symExec:Running, please wait...
INFO:oyente.symExec:	============ Results ===========
INFO:oyente.symExec:	  EVM code coverage: 	 100.0%
INFO:oyente.symExec:	  Callstack bug: 	 False
INFO:oyente.symExec:	  Money concurrency bug: False
INFO:oyente.symExec:	  Time dependency bug: 	 False
INFO:oyente.symExec:	  Reentrancy bug: 	 False
INFO:root:Contract all.sol:HoloSale:
INFO:oyente.symExec:Running, please wait...
INFO:oyente.symExec:	============ Results ===========
INFO:oyente.symExec:	  EVM code coverage: 	 84.4%
INFO:oyente.symExec:	  Callstack bug: 	 False
INFO:oyente.symExec:	  Money concurrency bug: False
INFO:oyente.symExec:	  Time dependency bug: 	 False
INFO:oyente.symExec:	  Reentrancy bug: 	 False
INFO:root:Contract all.sol:HoloSupply:
INFO:oyente.symExec:Running, please wait...
INFO:oyente.symExec:	============ Results ===========
INFO:oyente.symExec:	  EVM code coverage: 	 99.6%
INFO:oyente.symExec:	  Callstack bug: 	 False
INFO:oyente.symExec:	  Money concurrency bug: False
INFO:oyente.symExec:	  Time dependency bug: 	 False
INFO:oyente.symExec:	  Reentrancy bug: 	 False
INFO:root:Contract all.sol:Ownable:
INFO:oyente.symExec:Running, please wait...
INFO:oyente.symExec:	============ Results ===========
INFO:oyente.symExec:	  EVM code coverage: 	 99.4%
INFO:oyente.symExec:	  Callstack bug: 	 False
INFO:oyente.symExec:	  Money concurrency bug: False
INFO:oyente.symExec:	  Time dependency bug: 	 False
INFO:oyente.symExec:	  Reentrancy bug: 	 False
INFO:root:Contract all.sol:Pausable:
INFO:oyente.symExec:Running, please wait...
INFO:oyente.symExec:	============ Results ===========
INFO:oyente.symExec:	  EVM code coverage: 	 99.8%
INFO:oyente.symExec:	  Callstack bug: 	 False
INFO:oyente.symExec:	  Money concurrency bug: False
INFO:oyente.symExec:	  Time dependency bug: 	 False
INFO:oyente.symExec:	  Reentrancy bug: 	 False
INFO:root:Contract all.sol:SafeMath:
INFO:oyente.symExec:Running, please wait...
INFO:oyente.symExec:	============ Results ===========
INFO:oyente.symExec:	  EVM code coverage: 	 100.0%
INFO:oyente.symExec:	  Callstack bug: 	 False
INFO:oyente.symExec:	  Money concurrency bug: False
INFO:oyente.symExec:	  Time dependency bug: 	 False
INFO:oyente.symExec:	  Reentrancy bug: 	 False
INFO:oyente.symExec:	====== Analysis Completed ======
INFO:oyente.symExec:	====== Analysis Completed ======
INFO:oyente.symExec:	====== Analysis Completed ======
INFO:oyente.symExec:	====== Analysis Completed ======
INFO:oyente.symExec:	====== Analysis Completed ======
INFO:oyente.symExec:	====== Analysis Completed ======
```
