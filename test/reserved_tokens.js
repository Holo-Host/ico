import {expect} from 'chai'
var BigNumber = require('bignumber.js');

const HoloSale = artifacts.require('./HoloSale.sol')
const HoloToken = artifacts.require('./HoloToken.sol')
const HoloWhitelist = artifacts.require('./HoloWhitelist.sol')

import {
  contractShouldThrow,
  firstEvent
} from './testHelper'

contract('HoloSale - reserved tokens mechanics', (accounts) => {
  let wallet = accounts[9]
  let owner = accounts[0]
  let updater = accounts[1]
  let buyer1 = accounts[2]
  let buyer2 = accounts[3]
  let buyer3 = accounts[4]
  let buyer4 = accounts[5]
  let buyer5 = accounts[6]
  let buyer6 = accounts[7]
  let sale
  let token
  let whitelist_contract

  // we get 10 Holos per 1 ETH
  let rate = web3.toWei(10, 'ether')/1

  let weiToHoloWei = (x) => {
    return x * rate / web3.toWei(1, 'ether')
  }

  let holoWeiToWei = (x) => {
    return x * web3.toWei(1, 'ether') / rate
  }

  let deploy = async (min, maxPercent) => {
    sale = await HoloSale.new(web3.eth.blockNumber + 1, web3.eth.blockNumber + 500, rate, min, maxPercent, wallet)

    token = await HoloToken.new()
    whitelist_contract = await HoloWhitelist.new()
    await token.setMinter(sale.address)
    await sale.setTokenContract(token.address)
    await sale.setWhitelistContract(whitelist_contract.address)
    await sale.setUpdater(updater)
    await whitelist_contract.whitelist([buyer1,buyer2,buyer3,buyer4,buyer5,buyer6])
  }



  describe('Without min/maxPercent limits - basic reserved token features', () => {
    beforeEach(async () => {
      // Setting min very low..
      let min = web3.toWei(1, 'wei')
      // and maxPercent to 100...
      let maxPercent = 100;
      // ..to basically deactivate those limits to easily test
      // the reserved token mechanics.
      await deploy(min, maxPercent)
    })

    describe('on first day with 30 supply and 6 reserved tokens', () => {
      let supply = web3.toWei(30, 'ether') / 1

      beforeEach(async () => {
        let funders = [buyer1, buyer2, buyer3]
        let reservedTokens = [1, 2, 3].map(x => web3.toWei(x, 'ether') / 1)
        await whitelist_contract.whitelist(funders)
        await whitelist_contract.setReservedTokens(0, funders, reservedTokens)
        let totalReserved = reservedTokens.reduce((x,y)=>x+y)
        await sale.update(supply, totalReserved, {from: updater})
      })

      it('todayReserved() should be 6', async () => {
        let todayReserved = await sale.todayReserved.call()
        expect(todayReserved.toNumber()).to.equal(web3.toWei(6, 'ether')/1)
      })

      it('whitelist contract should show correct numbers of reserved tokens', async () => {
        let reserved1 = await whitelist_contract.reservedTokens.call(buyer1, 0)
        let reserved2 = await whitelist_contract.reservedTokens.call(buyer2, 0)
        let reserved3 = await whitelist_contract.reservedTokens.call(buyer3, 0)
        expect(reserved1.toNumber()).to.equal(web3.toWei(1, 'ether')/1)
        expect(reserved2.toNumber()).to.equal(web3.toWei(2, 'ether')/1)
        expect(reserved3.toNumber()).to.equal(web3.toWei(3, 'ether')/1)
      })

      it('somebody without reserved tokens should be able to buy 24', async () => {
        await sale.buyFuel(buyer6, {value: web3.toWei(2400, 'finney')})
        let amountTokens = await token.balanceOf(buyer6)
        expect(amountTokens.toNumber()).to.equal(web3.toWei(24, 'ether') / 1)
      })

      contractShouldThrow('but somebody without reserved tokens should not be able to buy 25', ()=> {
        return sale.buyFuel(buyer5, {value: web3.toWei(2500, 'finney')})
      })

      it('somebody with 1 reserved should be able to buy 25', async () => {
        await sale.buyFuel(buyer1, {value: web3.toWei(2500, 'finney')})
        let amountTokens = await token.balanceOf(buyer1)
        expect(amountTokens.toNumber()).to.equal(web3.toWei(25, 'ether') / 1)
      })

      it('somebody with 2 reserved should be able to buy 26', async () => {
        await sale.buyFuel(buyer2, {value: web3.toWei(2600, 'finney')})
        let amountTokens = await token.balanceOf(buyer2)
        expect(amountTokens.toNumber()).to.equal(web3.toWei(26, 'ether') / 1)
      })

      it('somebody with 3 reserved should be able to buy 27', async () => {
        await sale.buyFuel(buyer3, {value: web3.toWei(2700, 'finney')})
        let amountTokens = await token.balanceOf(buyer3)
        expect(amountTokens.toNumber()).to.equal(web3.toWei(27, 'ether') / 1)
      })

      describe('after buyer3 bought his 3 and all other 24 tokens', () => {
        beforeEach(() => {
          return sale.buyFuel(buyer3, {value: web3.toWei(2700, 'finney')})
        })

        it('Day struct should show 24 sold from unreserved and 3 sold from reserved', async () => {
          let stats = await sale.statsByDay(0)
          let sold = stats[1]
          let soldFromReserved = stats[3]
          expect(sold.toNumber()).to.equal(web3.toWei(24, 'ether')/1)
          expect(soldFromReserved.toNumber()).to.equal(web3.toWei(3, 'ether')/1)
        })

        it('todaySold() should return 27', async () => {
          let sold = await sale.todaySold.call()
          expect(sold.toNumber()).to.equal(web3.toWei(27, 'ether')/1)
        })

        contractShouldThrow('they can not buy more', () => {
          return sale.buyFuel(buyer3, {value: web3.toWei(1, 'finney')})
        })

        contractShouldThrow('somebody without reserved tokens can not buy even a fraction', () => {
          return sale.buyFuel(buyer6, {value: web3.toWei(1, 'finney')})
        })

        it('but somebody with 1 reserved should be able to buy 1', async () => {
          await sale.buyFuel(buyer1, {value: web3.toWei(100, 'finney')})
          let amountTokens = await token.balanceOf(buyer1)
          expect(amountTokens.toNumber()).to.equal(web3.toWei(1, 'ether') / 1)
        })

        it('and somebody with 2 reserved should be able to buy 2', async () => {
          await sale.buyFuel(buyer2, {value: web3.toWei(200, 'finney')})
          let amountTokens = await token.balanceOf(buyer2)
          expect(amountTokens.toNumber()).to.equal(web3.toWei(2, 'ether') / 1)
        })

        describe('next day with same supply (nothing added) and no reserved tokens', () => {
          beforeEach(() => {
            return sale.update(supply, 0, {from: updater})
          })

          it('buyer3 can buy the remaining 3 tokens', async () => {
            await sale.buyFuel(buyer3, {value: web3.toWei(300, 'finney')})
            let amountTokens = await token.balanceOf(buyer3)
            expect(amountTokens.toNumber()).to.equal(web3.toWei(30, 'ether') / 1)
          })

          it('buyer1 can also buy the remaining 3 tokens', async () => {
            await sale.buyFuel(buyer1, {value: web3.toWei(300, 'finney')})
            let amountTokens = await token.balanceOf(buyer1)
            expect(amountTokens.toNumber()).to.equal(web3.toWei(3, 'ether') / 1)
          })
        })
      })
    })
  })

  describe('Reasonable min/maxPercent limits', () => {
    beforeEach(async () => {
      let min = web3.toWei(100, 'finney')
      let maxPercent = 20;
      await deploy(min, maxPercent)
    })

    describe('on first day with 30 supply and 6 reserved tokens', () => {
      let supply = web3.toWei(30, 'ether') / 1

      beforeEach(async () => {
        let funders = [buyer1, buyer2, buyer3]
        let reservedTokens = [0.5, 2, 3].map(x => web3.toWei(x, 'ether') / 1)
        await whitelist_contract.whitelist(funders)
        await whitelist_contract.setReservedTokens(0, funders, reservedTokens)
        let totalReserved = reservedTokens.reduce((x,y)=>x+y)
        await sale.update(supply, totalReserved, {from: updater})
      })

      it('buyer1 can get their reserved tokens even with a transaction below minimum ETH', async () => {
        await sale.buyFuel(buyer1, {value: web3.toWei(50, 'finney')})
        let amountTokens = await token.balanceOf(buyer1)
        expect(amountTokens.toNumber()).to.equal(web3.toWei(500, 'finney') / 1)
      })

      describe('after buyer1 got half (0.25) of their reserved (0.5) tokens', () => {
        beforeEach(() => {
          return sale.buyFuel(buyer1, {value: web3.toWei(25, 'finney')})
        })

        it('Day struct should show 0 sold from unreserved and 0.25 sold from reserved', async () => {
          let stats = await sale.statsByDay(0)
          let sold = stats[1]
          let soldFromReserved = stats[3]
          expect(sold.toNumber()).to.equal(0)
          expect(soldFromReserved.toNumber()).to.equal(web3.toWei(250, 'finney')/1)
        })

        it('they can still get their second half plus a bit more and still be below min', async () => {
          await sale.buyFuel(buyer1, {value: web3.toWei(50, 'finney')})
          let amountTokens = await token.balanceOf(buyer1)
          expect(amountTokens.toNumber()).to.equal(web3.toWei(750, 'finney') / 1)
        })
      })
    })
  })

})
