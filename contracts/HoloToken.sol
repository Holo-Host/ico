pragma solidity ^0.4.15;
import "./HoloTokenSupply.sol";
import "zeppelin-solidity/contracts/token/StandardToken.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract HoloToken is StandardToken, Ownable {
  string public constant name = "Holo Token";
  string public constant symbol = "HOLO";
  uint8 public constant decimals = 18;

  address public destroyer;

  event Burn(uint256 _amount);

  modifier onlyDestroyer() {
     require(msg.sender == destroyer);
     _;
  }

  // Constructor
  function HoloToken(HoloTokenSupply supply_contract) payable {
     totalSupply = supply_contract.total_supply();
  }

  function setDestroyer(address _destroyer) onlyOwner {
    destroyer = _destroyer;
  }

  function burn(uint256 _amount) onlyDestroyer {
    require(balances[destroyer] >= _amount && _amount > 0);
    balances[destroyer] -= _amount;
    totalSupply -= _amount;
    Burn(_amount);
  }
}
