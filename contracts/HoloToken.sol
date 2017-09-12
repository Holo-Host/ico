pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/token/MintableToken.sol";

contract HoloToken is MintableToken {
  string public constant name = "Holo Token";
  string public constant symbol = "HOLO";
  uint8 public constant decimals = 18;

  address public destroyer;

  event Burn(uint256 amount);

  modifier onlyDestroyer() {
     require(msg.sender == destroyer);
     _;
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
