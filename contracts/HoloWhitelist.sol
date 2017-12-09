pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract HoloWhitelist is Ownable {
  address public updater;

  struct KnownFunder {
    bool whitelisted;
    mapping(uint => uint256) reservedTokensPerDay;
  }

  mapping(address => KnownFunder) knownFunders;

  modifier onlyUpdater {
    require(msg.sender == updater);
    _;
  }

  function HoloWhitelist() {
    updater = tx.origin;
  }

  function setUpdater(address new_updater) onlyOwner {
    updater = new_updater;
  }

  function whitelist(address[] funders) onlyUpdater {
    for (uint i = 0; i < funders.length; i++) {
        knownFunders[funders[i]].whitelisted = true;
    }
  }

  function unwhitelist(address[] funders) onlyUpdater {
    for (uint i = 0; i < funders.length; i++) {
        knownFunders[funders[i]].whitelisted = false;
    }
  }

  function setReservedTokens(uint day, address[] funders, uint256[] reservedTokens) onlyUpdater {
    for (uint i = 0; i < funders.length; i++) {
        knownFunders[funders[i]].reservedTokensPerDay[day] = reservedTokens[i];
    }
  }

  function isWhitelisted(address funder) returns (bool) {
    return knownFunders[funder].whitelisted;
  }

  function reservedTokens(address funder, uint day) returns (uint256) {
    return knownFunders[funder].reservedTokensPerDay[day];
  }


}
