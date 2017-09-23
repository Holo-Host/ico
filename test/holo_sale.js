import {expect} from 'chai'
var BigNumber = require('bignumber.js');

const HoloSale = artifacts.require('./HoloSale.sol')
const HoloSupply = artifacts.require('./HoloSupply.sol')
const HoloReceipt = artifacts.require('./HoloReceipt.sol')

import {
  contractShouldThrow,
  firstEvent
} from './testHelper'

contract('HoloSale', (accounts) => {
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
  let supply_contract
  let receipt

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
    sale = await HoloSale.new(web3.eth.blockNumber + 10, 1000, rate, min, maxPercent, wallet)
    supply_contract = await HoloSupply.new()
    receipt = await HoloReceipt.new()
    await receipt.setMinter(sale.address)
    await sale.setSupplyContract(supply_contract.address)
    await sale.setReceiptContract(receipt.address)
    await sale.setUpdater(updater)
  })

  contractShouldThrow('buyFuel should throw if called before sale started', async () => {
      return sale.buyFuel(buyer1, {value: 100, from: buyer1})
  })

  contractShouldThrow('should not take money before sale started', async () => {
    await web3.eth.sendTransaction({
      to: sale.address,
      value: web3.toWei(2, 'ether'),
      from: buyer1,
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
        return sale.buyFuel(buyer1, {from: buyer1, value: web3.toWei(2, 'ether')})
      })
    })

    describe('default function', () => {
      contractShouldThrow('should throw if called before first initial update', () => {
        return web3.eth.sendTransaction({
          to: sale.address,
          value: web3.toWei(2, 'ether'),
          from: buyer1,
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
      let supply = web3.toWei(25, 'ether') / 1

      beforeEach(async () => {
        await supply_contract.addTokens(supply)
        assert(await supply_contract.totalSupply() == supply)
        await sale.update({from: updater})
      })

      it('stats should contain the first day', async () => {
        let day = await sale.currentDay.call();
        expect(day.toNumber()).to.equal(1)
        let stats = await sale.statsByDay(0)
        expect(stats[0].toNumber()).to.equal(supply)
        expect(stats[1].toNumber()).to.equal(0)
      })

      let buyFuel = (amount) => {
        return () => {
          it('should have added the amount of sold Holos to the stats', async () => {
            let stats = await sale.statsByDay(0)
            expect(stats[0].toNumber()).to.equal(supply)
            expect(stats[1].toNumber()).to.equal(weiToHoloWei(amount))
          })

          it('should have created the correct amount of Holo Receipts', async () => {
            let amountReceipts = await receipt.balanceOf(buyer1)
            expect(amountReceipts.toNumber()).to.equal(weiToHoloWei(amount))
          })

          it('should have created an event', async () => {
            let log = await firstEvent(sale.ReceiptCreated())
            expect(log.args.beneficiary).to.equal(buyer1)
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
          let amount = holoWeiToWei(supply / 20)

          beforeEach(async () => {
            walletBalanceBefore = await web3.eth.getBalance(wallet)
            return sale.buyFuel(buyer1, {value: amount})
          })

          describe('[should do sale]', buyFuel(amount))
        })

        describe('when paused', () => {
          let amount = holoWeiToWei(supply / 20)
          beforeEach(() => {
            return sale.pause()
          })

          contractShouldThrow('it should not work even when amount is right', () => {
            return sale.buyFuel(buyer1, {value: amount})
          })

          describe('one should be able to unpause', () => {
            beforeEach(async () => {
              await sale.unpause()
              walletBalanceBefore = await web3.eth.getBalance(wallet)
              return sale.buyFuel(buyer1, {value: amount})
            })

            describe('[should do sale]', buyFuel(amount))
          })
        })

        describe('with too much ETH (over 10% of supply)', () => {
          let tenPercent = supply / 9
          let amount = holoWeiToWei(tenPercent)

          contractShouldThrow('it should not accept the transaction', () => {
            return sale.buyFuel(buyer1, {value: amount})
          })
        })

        describe('with too less ETH (< 0.1ETH)', () => {
          let amount = web3.toWei(99, 'finney')
          let walletBalanceBefore

          contractShouldThrow('it should not accept the transaction', () => {
            return sale.buyFuel(buyer1, {value: amount})
          })
        })
      })

      describe('default function', () => {
        describe('with the right amount of ETH', () => {
          let amount = holoWeiToWei(supply / 20)

          beforeEach(async () => {
            walletBalanceBefore = web3.eth.getBalance(wallet)
            return web3.eth.sendTransaction({
              to: sale.address,
              value: amount,
              from: buyer1,
              gas: 4000000
            })
          })

          describe('[should do sale]', buyFuel(amount))
        })

        describe('when paused', () => {
          let amount = holoWeiToWei(supply / 20)
          beforeEach(() => {
            return sale.pause()
          })

          contractShouldThrow('it should not work even when amount is right', () => {
            return web3.eth.sendTransaction({
              to: sale.address,
              value: amount,
              from: buyer1,
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
                from: buyer1,
                gas: 4000000
              })
            })

            describe('[should do sale]', buyFuel(amount))
          })
        })

        describe('with too much ETH (over 10% of supply)', () => {
          let tenPercent = supply / 10
          let amount = holoWeiToWei(tenPercent) + 100

          contractShouldThrow('it should not accept the transaction', () => {
            return web3.eth.sendTransaction({
              to: sale.address,
              value: amount,
              from: buyer1,
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
              from: buyer1,
              gas: 4000000
            })
          })
        })
      })

      describe('after 50% of day supply sold', () => {
        let walletBalanceBefore

        beforeEach(async () => {
          let tenPercent = supply / 10
          let weiAmount = holoWeiToWei(tenPercent)
          await sale.buyFuel(buyer1, {value: weiAmount, from: buyer1})
          await sale.buyFuel(buyer2, {value: weiAmount, from: buyer2})
          await sale.buyFuel(buyer3, {value: weiAmount, from: buyer3})
          await sale.buyFuel(buyer4, {value: weiAmount, from: buyer4})
          await sale.buyFuel(buyer5, {value: weiAmount, from: buyer5})
        })

        it('daily stats should show correct amount of sold receipts', async () => {
          let stats = await sale.statsByDay(0)
          expect(stats[1].toNumber()).to.equal(supply / 2)
        })

        it('receipt contract should have minted the correct amount', async () => {
          let receiptMinted = await receipt.totalSupply()
          expect(receiptMinted.toNumber()).to.equal(supply / 2)
        })

        it('update should create a new day and carry over non-sold fuel', async () => {
          // 10 new fuel units in supply
          supply_contract.addTokens(supply)
          assert(await supply_contract.totalSupply() == 2*supply)
          await sale.update({from: updater})
          let day = await sale.currentDay.call()
          expect(day.toNumber()).to.equal(2)
          let stats = await sale.statsByDay(1)
          // the 10 new plus the 5 unsold from yesterday
          expect(stats[0].toNumber()).to.equal(supply*3/2)
          expect(stats[1].toNumber()).to.equal(0)
        })

        describe('after 95% of day supply sold', () => {
          beforeEach(async () => {
            let tenPercent = supply / 10
            let weiAmount = holoWeiToWei(tenPercent)
            await sale.buyFuel(buyer1, {value: weiAmount, from: buyer1})
            await sale.buyFuel(buyer2, {value: weiAmount, from: buyer2})
            await sale.buyFuel(buyer3, {value: weiAmount, from: buyer3})
            await sale.buyFuel(buyer4, {value: weiAmount, from: buyer4})
            await sale.buyFuel(buyer5, {value: weiAmount / 2, from: buyer5})
          })

          it('daily stats should show correct amount of sold receipts', async () => {
            let stats = await sale.statsByDay(0)
            let percent95 = new BigNumber(supply).times(95).dividedBy(100)
            expect(stats[1].toNumber()).to.equal(percent95.toNumber())
          })

          it('receipt contract should have minted the correct amount', async () => {
            let receiptMinted = await receipt.totalSupply()
            let percent95 = new BigNumber(supply).times(95).dividedBy(100)
            expect(receiptMinted.toNumber()).to.equal(percent95.toNumber())
          })

          contractShouldThrow('buyer should not be able to buy more than supply', () => {
            let tenPercent = supply / 10
            let amount = holoWeiToWei(tenPercent)
            return sale.buyFuel(buyer4, {value: amount, from: buyer4})
          })
        })
      })
    })
  })
})
