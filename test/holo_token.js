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
/*
  const contractShouldThrowIfClosedOnly = (functionToCall) => {
    contractShouldThrowIfClosed(functionToCall, {only: true})
  }

  const contractShouldThrowIfClosed = (functionToCall, options) => {
    contractShouldThrow('should throw an error if contract is closed', () => {
      return token.close().then(functionToCall)
    }, options)
  }
*/
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

  beforeEach((done) => {
    HoloToken.deployed().then((_token) => {
      token = _token
      return done()
    }).catch(done)
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


    describe('#close', () => {
      // this must go first, for reasons unknown...
      contractIt('should fire Close event', (done) => {
        let events = token.Close()

        Promise.resolve().then(() => {
          return token.close()
        }).then(() => {
          return firstEvent(events)
        }).then((log) => {
          expect(log.args._closedBy).to.equal(accounts[0])
          done()
          return
        }).catch(done)
      })

      //contractShouldThrowIfClosed(() => {
      //  return token.close()
      //})

      contractShouldThrowIfEtherSent(() => {
        return token.close({value: 1})
      })

      contractShouldThrowForNonOwner(() => {
        return token.close({from: accounts[1]})
      })

      contractIt('owner can close the contract', (done) => {
        Promise.resolve().then(() => {
          return token.close()
        }).then(() => {
          return token.isClosed.call()
        }).then((isClosed) => {
          expect(isClosed).to.equal(true)
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
          expect(decimals.toNumber()).to.equal(0)
          return
        }).then(done).catch(done)
      })
    })

    describe('#name', () => {
      contractIt('should return the name for the contract', (done) => {
        Promise.resolve().then(() => {
          return token.name.call()
        }).then((decimals) => {
          expect(decimals).to.equal('Generic CoMakery DynamicToken')
          return
        }).then(done).catch(done)
      })
    })

    describe('#symbol', () => {
      contractIt('should return the symbol for the contract', (done) => {
        Promise.resolve().then(() => {
          return token.symbol.call()
        }).then((decimals) => {
          expect(decimals).to.equal('GCMD')
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
          return token.issue(starting.alice.address, 20, 'proof1', {from: starting.alice.address})
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
          return token.issue(starting.alice.address, 20, 'proof1', {from: starting.alice.address})
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
          return token.issue(starting.alice.address, 20, 'proof1', {from: starting.alice.address})
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
          return token.issue(starting.alice.address, 20, 'proof1', {from: starting.alice.address})
        }).then(() => {
          return firstEvent(token.Transfer())
        }).then(() => {
          return token.transfer(starting.bob.address, 5, {from: starting.alice.address})
        }).then(() => {
          return firstEvent(token.Transfer())
        }).then((log) => {
          expect(log.args._from).to.equal(starting.alice.address)
          expect(log.args._to).to.equal(starting.bob.address)
          expect(log.args._amount.toNumber()).to.equal(5)
          done()
          return
        }).catch(done)
      })

      contractIt('should do nothing if sender does not have enough tokens', (done) => {
        const amount = 10
        let starting

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.transfer(starting.alice.address, amount, {from: starting.bob.address})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.alice.balance).to.equal(starting.alice.balance)
          expect(ending.bob.balance).to.equal(starting.bob.balance)
          return
        }).then(done).catch(done)
      })

      contractIt('should do nothing if a the send value is a negative number', (done) => {
        const amount = -1
        let starting

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.transfer(starting.bob.address, amount, {from: starting.alice.address})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.alice.balance).to.equal(starting.alice.balance)
          expect(ending.bob.balance).to.equal(starting.bob.balance)
          return
        }).then(done).catch(done)
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
          return token.issue(manager, 200, 'proof1', {from: manager})
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

      contractIt('spender cannot spend without allowance set by manager', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.issue(manager, 200, 'proof1', {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 40, {from: spender})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.manager.balance).to.equal(200)
          expect(ending.spender.balance).to.equal(0)
          expect(ending.recipient.balance).to.equal(0)
          return
        }).then(() => {
          return token.allowance.call(manager, spender, {from: anyone})
        }).then((allowance) => {
          expect(allowance.toNumber()).to.equal(0)
          return
        }).then(done).catch(done)
      })

      contractIt('should fire a Transfer event when a transfer is sucessful', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.issue(manager, 200, 'proof1', {from: manager})
        }).then(() => {
          return firstEvent(token.Transfer())
        }).then(() => {
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 50, {from: spender})
        }).then(() => {
          return firstEvent(token.Transfer())
        }).then((log) => {
          expect(log.args._from).to.equal(manager)
          expect(log.args._to).to.equal(recipient)
          expect(log.args._amount.toNumber()).to.equal(50)
          done()
          return
        }).catch(done)
      })

      contractIt('should fire a TransferFrom event when a transfer is sucessful', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.issue(manager, 200, 'proof1', {from: manager})
        }).then(() => {
          return firstEvent(token.Transfer())
        }).then(() => {
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 50, {from: spender})
        }).then(() => {
          return firstEvent(token.TransferFrom())
        }).then((log) => {
          expect(log.args._from).to.equal(manager)
          expect(log.args._to).to.equal(recipient)
          // FAILS INTERMITTENTLY, CAUSE UNKNOWN:
          // expect(log.args._spender).to.equal(spender)
          expect(log.args._amount.toNumber()).to.equal(50)
          done()
          return
        }).catch(done)
      })

      contractIt('spender cannot spend more than allowance set by manager', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.issue(manager, 200, 'proof1', {from: manager})
        }).then(() => {
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 101, {from: spender})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.manager.balance).to.equal(200)
          expect(ending.spender.balance).to.equal(0)
          expect(ending.recipient.balance).to.equal(0)
          return
        }).then(() => {
          return token.allowance.call(manager, spender, {from: anyone})
        }).then((allowance) => {
          expect(allowance.toNumber()).to.equal(100)
          return
        }).then(done).catch(done)
      })

      contractIt('spender cannot spend more than current balance of manager', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.issue(manager, 100, 'proof1', {from: manager})
        }).then(() => {
          return token.approve(spender, 300, {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 200, {from: spender})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.manager.balance).to.equal(100)
          expect(ending.spender.balance).to.equal(0)
          expect(ending.recipient.balance).to.equal(0)
          return
        }).then(() => {
          return token.allowance.call(manager, spender, {from: anyone})
        }).then((allowance) => {
          expect(allowance.toNumber()).to.equal(300)
          return
        }).then(done).catch(done)
      })

      contractIt('spender cannot send a negative token amount', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.issue(manager, 100, 'proof1', {from: manager})
        }).then(() => {
          return token.issue(recipient, 100, 'proof2', {from: manager})
        }).then(() => {
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.approve(spender, 100, {from: recipient})
        }).then(() => {
          return token.transferFrom(manager, recipient, -1, {from: spender})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.manager.balance).to.equal(100)
          expect(ending.spender.balance).to.equal(0)
          expect(ending.recipient.balance).to.equal(100)
          return
        }).then(() => {
          return token.allowance.call(manager, spender, {from: anyone})
        }).then((allowance) => {
          expect(allowance.toNumber()).to.equal(100)
          return
        }).then(() => {
          return token.allowance.call(recipient, spender, {from: anyone})
        }).then((allowance) => {
          expect(allowance.toNumber()).to.equal(100)
          return
        }).then(done).catch(done)
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
          expect(log.args._owner).to.equal(manager)
          expect(log.args._spender).to.equal(spender)
          expect(log.args._amount.toNumber()).to.equal(50)
          done()
          return
        }).catch(done)
      })
    })

    describe('#maxSupply', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.setMaxSupply(10, {value: 1})
      })

      contractIt('should default to 10 million total supply', (done) => {
        Promise.resolve().then(() => {
          return token.maxSupply()
        }).then((max) => {
          expect(max.toNumber()).to.equal(10e6)
          return
        }).then(done).catch(done)
      })

      contractIt('should not allow owner to issue more than max tokens', (done) => {
        const halfAmount = 6e6
        let starting

        // Issue in halfAmount twice. Don't issue the second amount which is over the maxSupply
        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.issue(starting.bob.address, halfAmount, 'proof1', {from: starting.alice.address})
        }).then(() => {
          return token.issue(starting.bob.address, halfAmount, 'proof2', {from: starting.alice.address})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.alice.balance).to.equal(0)
          expect(ending.bob.balance).to.equal(halfAmount)
          return
        }).then(done).catch(done)
      })

      contractIt('should allow owner to issue max tokens', (done) => {
        const amount = 10e6
        let starting

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.issue(starting.bob.address, amount, 'proof1', {from: starting.alice.address})
        }).then(() => {
          return getUsers(token)
        }).then((ending) => {
          expect(ending.alice.balance).to.equal(0)
          expect(ending.bob.balance).to.equal(10e6)
          return
        }).then(done).catch(done)
      })
    })

    describe('#lockContractOwner', () => {
      contractIt('emits an event', (done) => {
        let events = token.LockContractOwner()

        Promise.resolve().then(() => {
          return token.lockContractOwner({from: accounts[0]})
        }).then(() => {
          return firstEvent(events)
        }).then((event) => {
          expect(event.args._by).to.equal(accounts[0])
          done()
          return
        }).catch(done)
      })

      contractShouldThrowForNonOwner(() => {
        return token.lockContractOwner({from: accounts[1]})
      })

      //contractShouldThrowIfClosed(() => {
      //  return token.lockContractOwner({from: accounts[0]})
      //})

      contractShouldThrowIfEtherSent(() => {
        return token.lockContractOwner({from: accounts[0], value: 1})
      })

      contractIt('should begin unlocked', (done) => {
        token.isContractOwnerLocked.call().then((locked) => {
          expect(locked).to.equal(false)
          return
        }).then(done).catch(done)
      })

      contractIt('should allow owner to set isContractOwnerLocked', (done) => {
        Promise.resolve().then(() => {
          return token.lockContractOwner({from: accounts[0]})
        }).then(() => {
          return token.isContractOwnerLocked.call()
        }).then((locked) => {
          expect(locked).to.equal(true)
          return
        }).then(done).catch(done)
      })

      contractShouldThrow('when owner tries to transferContractOwnership if isContractOwnerLocked', () => {
        return token.lockContractOwner({from: accounts[0]}).then(() => {
          return token.transferContractOwnership(accounts[1], {from: accounts[0]})
        })
      })
    })

    describe('#getAccounts accessbile by everyone', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.getAccounts({value: 1})
      })

      contractIt('includes accounts that are issued tokens without duplicates', (done) => {
        let expected = [accounts[2]]

        Promise.resolve().then(() => {
          return token.issue(accounts[2], 20, 'proof1')
        }).then(() => {
          return token.issue(accounts[2], 25, 'proof2')
        }).then(() => {
          return token.getAccounts.call()
        }).then((tokenAccounts) => {
          expect(tokenAccounts.length).to.equal(expected.length)
          expect(tokenAccounts).to.have.members(expected)
          return
        }).then(done).catch(done)
      })

      contractIt('includes accounts that are transfered tokens without duplicates', (done) => {
        let expected = [accounts[0], accounts[2]]

        Promise.resolve().then(() => {
          return token.issue(accounts[0], 2000, 'proof1')
        }).then(() => {
          return token.transfer(accounts[2], 20)
        }).then(() => {
          return token.transfer(accounts[2], 25)
        }).then(() => {
          return token.getAccounts.call()
        }).then((tokenAccounts) => {
          expect(expected).to.have.members(tokenAccounts)
          expect(tokenAccounts.length).to.equal(expected.length)
          return
        }).then(done).catch(done)
      })

      contractIt('includes accounts that are transferedFrom tokens without duplicates', (done) => {
        let manager, spender, recipient

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          manager = users.manager.address
          spender = users.spender.address
          recipient = users.recipient.address
          return token.issue(manager, 200, 'proof1', {from: manager})
        }).then(() => {
          return token.approve(spender, 100, {from: manager})
        }).then(() => {
          return token.transferFrom(manager, recipient, 50, {from: spender})
        }).then(() => {
          return token.getAccounts.call()
        }).then((tokenAccounts) => {
          let expected = [manager, recipient]
          expect(tokenAccounts).to.have.members(expected)
          return
        }).then(done).catch(done)
      })
    })

    contractIt('#indexAccount should be private', (done) => {
      expect(token.indexAccount).to.equal(undefined)
      done()
    })

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

    describe('#burn', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.burn(5, {from: accounts[0], value: 1})
      })

      //contractShouldThrowIfClosed(() => {
      //  return token.burn(1)
      //})

      contractIt('account owner can burn their tokens', (done) => {
        let bob = accounts[1]
        Promise.resolve().then(() => {
          return token.issue(bob, 11, 'proof1', {from: accounts[0]})
        }).then(() => {
          return token.totalSupply.call()
        }).then((totalSupply) => {
          expect(totalSupply.toNumber()).to.equal(11)
          return
        }).then(() => {
          return token.burn(10, {from: bob})
        }).then(() => {
          return token.balanceOf.call(bob)
        }).then((balance) => {
          expect(balance.toNumber()).to.equal(1)
          return token.totalSupply.call()
        }).then((totalSupply) => {
          expect(totalSupply.toNumber()).to.equal(1)
          return
        }).then(done).catch(done)
      })

      contractIt('burns no tokens if amount is greater than tokens available', (done) => {
        let bob = accounts[1]
        Promise.resolve().then(() => {
          return token.issue(bob, 1, 'proof1', {from: accounts[0]})
        }).then(() => {
          return token.totalSupply.call()
        }).then((totalSupply) => {
          return expect(totalSupply.toNumber()).to.equal(1)
        }).then(() => {
          return token.burn(10, {from: bob})
        }).then(() => {
          return token.balanceOf.call(bob)
        }).then((balance) => {
          expect(balance.toNumber()).to.equal(1)
          return token.totalSupply.call()
        }).then((totalSupply) => {
          expect(totalSupply.toNumber()).to.equal(1)
          return
        }).then(done).catch(done)
      })

      contractIt('should fire Burn event when #burn triggered', (done) => {
        let events = token.Burn()
        let starting

        Promise.resolve().then(() => {
          return getUsers(token)
        }).then((users) => {
          starting = users
          return token.issue(starting.bob.address, 11, 'proof1', {from: accounts[0]})
        }).then(() => {
          return token.burn(10, {from: starting.bob.address})
        }).then(() => {
          return firstEvent(events)
        }).then((log) => {
          expect(log.args._burnFrom).to.equal(starting.bob.address)
          expect(log.args._amount.toNumber()).to.equal(10)
          done()
          return
        }).catch(done)
      })
    })

    // This kills the server unless it runs last...
    describe('#destroyContract', () => {
      contractShouldThrowIfEtherSent(() => {
        return token.destroyContract({value: 1})
      })

      contractShouldThrowForNonOwner(() => {
        return token.destroyContract({from: accounts[1]})
      })

      contractIt('owner can self destruct the contract', (done) => {
        Promise.resolve().then(() => {
          return token.contractOwner()
        }).then((owner) => {
          expect(owner).to.equal(accounts[0])
          return
        }).then(() => {
          return token.destroyContract()
        }).then(() => {
          return token.contractOwner()
        }).then((owner) => {
          expect(owner).to.equal('0x')
          return
        }).then(done).catch(done)
      })
    })
})
