pragma solidity ^0.4.15;


/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
   * account.
   */
  function Ownable() {
    owner = msg.sender;
  }


  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == owner);
    _;
  }


  /**
   * @dev Allows the current owner to transfer control of the contract to a newOwner.
   * @param newOwner The address to transfer ownership to.
   */
  function transferOwnership(address newOwner) onlyOwner {
    if (newOwner != address(0)) {
      owner = newOwner;
    }
  }

}



/**
 * @title Pausable
 * @dev Base contract which allows children to implement an emergency stop mechanism.
 */
contract Pausable is Ownable {
  event Pause();
  event Unpause();

  bool public paused = false;


  /**
   * @dev modifier to allow actions only when the contract IS paused
   */
  modifier whenNotPaused() {
    require(!paused);
    _;
  }

  /**
   * @dev modifier to allow actions only when the contract IS NOT paused
   */
  modifier whenPaused {
    require(paused);
    _;
  }

  /**
   * @dev called by the owner to pause, triggers stopped state
   */
  function pause() onlyOwner whenNotPaused returns (bool) {
    paused = true;
    Pause();
    return true;
  }

  /**
   * @dev called by the owner to unpause, returns to normal state
   */
  function unpause() onlyOwner whenPaused returns (bool) {
    paused = false;
    Unpause();
    return true;
  }
}

/*
* @title SafeMath
* @dev Math operations with safety checks that throw on error
*/
library SafeMath {
 function mul(uint256 a, uint256 b) internal constant returns (uint256) {
   uint256 c = a * b;
   assert(a == 0 || c / a == b);
   return c;
 }

 function div(uint256 a, uint256 b) internal constant returns (uint256) {
   // assert(b > 0); // Solidity automatically throws when dividing by 0
   uint256 c = a / b;
   // assert(a == b * c + a % b); // There is no case in which this doesn't hold
   return c;
 }

 function sub(uint256 a, uint256 b) internal constant returns (uint256) {
   assert(b <= a);
   return a - b;
 }

 function add(uint256 a, uint256 b) internal constant returns (uint256) {
   uint256 c = a + b;
   assert(c >= a);
   return c;
 }
}

// This is an ERC-20 token contract based on Open Zepplin's StandardToken
// and MintableToken plus the ability to burn tokens.
//
// We had to copy over the code instead of inheriting because of changes
// to the modifier lists of some functions:
//   * transfer(), transferFrom() and approve() are not callable during
//     the minting period, only after MintingFinished()
//   * mint() can only be called by the minter who is not the owner
//     but the HoloTokenSale contract.
//
// Token can be burned by a special 'destroyer' role that can only
// burn its tokens.
contract HoloCredits is Ownable {
  string public constant name = "Holo Hosting Credits";
  string public constant symbol = "HOLO";
  uint8 public constant decimals = 18;

  event Transfer(address indexed from, address indexed to, uint256 value);
  event Approval(address indexed owner, address indexed spender, uint256 value);
  event Mint(address indexed to, uint256 amount);
  event MintingFinished();
  event Burn(uint256 amount);

  uint256 public totalSupply;


  //==================================================================================
  // Zeppelin BasicToken (plus modifier to not allow transfers during minting period):
  //==================================================================================

  using SafeMath for uint256;

  mapping(address => uint256) balances;

  /**
  * @dev transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(address _to, uint256 _value) whenMintingFinished returns (bool) {
    balances[msg.sender] = balances[msg.sender].sub(_value);
    balances[_to] = balances[_to].add(_value);
    Transfer(msg.sender, _to, _value);
    return true;
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param _owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address _owner) constant returns (uint256 balance) {
    return balances[_owner];
  }


  //=====================================================================================
  // Zeppelin StandardToken (plus modifier to not allow transfers during minting period):
  //=====================================================================================
  mapping (address => mapping (address => uint256)) allowed;


  /**
   * @dev Transfer tokens from one address to another
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amout of tokens to be transfered
   */
  function transferFrom(address _from, address _to, uint256 _value) whenMintingFinished returns (bool) {
    var _allowance = allowed[_from][msg.sender];

    // Check is not needed because sub(_allowance, _value) will already throw if this condition is not met
    // require (_value <= _allowance);

    balances[_to] = balances[_to].add(_value);
    balances[_from] = balances[_from].sub(_value);
    allowed[_from][msg.sender] = _allowance.sub(_value);
    Transfer(_from, _to, _value);
    return true;
  }

  /**
   * @dev Aprove the passed address to spend the specified amount of tokens on behalf of msg.sender.
   * @param _spender The address which will spend the funds.
   * @param _value The amount of tokens to be spent.
   */
  function approve(address _spender, uint256 _value) whenMintingFinished returns (bool) {

    // To change the approve amount you first have to reduce the addresses`
    //  allowance to zero by calling `approve(_spender, 0)` if it is not
    //  already 0 to mitigate the race condition described here:
    //  https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
    require((_value == 0) || (allowed[msg.sender][_spender] == 0));

    allowed[msg.sender][_spender] = _value;
    Approval(msg.sender, _spender, _value);
    return true;
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param _owner address The address which owns the funds.
   * @param _spender address The address which will spend the funds.
   * @return A uint256 specifing the amount of tokens still avaible for the spender.
   */
  function allowance(address _owner, address _spender) constant returns (uint256 remaining) {
    return allowed[_owner][_spender];
  }

  //=====================================================================================
  // Minting:
  //=====================================================================================

  bool public mintingFinished = false;
  address public destroyer;
  address public minter;

  modifier canMint() {
    require(!mintingFinished);
    _;
  }

  modifier whenMintingFinished() {
    require(mintingFinished);
    _;
  }

  modifier onlyMinter() {
    require(msg.sender == minter);
    _;
  }

  function setMinter(address _minter) public onlyOwner {
    minter = _minter;
  }

  function mint(address _to, uint256 _amount) onlyMinter canMint  returns (bool) {
    require(balances[_to] + _amount > balances[_to]); // Guard against overflow
    require(totalSupply + _amount > totalSupply);     // Guard against overflow  (this should never happen)
    totalSupply = totalSupply.add(_amount);
    balances[_to] = balances[_to].add(_amount);
    Mint(_to, _amount);
    return true;
  }

  function finishMinting() onlyMinter returns (bool) {
    mintingFinished = true;
    MintingFinished();
    return true;
  }


  //=====================================================================================
  // Burning:
  //=====================================================================================


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
    // We make only 75% of all tokens available for sale.
    // 25% goes to the team.
    // See finalize() in HoloSale contract.
    return totalSupply * 75 / 100;
  }

}


// This contract is a crowdsale based on Zeppelin's Crowdsale.sol but with
// several changes:
//   * the token contract as well as the supply contract get injected
//     with setTokenContract() and setSupplyContract()
//   * we have a dynamic token supply per day which we hold in the statsByDay
//   * once per day, the *updater* role runs the update function to make the
//     contract read the new supply and switch to the next day
//   * we have a minimum amount in ETH per transaction
//   * we have a maximum amount per transaction relative to the daily supply
//
//
contract HoloSale is Ownable, Pausable{
  using SafeMath for uint256;

  // Start and end block where purchases are allowed (both inclusive)
  uint256 public startBlock;
  uint256 public endBlock;
  // Factor between wei and full Holo tokens.
  // (i.e. a rate of 10^18 means one Holo per Ether)
  uint256 public rate;
  // Ratio of the current supply a transaction is allowed to by
  uint256 public maximumPercentageOfDaysSupply;
  // Minimum amount of wei a transaction has to send
  uint256 public minimumAmoutWei;
  // address where funds are being send to on successful buy
  address public wallet;

  // The token being minted on sale
  HoloCredits private tokenContract;
  // The contract to read amount of available fuel from
  HoloSupply private supplyContract;

  // The account that is allowed to call update()
  // which will happen once per day during the sale period
  address private updater;

  // Will be set to true by finalize()
  bool private finalized = false;

  // For every day of the sale we store one instance of this struct
  struct Day {
    // The supply available to sell on a given day
    uint256 supply;
    // The number of units sold on this day
    uint256 sold;
    // We are storing how much fuel each user has bought per day
    // to be able to apply our relative cap per user per day
    // (i.e. nobody is allowed to buy more than 10% of each day's supply)
    mapping(address => uint256) fuelBoughtByAddress;
  }

  // Growing list of days
  Day[] public statsByDay;

  event CreditsCreated(address beneficiary, uint256 amountWei, uint256 amountHolos);


  modifier onlyUpdater {
    require(msg.sender == updater);
    _;
  }

  // Converts wei to smallest fraction of Holo credits.
  // 'rate' is meant to give the factor between weis and full Holo tokens,
  // hence the division by 10^18.
  function holosForWei(uint256 amountWei) internal constant returns (uint256) {
    return amountWei * rate / 1000000000000000000;
  }

  // Contstructor takes start and end block of the sale period,
  // the rate that defines how many full Holo token are being minted per wei
  // (since the Holo token has 18 decimals, 1000000000000000000 would mean that
  // one full Holo is minted per Ether),
  // minimum and maximum limits for incoming ETH transfers
  // and the wallet to which the Ethers are being transfered on updated()
  function HoloSale(
    uint256 _startBlock, uint256 _endBlock,
    uint256 _rate,
    uint256 _minimumAmountWei, uint256 _maximumPercentageOfDaysSupply,
    address _wallet)
  {
    require(_startBlock >= block.number);
    require(_endBlock >= _startBlock);
    require(_rate > 0);
    require(_wallet != 0x0);

    updater = msg.sender;
    startBlock = _startBlock;
    endBlock = _endBlock;
    rate = _rate;
    maximumPercentageOfDaysSupply = _maximumPercentageOfDaysSupply;
    minimumAmoutWei = _minimumAmountWei;
    wallet = _wallet;
  }

  //---------------------------------------------------------------------------
  // Setters and Getters:
  //---------------------------------------------------------------------------

  function setUpdater(address _updater) onlyOwner {
    updater = _updater;
  }

  function setSupplyContract(HoloSupply _supplyContract) onlyOwner {
    supplyContract = _supplyContract;
  }

  function setTokenContract(HoloCredits _tokenContract) onlyOwner {
    tokenContract = _tokenContract;
  }

  function currentDay() returns (uint) {
    return statsByDay.length;
  }

  //---------------------------------------------------------------------------
  // Sending money / adding asks
  //---------------------------------------------------------------------------

  // Fallback function can be used to buy fuel
  function () payable {
    buyFuel(msg.sender);
  }

  // Main function that checks all conditions and then mints fuel receipts
  // and transfers the ETH to our wallet
  function buyFuel(address beneficiary) payable whenNotPaused{
    require(currentDay() > 0);

    // Get current day
    Day storage today = statsByDay[statsByDay.length-1];
    // Calculate how many Holos this transaction would buy
    uint256 amountOfHolosAsked = holosForWei(msg.value);

    require(beneficiary != 0x0);
    require(withinPeriod());
    require(msg.value > minimumAmoutWei);
    require(lessThanMaxRatio(beneficiary, amountOfHolosAsked, today));
    require(lessThanSupply(amountOfHolosAsked, today));

    // Everything fine if we're here
    // Send ETH to our wallet
    wallet.transfer(msg.value);
    // Mint receipts
    tokenContract.mint(beneficiary, amountOfHolosAsked);
    // Log this sale
    today.sold = today.sold.add(amountOfHolosAsked);
    today.fuelBoughtByAddress[beneficiary] = today.fuelBoughtByAddress[beneficiary].add(amountOfHolosAsked);
    CreditsCreated(beneficiary, msg.value, amountOfHolosAsked);
  }

  // Returns true if we are in the live period of the sale
  function withinPeriod() internal constant returns (bool) {
    uint256 current = block.number;
    return current >= startBlock && current <= endBlock;
  }

  // Returns true if amount + plus fuel bought today already is not above
  // the maximum share one could buy today
  function lessThanMaxRatio(address beneficiary, uint256 amount, Day storage today) internal returns (bool) {
    uint256 boughtTodayBefore = today.fuelBoughtByAddress[beneficiary];
    return ((boughtTodayBefore + amount) * 100 / maximumPercentageOfDaysSupply <= today.supply);
  }

  // Returns false if amount would buy more fuel than we can sell today
  function lessThanSupply(uint256 amount, Day today) internal returns (bool) {
    return (today.sold.add(amount) <= today.supply);
  }

  //---------------------------------------------------------------------------
  // Update
  //---------------------------------------------------------------------------

  function update() onlyUpdater {
    // unsoldTokens is the amount of tokens (*10^18) that we can sell today
    uint256 unsoldTokens = supplyContract.supplyAvailableForSale() - tokenContract.totalSupply();
    statsByDay.push(Day(unsoldTokens, 0));
  }

  //---------------------------------------------------------------------------
  // Finalize
  //---------------------------------------------------------------------------

  // Returns true if crowdsale event has ended
  function hasEnded() public constant returns (bool) {
    return block.number > endBlock;
  }

  // Mints a third of all tokens minted so far for the team.
  // => Team ends up with 25% of all tokens.
  // Also calls finishMinting() on the token contract which makes it
  // impossible to mint more.
  function finalize() onlyOwner {
    require(!finalized);
    require(hasEnded());
    uint256 receiptsMinted = tokenContract.totalSupply();
    uint256 shareForTheTeam = receiptsMinted / 3;
    tokenContract.mint(wallet, shareForTheTeam);
    tokenContract.finishMinting();
    finalized = true;
  }
}
