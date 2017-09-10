pragma solidity ^0.4.15;

contract HoloTokenSupply {
  address public owner;
  address public updater;
  uint public total_supply;

  modifier onlyOwner {
    require(msg.sender == owner);
    _;
  }

  modifier onlyUpater {
    require(msg.sender == updater);
    _;
  }

  function HoloTokenSupply() {
    owner = tx.origin;
    updater = tx.origin;
    total_supply = 0;
  }

  function setUpdater(address new_updater) onlyOwner {
    updater = new_updater;
  }

  function addTokens(uint token_count_to_add) onlyUpater {
    total_supply += token_count_to_add;
  }

}
