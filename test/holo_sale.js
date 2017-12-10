import {expect} from 'chai'
var BigNumber = require('bignumber.js');

const HoloSale = artifacts.require('./HoloSale.sol')
const HoloToken = artifacts.require('./HoloToken.sol')
const HoloWhitelist = artifacts.require('./HoloWhitelist.sol')

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
  let anonymous = accounts[8]
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

  beforeEach(async () => {
    let min = web3.toWei(100, 'finney')
    let maxPercent = 20;
    sale = await HoloSale.new(web3.eth.blockNumber + 10, web3.eth.blockNumber + 500, rate, min, maxPercent, wallet)
    token = await HoloToken.new()
    whitelist_contract = await HoloWhitelist.new()
    await token.setMinter(sale.address)
    await sale.setTokenContract(token.address)
    await sale.setWhitelistContract(whitelist_contract.address)
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
        return sale.update(0,0)
      })

      it('should not throw when called by updater', () => {
        return sale.update(0,0,{from: updater})
      })
    })

    describe('after first update', () => {
      let walletBalanceBefore
      let supply = web3.toWei(30, 'ether') / 1

      beforeEach(async () => {
        await sale.update(supply, 0, {from: updater})
      })

      it('stats should contain the first day', async () => {
        let day = await sale.currentDay.call();
        expect(day.toNumber()).to.equal(1)
        let stats = await sale.statsByDay(0)
        expect(stats[0].toNumber()).to.equal(supply)
        expect(stats[1].toNumber()).to.equal(0)
      })

      it('todaysSupply() should be correct', async () => {
        let todaysSupply = await sale.todaysSupply.call()
        expect(todaysSupply.toNumber()).to.equal(supply)
      })

      it('todaySold() should start off with 0', async () => {
        let todaySold = await sale.todaySold.call()
        expect(todaySold.toNumber()).to.equal(0)
      })

      it('todayReserved() should be correct', async () => {
        let todayReserved = await sale.todayReserved.call()
        expect(todayReserved.toNumber()).to.equal(0)
      })

      let buyFuel = (amount, beneficiary = buyer1) => {
        return () => {
          it('should have added the amount of sold Holos to the stats', async () => {
            let stats = await sale.statsByDay(0)
            expect(stats[0].toNumber()).to.equal(supply)
            expect(stats[1].toNumber()).to.equal(weiToHoloWei(amount))
          })

          it('should have created the correct amount of Holo Receipts', async () => {
            let amountReceipts = await token.balanceOf(beneficiary)
            expect(amountReceipts.toNumber()).to.equal(weiToHoloWei(amount))
          })

          it('should have created an event', async () => {
            let log = await firstEvent(sale.CreditsCreated())
            expect(log.args.beneficiary).to.equal(beneficiary)
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
        describe('when whitelisted', () => {
          beforeEach(() => {
            return whitelist_contract.whitelist([buyer1])
          })

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

        describe('when not whitelisted', () => {
          let amount = holoWeiToWei(supply / 20)
          contractShouldThrow('it should not work even when amount is right', () => {
            return sale.buyFuel(anonymous, {value: amount})
          })

          describe('but after whitelisting', () => {
            beforeEach(async () => {
              await whitelist_contract.whitelist([anonymous])
              return sale.buyFuel(anonymous, {value: amount})
            })

            describe('[should do sale]',buyFuel(amount, anonymous))
          })
        })

      })

      describe('default function', () => {
        describe('when whitelisted', () => {
          beforeEach(() => {
            return whitelist_contract.whitelist([buyer1])
          })
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

        describe('when not whitelisted', () => {
          let amount = holoWeiToWei(supply / 20)
          contractShouldThrow('it should not work even when amount is right', () => {
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
          supplyAvailableForSale = await sale.totalSupply.call()
          let twentyPercent = supplyAvailableForSale.toNumber() / 5
          let weiAmount = holoWeiToWei(twentyPercent)
          await whitelist_contract.whitelist([buyer1, buyer2,buyer3])
          await sale.buyFuel(buyer1, {value: weiAmount, from: buyer1})
          await sale.buyFuel(buyer2, {value: weiAmount, from: buyer2})
          await sale.buyFuel(buyer3, {value: weiAmount, from: buyer3})
          sixtyPercent = new BigNumber(supply).times(6).dividedBy(10).toNumber()
        })

        contractShouldThrow('buyer1 should not be able to buy more fuel today because he got 20% already', () => {
          let weiAmount = holoWeiToWei(supplyAvailableForSale.toNumber() / 10)
          return sale.buyFuel(buyer1, {value: weiAmount, from: buyer1})
        })

        it('daily stats should show correct amount of sold credits', async () => {
          let stats = await sale.statsByDay(0)
          expect(stats[1].toNumber()).to.equal(sixtyPercent)
        })

        it('todaysSupply should not be changed', async () => {
          let todaysSupply = await sale.todaysSupply.call()
          expect(todaysSupply.toNumber()).to.equal(supply)
        })

        it('todaySold should return those 60%', async () => {
          let todaySold = await sale.todaySold.call()
          expect(todaySold.toNumber()).to.equal(sixtyPercent)
        })

        it('token contract should have minted the correct amount', async () => {
          let creditsMinted = await token.totalSupply()
          expect(creditsMinted.toNumber()).to.equal(sixtyPercent)
        })

        it('update should create a new day and carry over non-sold fuel', async () => {
          // double available fuel
          await sale.update(supply * 2, 0, {from: updater})
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
            let supplyAvailableForSale = await sale.totalSupply.call()
            let twentyPercent = supplyAvailableForSale.toNumber() / 5
            let tenPercent = supplyAvailableForSale.toNumber() / 10
            let weiAmount = holoWeiToWei(twentyPercent)
            await whitelist_contract.whitelist([buyer4, buyer5, buyer6])
            await sale.buyFuel(buyer4, {value: weiAmount, from: buyer4})
            weiAmount = holoWeiToWei(tenPercent)
            await sale.buyFuel(buyer5, {value: weiAmount, from: buyer5})
            percent90 = new BigNumber(supply).times(90).dividedBy(100).toNumber()
          })

          it('daily stats should show correct amount of sold credits', async () => {
            let stats = await sale.statsByDay(0)
            expect(stats[1].toNumber()).to.equal(percent90)
          })

          it('token contract should have minted the correct amount', async () => {
            let creditsMinted = await token.totalSupply()
            expect(creditsMinted.toNumber()).to.equal(percent90)
          })

          contractShouldThrow('buyer should not be able to buy more than supply', () => {
            let twentyPercent = supplyAvailableForSale.toNumber() / 5
            let amount = holoWeiToWei(twentyPercent)
            return sale.buyFuel(buyer6, {value: amount, from: buyer6})
          })

          describe('on the next day with more supply', () => {
            beforeEach(async () => {
              await sale.update(supply * 3, 0, {from: updater})
            })

            it('buyer1 should be able to buy fuel again', async () => {
              let weiAmount = holoWeiToWei(supplyAvailableForSale.toNumber() / 10)
              let fuelBefore = await token.balanceOf(buyer1)
              await sale.buyFuel(buyer1, {value: weiAmount, from: buyer1})
              let fuelAfter = await token.balanceOf(buyer1)
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

              let mintingFinished = await token.mintingFinished.call()
              expect(mintingFinished).to.equal(false)

              await sale.finalize()

              let teamBalance = await token.balanceOf(wallet)
              let allTokens = await token.totalSupply()
              expect(teamBalance.toNumber()).to.equal(new BigNumber(allTokens).times(25).dividedBy(100).toNumber())
              mintingFinished = await token.mintingFinished.call()
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
