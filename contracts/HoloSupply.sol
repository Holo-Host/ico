pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract HoloSupply is Ownable {
  address public updater;
  uint256 public totalSupply;

  modifier onlyUpater {
    require(msg.sender == updater);
    _;
  }

  function HoloSupply() {
    updater = tx.origin;
    totalSupply = 0;
  }

  function setUpdater(address new_updater) onlyOwner {
    updater = new_updater;
  }

  function addTokens(uint256 token_count_to_add) onlyUpater {
    totalSupply += token_count_to_add;
  }

  function supplyAvailableForSale() returns (uint256) {
    return totalSupply * 75 / 100;
  }

}
