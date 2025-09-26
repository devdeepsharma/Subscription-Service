// Subscription Service dApp - Frontend Integration
// Contract Address: 0x21190Bb2CAE14C01Dd2fC99Eef5b589ec17f8979

class SubscriptionServiceApp {
  constructor() {
    this.web3 = null;
    this.contract = null;
    this.userAccount = null;
    this.contractAddress = '0x21190Bb2CAE14C01Dd2fC99Eef5b589ec17f8979';
    
    // Contract ABI - Replace with your actual ABI
    this.contractABI = [
      // Basic subscription functions
      {
        "inputs": [{"internalType": "uint256", "name": "planId", "type": "uint256"}],
        "name": "subscribe",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "depositFunds",
        "outputs": [],
        "stateMutability": "payable",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "uint256", "name": "amount", "type": "uint256"}],
        "name": "withdrawBalance",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getUserBalance",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
        "name": "getSubscriptionStatus",
        "outputs": [
          {"internalType": "bool", "name": "isActive", "type": "bool"},
          {"internalType": "uint256", "name": "planId", "type": "uint256"},
          {"internalType": "uint256", "name": "nextPayment", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
      },
      // Events
      {
        "anonymous": false,
        "inputs": [
          {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
          {"indexed": false, "internalType": "uint256", "name": "planId", "type": "uint256"}
        ],
        "name": "SubscriptionCreated",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
          {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "PaymentProcessed",
        "type": "event"
      }
    ];

    this.init();
  }

  async init() {
    await this.checkWeb3();
    this.setupEventListeners();
    this.updateUI();
  }

  // Check for Web3 provider and initialize
  async checkWeb3() {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // Import Web3 dynamically
        const Web3 = (await import('https://cdn.jsdelivr.net/npm/web3@4.0.0/+esm')).default;
        this.web3 = new Web3(window.ethereum);
        
        // Initialize contract
        this.contract = new this.web3.eth.Contract(this.contractABI, this.contractAddress);
        
        console.log('Web3 initialized successfully');
        this.showStatus('Web3 ready. Click Connect Wallet to start.', 'success');
      } catch (error) {
        console.error('Web3 initialization failed:', error);
        this.showStatus('Failed to initialize Web3', 'error');
      }
    } else {
      this.showStatus('MetaMask not detected. Please install MetaMask.', 'error');
      this.showInstallMetaMask();
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Wallet connection
    const connectBtn = document.getElementById('connectWallet');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => this.connectWallet());
    }

    // Subscription actions
    const subscribeBtn = document.getElementById('subscribeBtn');
    if (subscribeBtn) {
      subscribeBtn.addEventListener('click', () => this.handleSubscribe());
    }

    // Balance management
    const depositBtn = document.getElementById('depositBtn');
    if (depositBtn) {
      depositBtn.addEventListener('click', () => this.handleDeposit());
    }

    const withdrawBtn = document.getElementById('withdrawBtn');
    if (withdrawBtn) {
      withdrawBtn.addEventListener('click', () => this.handleWithdraw());
    }

    // Refresh data
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshUserData());
    }

    // Listen for account changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          this.handleDisconnect();
        } else {
          this.userAccount = accounts[0];
          this.refreshUserData();
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }

  // Connect wallet
  async connectWallet() {
    if (!this.web3) {
      this.showStatus('Web3 not initialized', 'error');
      return;
    }

    try {
      this.showStatus('Connecting to wallet...', 'loading');
      
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        this.userAccount = accounts[0];
        await this.refreshUserData();
        this.showStatus('Wallet connected successfully!', 'success');
        this.updateConnectionUI(true);
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      
      if (error.code === 4001) {
        this.showStatus('Connection rejected by user', 'error');
      } else {
        this.showStatus('Failed to connect wallet', 'error');
      }
    }
  }

  // Handle disconnect
  handleDisconnect() {
    this.userAccount = null;
    this.updateConnectionUI(false);
    this.showStatus('Wallet disconnected', 'info');
  }

  // Subscribe to a plan
  async handleSubscribe() {
    if (!this.userAccount) {
      this.showStatus('Please connect your wallet first', 'error');
      return;
    }

    const planSelect = document.getElementById('planSelect');
    const planId = planSelect ? planSelect.value : '0';

    try {
      this.showStatus('Processing subscription...', 'loading');

      const tx = await this.contract.methods.subscribe(planId).send({
        from: this.userAccount,
        value: this.web3.utils.toWei('0.01', 'ether') // Example price
      });

      this.showStatus('Subscription successful!', 'success');
      console.log('Transaction hash:', tx.transactionHash);
      
      // Refresh user data after successful transaction
      setTimeout(() => this.refreshUserData(), 2000);
      
    } catch (error) {
      console.error('Subscription failed:', error);
      this.showStatus('Subscription failed: ' + error.message, 'error');
    }
  }

  // Deposit funds
  async handleDeposit() {
    if (!this.userAccount) {
      this.showStatus('Please connect your wallet first', 'error');
      return;
    }

    const depositInput = document.getElementById('depositAmount');
    const amount = depositInput ? depositInput.value : '0.01';

    if (!amount || parseFloat(amount) <= 0) {
      this.showStatus('Please enter a valid deposit amount', 'error');
      return;
    }

    try {
      this.showStatus('Processing deposit...', 'loading');

      const tx = await this.contract.methods.depositFunds().send({
        from: this.userAccount,
        value: this.web3.utils.toWei(amount, 'ether')
      });

      this.showStatus(`Deposited ${amount} ETH successfully!`, 'success');
      console.log('Transaction hash:', tx.transactionHash);
      
      // Clear input and refresh data
      if (depositInput) depositInput.value = '';
      setTimeout(() => this.refreshUserData(), 2000);
      
    } catch (error) {
      console.error('Deposit failed:', error);
      this.showStatus('Deposit failed: ' + error.message, 'error');
    }
  }

  // Withdraw funds
  async handleWithdraw() {
    if (!this.userAccount) {
      this.showStatus('Please connect your wallet first', 'error');
      return;
    }

    const withdrawInput = document.getElementById('withdrawAmount');
    const amount = withdrawInput ? withdrawInput.value : '0';

    if (!amount || parseFloat(amount) <= 0) {
      this.showStatus('Please enter a valid withdrawal amount', 'error');
      return;
    }

    try {
      this.showStatus('Processing withdrawal...', 'loading');

      const amountWei = this.web3.utils.toWei(amount, 'ether');
      const tx = await this.contract.methods.withdrawBalance(amountWei).send({
        from: this.userAccount
      });

      this.showStatus(`Withdrew ${amount} ETH successfully!`, 'success');
      console.log('Transaction hash:', tx.transactionHash);
      
      // Clear input and refresh data
      if (withdrawInput) withdrawInput.value = '';
      setTimeout(() => this.refreshUserData(), 2000);
      
    } catch (error) {
      console.error('Withdrawal failed:', error);
      this.showStatus('Withdrawal failed: ' + error.message, 'error');
    }
  }

  // Refresh user data
  async refreshUserData() {
    if (!this.userAccount || !this.contract) return;

    try {
      // Get user balance
      const balance = await this.contract.methods.getUserBalance(this.userAccount).call();
      const balanceEth = this.web3.utils.fromWei(balance, 'ether');
      
      // Get subscription status
      const subscription = await this.contract.methods.getSubscriptionStatus(this.userAccount).call();
      
      // Update UI
      this.updateUserDataUI({
        address: this.userAccount,
        balance: balanceEth,
        subscription: {
          isActive: subscription.isActive,
          planId: subscription.planId,
          nextPayment: subscription.nextPayment
        }
      });
      
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      this.showStatus('Failed to load user data', 'error');
    }
  }

  // Update UI with user data
  updateUserDataUI(userData) {
    // Update address
    const addressElement = document.getElementById('userAddress');
    if (addressElement) {
      addressElement.textContent = `${userData.address.slice(0, 6)}...${userData.address.slice(-4)}`;
    }

    // Update balance
    const balanceElement = document.getElementById('userBalance');
    if (balanceElement) {
      balanceElement.textContent = `${parseFloat(userData.balance).toFixed(4)} ETH`;
    }

    // Update subscription status
    const statusElement = document.getElementById('subscriptionStatus');
    if (statusElement) {
      if (userData.subscription.isActive) {
        statusElement.innerHTML = `
          <span class="status-active">Active</span> 
          <small>Plan ${userData.subscription.planId}</small>
        `;
      } else {
        statusElement.innerHTML = '<span class="status-inactive">Not Active</span>';
      }
    }

    // Update next payment
    const nextPaymentElement = document.getElementById('nextPayment');
    if (nextPaymentElement && userData.subscription.isActive) {
      const date = new Date(userData.subscription.nextPayment * 1000);
      nextPaymentElement.textContent = date.toLocaleDateString();
    }
  }

  // Update connection UI
  updateConnectionUI(connected) {
    const connectBtn = document.getElementById('connectWallet');
    const walletInfo = document.getElementById('walletInfo');
    const dappActions = document.getElementById('dappActions');

    if (connectBtn) {
      connectBtn.textContent = connected ? 'Connected' : 'Connect Wallet';
      connectBtn.disabled = connected;
      connectBtn.className = connected ? 'btn btn-success' : 'btn';
    }

    if (walletInfo) {
      walletInfo.style.display = connected ? 'block' : 'none';
    }

    if (dappActions) {
      dappActions.style.display = connected ? 'block' : 'none';
    }
  }

  // Show status messages
  showStatus(message, type = 'info') {
    const statusElement = document.getElementById('statusMessage');
    if (!statusElement) return;

    statusElement.textContent = message;
    statusElement.className = `status-message status-${type}`;
    statusElement.style.display = 'block';

    // Auto-hide after 5 seconds unless it's an error
    if (type !== 'error') {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 5000);
    }
  }

  // Show MetaMask installation prompt
  showInstallMetaMask() {
    const installPrompt = document.getElementById('installMetaMask');
    if (installPrompt) {
      installPrompt.style.display = 'block';
      installPrompt.innerHTML = `
        <div class="install-prompt">
          <h3>MetaMask Required</h3>
          <p>Please install MetaMask to use this dApp</p>
          <a href="https://metamask.io/download/" target="_blank" class="btn">
            Install MetaMask
          </a>
        </div>
      `;
    }
  }

  // Contract event listeners
  setupContractEventListeners() {
    if (!this.contract) return;

    // Listen for subscription events
    this.contract.events.SubscriptionCreated({
      filter: { user: this.userAccount }
    })
    .on('data', (event) => {
      console.log('Subscription created:', event);
      this.showStatus('Subscription activated!', 'success');
      this.refreshUserData();
    })
    .on('error', console.error);

    // Listen for payment events
    this.contract.events.PaymentProcessed({
      filter: { user: this.userAccount }
    })
    .on('data', (event) => {
      console.log('Payment processed:', event);
      this.showStatus('Payment processed automatically', 'info');
      this.refreshUserData();
    })
    .on('error', console.error);
  }

  // Network detection and switching
  async checkNetwork() {
    if (!this.web3) return;

    try {
      const chainId = await this.web3.eth.getChainId();
      const expectedChainId = 1; // Ethereum mainnet

      if (chainId !== expectedChainId) {
        this.showStatus('Please switch to Ethereum Mainnet', 'error');
        
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: this.web3.utils.toHex(expectedChainId) }]
          });
        } catch (switchError) {
          console.error('Failed to switch network:', switchError);
        }
      }
    } catch (error) {
      console.error('Network check failed:', error);
    }
  }

  // Utility: Format timestamp
  formatTimestamp(timestamp) {
    return new Date(timestamp * 1000).toLocaleString();
  }

  // Utility: Format address
  formatAddress(address) {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.subscriptionApp = new SubscriptionServiceApp();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SubscriptionServiceApp;
}
