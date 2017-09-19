pragma solidity ^0.4.15;
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./HoloToken.sol";
import "./HoloTokenSupply.sol";

contract HoloTokenSale is Ownable{
  using SafeMath for uint256;

  // start and end block where purchases are allowed (both inclusive)
  uint256 public startBlock;
  uint256 public endBlock;
  // how many token units a buyer gets per wei
  uint256 public rate;
  // address where funds are being send to on successful buy
  address public wallet;

  // The token being sold
  HoloToken public tokenContract;
  // The contract to read amount of available tokens from
  HoloTokenSupply private supplyContract;

  // The account that is allowed to call update()
  // which will happen once per day during the active period
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

  event AskAdded(address purchaser, address beneficiary, uint256 value, uint256 amount);
  event Withdrawn(address beneficiary, uint256 value);


  modifier onlyUpdater {
    require(msg.sender == updater);
    _;
  }

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

  function setUpdater(address u) onlyOwner {
    updater = u;
  }

  function setSupplyContract(HoloTokenSupply s) onlyOwner {
    supplyContract = s;
  }

  function setTokenContract(HoloToken t) onlyOwner {
    tokenContract = t;
  }


  // fallback function can be used to buy tokens
  function () payable {
    buyTokens(msg.sender);
  }

  function buyTokens(address beneficiary) payable {
    require(beneficiary != 0x0);
    require(validPurchase());

    if( !(escrow[beneficiary] > 0) ) {
      beneficiaries.push(beneficiary);
    }

    uint256 weiAmount = msg.value;
    escrow[beneficiary] = escrow[beneficiary].add(weiAmount);
    uint256 amountOfHolosAsked = holosForWei(weiAmount);
    demand = demand.add(amountOfHolosAsked);

    AskAdded(msg.sender, beneficiary, weiAmount, amountOfHolosAsked);
  }

  function inEscrowFor(address buyer) returns (uint256){
    return escrow[buyer];
  }

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
    escrow[beneficiary] = 0;
    demand = demand.sub(holosForWei(depositedValue));
    for(uint i=0; i<beneficiaries.length; i++) {
      if(beneficiaries[i] == beneficiary) {
        beneficiaries[i] = beneficiaries[beneficiaries.length-1];
        delete beneficiaries[beneficiaries.length-1];
        beneficiaries.length -= 1;
      }
    }
    beneficiary.transfer(depositedValue);
    Withdrawn(beneficiary, depositedValue);
  }

  function update() onlyUpdater {
    uint256 unsoldTokens = supplyContract.total_supply() - tokenContract.totalSupply();
    address beneficiary;
    uint256 weiToSpent;
    uint256 totalWeiConverted = 0;
    if(demand < unsoldTokens) {
      for(uint i=0; i<beneficiaries.length; i++) {
        beneficiary = beneficiaries[i];
        weiToSpent = escrow[beneficiary];
        if ( weiToSpent > 0 ) {
            exchangeWeiForHolos(beneficiary, weiToSpent);
            totalWeiConverted = totalWeiConverted.add(weiToSpent);
        }
      }
      delete beneficiaries;
    } else {
      uint256 ratio_per_wei = unsoldTokens * 10000000000000000000000 / demand;
      for(i=0; i<beneficiaries.length; i++) {
        beneficiary = beneficiaries[i];
        weiToSpent = escrow[beneficiary] * ratio_per_wei / 10000000000000000000000;
        if ( weiToSpent > 0 ) {
            exchangeWeiForHolos(beneficiary, weiToSpent);
            totalWeiConverted = totalWeiConverted.add(weiToSpent);
        }
      }
    }
    wallet.transfer(totalWeiConverted);
  }

  function holosForWei(uint256 amountWei) internal constant returns (uint256) {
    return amountWei * rate;
  }

  function exchangeWeiForHolos(address beneficiary, uint256 amountWei) internal {
    uint256 amountOfHolos = holosForWei(amountWei);
    escrow[beneficiary] = escrow[beneficiary].sub(amountWei);
    demand = demand.sub(amountOfHolos);
    tokenContract.mint(beneficiary, amountOfHolos);
  }

  // @return true if the transaction can buy tokens
  function validPurchase() internal constant returns (bool) {
    uint256 current = block.number;
    bool withinPeriod = current >= startBlock && current <= endBlock;
    bool nonZeroPurchase = msg.value != 0;
    return withinPeriod && nonZeroPurchase;
  }

  // @return true if crowdsale event has ended
  function hasEnded() public constant returns (bool) {
    return block.number > endBlock;
  }

  function beneficiariesLength() public constant returns (uint) {
    return beneficiaries.length;
  }

  function finalize() onlyOwner {

  }
}
