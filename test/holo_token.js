import {expect} from 'chai'
import {d} from 'lightsaber'

const HoloToken = artifacts.require('./HoloToken.sol')

import {
  contractIt,
  contractItOnly,
  contractShouldThrow,
  contractShouldThrowForNonOwner,
  contractShouldThrowForNonOwnerOnly,
  contractShouldThrowIfClosed,
  contractShouldThrowIfClosedOnly,
  contractShouldThrowIfEtherSent,
  contractShouldThrowIfEtherSentOnly,
  contractShouldThrowOnly
} from './testHelper'

contract('HoloToken', (accounts) => {
  let anyone = accounts[5]
  let token

  let getUsers = (token) => {
    let alice = {address: accounts[0]}
    let bob = {address: accounts[1]}
    let charlie = {address: accounts[2]}

    return Promise.resolve().then(() => {
      return token.balanceOf.call(accounts[0])
    }).then((balance) => {
      alice.balance = balance.toNumber()
      return token.balanceOf.call(accounts[1])
    }).then((balance) => {
      bob.balance = balance.toNumber()
      return token.balanceOf.call(accounts[2])
    }).then((balance) => {
      charlie.balance = balance.toNumber()
      return charlie.balance
    }).then(() => {
      // sometimes convenient to identify users by name, other times by role
      let manager = alice
      let spender = bob
      let recipient = charlie
      return {
        alice, bob, charlie,
        manager, spender, recipient
      }
    })
  }

  const firstEvent = (events) => {
    return new Promise((resolve, reject) => {
      events.watch((error, log) => {
        if (error) {
          reject(error)
        } else {
          events.stopWatching()
          resolve(log)
        }
      })
    })
  }

  beforeEach(async () => {
    token = await HoloToken.new()
    await token.setMinter(accounts[0])
  })

  describe('expected test conditions', () => {
    contractIt('token balances of all accounts are zero', (done) => {
      Promise.resolve().then(() => {
        return getUsers(token)
      }).then(({alice, bob}) => {
        expect(alice.balance).to.equal(0)
        expect(bob.balance).to.equal(0)
        return
      }).then(done).catch(done)
    })

    contractIt('allowances of all accounts are zero', (done) => {
      let alice, bob
      Promise.resolve().then(() => {
        return getUsers(token)
      }).then((users) => {
        alice = users.alice
        bob = users.bob
        return token.allowance.call(alice.address, bob.address)
      }).then((allowance) => {
        expect(allowance.toNumber()).to.equal(0)
        return token.allowance.call(bob.address, alice.address)
      }).then((allowance) => {
        expect(allowance.toNumber()).to.equal(0)
        return token.allowance.call(alice.address, alice.address)
      }).then((allowance) => {
        expect(allowance.toNumber()).to.equal(0)
        return
      }).then(done).catch(done)
    })
  })

    describe('#allowance', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.allowance(accounts[1], accounts[2], {value: 1})
      })
    })

    describe('#balanceOf', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.balanceOf(accounts[1], {value: 1})
      })
    })

    describe('#decimals', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.decimals({value: 1})
      })
      contractIt('should return the number of decimals for the contract', (done) => {
        Promise.resolve().then(() => {
          return token.decimals.call()
        }).then((decimals) => {
          expect(decimals.toNumber()).to.equal(18)
          return
        }).then(done).catch(done)
      })
    })

    describe('#name', () => {
      contractIt('should return the name for the contract', (done) => {
        Promise.resolve().then(() => {
          return token.name.call()
        }).then((name) => {
          expect(name).to.equal('Holo Token')
          return
        }).then(done).catch(done)
      })
    })

    describe('#symbol', () => {
      contractIt('should return the symbol for the contract', (done) => {
        Promise.resolve().then(() => {
          return token.symbol.call()
        }).then((symbol) => {
          expect(symbol).to.equal('HOLO')
          return
        }).then(done).catch(done)
      })
    })

    describe('#transfer', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.transfer(accounts[0], 10, {value: 1})
      })

      //contractShouldThrowIfClosed(() => {
      //  return token.transfer(accounts[0], 1)
      //})

      contractIt('should transfer tokens from contract owner to a receiver', (done) => {
        let starting

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.mint(starting.alice.address, 20)
        }).then(() => {
          return token.transfer(starting.bob.address, 5, {from: starting.alice.address})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.alice.balance).to.equal(15)
          expect(ending.bob.balance).to.equal(5)
          return
        }).then(done).catch(done)
      })

      contractIt('should transfer tokens from user to a user', (done) => {
        let starting

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.mint(starting.alice.address, 20)
        }).then(() => {
          return token.transfer(starting.bob.address, 5, {from: starting.alice.address})
        }).then(() => {
          return token.transfer(starting.charlie.address, 5, {from: starting.bob.address})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.alice.balance).to.equal(15)
          expect(ending.bob.balance).to.equal(0)
          expect(ending.charlie.balance).to.equal(5)
          return
        }).then(done).catch(done)
      })

      contractIt('should allow the token owner to transfer tokens to other users', (done) => {
        let starting

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.mint(starting.alice.address, 20)
        }).then(() => {
          return token.transfer(starting.bob.address, 5, {from: starting.alice.address})
        }).then(() => {
          return token.transfer(starting.charlie.address, 5, {from: starting.bob.address})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.alice.balance).to.equal(15)
          expect(ending.bob.balance).to.equal(0)
          expect(ending.charlie.balance).to.equal(5)
          return
        }).then(done).catch(done)
      })

      contractIt('should fire a Transfer event when a transfer is sucessful', (done) => {
        let starting

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.mint(starting.alice.address, 20)
        }).then(() => {
          return //firstEvent(token.Transfer())
        }).then(() => {
          return token.transfer(starting.bob.address, 5, {from: starting.alice.address})
        }).then(() => {
          return firstEvent(token.Transfer())
        }).then((log) => {
          expect(log.args.from).to.equal(starting.alice.address)
          expect(log.args.to).to.equal(starting.bob.address)
          expect(log.args.value.toNumber()).to.equal(5)
          done()
          return
        }).catch(done)
      })

      contractShouldThrow("should throw if sender does not have enough tokens", async () => {
        var users = await getUsers(token)
        return token.transfer(users.alice.address, 10, {from: users.bob.address})
      })


      contractShouldThrow('should throw if a the send value is a negative number', async (done) => {
        var users = await getUsers(token)
        return token.transfer(users.alice.address, -1, {from: users.bob.address})
      })
    })

    describe('#transferFrom', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.transferFrom(accounts[1], accounts[2], 3, {value: 1})
      })

      //contractShouldThrowIfClosed(() => {
      //  return token.transferFrom(accounts[0], accounts[1], 1)
      //})

      contractIt('spender can spend within allowance set by manager', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.mint(manager, 200)
        }).then(() => {
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 40, {from: spender})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.manager.balance).to.equal(160)
          expect(ending.spender.balance).to.equal(0)
          expect(ending.recipient.balance).to.equal(40)
          return
        }).then(() => {
          return token.allowance.call(manager, spender, {from: anyone})
        }).then((allowance) => {
          expect(allowance.toNumber()).to.equal(60)
          return
        }).then(done).catch(done)
      })

      contractShouldThrow('spender cannot spend without allowance set by manager', async (done) => {
        let manager, spender, recipient
        let users = await getUsers(token)

        manager = users.manager.address
        spender = users.spender.address
        recipient = users.recipient.address
        await token.mint(manager, 200)
        await token.transferFrom(manager, recipient, 40, {from: spender})
        assert(false)
        return
      })

      contractIt('should fire a Transfer event when a transfer is sucessful', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.mint(manager, 200)
        }).then(() => {
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 50, {from: spender})
        }).then(() => {
          return firstEvent(token.Transfer())
        }).then((log) => {
          expect(log.args.from).to.equal(manager)
          expect(log.args.to).to.equal(recipient)
          expect(log.args.value.toNumber()).to.equal(50)
          done()
          return
        }).catch(done)
      })
/*
      contractIt('should fire a TransferFrom event when a transfer is sucessful', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.mint(manager, 200)
        }).then(() => {
          return //firstEvent(token.Transfer())
        }).then(() => {
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 50, {from: spender})
        }).then(() => {
          return firstEvent(token.TransferFrom())
        }).then((log) => {
          expect(log.args.from).to.equal(manager)
          expect(log.args.to).to.equal(recipient)
          // FAILS INTERMITTENTLY, CAUSE UNKNOWN:
          // expect(log.args._spender).to.equal(spender)
          expect(log.args.value.toNumber()).to.equal(50)
          done()
          return
        }).catch(done)
      })
*/
      contractShouldThrow('spender cannot spend more than allowance set by manager', async (done) => {
        let manager, spender, recipient
        let users = await getUsers(token)

        manager = users.manager.address
        spender = users.spender.address
        recipient = users.recipient.address
        await token.mint(manager, 200)
        await token.approve(spender, 100, {from: manager})
        await token.transferFrom(manager, recipient, 101, {from: spender})
        assert(false)
        return
      })

      contractShouldThrow('spender cannot spend more than current balance of manager', async (done) => {
        let manager, spender, recipient
        let users = await getUsers(token)

        manager = users.manager.address
        spender = users.spender.address
        recipient = users.recipient.address
        await token.mint(manager, 100)
        await token.approve(spender, 300, {from: manager})
        await token.transferFrom(manager, recipient, 200, {from: spender})
        assert(false)
      })

      contractShouldThrow('spender cannot send a negative token amount', async (done) => {
        let manager, spender, recipient
        let users = await getUsers(token)

        manager = users.manager.address
        spender = users.spender.address
        recipient = users.recipient.address
        await token.mint(manager, 100)
        await token.approve(spender, 300, {from: manager})
        await token.transferFrom(manager, recipient, -1, {from: spender})
        assert(false)

      })
    })

    describe('#approve', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.approve(accounts[1], 100, {value: 1})
      })

      //contractShouldThrowIfClosed(() => {
      //  return token.approve(accounts[0], 1)
      //})

      contractIt('manager can approve allowance for spender to spend', (done) => {
        let manager, spender

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.alice.address
          spender = users.bob.address
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.allowance.call(manager, spender, {from: anyone})
        }).then((allowance) => {
          expect(allowance.toNumber()).to.equal(100)
          return
        }).then(done).catch(done)
      })

      contractIt('should fire an Approval event when a tranfer is sucessful', (done) => {
        let events = token.Approval()
        let manager, spender

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          return token.approve(spender, 50, {from: manager})
        }).then(() => {
          return firstEvent(events)
        }).then((log) => {
          expect(log.args.owner).to.equal(manager)
          expect(log.args.spender).to.equal(spender)
          expect(log.args.value.toNumber()).to.equal(50)
          done()
          return
        }).catch(done)
      })
    })

/*
    describe('#upgrade', () => {
      const upgradeAccount = '0x00000f31d5d8c3146ea6f5c31c7f571c00000000'

      contractShouldThrowIfEtherSent(() => {
        return token.upgrade(upgradeAccount, {value: 1})
      })

      contractShouldThrowForNonOwner(() => {
        return token.upgrade(upgradeAccount, {from: accounts[1]})
      })

      //contractShouldThrowIfClosed(() => {
      //  return token.upgrade(upgradeAccount)
      //})

      contractIt('emits a close event', (done) => {
        const events = token.Upgrade()

        Promise.resolve().then(() => {
          return token.upgrade(upgradeAccount)
        }).then(() => {
          return firstEvent(events)
        }).then((event) => {
          expect(event.args._upgradedContract).to.equal(upgradeAccount)
          return
        }).then(done).catch(done)
      }, {pending: true})

      describe('when closed', () => {
        beforeEach(() => {
          return token.upgrade(upgradeAccount)
        })

        contractIt('toggles closed to true', (done) => {
          token.isClosed().then((isClosed) => {
            expect(isClosed).to.equal(true)
            return
          }).then(done).catch(done)
        })

        contractIt('stores the replacement contract address', (done) => {
          token.upgradedContract().then((upgradedContract) => {
            expect(upgradedContract).to.equal(upgradeAccount)
            return
          }).then(done).catch(done)
        })
      })
    })
*/
    describe('#burn', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.burn(5, {from: accounts[0], value: 1})
      })

      //contractShouldThrowIfClosed(() => {
      //  return token.burn(1)
      //})

      contractShouldThrow('should throw if non-destroyer calls burn', async () => {
        let bob = accounts[1]
        await token.mint(bob, 11)
        let totalSupply = await token.totalSupply.call()
        expect(totalSupply.toNumber()).to.equal(11)
        await token.burn(10, {from: bob})
        assert(false)
      })

      contractIt('destroyer can burn their tokens', async () => {
        let bob = accounts[1]
        await token.mint(bob, 11)
        let totalSupply = await token.totalSupply.call()
        expect(totalSupply.toNumber()).to.equal(11)

        await token.setDestroyer(bob, {from: accounts[0]})
        await token.burn(10, {from: bob})
        let balance = await token.balanceOf.call(bob)
        expect(balance.toNumber()).to.equal(1)
        totalSupply = await token.totalSupply.call()
        expect(totalSupply.toNumber()).to.equal(1)
      })

      contractShouldThrow('burns no tokens if amount is greater than tokens available', async (done) => {
        let bob = accounts[1]
        await token.mint(bob, 1)
        let totalSupply = await token.totalSupply.call()
        expect(totalSupply.toNumber()).to.equal(1)

        await token.setDestroyer(bob, {from: accounts[0]})
        await token.burn(10, {from: bob})
        assert(false)
        let balance = await token.balanceOf.call(bob)
        expect(balance.toNumber()).to.equal(1)
        totalSupply = await token.totalSupply.call()
        expect(totalSupply.toNumber()).to.equal(1)
      })

      contractIt('should fire Burn event when #burn triggered', async () => {
        let events = token.Burn()
        let users = await getUsers(token)
        await token.mint(users.bob.address, 11)
        await token.setDestroyer(users.bob.address)
        await token.burn(10, {from: users.bob.address})
        let log = await firstEvent(events)
        expect(log.args.amount.toNumber()).to.equal(10)
      })
    })

    describe('mint', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.mint(accounts[1], 5, {from: accounts[0], value: 1})
      })

      contractShouldThrow('should throw if called by non-minter', async () => {
        return token.mint(accounts[1], 5, {from: accounts[1]})
      })

      it('should create tokens', async () => {
        let before = await token.balanceOf(accounts[1])
        await token.mint(accounts[1], 5)
        let after = await token.balanceOf(accounts[1])
        expect(after.toNumber()).to.equal(before.toNumber() + 5)
      })

      it('should be callable by the address set by setMinter', async () => {
        let newMinter = accounts[5]
        await token.setMinter(newMinter)
        let before = await token.balanceOf(accounts[1])
        await token.mint(accounts[1], 5, {from: newMinter})
        let after = await token.balanceOf(accounts[1])
        expect(after.toNumber()).to.equal(before.toNumber() + 5)
      })

      contractShouldThrow('should throw when called by the owner who is not the minter', async () => {
        let newMinter = accounts[5]
        await token.setMinter(newMinter)
        await token.mint(accounts[1], 5, {from: accounts[0]})
        assert(false)
      })

      contractShouldThrow('should throw if minter tries minting after finishMinting() was called', async () => {
        let minter = accounts[5]
        await token.setMinter(minter)
        await token.finishMinting()
        await token.mint(accounts[1], 100, {from: minter})
        assert(false)
      })

      contractShouldThrow('should throw if finishMinting() is called by non-owner', async () => {
        return token.finishMinting({from: accounts[1]})
      })

      it('should increase totalSupply accordingly', async () => {
        let amount = 1337
        let before = await token.totalSupply()
        await token.mint(accounts[1], amount)
        let after = await token.totalSupply()
        expect(after.toNumber()).to.equal(before.toNumber() + amount)
      })

      contractShouldThrow('should throw when called with negative amount', async () => {
        await token.mint(accounts[1], 100)
        await token.mint(accounts[1], -1)
      })
    })
})
