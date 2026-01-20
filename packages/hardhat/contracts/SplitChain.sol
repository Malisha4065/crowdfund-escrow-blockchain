// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SplitChain
 * @notice Decentralized expense splitting with one-click crypto settlement
 * @dev A blockchain-based Splitwise alternative
 */
contract SplitChain {
    // ============ DATA STRUCTURES ============

    struct Group {
        string name;
        address creator;
        bool active;
    }

    struct Expense {
        uint256 groupId;
        address payer;
        uint256 amount;
        string description;
        uint256 timestamp;
        uint256 participantCount;
    }

    struct SimplifiedDebt {
        address debtor;
        address creditor;
        uint256 amount;
    }

    // ============ STATE VARIABLES ============

    uint256 public groupCount;
    uint256 public expenseCount;

    // Group ID => Group
    mapping(uint256 => Group) public groups;

    // Group ID => member address => is member
    mapping(uint256 => mapping(address => bool)) public isMember;

    // Group ID => array of member addresses
    mapping(uint256 => address[]) public groupMembers;

    // Expense ID => Expense
    mapping(uint256 => Expense) public expenses;

    // Expense ID => participant address => is participant
    mapping(uint256 => mapping(address => bool)) public isParticipant;

    // Expense ID => array of participants
    mapping(uint256 => address[]) public expenseParticipants;

    // Group ID => array of expense IDs
    mapping(uint256 => uint256[]) public groupExpenses;

    // Group ID => member => net balance (positive = owed money, negative = owes money)
    // Stored as two separate mappings to handle signed integers properly
    mapping(uint256 => mapping(address => int256)) public memberBalances;

    // ============ EVENTS ============

    event GroupCreated(uint256 indexed groupId, string name, address indexed creator);
    event MemberJoined(uint256 indexed groupId, address indexed member);
    event MemberLeft(uint256 indexed groupId, address indexed member);
    event ExpenseAdded(
        uint256 indexed groupId,
        uint256 indexed expenseId,
        address indexed payer,
        uint256 amount,
        string description
    );
    event DebtSettled(
        uint256 indexed groupId,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    // ============ MODIFIERS ============

    modifier onlyMember(uint256 _groupId) {
        require(isMember[_groupId][msg.sender], "Not a group member");
        _;
    }

    modifier groupExists(uint256 _groupId) {
        require(_groupId > 0 && _groupId <= groupCount, "Group does not exist");
        require(groups[_groupId].active, "Group is not active");
        _;
    }

    // Reentrancy guard
    bool private locked;
    modifier nonReentrant() {
        require(!locked, "REENTRANCY_DETECTED");
        locked = true;
        _;
        locked = false;
    }

    // ============ GROUP FUNCTIONS ============

    /**
     * @notice Create a new expense-splitting group
     * @param _name Name of the group
     * @param _initialMembers Array of initial member addresses
     */
    function createGroup(string calldata _name, address[] calldata _initialMembers) external returns (uint256) {
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(_initialMembers.length > 0, "Must have at least one member");

        groupCount++;
        uint256 groupId = groupCount;

        groups[groupId] = Group({
            name: _name,
            creator: msg.sender,
            active: true
        });

        // Add creator as member
        isMember[groupId][msg.sender] = true;
        groupMembers[groupId].push(msg.sender);

        // Add initial members
        for (uint256 i = 0; i < _initialMembers.length; i++) {
            address member = _initialMembers[i];
            if (member != msg.sender && member != address(0) && !isMember[groupId][member]) {
                isMember[groupId][member] = true;
                groupMembers[groupId].push(member);
                emit MemberJoined(groupId, member);
            }
        }

        emit GroupCreated(groupId, _name, msg.sender);
        emit MemberJoined(groupId, msg.sender);

        return groupId;
    }

    /**
     * @notice Join an existing group
     * @param _groupId ID of the group to join
     */
    function joinGroup(uint256 _groupId) external groupExists(_groupId) {
        require(!isMember[_groupId][msg.sender], "Already a member");

        isMember[_groupId][msg.sender] = true;
        groupMembers[_groupId].push(msg.sender);

        emit MemberJoined(_groupId, msg.sender);
    }

    /**
     * @notice Get all members of a group
     * @param _groupId ID of the group
     */
    function getGroupMembers(uint256 _groupId) external view groupExists(_groupId) returns (address[] memory) {
        return groupMembers[_groupId];
    }

    /**
     * @notice Get group details
     * @param _groupId ID of the group
     */
    function getGroup(uint256 _groupId) external view returns (string memory name, address creator, bool active, uint256 memberCount) {
        Group storage group = groups[_groupId];
        return (group.name, group.creator, group.active, groupMembers[_groupId].length);
    }

    // ============ EXPENSE FUNCTIONS ============

    /**
     * @notice Add an expense to a group (equal split among participants)
     * @param _groupId ID of the group
     * @param _amount Amount in wei
     * @param _description Description of the expense
     * @param _participants Array of addresses sharing this expense
     */
    function addExpense(
        uint256 _groupId,
        uint256 _amount,
        string calldata _description,
        address[] calldata _participants
    ) external groupExists(_groupId) onlyMember(_groupId) returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(_participants.length > 0, "Must have at least one participant");

        // Validate all participants are members
        for (uint256 i = 0; i < _participants.length; i++) {
            require(isMember[_groupId][_participants[i]], "Participant not a member");
        }

        expenseCount++;
        uint256 expenseId = expenseCount;

        expenses[expenseId] = Expense({
            groupId: _groupId,
            payer: msg.sender,
            amount: _amount,
            description: _description,
            timestamp: block.timestamp,
            participantCount: _participants.length
        });

        // Store participants
        for (uint256 i = 0; i < _participants.length; i++) {
            isParticipant[expenseId][_participants[i]] = true;
            expenseParticipants[expenseId].push(_participants[i]);
        }

        groupExpenses[_groupId].push(expenseId);

        // Update balances: payer gets credit, participants get debited
        uint256 sharePerPerson = _amount / _participants.length;

        // Credit the payer
        memberBalances[_groupId][msg.sender] += int256(_amount);

        // Debit each participant their share
        for (uint256 i = 0; i < _participants.length; i++) {
            memberBalances[_groupId][_participants[i]] -= int256(sharePerPerson);
        }

        emit ExpenseAdded(_groupId, expenseId, msg.sender, _amount, _description);

        return expenseId;
    }

    /**
     * @notice Get expense details
     * @param _expenseId ID of the expense
     */
    function getExpense(uint256 _expenseId) external view returns (
        uint256 groupId,
        address payer,
        uint256 amount,
        string memory description,
        uint256 timestamp,
        address[] memory participants
    ) {
        Expense storage expense = expenses[_expenseId];
        return (
            expense.groupId,
            expense.payer,
            expense.amount,
            expense.description,
            expense.timestamp,
            expenseParticipants[_expenseId]
        );
    }

    /**
     * @notice Get all expense IDs for a group
     * @param _groupId ID of the group
     */
    function getGroupExpenses(uint256 _groupId) external view groupExists(_groupId) returns (uint256[] memory) {
        return groupExpenses[_groupId];
    }

    // ============ BALANCE & SETTLEMENT FUNCTIONS ============

    /**
     * @notice Get a member's net balance in a group
     * @param _groupId ID of the group
     * @param _member Address of the member
     * @return Positive = owed money, Negative = owes money
     */
    function getMemberBalance(uint256 _groupId, address _member) external view returns (int256) {
        return memberBalances[_groupId][_member];
    }

    /**
     * @notice Get all member balances for a group
     * @param _groupId ID of the group
     */
    function getAllBalances(uint256 _groupId) external view groupExists(_groupId) returns (
        address[] memory members,
        int256[] memory balances
    ) {
        address[] memory _members = groupMembers[_groupId];
        int256[] memory _balances = new int256[](_members.length);

        for (uint256 i = 0; i < _members.length; i++) {
            _balances[i] = memberBalances[_groupId][_members[i]];
        }

        return (_members, _balances);
    }

    /**
     * @notice Calculate simplified debts (minimize number of transactions)
     * @param _groupId ID of the group
     * @dev Uses greedy algorithm: match largest creditor with largest debtor
     */
    function getSimplifiedDebts(uint256 _groupId) external view groupExists(_groupId) returns (SimplifiedDebt[] memory) {
        address[] memory members = groupMembers[_groupId];
        uint256 memberLen = members.length;

        // Create temporary arrays for balances
        int256[] memory balances = new int256[](memberLen);
        for (uint256 i = 0; i < memberLen; i++) {
            balances[i] = memberBalances[_groupId][members[i]];
        }

        // Count how many debts we might need (worst case: n-1)
        SimplifiedDebt[] memory tempDebts = new SimplifiedDebt[](memberLen);
        uint256 debtCount = 0;

        // Greedy algorithm: match debtors with creditors
        for (uint256 iteration = 0; iteration < memberLen; iteration++) {
            // Find max creditor and max debtor
            int256 maxCredit = 0;
            int256 maxDebt = 0;
            uint256 maxCreditorIdx = 0;
            uint256 maxDebtorIdx = 0;

            for (uint256 i = 0; i < memberLen; i++) {
                if (balances[i] > maxCredit) {
                    maxCredit = balances[i];
                    maxCreditorIdx = i;
                }
                if (balances[i] < maxDebt) {
                    maxDebt = balances[i];
                    maxDebtorIdx = i;
                }
            }

            // If no more debts, we're done
            if (maxCredit <= 0 || maxDebt >= 0) {
                break;
            }

            // Settlement amount is min of what's owed and what's due
            int256 settlementAmount = maxCredit < -maxDebt ? maxCredit : -maxDebt;

            // Record this debt
            tempDebts[debtCount] = SimplifiedDebt({
                debtor: members[maxDebtorIdx],
                creditor: members[maxCreditorIdx],
                amount: uint256(settlementAmount)
            });
            debtCount++;

            // Update balances
            balances[maxCreditorIdx] -= settlementAmount;
            balances[maxDebtorIdx] += settlementAmount;
        }

        // Create properly sized result array
        SimplifiedDebt[] memory result = new SimplifiedDebt[](debtCount);
        for (uint256 i = 0; i < debtCount; i++) {
            result[i] = tempDebts[i];
        }

        return result;
    }

    /**
     * @notice Settle your debt to a specific creditor
     * @param _groupId ID of the group
     * @param _creditor Address of the person you're paying
     */
    function settleDebt(uint256 _groupId, address _creditor) external payable groupExists(_groupId) onlyMember(_groupId) nonReentrant {
        require(_creditor != msg.sender, "Cannot settle with yourself");
        require(isMember[_groupId][_creditor], "Creditor not a member");
        require(msg.value > 0, "Must send ETH to settle");

        int256 myBalance = memberBalances[_groupId][msg.sender];
        int256 creditorBalance = memberBalances[_groupId][_creditor];

        require(myBalance < 0, "You don't owe anything");
        require(creditorBalance > 0, "Creditor is not owed anything");

        uint256 maxPayable = uint256(-myBalance);
        require(msg.value <= maxPayable, "Cannot overpay your debt");

        // Update balances
        memberBalances[_groupId][msg.sender] += int256(msg.value);
        memberBalances[_groupId][_creditor] -= int256(msg.value);

        // Transfer ETH to creditor
        (bool sent, ) = payable(_creditor).call{value: msg.value}("");
        require(sent, "Failed to send ETH");

        emit DebtSettled(_groupId, msg.sender, _creditor, msg.value);
    }

    /**
     * @notice Get user's groups (groups they're a member of)
     * @dev This is gas-intensive for many groups - consider off-chain indexing for production
     */
    function getUserGroups(address _user) external view returns (uint256[] memory) {
        uint256[] memory tempGroups = new uint256[](groupCount);
        uint256 count = 0;

        for (uint256 i = 1; i <= groupCount; i++) {
            if (isMember[i][_user] && groups[i].active) {
                tempGroups[count] = i;
                count++;
            }
        }

        // Create properly sized result
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = tempGroups[i];
        }

        return result;
    }
}
