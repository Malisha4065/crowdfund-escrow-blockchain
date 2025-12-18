// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Crowdfund {
    
    struct Campaign {
        address creator;
        uint goal;
        uint pledged;
        uint32 startAt;
        uint32 endAt;
        bool claimed;
    }

    uint public count;
    mapping(uint => Campaign) public campaigns;
    mapping(uint => mapping(address => uint)) public pledgedAmount;

    // EVENTS
    event Launch(uint id, address indexed creator, uint goal, uint32 startAt, uint32 endAt);
    event Pledge(uint indexed id, address indexed caller, uint amount);
    event Unpledge(uint indexed id, address indexed caller, uint amount);
    event Claim(uint id);
    event Refund(uint id, address indexed caller, uint amount);

    // SECURITY MODIFIER: Reentrancy Guard
    bool internal locked;
    modifier nonReentrant() {
        require(!locked, "REENTRANCY_DETECTED");
        locked = true;
        _;
        locked = false;
    }

    // 1. LAUNCH CAMPAIGN
    function launch(uint _goal, uint32 _startAt, uint32 _endAt) external {
        require(_startAt >= block.timestamp, "Start time invalid");
        require(_endAt > _startAt, "End time invalid");
        require(_endAt <= block.timestamp + 90 days, "Duration too long");

        count += 1;
        campaigns[count] = Campaign({
            creator: msg.sender,
            goal: _goal,
            pledged: 0,
            startAt: _startAt,
            endAt: _endAt,
            claimed: false
        });

        emit Launch(count, msg.sender, _goal, _startAt, _endAt);
    }

    // 2. DONATE (PLEDGE)
    function pledge(uint _id) external payable {
        Campaign storage campaign = campaigns[_id];
        require(block.timestamp >= campaign.startAt, "Not started");
        require(block.timestamp <= campaign.endAt, "Ended");

        campaign.pledged += msg.value;
        pledgedAmount[_id][msg.sender] += msg.value;

        emit Pledge(_id, msg.sender, msg.value);
    }

    // 3. WITHDRAW (REFUND) - The "Secure" Pull Pattern
    // SECURITY: Prevents DoS by making users pull their own funds
    function refund(uint _id) external nonReentrant {
        Campaign storage campaign = campaigns[_id];
        require(block.timestamp > campaign.endAt, "Not ended");
        require(campaign.pledged < campaign.goal, "Goal met, cannot refund");

        uint bal = pledgedAmount[_id][msg.sender];
        require(bal > 0, "No balance to refund");

        // STEP 1: EFFECTS (Update state BEFORE sending money)
        pledgedAmount[_id][msg.sender] = 0;

        // STEP 2: INTERACTIONS (Send money)
        (bool sent, ) = payable(msg.sender).call{value: bal}("");
        require(sent, "Failed to send Ether");

        emit Refund(_id, msg.sender, bal);
    }

    // 4. CLAIM FUNDS (For Campaign Creator)
    function claim(uint _id) external nonReentrant {
        Campaign storage campaign = campaigns[_id];
        require(campaign.creator == msg.sender, "Not creator");
        require(block.timestamp > campaign.endAt, "Not ended");
        require(campaign.pledged >= campaign.goal, "Goal not met");
        require(!campaign.claimed, "Already claimed");

        // EFFECTS
        campaign.claimed = true;

        // INTERACTIONS
        (bool sent, ) = payable(msg.sender).call{value: campaign.pledged}("");
        require(sent, "Failed to send Ether");

        emit Claim(_id);
    }
}