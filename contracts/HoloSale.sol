pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "./HoloReceipt.sol";
import "./HoloSupply.sol";

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
  HoloReceipt private receiptContract;
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

  event ReceiptsCreated(address beneficiary, uint256 amountWei, uint256 amountHolos);


  modifier onlyUpdater {
    require(msg.sender == updater);
    _;
  }

  // Converts wei to smallest fraction of Holo tokens.
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

  function setReceiptContract(HoloReceipt _receiptContract) onlyOwner {
    receiptContract = _receiptContract;
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
    receiptContract.mint(beneficiary, amountOfHolosAsked);
    // Log this sale
    today.sold = today.sold.add(amountOfHolosAsked);
    today.fuelBoughtByAddress[beneficiary] = today.fuelBoughtByAddress[beneficiary].add(amountOfHolosAsked);
    ReceiptsCreated(beneficiary, msg.value, amountOfHolosAsked);
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
    uint256 unsoldTokens = supplyContract.supplyAvailableForSale() - receiptContract.totalSupply();
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
    uint256 receiptsMinted = receiptContract.totalSupply();
    uint256 shareForTheTeam = receiptsMinted / 3;
    receiptContract.mint(wallet, shareForTheTeam);
    receiptContract.finishMinting();
    finalized = true;
  }
}
