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
  let buyer1 = accounts[1]
  let buyer2 = accounts[2]
  let buyer3 = accounts[3]
  let buyer4 = accounts[4]
  let buyer5 = accounts[5]
  let buyer6 = accounts[6]
  let buyer7 = accounts[7]
  let buyer8 = accounts[8]
  let buyer9 = accounts[9]
  let buyer10 = accounts[0]
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
    let maxPercent = 20;
    sale = await HoloSale.new(web3.eth.blockNumber + 10, web3.eth.blockNumber + 500, rate, min, maxPercent, wallet)
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
      let supply = web3.toWei(30, 'ether') / 1

      beforeEach(async () => {
        let supplyForSale = supply
        let totalSupply = new BigNumber(supplyForSale).times(4).dividedBy(3)
        await supply_contract.addTokens(totalSupply)
        let _supplyForSale = await supply_contract.supplyAvailableForSale.call()
        expect(_supplyForSale.toNumber()).to.equal(supplyForSale)
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
            let log = await firstEvent(sale.ReceiptsCreated())
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

        describe('with too much ETH (over 20% of supply)', () => {
          let quarter = supply / 4
          let amount = holoWeiToWei(quarter)

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

        describe('with too much ETH (over 20% of supply)', () => {
          let quarter = supply / 4
          let amount = holoWeiToWei(quarter) + 100

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

      describe('after 60% of day supply sold', () => {
        let walletBalanceBefore
        let sixtyPercent
        let supplyAvailableForSale

        beforeEach(async () => {
          supplyAvailableForSale = await supply_contract.supplyAvailableForSale.call()
          let twentyPercent = supplyAvailableForSale.toNumber() / 5
          let weiAmount = holoWeiToWei(twentyPercent)
          await sale.buyFuel(buyer1, {value: weiAmount, from: buyer1})
          await sale.buyFuel(buyer2, {value: weiAmount, from: buyer2})
          await sale.buyFuel(buyer3, {value: weiAmount, from: buyer3})
          sixtyPercent = new BigNumber(supply).times(6).dividedBy(10).toNumber()
        })

        contractShouldThrow('buyer1 should not be able to buy more coins today because he got 20% already', () => {
          let weiAmount = holoWeiToWei(supplyAvailableForSale.toNumber() / 10)
          return sale.buyFuel(buyer1, {value: weiAmount, from: buyer1})
        })

        it('daily stats should show correct amount of sold receipts', async () => {
          let stats = await sale.statsByDay(0)
          expect(stats[1].toNumber()).to.equal(sixtyPercent)
        })

        it('receipt contract should have minted the correct amount', async () => {
          let receiptMinted = await receipt.totalSupply()
          expect(receiptMinted.toNumber()).to.equal(sixtyPercent)
        })

        it('update should create a new day and carry over non-sold fuel', async () => {
          // double available fuel
          let totalSupply = await supply_contract.totalSupply()
          await supply_contract.addTokens(totalSupply)
          let supplyAvailableForSale = await supply_contract.supplyAvailableForSale.call()
          expect(supplyAvailableForSale.toNumber()).to.equal(2*supply)
          //assert(await supply_contract.supplyAvailableForSale() == 2*supply)
          await sale.update({from: updater})
          let day = await sale.currentDay.call()
          expect(day.toNumber()).to.equal(2)
          let stats = await sale.statsByDay(1)
          // the new full supply plus 40% from yesterday
          expect(stats[0].toNumber()).to.equal(supply*140/100)
          expect(stats[1].toNumber()).to.equal(0)
        })

        describe('after 90% of day supply sold', () => {
          let percent90
          beforeEach(async () => {
            let supplyAvailableForSale = await supply_contract.supplyAvailableForSale.call()
            let twentyPercent = supplyAvailableForSale.toNumber() / 5
            let tenPercent = supplyAvailableForSale.toNumber() / 10
            let weiAmount = holoWeiToWei(twentyPercent)
            await sale.buyFuel(buyer4, {value: weiAmount, from: buyer4})
            weiAmount = holoWeiToWei(tenPercent)
            await sale.buyFuel(buyer5, {value: weiAmount, from: buyer5})
            percent90 = new BigNumber(supply).times(90).dividedBy(100).toNumber()
          })

          it('daily stats should show correct amount of sold receipts', async () => {
            let stats = await sale.statsByDay(0)
            expect(stats[1].toNumber()).to.equal(percent90)
          })

          it('receipt contract should have minted the correct amount', async () => {
            let receiptMinted = await receipt.totalSupply()
            expect(receiptMinted.toNumber()).to.equal(percent90)
          })

          contractShouldThrow('buyer should not be able to buy more than supply', () => {
            let twentyPercent = supplyAvailableForSale.toNumber() / 5
            let amount = holoWeiToWei(twentyPercent)
            return sale.buyFuel(buyer6, {value: amount, from: buyer6})
          })

          describe('on the next day', () => {
            beforeEach(async () => {
              let supplyForSale = supply
              let totalSupply = new BigNumber(supplyForSale).times(4).dividedBy(3)
              await supply_contract.addTokens(totalSupply)
              let _supplyForSale = await supply_contract.supplyAvailableForSale.call()
              expect(_supplyForSale.toNumber()).to.equal(2*supplyForSale)
              await sale.update({from: updater})
            })

            it('buyer1 should be able to buy fuel again', async () => {
              let weiAmount = holoWeiToWei(supplyAvailableForSale.toNumber() / 10)
              let fuelBefore = await receipt.balanceOf(buyer1)
              await sale.buyFuel(buyer1, {value: weiAmount, from: buyer1})
              let fuelAfter = await receipt.balanceOf(buyer1)
              expect(fuelAfter.toNumber()).to.be.above(fuelBefore.toNumber())
            })
          })

          describe('finalize', () => {
            contractShouldThrow('should not be callable if sale has not ended', () => {
              return sale.finalize();
            })

            it('should have minted the 25% for the team and finish minting period', async () => {
              // forward testrpcs blocknumber
              for(let i=0; i<501; i++) {
                await sale.setUpdater(updater);
              }

              let mintingFinished = await receipt.mintingFinished.call()
              expect(mintingFinished).to.equal(false)

              await sale.finalize()

              let teamBalance = await receipt.balanceOf(wallet)
              let allTokens = await receipt.totalSupply()
              expect(teamBalance.toNumber()).to.equal(new BigNumber(allTokens).times(25).dividedBy(100).toNumber())
              mintingFinished = await receipt.mintingFinished.call()
              expect(mintingFinished).to.equal(true)
            })

            contractShouldThrow('should not be callable again', () => {
              return sale.finalize()
            })
          })
        })
      })
    })
  })
})
