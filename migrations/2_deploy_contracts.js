const HoloToken = artifacts.require("./HoloToken.sol");
const HoloSale = artifacts.require("./HoloSale.sol");
const HoloWhitelist = artifacts.require("./HoloWhitelist.sol");

module.exports = function(deployer, network, accounts) {
  let sale, whitelist
  deployer.deploy(HoloToken).then(() => {
    return deployer.deploy(HoloSale, web3.eth.blockNumber + 10, 1000, 1, web3.toWei(2500000, 'ether'), 10, accounts[0])
  }).then(() => {
    return deployer.deploy(HoloWhitelist)
  }).then(() => {
    return HoloSale.deployed()
  }).then((s) => {
    sale = s
    return HoloToken.deployed()
  }).then((t) => {
    token = t
    return HoloWhitelist.deployed()
  }).then((w) => {
    whitelist = w
    return token.setMinter(sale.address)
  }).then(() => {
    return sale.setTokenContract(token.address)
  }).then(() => {
    return sale.setWhitelistContract(whitelist.address)
  })
};
