pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract HoloTokenSupply is Ownable {
  address public updater;
  uint256 public total_supply;

  modifier onlyUpater {
    require(msg.sender == updater);
    _;
  }

  function HoloTokenSupply() {
    updater = tx.origin;
    total_supply = 0;
  }

  function setUpdater(address new_updater) onlyOwner {
    updater = new_updater;
  }

  function addTokens(uint256 token_count_to_add) onlyUpater {
    total_supply += token_count_to_add;
  }

}
