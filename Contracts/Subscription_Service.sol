// SPDX-License-Identifier: 
pragma solidity ^0.8.19;


contract SubscriptionService {
        struct SubscriptionPlan {
        uint256 price;           // Price per billing cycle in wei
        uint256 duration;        // Duration of each billing cycle in seconds
        bool isActive;           // Whether the plan is currently available
        string name;             // Name of the subscription plan
    }
    
    struct UserSubscription {
        uint256 planId;          // ID of the subscribed plan
        uint256 startTime;       // When the subscription started
        uint256 lastPayment;     // Timestamp of last payment
        uint256 nextPayment;     // Timestamp when next payment is due
        bool isActive;           // Whether the subscription is currently active
        uint256 totalPaid;       // Total amount paid by subscriber
    }
    
    // State variables
    address public owner;
    uint256 public nextPlanId;
    uint256 public totalRevenue;
    
    // Mappings
    mapping(uint256 => SubscriptionPlan) public subscriptionPlans;
    mapping(address => UserSubscription) public userSubscriptions;
    mapping(address => uint256) public userBalances; // For prepaid balances
    
    // Events
    event PlanCreated(uint256 indexed planId, string name, uint256 price, uint256 duration);
    event SubscriptionStarted(address indexed user, uint256 indexed planId, uint256 startTime);
    event PaymentProcessed(address indexed user, uint256 amount, uint256 timestamp);
    event SubscriptionCancelled(address indexed user, uint256 timestamp);
    event FundsDeposited(address indexed user, uint256 amount);
    event FundsWithdrawn(address indexed user, uint256 amount);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier hasActiveSubscription() {
        require(userSubscriptions[msg.sender].isActive, "No active subscription found");
        _;
    }
    
    modifier validPlan(uint256 _planId) {
        require(_planId < nextPlanId && subscriptionPlans[_planId].isActive, "Invalid or inactive plan");
        _;
    }
    
    constructor() {
        owner = msg.sender;
        nextPlanId = 0;
    }
    
    function createSubscriptionPlan(
        string memory _name,
        uint256 _price,
        uint256 _duration
    ) external onlyOwner {
        require(_price > 0, "Price must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");
        require(bytes(_name).length > 0, "Plan name cannot be empty");
        
        subscriptionPlans[nextPlanId] = SubscriptionPlan({
            price: _price,
            duration: _duration,
            isActive: true,
            name: _name
        });
        
        emit PlanCreated(nextPlanId, _name, _price, _duration);
        nextPlanId++;
    }
    
    function subscribeToService(uint256 _planId) external payable validPlan(_planId) {
        require(!userSubscriptions[msg.sender].isActive, "User already has active subscription");
        
        SubscriptionPlan memory plan = subscriptionPlans[_planId];
        require(msg.value >= plan.price, "Insufficient payment for first billing cycle");
        
        // Set up user subscription
        userSubscriptions[msg.sender] = UserSubscription({
            planId: _planId,
            startTime: block.timestamp,
            lastPayment: block.timestamp,
            nextPayment: block.timestamp + plan.duration,
            isActive: true,
            totalPaid: plan.price
        });
        
        // Handle payment
        totalRevenue += plan.price;
        
        // Refund excess payment or store as balance for future payments
        if (msg.value > plan.price) {
            userBalances[msg.sender] += (msg.value - plan.price);
            emit FundsDeposited(msg.sender, msg.value - plan.price);
        }
        
        emit SubscriptionStarted(msg.sender, _planId, block.timestamp);
        emit PaymentProcessed(msg.sender, plan.price, block.timestamp);
    }
    
    /**
     * @dev Core Function 3: Process automatic billing for active subscriptions
     * @param _user Address of the user whose subscription to process
     */
    function processRecurringPayment(address _user) external {
        UserSubscription storage subscription = userSubscriptions[_user];
        require(subscription.isActive, "User has no active subscription");
        require(block.timestamp >= subscription.nextPayment, "Payment not yet due");
        
        SubscriptionPlan memory plan = subscriptionPlans[subscription.planId];
        require(plan.isActive, "Subscription plan is no longer active");
        
        // Check if user has sufficient balance for payment
        if (userBalances[_user] >= plan.price) {
            // Process payment from user balance
            userBalances[_user] -= plan.price;
            subscription.lastPayment = block.timestamp;
            subscription.nextPayment = block.timestamp + plan.duration;
            subscription.totalPaid += plan.price;
            totalRevenue += plan.price;
            
            emit PaymentProcessed(_user, plan.price, block.timestamp);
        } else {
            // Insufficient balance - cancel subscription
            subscription.isActive = false;
            emit SubscriptionCancelled(_user, block.timestamp);
        }
    }
    
    // Additional utility functions
    
    /**
     * @dev Add funds to user balance for future subscription payments
     */
    function depositFunds() external payable {
        require(msg.value > 0, "Must deposit more than 0");
        userBalances[msg.sender] += msg.value;
        emit FundsDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Cancel active subscription
     */
    function cancelSubscription() external hasActiveSubscription {
        userSubscriptions[msg.sender].isActive = false;
        emit SubscriptionCancelled(msg.sender, block.timestamp);
    }
    
    /**
     * @dev Withdraw unused balance
     */
    function withdrawBalance() external {
        uint256 balance = userBalances[msg.sender];
        require(balance > 0, "No balance to withdraw");
        
        userBalances[msg.sender] = 0;
        payable(msg.sender).transfer(balance);
        emit FundsWithdrawn(msg.sender, balance);
    }
    
    /**
     * @dev Owner can withdraw contract revenue
     */
    function withdrawRevenue() external onlyOwner {
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "No revenue to withdraw");
        
        payable(owner).transfer(contractBalance);
    }
    
    /**
     * @dev Deactivate a subscription plan
     */
    function deactivatePlan(uint256 _planId) external onlyOwner {
        require(_planId < nextPlanId, "Plan does not exist");
        subscriptionPlans[_planId].isActive = false;
    }
    
    /**
     * @dev Get subscription details for a user
     */
    function getSubscriptionDetails(address _user) external view returns (
        uint256 planId,
        uint256 startTime,
        uint256 lastPayment,
        uint256 nextPayment,
        bool isActive,
        uint256 totalPaid,
        string memory planName,
        uint256 planPrice
    ) {
        UserSubscription memory subscription = userSubscriptions[_user];
        SubscriptionPlan memory plan = subscriptionPlans[subscription.planId];
        
        return (
            subscription.planId,
            subscription.startTime,
            subscription.lastPayment,
            subscription.nextPayment,
            subscription.isActive,
            subscription.totalPaid,
            plan.name,
            plan.price
        );
    }
    
    /**
     * @dev Check if payment is due for a user
     */
    function isPaymentDue(address _user) external view returns (bool) {
        UserSubscription memory subscription = userSubscriptions[_user];
        return subscription.isActive && block.timestamp >= subscription.nextPayment;
    }
    
 
    function getActivePlans() external view returns (uint256[] memory) {
        uint256[] memory activePlans = new uint256[](nextPlanId);
        uint256 count = 0;
        
        for (uint256 i = 0; i < nextPlanId; i++) {
            if (subscriptionPlans[i].isActive) {
                activePlans[count] = i;
                count++;
            }
        }
        
        // Resize array to actual count
        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activePlans[i];
        }
        
        return result;
    }
}
