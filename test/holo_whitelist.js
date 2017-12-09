import {expect} from 'chai'

const HoloWhitelist = artifacts.require('./HoloWhitelist.sol')

import {
  contractShouldThrow,
  firstEvent
} from './testHelper'

contract('HoloWhitelist', (accounts) => {
  let owner = accounts[0]
  let updater = accounts[1]
  let funder1 = accounts[2]
  let funder2 = accounts[3]
  let funder3 = accounts[4]
  let funder4 = accounts[5]
  let funder5 = accounts[6]
  let funder6 = accounts[7]

  let instance

  beforeEach(async () => {
    instance = await HoloWhitelist.deployed()
  })


  it("should set owner and updater to sender initially", async () => {
    let o = await instance.owner()
    let u = await instance.updater()
    assert.equal(o, owner, "didn't set owner to sender initially")
    assert.equal(u, owner, "didnt' set updater to sender initially")
  })

  describe("with updater set", () => {
    beforeEach(() => {
      return instance.setUpdater(updater)
    })

    describe("whitelist()", () => {
      it("updater should be able to call", async () => {
        let addresses = [funder1, funder2]
        await instance.whitelist(addresses, {from: updater})
      })

      contractShouldThrow("others should not be able to call", async () => {
        let addresses = [funder1, funder2]
        await instance.whitelist(addresses)
      })

      it("should whitelist addresses", async() => {
        let addresses = [funder1, funder2]
        await instance.whitelist(addresses, {from: updater})
        let f1 = await instance.isWhitelisted.call(funder1)
        let f2 = await instance.isWhitelisted.call(funder2)
        let f3 = await instance.isWhitelisted.call(funder3)
        expect(f1).to.equal(true)
        expect(f2).to.equal(true)
        expect(f3).to.equal(false)
      })
    })

    describe("unwhitelist()", () => {
      beforeEach(()=>{
        let addresses = [funder1, funder2, funder3]
        return instance.whitelist(addresses, {from: updater})
      })

      it("should unwhitelist when called by updater", async () => {
        await instance.unwhitelist([funder1, funder3], {from: updater})
        let f1 = await instance.isWhitelisted.call(funder1)
        let f2 = await instance.isWhitelisted.call(funder2)
        let f3 = await instance.isWhitelisted.call(funder3)
        expect(f1).to.equal(false)
        expect(f2).to.equal(true)
        expect(f3).to.equal(false)

      })

      contractShouldThrow("others should not be able to call", () => {
        return instance.unwhitelist([funder1])
      })
    })

    describe("reserved tokens", () => {
      beforeEach(() => {
        let funders = [funder1, funder2, funder3, funder4]
        let reservedTokens = [1, 12, 123, 1234]
        return instance.setReservedTokens(1, funders, reservedTokens, { from: updater })
      })

      it("should store and give back the right number of reserverd tokens per funder per day", async () => {
        let f1 = await instance.reservedTokens.call(funder1, 1)
        let f2 = await instance.reservedTokens.call(funder2, 1)
        let f3 = await instance.reservedTokens.call(funder3, 1)
        let f4 = await instance.reservedTokens.call(funder4, 1)
        let f5 = await instance.reservedTokens.call(funder5, 1)
        let f6 = await instance.reservedTokens.call(funder6, 1)
        expect(f1.toNumber()).to.equal(1)
        expect(f2.toNumber()).to.equal(12)
        expect(f3.toNumber()).to.equal(123)
        expect(f4.toNumber()).to.equal(1234)
        expect(f5.toNumber()).to.equal(0)
        expect(f6.toNumber()).to.equal(0)
      })

      it("should not alter reserved tokens for other days", async () => {
        let f01 = await instance.reservedTokens.call(funder1, 0)
        let f02 = await instance.reservedTokens.call(funder2, 0)
        expect(f01.toNumber()).to.equal(0)
        expect(f02.toNumber()).to.equal(0)
      })
    })


  })



})
