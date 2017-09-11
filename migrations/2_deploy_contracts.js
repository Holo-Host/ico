var HoloTokenSupply = artifacts.require("./HoloTokenSupply.sol");
var HoloToken = artifacts.require("./HoloToken.sol");

module.exports = function(deployer) {
  deployer.deploy(HoloTokenSupply).then(() => {
      return deployer.deploy(HoloToken, HoloTokenSupply.address)
  });
};
