import {expect} from 'chai'

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

  beforeEach(async () => {
    sale = await HoloTokenSale.new(web3.eth.blockNumber + 10, 1000, 1, wallet)
    supply_contract = await HoloTokenSupply.new()
    token = await HoloToken.new()
    await token.setMinter(sale.address)
    await sale.setSupplyContract(supply_contract.address)
    await sale.setTokenContract(token.address)
    await sale.setUpdater(updater)
  })

  describe('buyTokens', () => {
    contractShouldThrow('should throw if called before ICO started', async () => {
        return sale.buyTokens(tokenBuyer1, {value: 100, from: tokenBuyer1})
    })

    describe('after starting block', () => {
      beforeEach(async () => {
        // create three blocks (testRPC creates a block for every transaction)
        for(let i=0; i<10; i++) {
          await sale.setUpdater(updater)
        }
      })

      it('should add an ask correctly when eth is sent to it', async () => {
        let twoEther = web3.toWei(2, 'ether')

        let demand = await sale.demand()
        expect(demand.toNumber()).to.equal(0)

        await web3.eth.sendTransaction({
          to: sale.address,
          value: twoEther,
          from: tokenBuyer1,
          gas: 4000000
        })
        let log = await firstEvent(sale.AskAdded())
        expect(log.args.purchaser).to.equal(tokenBuyer1)
        expect(log.args.beneficiary).to.equal(tokenBuyer1)
        expect(log.args.value.toString()).to.equal(twoEther)
        expect(log.args.amount.toString()).to.equal(web3.toWei(2, 'ether'))
        let escrowOfBuyer1 = await sale.inEscrowFor.call(tokenBuyer1)
        expect(escrowOfBuyer1.toString()).to.equal(twoEther)
        let beneficiaries = await sale.beneficiaries(0)
        expect(beneficiaries).to.equal(tokenBuyer1)
        demand = await sale.demand()
        expect(demand.toString()).to.equal(web3.toWei(2, 'ether'))

        await web3.eth.sendTransaction({
          to: sale.address,
          value: twoEther,
          from: tokenBuyer2,
          gas: 4000000
        })
        log = await firstEvent(sale.AskAdded())
        expect(log.args.purchaser).to.equal(tokenBuyer2)
        expect(log.args.beneficiary).to.equal(tokenBuyer2)
        expect(log.args.value.toString()).to.equal(twoEther)
        expect(log.args.amount.toString()).to.equal(web3.toWei(2, 'ether'))
        escrowOfBuyer1 = await sale.inEscrowFor.call(tokenBuyer1)
        let escrowOfBuyer2 = await sale.inEscrowFor.call(tokenBuyer2)
        beneficiaries = await sale.beneficiaries(1)
        demand = await sale.demand()

        expect(escrowOfBuyer1.toString()).to.equal(twoEther)
        expect(escrowOfBuyer2.toString()).to.equal(twoEther)
        expect(beneficiaries).to.equal(tokenBuyer2)
        expect(demand.toString()).to.equal(web3.toWei(4, 'ether'))
      })

      describe('after three token purchases', () => {
        beforeEach(async () => {
          await sale.buyTokens(tokenBuyer1, {value: web3.toWei(2, 'ether'), from: tokenBuyer1})
          await sale.buyTokens(tokenBuyer2, {value: web3.toWei(5, 'ether'), from: tokenBuyer2})
          await sale.buyTokens(tokenBuyer3, {value: web3.toWei(1, 'ether'), from: tokenBuyer3})
        })

        it('should have 3 beneficiaries asks', async () => {
          let beneficiariesLength = await sale.beneficiariesLength.call()
          expect(beneficiariesLength.toNumber()).to.equal(3)
        })

        it('should have a demand of 8', async () => {
          let demand = await sale.demand.call()
          expect(demand.toString()).to.equal(web3.toWei(8, 'ether'))
        })

        it('buyTokens should not add a beneficiary to the list of beneficiaries twice', async () => {
          await sale.buyTokens(tokenBuyer1, {value: web3.toWei(2, 'ether'), from: tokenBuyer1})
          let beneficiariesLength = await sale.beneficiariesLength.call()
          expect(beneficiariesLength.toNumber()).to.equal(3)
        })

        describe('withdraw', () => {
          it('should send back the deposited ether', async () => {
            let gasCost = 3766299999993900;

            let before = await web3.eth.getBalance(tokenBuyer1)
            await sale.withdraw({from: tokenBuyer1})
            let escrow = await sale.inEscrowFor.call(tokenBuyer1)
            expect(escrow.toNumber()).to.equal(0)
            let after = await web3.eth.getBalance(tokenBuyer1)
            let differenceWei = (after.toNumber() - before.toNumber())
            expect(differenceWei + gasCost + 100000).to.be.at.least(2000000000000000000)

            before = await web3.eth.getBalance(tokenBuyer2)
            await sale.withdraw({from: tokenBuyer2})
            escrow = await sale.inEscrowFor.call(tokenBuyer2)
            expect(escrow.toNumber()).to.equal(0)
            after = await web3.eth.getBalance(tokenBuyer2)
            differenceWei = (after.toNumber() - before.toNumber())
            expect(differenceWei + gasCost + 100000).to.be.at.least(5000000000000000000)

            before = await web3.eth.getBalance(tokenBuyer3)
            await sale.withdraw({from: tokenBuyer3})
            escrow = await sale.inEscrowFor.call(tokenBuyer3)
            expect(escrow.toNumber()).to.equal(0)
            after = await web3.eth.getBalance(tokenBuyer3)
            differenceWei = (after.toNumber() - before.toNumber())
            expect(differenceWei + gasCost + 100000).to.be.at.least(1000000000000000000)
          })

          it('should delete the caller from the beneficiaries list', async () => {
            let countBefore = await sale.beneficiariesLength.call()
            await sale.withdraw({from: tokenBuyer1})
            let countAfter = await sale.beneficiariesLength.call()
            expect(countBefore - countAfter).to.equal(1)
            for(let i=0; i<countAfter; i++) {
              let b = sale.beneficiaries.call(i)
              expect(b).to.not.equal(tokenBuyer1)
            }
          })

          it('should delete the caller from the beneficiaries list even if they send tokens multiple times', async () => {
            await sale.buyTokens(tokenBuyer1, {value: web3.toWei(200, 'finney'), from: tokenBuyer1})
            await sale.buyTokens(tokenBuyer1, {value: web3.toWei(200, 'finney'), from: tokenBuyer1})
            let countBefore = await sale.beneficiariesLength.call()
            await sale.withdraw({from: tokenBuyer1})
            let countAfter = await sale.beneficiariesLength.call()
            expect(countBefore - countAfter).to.equal(1)
            for(let i=0; i<countAfter; i++) {
              let b = await sale.beneficiaries.call(i)
              expect(b).to.not.equal(tokenBuyer1)
            }
          })

          it('should reduce the sale contracts balance by the amount that was in escrow', async () => {
            let before = await web3.eth.getBalance(sale.address)
            let escrow = await sale.inEscrowFor.call(tokenBuyer2)
            expect(escrow.toString()).to.equal(web3.toWei(5, 'ether'))
            await sale.withdraw({from: tokenBuyer2})
            let after = await web3.eth.getBalance(sale.address)
            expect(after.toNumber()).to.equal(before.toNumber() - escrow.toNumber())
          })
        })

        describe('withdrawFor', () => {
          contractShouldThrow('should not be callable by non-owner', async () => {
            await sale.withdrawFor(tokenBuyer1, {from: tokenBuyer2})
          })

          it('should send back deposited ether to mentioned buyer', async () => {
            let gasCost = 3766299999993900;

            let before = await web3.eth.getBalance(tokenBuyer1)
            await sale.withdrawFor(tokenBuyer1, {from: owner})
            let escrow = await sale.inEscrowFor.call(tokenBuyer1)
            expect(escrow.toNumber()).to.equal(0)
            let after = await web3.eth.getBalance(tokenBuyer1)
            let differenceWei = (after.toNumber() - before.toNumber())
            expect(differenceWei + gasCost + 1).to.be.at.least(2000000000000000000)
          })
        })

        contractShouldThrow('should throw if nothing in escrow for beneficiary', async () => {
          await sale.withdraw({from: updater})
        })

        contractShouldThrow('should throw if already withdrawn', async () => {
          await sale.withdraw({from: tokenBuyer1})
          assert(true)
          await sale.withdraw({from: tokenBuyer1})
        })


        describe('after update with enough supply', () => {
          let walletBalanceBefore

          beforeEach(async () => {
            await supply_contract.addTokens(web3.toWei(10, 'ether'))
            assert(await supply_contract.total_supply() == 10000000000000000000)

            let escrow1 = await sale.inEscrowFor.call(tokenBuyer1)
            let escrow2 = await sale.inEscrowFor.call(tokenBuyer2)
            let escrow3 = await sale.inEscrowFor.call(tokenBuyer3)
            assert(escrow1 == 2000000000000000000)
            assert(escrow2 == 5000000000000000000)
            assert(escrow3 == 1000000000000000000)

            let demand = await sale.demand()
            assert(demand == 8000000000000000000)

            walletBalanceBefore = web3.eth.getBalance(wallet)

            await sale.update({from: updater})
          })

          it('should have minted the tokens for everybody', async () => {
            let balance1 = await token.balanceOf(tokenBuyer1)
            let balance2 = await token.balanceOf(tokenBuyer2)
            let balance3 = await token.balanceOf(tokenBuyer3)
            expect(balance1.toString()).to.equal(web3.toWei(2, 'ether'))
            expect(balance2.toString()).to.equal(web3.toWei(5, 'ether'))
            expect(balance3.toString()).to.equal(web3.toWei(1, 'ether'))
          })

          it('should have resetted the demand to 0', async () => {
            let demand = await sale.demand.call()
            expect(demand.toNumber()).to.equal(0)
          })

          it('should have resetted the "beneficiaries" list', async () => {
            let beneficiariesLength = await sale.beneficiariesLength.call()
            expect(beneficiariesLength.toNumber()).to.equal(0)
          })

          it('should have resetted the escrows for all buyers', async () => {
            let escrow1 = await sale.inEscrowFor.call(tokenBuyer1)
            let escrow2 = await sale.inEscrowFor.call(tokenBuyer2)
            let escrow3 = await sale.inEscrowFor.call(tokenBuyer3)
            expect(escrow1.toNumber()).to.equal(0)
            expect(escrow2.toNumber()).to.equal(0)
            expect(escrow3.toNumber()).to.equal(0)
          })

          it('should have sent the ethers to the wallet', async () => {
            let walletBalance = await web3.eth.getBalance(wallet)
            let walletDifference = walletBalance.toNumber() - walletBalanceBefore;
            expect(''+walletDifference).to.equal(web3.toWei(8, 'ether'))
          })

          it('token should have a matching total supply', async () => {
            let totalSupply = await token.totalSupply()
            expect(totalSupply.toString()).to.equal(web3.toWei(8, 'ether'))
          })

          describe('on the second day with double demand than supply', () => {
            beforeEach(async () => {
              await supply_contract.addTokens(web3.toWei(2, 'ether'))
              assert(await supply_contract.total_supply() == 12000000000000000000)
              await sale.buyTokens(tokenBuyer4, {value: web3.toWei(2, 'ether'), from: tokenBuyer4})
              await sale.buyTokens(tokenBuyer5, {value: web3.toWei(5, 'ether'), from: tokenBuyer5})
              await sale.buyTokens(tokenBuyer6, {value: web3.toWei(1, 'ether'), from: tokenBuyer6})

              let demand = await sale.demand()
              assert(demand == 8000000000000000000)

              walletBalanceBefore = web3.eth.getBalance(wallet)

              await sale.update({from: updater})
            })

            it('should have minted half of the asked tokens', async () => {
              let balance1 = await token.balanceOf(tokenBuyer4)
              let balance2 = await token.balanceOf(tokenBuyer5)
              let balance3 = await token.balanceOf(tokenBuyer6)
              expect(balance1.toString()).to.equal(web3.toWei(1, 'ether'))
              expect(balance2.toString()).to.equal(web3.toWei(2500, 'finney'))
              expect(balance3.toString()).to.equal(web3.toWei(500, 'finney'))
            })

            it('should have left half of the demand there', async () => {
              let demand = await sale.demand.call()
              expect(demand.toString()).to.equal(web3.toWei(4, 'ether'))
            })

            it('should have left the "beneficiaries" list as is', async () => {
              let beneficiariesLength = await sale.beneficiariesLength.call()
              expect(beneficiariesLength.toNumber()).to.equal(3)
            })

            it('should have left half the ethers in escrows for all buyers', async () => {
              let escrow1 = await sale.inEscrowFor.call(tokenBuyer4)
              let escrow2 = await sale.inEscrowFor.call(tokenBuyer5)
              let escrow3 = await sale.inEscrowFor.call(tokenBuyer6)
              expect(escrow1.toString()).to.equal(web3.toWei(1, 'ether'))
              expect(escrow2.toString()).to.equal(web3.toWei(2500, 'finney'))
              expect(escrow3.toString()).to.equal(web3.toWei(500, 'finney'))
            })

            it('should have sent the spent ethers to the wallet', async () => {
              let walletBalance = await web3.eth.getBalance(wallet)
              let walletDifference = walletBalance.toNumber() - walletBalanceBefore;
              expect(''+walletDifference).to.equal(web3.toWei(4, 'ether'))
            })

            it('token should have a matching total supply', async () => {
              let totalSupply = await token.totalSupply()
              expect(totalSupply.toString()).to.equal(web3.toWei(12, 'ether'))
            })

            describe('on the third day with 2 more supply and after one buyer has withdrawn his one remaining ether', () => {
              beforeEach(async () => {
                await sale.withdraw({from: tokenBuyer4})
                await supply_contract.addTokens(web3.toWei(2, 'ether'))

                let demand = await sale.demand()
                expect(demand.toNumber()).to.equal(3000000000000000000)

                walletBalanceBefore = web3.eth.getBalance(wallet)

                await sale.update({from: updater})
              })

              it('should have minted 2/3 of the asked tokens', async () => {
                // buyer should be stil the same
                let balance1 = await token.balanceOf(tokenBuyer4)
                expect(balance1.toString()).to.equal(web3.toWei(1, 'ether'))

                let balance2 = await token.balanceOf(tokenBuyer5)
                let balance3 = await token.balanceOf(tokenBuyer6)
                expect(balance2.toString()).to.equal('4166666666666666666')
                expect(balance3.toString()).to.equal('833333333333333333')
              })

              it('should have left 1/3 of the demand there', async () => {
                let demand = await sale.demand.call()
                expect(demand.toString()).to.equal('1000000000000000001')
              })

              it('should have still two buyers in the beneficiaries list', async () => {
                let beneficiariesLength = await sale.beneficiariesLength.call()
                expect(beneficiariesLength.toNumber()).to.equal(2)
              })

              it('should have left 1/3 the remaining ethers in escrows for all buyers', async () => {
                let escrow1 = await sale.inEscrowFor.call(tokenBuyer4)
                let escrow2 = await sale.inEscrowFor.call(tokenBuyer5)
                let escrow3 = await sale.inEscrowFor.call(tokenBuyer6)
                expect(escrow1.toString()).to.equal('0')
                expect(escrow2.toString()).to.equal('833333333333333334')
                expect(escrow3.toString()).to.equal('166666666666666667')
              })

              it('should have sent the spent ethers to the wallet', async () => {
                let walletBalance = await web3.eth.getBalance(wallet)
                let walletDifference = walletBalance.toNumber() - walletBalanceBefore;
                expect(''+walletDifference).to.equal(web3.toWei(2, 'ether'))
              })

              it('token should have a matching total supply', async () => {
                let totalSupply = await token.totalSupply()
                expect(totalSupply.toString()).to.equal('13999999999999999999')
              })

            })

          })
        })

      })

    })
  })



})
