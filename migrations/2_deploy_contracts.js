var HoloTokenSupply = artifacts.require("./HoloTokenSupply.sol");

module.exports = function(deployer) {
  deployer.deploy(HoloTokenSupply);
};
