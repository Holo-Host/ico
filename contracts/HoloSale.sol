pragma solidity ^0.4.18;
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./HoloToken.sol";
import "./HoloWhitelist.sol";

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
  uint256 public minimumAmountWei;
  // address where funds are being send to on successful buy
  address public wallet;

  // The token being minted on sale
  HoloToken private tokenContract;
  // The contract to check beneficiaries' address against
  // and to hold number of reserved tokens per day
  HoloWhitelist private whitelistContract;

  // The account that is allowed to call update()
  // which will happen once per day during the sale period
  address private updater;

  // Will be set to true by finalize()
  bool private finalized = false;

  uint256 public totalSupply;

  // For every day of the sale we store one instance of this struct
  struct Day {
    // The supply available to sell on this day
    uint256 supply;
    // The number of unreserved tokens sold on this day
    uint256 soldFromUnreserved;
    // Number of tokens reserved today
    uint256 reserved;
    // Number of reserved tokens sold today
    uint256 soldFromReserved;
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

  // Converts wei to smallest fraction of Holo tokens.
  // 'rate' is meant to give the factor between weis and full Holo tokens,
  // hence the division by 10^18.
  function holosForWei(uint256 amountWei) internal view returns (uint256) {
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
    address _wallet) public
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
    minimumAmountWei = _minimumAmountWei;
    wallet = _wallet;
  }

  //---------------------------------------------------------------------------
  // Setters and Getters:
  //---------------------------------------------------------------------------

  function setUpdater(address _updater) external onlyOwner {
    updater = _updater;
  }

  function setTokenContract(HoloToken _tokenContract) external onlyOwner {
    tokenContract = _tokenContract;
  }

  function setWhitelistContract(HoloWhitelist _whitelistContract) external onlyOwner {
    whitelistContract = _whitelistContract;
  }

  function currentDay() public view returns (uint) {
    return statsByDay.length;
  }

  function todaysSupply() external view returns (uint) {
    return statsByDay[currentDay()-1].supply;
  }

  function todaySold() external view returns (uint) {
    return statsByDay[currentDay()-1].soldFromUnreserved + statsByDay[currentDay()-1].soldFromReserved;
  }

  function todayReserved() external view returns (uint) {
    return statsByDay[currentDay()-1].reserved;
  }

  //---------------------------------------------------------------------------
  // Sending money / adding asks
  //---------------------------------------------------------------------------

  // Fallback function can be used to buy fuel
  function () public payable {
    buyFuel(msg.sender);
  }

  // Main function that checks all conditions and then mints fuel tokens
  // and transfers the ETH to our wallet
  function buyFuel(address beneficiary) public payable whenNotPaused{
    require(currentDay() > 0);
    require(whitelistContract.isWhitelisted(beneficiary));
    require(beneficiary != 0x0);
    require(withinPeriod());

    // Calculate how many Holos this transaction would buy
    uint256 amountOfHolosAsked = holosForWei(msg.value);

    // Get current day
    uint dayIndex = statsByDay.length-1;
    Day storage today = statsByDay[dayIndex];

    // Funders who took part in the crowdfund could have reserved tokens
    uint256 reservedHolos = whitelistContract.reservedTokens(beneficiary, dayIndex);
    // If they do, make sure to subtract what they bought already today
    uint256 alreadyBought = today.fuelBoughtByAddress[beneficiary];
    if(alreadyBought >= reservedHolos) {
      reservedHolos = 0;
    } else {
      reservedHolos = reservedHolos.sub(alreadyBought);
    }

    // Calculate if they asked more than they have reserved
    uint256 askedMoreThanReserved;
    uint256 useFromReserved;
    if(amountOfHolosAsked > reservedHolos) {
      askedMoreThanReserved = amountOfHolosAsked.sub(reservedHolos);
      useFromReserved = reservedHolos;
    } else {
      askedMoreThanReserved = 0;
      useFromReserved = amountOfHolosAsked;
    }

    if(reservedHolos == 0) {
      // If this transaction is not claiming reserved tokens
      // it has to be over the minimum.
      // (Reserved tokens must be claimable even if it would be just few)
      require(msg.value >= minimumAmountWei);
    }

    // The non-reserved tokens asked must not exceed the max-ratio
    // nor the available supply.
    require(lessThanMaxRatio(beneficiary, askedMoreThanReserved, today));
    require(lessThanSupply(askedMoreThanReserved, today));

    // Everything fine if we're here
    // Send ETH to our wallet
    wallet.transfer(msg.value);
    // Mint receipts
    tokenContract.mint(beneficiary, amountOfHolosAsked);
    // Log this sale
    today.soldFromUnreserved = today.soldFromUnreserved.add(askedMoreThanReserved);
    today.soldFromReserved = today.soldFromReserved.add(useFromReserved);
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
  function lessThanMaxRatio(address beneficiary, uint256 amount, Day storage today) internal view returns (bool) {
    uint256 boughtTodayBefore = today.fuelBoughtByAddress[beneficiary];
    return boughtTodayBefore.add(amount).mul(100).div(maximumPercentageOfDaysSupply) <= today.supply;
  }

  // Returns false if amount would buy more fuel than we can sell today
  function lessThanSupply(uint256 amount, Day today) internal pure returns (bool) {
    return today.soldFromUnreserved.add(amount) <= today.supply.sub(today.reserved);
  }

  //---------------------------------------------------------------------------
  // Update
  //---------------------------------------------------------------------------


  function update(uint256 newTotalSupply, uint256 reservedTokensNextDay) external onlyUpdater {
    totalSupply = newTotalSupply;
    // daysSupply is the amount of tokens (*10^18) that we can sell today
    uint256 daysSupply = newTotalSupply.sub(tokenContract.totalSupply());
    statsByDay.push(Day(daysSupply, 0, reservedTokensNextDay, 0));
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
  function finalize() external onlyOwner {
    require(!finalized);
    require(hasEnded());
    uint256 receiptsMinted = tokenContract.totalSupply();
    uint256 shareForTheTeam = receiptsMinted.div(3);
    tokenContract.mint(wallet, shareForTheTeam);
    tokenContract.finishMinting();
    finalized = true;
  }
}
