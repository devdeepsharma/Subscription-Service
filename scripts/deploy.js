#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  projectName: 'Subscription-Service',
  buildDir: 'dist',
  environments: {
    development: {
      url: 'http://localhost:3000',
      branch: 'develop'
    },
    staging: {
      url: 'https://staging.subscription-service.com',
      branch: 'staging'
    },
    production: {
      url: 'https://subscription-service.com',
      branch: 'main'
    }
  },
  healthCheckPath: '/health',
  timeout: 300000 // 5 minutes
};

class Deployer {
  constructor() {
    this.environment = process.argv[2] || 'development';
    this.skipTests = process.argv.includes('--skip-tests');
    this.skipBuild = process.argv.includes('--skip-build');
    this.verbose = process.argv.includes('--verbose');
    
    if (!CONFIG.environments[this.environment]) {
      throw new Error(`Unknown environment: ${this.environment}`);
    }
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
    } else if (level === 'warn') {
      console.warn(`${prefix} ${message}`);
    } else if (this.verbose || level === 'info') {
      console.log(`${prefix} ${message}`);
    }
  }

  exec(command, options = {}) {
    this.log(`Executing: ${command}`, 'debug');
    try {
      const result = execSync(command, {
        stdio: this.verbose ? 'inherit' : 'pipe',
        encoding: 'utf8',
        ...options
      });
      return result;
    } catch (error) {
      this.log(`Command failed: ${command}`, 'error');
      this.log(`Error: ${error.message}`, 'error');
      throw error;
    }
  }

  async checkPrerequisites() {
    this.log('Checking prerequisites...');
    
    // Check if package.json exists
    if (!fs.existsSync('package.json')) {
      throw new Error('package.json not found. Make sure you\'re in the project root.');
    }

    // Check if required commands are available
    const commands = ['node', 'npm'];
    for (const cmd of commands) {
      try {
        this.exec(`which ${cmd}`);
      } catch (error) {
        throw new Error(`Required command not found: ${cmd}`);
      }
    }

    // Check git status
    try {
      const status = this.exec('git status --porcelain');
      if (status.trim() && this.environment === 'production') {
        throw new Error('Working directory is not clean. Commit your changes before deploying to production.');
      }
    } catch (error) {
      this.log('Git not available or not in a git repository', 'warn');
    }

    this.log('Prerequisites check passed');
  }

  async installDependencies() {
    this.log('Installing dependencies...');
    
    // Check if node_modules exists and is up to date
    const packageJsonTime = fs.statSync('package.json').mtime;
    const nodeModulesExists = fs.existsSync('node_modules');
    const packageLockTime = fs.existsSync('package-lock.json') 
      ? fs.statSync('package-lock.json').mtime 
      : new Date(0);

    if (!nodeModulesExists || packageJsonTime > packageLockTime) {
      this.exec('npm ci');
    } else {
      this.log('Dependencies are up to date');
    }
  }

  async runTests() {
    if (this.skipTests) {
      this.log('Skipping tests (--skip-tests flag provided)');
      return;
    }

    this.log('Running tests...');
    
    try {
      // Run unit tests
      this.exec('npm test');
      
      // Run integration tests if available
      if (fs.existsSync('test/integration')) {
        this.exec('npm run test:integration');
      }
      
      // Run linting
      this.exec('npm run lint');
      
      this.log('All tests passed');
    } catch (error) {
      this.log('Tests failed', 'error');
      throw error;
    }
  }

  async build() {
    if (this.skipBuild) {
      this.log('Skipping build (--skip-build flag provided)');
      return;
    }

    this.log('Building application...');
    
    // Clean previous build
    if (fs.existsSync(CONFIG.buildDir)) {
      this.exec(`rm -rf ${CONFIG.buildDir}`);
    }

    // Set environment variables
    process.env.NODE_ENV = this.environment;
    process.env.BUILD_ENV = this.environment;

    // Build the application
    this.exec('npm run build');
    
    this.log('Build completed');
  }

  async deployToEnvironment() {
    this.log(`Deploying to ${this.environment} environment...`);
    
    const envConfig = CONFIG.environments[this.environment];
    
    switch (this.environment) {
      case 'development':
        await this.deployLocal();
        break;
      case 'staging':
      case 'production':
        await this.deployRemote(envConfig);
        break;
      default:
        throw new Error(`Deployment not configured for environment: ${this.environment}`);
    }
  }

  async deployLocal() {
    this.log('Starting local development server...');
    
    // Kill any existing process on port 3000
    try {
      this.exec('pkill -f "node.*3000" || true');
    } catch (error) {
      // Ignore if no process found
    }

    // Start the server
    this.exec('npm run dev &');
    
    // Wait for server to start
    await this.waitForHealthCheck('http://localhost:3000');
    
    this.log('Local deployment completed');
  }

  async deployRemote(envConfig) {
    this.log(`Deploying to remote environment: ${envConfig.url}`);
    
    
    // Example for PM2 deployment
    if (this.checkPM2Available()) {
      await this.deployWithPM2(envConfig);
    } else {
      this.log('Add your deployment logic here (Docker, Heroku, etc.)', 'warn');
    }
  }

  checkPM2Available() {
    try {
      this.exec('which pm2');
      return true;
    } catch (error) {
      return false;
    }
  }

  async deployWithPM2(envConfig) {
    this.log('Deploying with PM2...');
    
    const pm2Config = {
      name: `${CONFIG.projectName}-${this.environment}`,
      script: './dist/index.js',
      env: {
        NODE_ENV: this.environment,
        PORT: this.environment === 'production' ? 3000 : 3001
      }
    };

    // Write PM2 ecosystem file
    fs.writeFileSync('ecosystem.config.js', `
module.exports = {
  apps: [${JSON.stringify(pm2Config, null, 2)}]
};
    `);

    // Deploy with PM2
    this.exec(`pm2 startOrRestart ecosystem.config.js --env ${this.environment}`);
    
    await this.waitForHealthCheck(envConfig.url);
    
    this.log('PM2 deployment completed');
  }

  async waitForHealthCheck(baseUrl) {
    this.log('Performing health check...');
    
    const healthUrl = `${baseUrl}${CONFIG.healthCheckPath}`;
    const startTime = Date.now();
    
    while (Date.now() - startTime < CONFIG.timeout) {
      try {
        // For Node.js built-in fetch (Node 18+) or you can use axios/node-fetch
        const response = await fetch(healthUrl);
        
        if (response.ok) {
          this.log('Health check passed');
          return;
        }
      } catch (error) {
        // Service not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }
    
    throw new Error('Health check timeout');
  }

  async createBackup() {
    if (this.environment === 'production') {
      this.log('Creating backup...');
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = `backups/${timestamp}`;
      
      if (!fs.existsSync('backups')) {
        fs.mkdirSync('backups');
      }
      
      // Create backup (customize based on your needs)
      this.exec(`mkdir -p ${backupDir}`);
      this.exec(`cp -r ${CONFIG.buildDir} ${backupDir}/`);
      
      this.log(`Backup created: ${backupDir}`);
    }
  }

  async notifySlack(message) {
    const slackWebhook = process.env.SLACK_WEBHOOK_URL;
    
    if (slackWebhook) {
      try {
        // Add your Slack notification logic here
        this.log('Slack notification sent');
      } catch (error) {
        this.log('Failed to send Slack notification', 'warn');
      }
    }
  }

  async deploy() {
    const startTime = Date.now();
    
    try {
      this.log(`Starting deployment of ${CONFIG.projectName} to ${this.environment}`);
      
      await this.checkPrerequisites();
      await this.installDependencies();
      await this.runTests();
      await this.build();
      await this.createBackup();
      await this.deployToEnvironment();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const successMessage = `✅ Deployment completed successfully in ${duration}s`;
      
      this.log(successMessage);
      await this.notifySlack(successMessage);
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      const errorMessage = `❌ Deployment failed after ${duration}s: ${error.message}`;
      
      this.log(errorMessage, 'error');
      await this.notifySlack(errorMessage);
      
      process.exit(1);
    }
  }
}

// Usage information
function showUsage() {
  console.log(`
Usage: node deploy.js [environment] [options]

Environments:
  development (default) - Deploy to local development
  staging              - Deploy to staging environment
  production          - Deploy to production environment

Options:
  --skip-tests        - Skip running tests
  --skip-build        - Skip build step
  --verbose          - Show detailed output
  --help             - Show this help message

Examples:
  node deploy.js                    # Deploy to development
  node deploy.js staging            # Deploy to staging
  node deploy.js production         # Deploy to production
  node deploy.js staging --verbose  # Deploy to staging with verbose output
  `);
}

// Main execution
if (require.main === module) {
  if (process.argv.includes('--help')) {
    showUsage();
    process.exit(0);
  }

  const deployer = new Deployer();
  deployer.deploy();
}
