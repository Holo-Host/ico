import {expect} from 'chai'
var BigNumber = require('bignumber.js');

const HoloTokenSale = artifacts.require('./HoloTokenSale.sol')
const HoloTokenSupply = artifacts.require('./HoloTokenSupply.sol')
const HoloToken = artifacts.require('./HoloToken.sol')

import {
  contractShouldThrow,
  firstEvent
} from './testHelper'

contract('HoloTokenSale', (accounts) => {
  let wallet = accounts[9]
  let owner = accounts[0]
  let updater = accounts[1]
  let tokenBuyer1 = accounts[2]
  let tokenBuyer2 = accounts[3]
  let tokenBuyer3 = accounts[4]
  let tokenBuyer4 = accounts[5]
  let tokenBuyer5 = accounts[6]
  let tokenBuyer6 = accounts[7]
  let sale
  let supply_contract
  let token

  // we get 10 Holos per 1 ETH
  let rate = web3.toWei(10, 'ether')/1

  let weiToHoloWei = (x) => {
    return x * rate / web3.toWei(1, 'ether')
  }

  let holoWeiToWei = (x) => {
    return x * web3.toWei(1, 'ether') / rate
  }

  beforeEach(async () => {
    let min = web3.toWei(100, 'finney')
    let maxPercent = 10;
    sale = await HoloTokenSale.new(web3.eth.blockNumber + 10, 1000, rate, min, maxPercent, wallet)
    supply_contract = await HoloTokenSupply.new()
    token = await HoloToken.new()
    await token.setMinter(sale.address)
    await sale.setSupplyContract(supply_contract.address)
    await sale.setTokenContract(token.address)
    await sale.setUpdater(updater)
  })

  contractShouldThrow('buyFuel should throw if called before sale started', async () => {
      return sale.buyFuel(tokenBuyer1, {value: 100, from: tokenBuyer1})
  })

  contractShouldThrow('should not take money before sale started', async () => {
    await web3.eth.sendTransaction({
      to: sale.address,
      value: web3.toWei(2, 'ether'),
      from: tokenBuyer1,
      gas: 4000000
    })
  })

  describe('currentDay()', () => {
    it('should be 0 before sale started', async () => {
      let day = await sale.currentDay.call()
      expect(day.toNumber()).to.equal(0)
    })
  })


  describe('after starting block', () => {
    beforeEach(async () => {
      // create three blocks (testRPC creates a block for every transaction)
      for(let i=0; i<10; i++) {
        await sale.setUpdater(updater)
      }
    })

    describe('buyFuel()', () => {
      contractShouldThrow('should throw if called before first initial update', () => {
        return sale.buyFuel(tokenBuyer1, {from: tokenBuyer1, value: web3.toWei(2, 'ether')})
      })
    })

    describe('default function', () => {
      contractShouldThrow('should throw if called before first initial update', () => {
        return web3.eth.sendTransaction({
          to: sale.address,
          value: web3.toWei(2, 'ether'),
          from: tokenBuyer1,
          gas: 4000000
        })
      })
    })

    describe('update()', () => {
      contractShouldThrow('should throw if called by non-updater', () => {
        return sale.update()
      })

      it('should not throw when called by updater', () => {
        return sale.update({from: updater})
      })
    })

    describe('after first update', () => {
      let walletBalanceBefore
      let tokenSupply = web3.toWei(25, 'ether') / 1

      beforeEach(async () => {
        await supply_contract.addTokens(tokenSupply)
        assert(await supply_contract.total_supply() == tokenSupply)
        await sale.update({from: updater})
      })

      it('stats should contain the first day', async () => {
        let day = await sale.currentDay.call();
        expect(day.toNumber()).to.equal(1)
        let stats = await sale.statsByDay(0)
        expect(stats[0].toNumber()).to.equal(tokenSupply)
        expect(stats[1].toNumber()).to.equal(0)
      })

      let buyFuel = (amount) => {
        return () => {
          it('should have added the amount of sold Holos to the stats', async () => {
            let stats = await sale.statsByDay(0)
            expect(stats[0].toNumber()).to.equal(tokenSupply)
            expect(stats[1].toNumber()).to.equal(weiToHoloWei(amount))
          })

          it('should have created the correct amount of Holo Receipts', async () => {
            let amountReceipts = await token.balanceOf(tokenBuyer1)
            expect(amountReceipts.toNumber()).to.equal(weiToHoloWei(amount))
          })

          it('should have created an event', async () => {
            let log = await firstEvent(sale.ReceiptCreated())
            expect(log.args.beneficiary).to.equal(tokenBuyer1)
            expect(log.args.amountWei.toNumber()).to.equal(amount)
            expect(log.args.amountHolos.toNumber()).to.equal(weiToHoloWei(amount))
          })

          it('should have sent the incoming ETH to the wallet', async () => {
            let balance = await web3.eth.getBalance(wallet)
            expect(balance.toNumber() - walletBalanceBefore.toNumber()).to.equal(amount)
          })
        }
      }

      describe('buyTokens()', () => {
        describe('with the right amount of ETH', () => {
          let amount = holoWeiToWei(tokenSupply / 20)

          beforeEach(async () => {
            walletBalanceBefore = await web3.eth.getBalance(wallet)
            return sale.buyFuel(tokenBuyer1, {value: amount})
          })

          describe('[should do sale]', buyFuel(amount))
        })

        describe('when paused', () => {
          let amount = holoWeiToWei(tokenSupply / 20)
          beforeEach(() => {
            return sale.pause()
          })

          contractShouldThrow('it should not work even when amount is right', () => {
            return sale.buyFuel(tokenBuyer1, {value: amount})
          })

          describe('one should be able to unpause', () => {
            beforeEach(async () => {
              await sale.unpause()
              walletBalanceBefore = await web3.eth.getBalance(wallet)
              return sale.buyFuel(tokenBuyer1, {value: amount})
            })

            describe('[should do sale]', buyFuel(amount))
          })
        })

        describe('with too much ETH (over 10% of supply)', () => {
          let tenPercent = tokenSupply / 9
          let amount = holoWeiToWei(tenPercent)

          contractShouldThrow('it should not accept the transaction', () => {
            return sale.buyFuel(tokenBuyer1, {value: amount})
          })
        })

        describe('with too less ETH (< 0.1ETH)', () => {
          let amount = web3.toWei(99, 'finney')
          let walletBalanceBefore

          contractShouldThrow('it should not accept the transaction', () => {
            return sale.buyFuel(tokenBuyer1, {value: amount})
          })
        })
      })

      describe('default function', () => {
        describe('with the right amount of ETH', () => {
          let amount = holoWeiToWei(tokenSupply / 20)

          beforeEach(async () => {
            walletBalanceBefore = web3.eth.getBalance(wallet)
            return web3.eth.sendTransaction({
              to: sale.address,
              value: amount,
              from: tokenBuyer1,
              gas: 4000000
            })
          })

          describe('[should do sale]', buyFuel(amount))
        })

        describe('when paused', () => {
          let amount = holoWeiToWei(tokenSupply / 20)
          beforeEach(() => {
            return sale.pause()
          })

          contractShouldThrow('it should not work even when amount is right', () => {
            return web3.eth.sendTransaction({
              to: sale.address,
              value: amount,
              from: tokenBuyer1,
              gas: 4000000
            })
          })

          describe('one should be able to unpause', () => {
            beforeEach(async () => {
              await sale.unpause()
              walletBalanceBefore = await web3.eth.getBalance(wallet)
              return web3.eth.sendTransaction({
                to: sale.address,
                value: amount,
                from: tokenBuyer1,
                gas: 4000000
              })
            })

            describe('[should do sale]', buyFuel(amount))
          })
        })

        describe('with too much ETH (over 10% of supply)', () => {
          let tenPercent = tokenSupply / 10
          let amount = holoWeiToWei(tenPercent) + 100

          contractShouldThrow('it should not accept the transaction', () => {
            return web3.eth.sendTransaction({
              to: sale.address,
              value: amount,
              from: tokenBuyer1,
              gas: 4000000
            })
          })
        })

        describe('with too less ETH (< 0.1ETH)', () => {
          let amount = web3.toWei(99, 'finney')
          let walletBalanceBefore

          contractShouldThrow('it should not accept the transaction', () => {
            return web3.eth.sendTransaction({
              to: sale.address,
              value: amount,
              from: tokenBuyer1,
              gas: 4000000
            })
          })
        })
      })

      describe('after 50% of day supply sold', () => {
        let walletBalanceBefore

        beforeEach(async () => {
          let tenPercent = tokenSupply / 10
          let weiAmount = holoWeiToWei(tenPercent)
          await sale.buyFuel(tokenBuyer1, {value: weiAmount, from: tokenBuyer1})
          await sale.buyFuel(tokenBuyer2, {value: weiAmount, from: tokenBuyer2})
          await sale.buyFuel(tokenBuyer3, {value: weiAmount, from: tokenBuyer3})
          await sale.buyFuel(tokenBuyer4, {value: weiAmount, from: tokenBuyer4})
          await sale.buyFuel(tokenBuyer5, {value: weiAmount, from: tokenBuyer5})
        })

        it('daily stats should show correct amount of sold receipts', async () => {
          let stats = await sale.statsByDay(0)
          expect(stats[1].toNumber()).to.equal(tokenSupply / 2)
        })

        it('token contract should have minted the correct amount', async () => {
          let tokenMinted = await token.totalSupply()
          expect(tokenMinted.toNumber()).to.equal(tokenSupply / 2)
        })

        it('update should create a new day and carry over non-sold tokens', async () => {
          // 10 new tokens in supply
          supply_contract.addTokens(tokenSupply)
          assert(await supply_contract.total_supply() == 2*tokenSupply)
          await sale.update({from: updater})
          let day = await sale.currentDay.call()
          expect(day.toNumber()).to.equal(2)
          let stats = await sale.statsByDay(1)
          // the 10 new plus the 5 unsold from yesterday
          expect(stats[0].toNumber()).to.equal(tokenSupply*3/2)
          expect(stats[1].toNumber()).to.equal(0)
        })

        describe('after 95% of day supply sold', () => {
          beforeEach(async () => {
            let tenPercent = tokenSupply / 10
            let weiAmount = holoWeiToWei(tenPercent)
            await sale.buyFuel(tokenBuyer1, {value: weiAmount, from: tokenBuyer1})
            await sale.buyFuel(tokenBuyer2, {value: weiAmount, from: tokenBuyer2})
            await sale.buyFuel(tokenBuyer3, {value: weiAmount, from: tokenBuyer3})
            await sale.buyFuel(tokenBuyer4, {value: weiAmount, from: tokenBuyer4})
            await sale.buyFuel(tokenBuyer5, {value: weiAmount / 2, from: tokenBuyer5})
          })

          it('daily stats should show correct amount of sold receipts', async () => {
            let stats = await sale.statsByDay(0)
            let percent95 = new BigNumber(tokenSupply).times(95).dividedBy(100)
            expect(stats[1].toNumber()).to.equal(percent95.toNumber())
          })

          it('token contract should have minted the correct amount', async () => {
            let tokenMinted = await token.totalSupply()
            let percent95 = new BigNumber(tokenSupply).times(95).dividedBy(100)
            expect(tokenMinted.toNumber()).to.equal(percent95.toNumber())
          })

          contractShouldThrow('buyer should not be able to buy more than supply', () => {
            let tenPercent = tokenSupply / 10
            let amount = holoWeiToWei(tenPercent)
            return sale.buyFuel(tokenBuyer4, {value: amount, from: tokenBuyer4})
          })
        })
      })
    })
  })
})
