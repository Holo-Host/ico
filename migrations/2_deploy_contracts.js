const HoloToken = artifacts.require("./HoloToken.sol");
const HoloSale = artifacts.require("./HoloSale.sol");
const HoloWhitelist = artifacts.require("./HoloWhitelist.sol");

module.exports = function(deployer, network, accounts) {
  let sale, whitelist
  deployer.deploy(HoloToken).then(() => {
    wei_to_eth = 1000000000000000000
    eth_to_eur = 567
    rate = wei_to_eth * eth_to_eur * 10000
    min_wei_20_eur = web3.toWei(1, 'ether') * 20 / eth_to_eur
    blocks_in_3_days = 60*60*24*3 / 15
    return deployer.deploy(HoloSale, web3.eth.blockNumber + 10, web3.eth.blockNumber + blocks_in_3_days, rate, min_wei_20_eur, 10, accounts[0])
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
