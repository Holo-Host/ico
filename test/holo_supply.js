var HoloTokenSupply = artifacts.require("./HoloSupply.sol");

contract('HoloSupply', function(accounts) {

  it("should start off with 0 supply", function() {
    return HoloTokenSupply.deployed().then(function(instance) {
      return instance.totalSupply();
    }).then(function(supply) {
      assert.equal(supply, 0, "didn't initialise with 0 supply");
    });
  });

  it("should set owner and updater to sender initially", function() {
    let instance;
    return HoloTokenSupply.deployed().then((i) => {
      instance = i
      return instance.owner()
    }).then((owner) => {
      assert.equal(owner, accounts[0], "didn't set owner to sender initially")
      return instance.updater()
    }).then((updater) => {
      assert.equal(updater, accounts[0], "didnt' set updater to sender initially")
    })
  })

  describe("setUpdater()", () => {
    it("should change the updater when called by owner", () => {
      let instance
      return HoloTokenSupply.deployed().then((i) => {
        instance = i
        return instance.updater()
      }).then((updater) => {
        assert.equal(updater, accounts[0], "didnt' set updater to sender initially")
        return instance.setUpdater(accounts[1], {from: accounts[0]})
      }).then(() => {
        return instance.updater()
      }).then((updater) => {
        assert.equal(updater, accounts[1], "didn't change the updater")
      })
    })

    it("should not change the updater when called by someone else", () => {
      let instance
      let oldUpater
      return HoloTokenSupply.deployed().then((i) => {
        instance = i
        return instance.updater()
      }).then((updater) => {
        assert.notEqual(updater, accounts[2], "wrong updater to start this test with")
        oldUpater = updater
        return instance.setUpdater(accounts[2], {from: accounts[2]})
      }).catch((error) => {
        if (!error.message || error.message.search('VM Exception while processing transaction: revert') < 0) throw error
      }).then(() => {
        return instance.updater()
      }).then((updater) => {
        assert.equal(updater, oldUpater, "didn't keep the updater after unauhtorized call")
      })
    })
  })

  describe("addTokens()", () => {
    let instance
    let updater
    const tokens_to_add = 1337

    beforeEach((done) => {
      HoloTokenSupply.deployed().then((i) => {
        instance = i
        return instance.updater()
      }).then((u) => {
        updater = u
        return done()
      }).catch(done)
    })

    const callAddTokensFrom = (caller, assertions) => {
      let supply_before
      let supply_after
      return instance.totalSupply().then((supply) => {
        supply_before = supply.toNumber()
        return instance.addTokens(tokens_to_add, {from: caller})
      }).catch((error) => {
        if (!error.message || error.message.search('VM Exception while processing transaction: invalid opcode') < 0) throw error
      }).then(() => {
        return instance.totalSupply()
      }).then((supply) => {
        supply_after = supply.toNumber()
        assertions(supply_before, supply_after)
      })
    }

    it("should add the given amount of tokens if called by the updater", () => {
      callAddTokensFrom(updater, (supply_before, supply_after) => {
        assert.equal(supply_after, supply_before + tokens_to_add, "didn't not add tokens")
      })
    })

    it("should not change amount of tokens if called by somebody else", () => {
      callAddTokensFrom(accounts[8], (supply_before, supply_after) => {
        assert.equal(supply_after, supply_before, "did change the number of tokens")
      })
    })
  })
});
