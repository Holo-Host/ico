const HoloCredits = artifacts.require("./HoloCredits.sol");
const HoloSale = artifacts.require("./HoloSale.sol");
const HoloWhitelist = artifacts.require("./HoloWhitelist.sol");

module.exports = function(deployer, network, accounts) {
  let sale
  deployer.deploy(HoloCredits).then(() => {
    return deployer.deploy(HoloSale, web3.eth.blockNumber + 10, 1000, 1, web3.toWei(2500000, 'ether'), 10, accounts[0])
  }).then(() => {
    return deployer.deploy(HoloWhitelist)
  }).then(() => {
    return HoloSale.deployed()
  }).then((s) => {
    sale = s
    return HoloCredits.deployed()
  }).then((r) => {
    token = r
    return token.setMinter(sale.address)
  }).then(() => {
    return sale.setTokenContract(token.address)
  })
};
