pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./HoloToken.sol";
import "./HoloTokenSupply.sol";

// This contract is basically an escrow that allows funds
// (that were send to it via the default function or addAsk())
// to leave either back to the sender via withdraw()
// or be exchanged into newly minted Holo tokens in which case the
// send ETH leave the escrow into the owners wallet.
//
// We are capping the amount of tokens that can be bought in accordance
// to the numbers of our simultaneously running crowdfunding.
// The HoloTokenSupply contract will be updated daily and holds the total
// number of tokens that we allow ourselfs to sell.
//
// Also every day, this contract's update() function will be called which
// reads the total supply from HoloTokenSupply and compares it with that
// day's demand and then exchanges the ETH in escrow for the Holos that
// are available today. If the demand is higher than the supply, everybody
// only gets a portion of Holos and the unused ETH stay in escrow for the
// next day.
contract HoloTokenSale is Ownable{
  using SafeMath for uint256;

  // Start and end block where purchases are allowed (both inclusive)
  uint256 public startBlock;
  uint256 public endBlock;
  // Factor between wei and full Holo tokens.
  // (i.e. a rate of 10^18 means one Holo per Ether)
  uint256 public rate;
  // address where funds are being send to on successful buy
  address public wallet;

  // The token being sold
  HoloToken public tokenContract;
  // The contract to read amount of available tokens from
  HoloTokenSupply private supplyContract;

  // The account that is allowed to call update()
  // which will happen once per day during the sale period
  address private updater;

  // Until update() runs and actually mints tokens for the sent ETH
  // (and also after that if the demand could not be met)
  // the money stays in escrow in this contract.
  // This mapping holds how many wei each buyer has in escrow waiting
  // to be spent for Holos.
  mapping(address => uint256) public escrow;

  // This is a list of everybody who has ETH in escrow and needs to be taken
  // into account on the next update.
  address[] public beneficiaries;
  // This is the accumulated total demand (of today) which corresponds to
  // all the ETH in escrow
  uint256 public demand;

  event AskAdded(address purchaser, address beneficiary, uint256 amountWei, uint256 amountHolos);
  event Withdrawn(address beneficiary, uint256 amountWei);
  event Exchange(address beneficiary, uint256 amountWei, uint256 amountHolos);


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
  // one full Holo is minted per Ether)
  // and the wallet to which the Ethers are being transfered on updated()
  function HoloTokenSale(uint256 _startBlock, uint256 _endBlock, uint256 _rate, address _wallet)
  {
    require(_startBlock >= block.number);
    require(_endBlock >= _startBlock);
    require(_rate > 0);
    require(_wallet != 0x0);

    updater = msg.sender;
    startBlock = _startBlock;
    endBlock = _endBlock;
    rate = _rate;
    wallet = _wallet;
  }

  //---------------------------------------------------------------------------
  // Setters and Getters:
  //---------------------------------------------------------------------------

  function setUpdater(address _updater) onlyOwner {
    updater = _updater;
  }

  function setSupplyContract(HoloTokenSupply _supplyContract) onlyOwner {
    supplyContract = _supplyContract;
  }

  function setTokenContract(HoloToken _tokenContract) onlyOwner {
    tokenContract = _tokenContract;
  }

  function inEscrowFor(address beneficiary) returns (uint256){
    return escrow[beneficiary];
  }

  function beneficiariesLength() public constant returns (uint) {
    return beneficiaries.length;
  }

  //---------------------------------------------------------------------------
  // Sending money / adding asks
  //---------------------------------------------------------------------------

  // Fallback function can be used to add asks
  function () payable {
    addAsk(msg.sender);
  }

  // This function gets executed when buyers are sending ETH to this contract.
  // This does not trigger minting of tokens yet but instead puts the ETH
  // into escrow.
  // Once per day, by calling update(), this escrow is being processed per
  // beneficiary and that is why we need to store an array of all beneficiaries
  // that have money in the escrow waiting to be used to buy tokens.
  function addAsk(address beneficiary) payable {
    require(beneficiary != 0x0);
    require(validPurchase());

    if( !(escrow[beneficiary] > 0) ) {
      // List of all beneficiaries with money in escrow.
      // If beneficiary already has ETH in escrow they must be in
      // in the list already which is why we don't add them again.
      beneficiaries.push(beneficiary);
    }

    uint256 weiAmount = msg.value;
    escrow[beneficiary] = escrow[beneficiary].add(weiAmount);
    uint256 amountOfHolosAsked = holosForWei(weiAmount);
    // demand tracks the daily demand
    demand = demand.add(amountOfHolosAsked);

    AskAdded(msg.sender, beneficiary, weiAmount, amountOfHolosAsked);
  }

  // Returns true if the transaction can buy tokens
  function validPurchase() internal constant returns (bool) {
    uint256 current = block.number;
    bool withinPeriod = current >= startBlock && current <= endBlock;
    bool nonZeroPurchase = msg.value != 0;
    return withinPeriod && nonZeroPurchase;
  }

  //---------------------------------------------------------------------------
  // Withdraw from escrow
  //---------------------------------------------------------------------------

  // At any point in time everybody who has ETH in escrow can withdraw
  // all of it by calling this function.
  function withdraw() {
    address beneficiary = msg.sender;
    withdrawInternal(beneficiary);
  }

  function withdrawFor(address beneficiary) onlyOwner {
    withdrawInternal(beneficiary);
  }

  function withdrawInternal(address beneficiary) internal {
    require(escrow[beneficiary] > 0);
    uint256 depositedValue = escrow[beneficiary];

    // We set their escrow to 0
    escrow[beneficiary] = 0;
    // and reduce the demand for today by the number Holos that could
    // have bought.
    demand = demand.sub(holosForWei(depositedValue));

    // Then we need to groom the beneficiaries list by removing this one.
    for(uint i=0; i<beneficiaries.length; i++) {
      if(beneficiaries[i] == beneficiary) {
        beneficiaries[i] = beneficiaries[beneficiaries.length-1];
        delete beneficiaries[beneficiaries.length-1];
        beneficiaries.length -= 1;
      }
    }

    // Finally, we transfer the ETH
    beneficiary.transfer(depositedValue);
    Withdrawn(beneficiary, depositedValue);
  }


  //---------------------------------------------------------------------------
  // Update
  //---------------------------------------------------------------------------

  // This function will be called by us once per day
  // (after updating the supply contract with data from the crowdfund).
  // It compares the available unsold tokens with the demand for which the
  // ETH we hold in escrow.
  // If we have more tokens then demand, everybody will get what they asked for.
  // If we don't have enough tokens to meet the demand we scale everybodys share
  // with the overall ratio between demand and supply.
  function update() onlyUpdater {
    // unsoldTokens is the amount of tokens (*10^18) that we can sell today
    uint256 unsoldTokens = supplyContract.total_supply() - tokenContract.totalSupply();
    // Here we accumulate the amount of wei that were exchanged today
    uint256 totalWeiExchanged = 0;

    if(demand < unsoldTokens) {
      // We have more tokens avaible today than there are asks for
      for(uint i=0; i<beneficiaries.length; i++) {
        address beneficiary = beneficiaries[i];
        // Which means everybody is allowed to exchange their full escrow
        // into Holos:
        uint256 amountWeiToExchange = escrow[beneficiary];
        if ( amountWeiToExchange > 0 ) {
            exchangeWeiForHolos(beneficiary, amountWeiToExchange);
            totalWeiExchanged = totalWeiExchanged.add(amountWeiToExchange);
        }
      }
      // Since all escrows are fully exchanged we can delete this list
      delete beneficiaries;
    } else {
      // We have less tokens today than people would like to buy
      // so we calculate the ratio between supply and demand
      // (with enough padding) ...
      uint256 ratio_per_wei = unsoldTokens * 10000000000000000000000 / demand;
      for(i=0; i<beneficiaries.length; i++) {
        beneficiary = beneficiaries[i];
        // ...and scale each ask with this same ratio (divided by the padding)
        amountWeiToExchange = escrow[beneficiary] * ratio_per_wei / 10000000000000000000000;
        if ( amountWeiToExchange > 0 ) {
            exchangeWeiForHolos(beneficiary, amountWeiToExchange);
            totalWeiExchanged = totalWeiExchanged.add(amountWeiToExchange);
        }
      }
    }

    // All the money that was exchanged for tokens is not in escrow anymore
    // but is being passed on to our wallet.
    wallet.transfer(totalWeiExchanged);
  }

  // This function takes amountWei from beneficiary's escrow and let's
  // the token contract mint the equivalent of Holos for that.
  function exchangeWeiForHolos(address beneficiary, uint256 amountWei) internal {
    uint256 amountOfHolos = holosForWei(amountWei);
    escrow[beneficiary] = escrow[beneficiary].sub(amountWei);
    demand = demand.sub(amountOfHolos);
    tokenContract.mint(beneficiary, amountOfHolos);
    Exchange(beneficiary, amountWei, amountOfHolos);
  }

  // Returns true if crowdsale event has ended
  function hasEnded() public constant returns (bool) {
    return block.number > endBlock;
  }
}
