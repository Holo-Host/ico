const HoloReceipt = artifacts.require("./HoloReceipt.sol");
const HoloSale = artifacts.require("./HoloSale.sol");
const HoloSupply = artifacts.require("./HoloSupply.sol");

module.exports = function(deployer, network, accounts) {
  let sale
  deployer.deploy(HoloSupply).then(() => {
    return deployer.deploy(HoloReceipt, HoloSupply.address)
  }).then(() => {
    return deployer.deploy(HoloSale, web3.eth.blockNumber + 10, 1000, 1, web3.toWei(2500000, 'ether'), 10, accounts[0])
  }).then(() => {
    return HoloSale.deployed()
  }).then((s) => {
    sale = s
    return HoloSupply.deployed()
  }).then((s) => {
    supply = s
    return HoloReceipt.deployed()
  }).then((r) => {
    receipt = r
    return receipt.setMinter(sale.address)
  }).then(() => {
    return sale.setReceiptContract(receipt.address)
  }).then(() => {
    return sale.setSupplyContract(supply.address)
  })
};
