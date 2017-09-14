pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/token/StandardToken.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";

contract HoloToken is StandardToken, Ownable {
  string public constant name = "Holo Token";
  string public constant symbol = "HOLO";
  uint8 public constant decimals = 18;

  event Mint(address indexed to, uint256 amount);
  event MintFinished();
  event Burn(uint256 amount);

  bool public mintingFinished = false;
  address public destroyer;
  address public minter;

  modifier canMint() {
    require(!mintingFinished);
    _;
  }

  modifier onlyDestroyer() {
     require(msg.sender == destroyer);
     _;
  }

  modifier onlyMinter() {
    require(msg.sender == minter);
    _;
  }

  function setDestroyer(address _destroyer) onlyOwner {
    destroyer = _destroyer;
  }

  function setMinter(address _minter) public onlyOwner {
    minter = _minter;
  }

  function burn(uint256 _amount) onlyDestroyer {
    require(balances[destroyer] >= _amount && _amount > 0);
    balances[destroyer] -= _amount;
    totalSupply -= _amount;
    Burn(_amount);
  }

  function mint(address _to, uint256 _amount) onlyMinter canMint  returns (bool) {
    require(balances[_to] + _amount > balances[_to]); // Guard against overflow
    require(totalSupply + _amount > totalSupply); // Guard against overflow  (this should never happen)
    totalSupply = totalSupply.add(_amount);
    balances[_to] = balances[_to].add(_amount);
    Mint(_to, _amount);
    return true;
  }

  function finishMinting() onlyOwner returns (bool) {
    mintingFinished = true;
    MintFinished();
    return true;
  }
}
