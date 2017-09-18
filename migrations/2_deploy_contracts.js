const HoloToken = artifacts.require("./HoloToken.sol");
const HoloTokenSale = artifacts.require("./HoloTokenSale.sol");
const HoloTokenSupply = artifacts.require("./HoloTokenSupply.sol");

module.exports = function(deployer, network, accounts) {
  let sale
  deployer.deploy(HoloTokenSupply).then(() => {
    return deployer.deploy(HoloToken, HoloTokenSupply.address)
  }).then(() => {
    return deployer.deploy(HoloTokenSale, web3.eth.blockNumber + 10, 1000, 1, accounts[0])
  }).then(() => {
    return HoloTokenSale.deployed()
  }).then((s) => {
    sale = s
    return HoloTokenSupply.deployed()
  }).then((s) => {
    supply = s
    return HoloToken.deployed()
  }).then((t) => {
    token = t
    return token.setMinter(sale.address)
  }).then(() => {
    return sale.setTokenContract(token.address)
  }).then(() => {
    return sale.setSupplyContract(supply.address)
  })
};
