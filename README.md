# Holo Token Sale contracts
This repository holds the three smart contracts that constitute the on-chain part of
Holo's token sale.

1. **HoloTokenSupply:** a contract that receives update messages that increase the credit supply based on predicted demand for services of the Holo hosting network.
2. **HoloTokenSale:** a limited time period contract that accepts purchase requests for Holo credit and handles those requests, on a periodic basis, according to the supply available. (See 1)
3. **HoloToken:** an ERC20 contract that mints tokens during the sale period and can destroy tokens in the later phase, when they are converted to Holo “fuel” once the Holo network launches. 


## Context
Holo will be selling hosting credits at a pre-launch discount in the form of an ERC20 token that will act as a receipt “redeemable by the bearer” for the Holo hosting currency when the network launches.  A set of coordinated Ethereum contracts manage the supply and purchase of these credits over the sale period.

## Design Principles
1. We take a strategy of splitting the contracts as small logical units as possible and to re-use as much code as we can that has been written and tested by others.
2. All our contracts are based on the zeppelin-solidity library.  In some cases, where we needed to make modifications, we copy-pasted the zeppelin code and then made minor changes.
3. All code is checked by truffle tests.
4. We use SafeMath for all mathematical functions.
5. The contracts have roles that allow certain actions (i.e. updater, minter, owner) that are usually updatable by the owner.

## Token Sale Mechanics
We want to do a token sale that is as inclusive as possible,
meaning that as many future Holo users can take part as possible
- versus having a few rich people buying all the tokens within minutes.
We also want to act responsibly by having a meaningful cap on the amount of tokens we allow ourselves to sell - instead of just raising as much funds as possible.

In order to meet these criteria, we are introducing two aspects to our token sale
that are rather unsual within this field of Ethereum based crowdsales / ICOs:

1. We are doing a **crowdfunding on Indigogo** starting two weeks prior to the token sale and running alongside it for four weeks. We take the sales from this crowdfunding as indicators to predict the size of the distributed hosting ecosystem that Holo will create so we can have this market size limit the amount of tokens we sell. Since we will have ongoing sales on Indigogo while the token sale on Ethereum is running, this estimated market size and the token supply it implies is not a fixed number. **Once per day, the new amount of tokens will be written to the blockchain enabling further token sales** - if all tokens are sold-out nobody can buy tokens before the next update releases more (which of course can be triggered by taking part in the crowdfunding)
2. We don't sell tokens immediately after receiving funds. In order to distribute them fairly, **we hold Ethers in escrow** and once per day (after updating the token supply as described above) **we compare the current demand with the amount of tokens available** for sale. If we can meet the whole demand everybody gets the exact amount of tokens they asked and payed for (we will keep a fixed price in all cases). **If the demand is higher than the supply we calculate the ratio and scale everybody's demand with that factor** - i.e. if the total demand is twice the supply, everybody will get half of what they asked for. In such a case, all funds stay in escrow by default and will continue take part in the sale on the next day. Funds that are in this escrow still have not been used to mint tokens and can be withdrawn by the beneficiary at any given point in time. If they are used to mint tokens during the daily update the funds are being transfered over to our wallet.


## Contract Design and Associations 
All three contracts will be deployed by us separately (potentially from different owner accounts) and then injected into each other as neeed. The following deploy script is doing this and is used in some of the tests:

```javascript
async () => {
    sale = await HoloTokenSale.new(web3.eth.blockNumber + 10, 1000, 1000000000000000000, wallet)
    supply_contract = await HoloTokenSupply.new()
    token = await HoloToken.new()
    await token.setMinter(sale.address)
    await sale.setSupplyContract(supply_contract.address)
    await sale.setTokenContract(token.address)
    await sale.setUpdater(updater)
  }
```



### HoloTokenSupply
***inherits from Zeppelin's Ownable***

This simple contract implements an increasing **total_supply** value that can be sold during the token sale, via an **addTokens()** function that can only be called by the *updater* - an address that is set by the contract owner during initialization, and that can be modified by the contract owner.  The value of token supply is used by the HoloTokenSale contract.

### HoloTokenSale
***inherits from Zeppelin's Ownable***

The purpose of this contract is to collect token purchase requests during the sale period, and honor them in batches.  It implements this with the payable **addAsks()** function, which records the amount sent for purchase in an escrow mapping.  The *updater* can then periodically call the **update()** function which then simultaneously transfers the amounts recorded in escrow to a Holo owned wallet (set at initialization time), and calls the HoloToken contract to mint new tokens for the purchasers in that batch.

We do this batched processing of purchase requests for few reasons: 1) the supply of tokens available to be sold will increase over the sale period as calculated from the demand indicators and recorded via HoloTokenSupply contract.  2) we want to include as many participants as possible, thus if the demand outstrips the supply on any given batch period, all purchase requests will be honored in part.  In such cases, purchase requester’s unspent funds will remain in escrow and will automatically apply to the next batch processing.  However, there is also a **withdraw()** function that allows purchase requesters to withdraw any funds from the escrow at any time, so they can get those unspent funds returned to them if they wish.  Finally, the contract also implements a **finalize()** function that returns all funds from requests that could not be honored that will be called after the end of the sale period.

### HoloToken
***inherits from Zeppelin's Ownable***
This contract acts as a standard ERC20 token as implemented by the zeppelin library with two additions: 

1. it adds a *minter* role that can call the **mint()** function to create new tokens only during a minting period.  The HoloTokenSale contract address is the minter.  The minting period is closed by the contract owner calling the **finishMinting()** function. 
2. it does not allow transfers durint the initial minting period.
3. it adds a *destroyer* role that can call a **burn()** function to record destroyed tokens.  We will write a HoloTokenDestroyer by the launch of the Holo network that will be used to redeem the tokens produced by this contract for Holo fuel.

## Install, testing and deploy
This project uses the [Truffle framework](http://truffleframework.com/) which you install with:

```npm install -g truffle```

In order to run the tests you will also need [Ethereum testrpc](https://github.com/ethereumjs/testrpc):

```npm install -g ethereumjs-testrpc```

And then cd into the repository and install all other dependencies with:

```npm install```

### Running the tests

Open another shell window and start testrpc there with:

```testrpc```

Leave it running.

Now from the repository's directory you should be able to deploy the contracts
on testrpc's testing blockchain by running:

```truffle migrate```

Then run the tests with:

```truffle test```