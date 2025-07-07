#!/usr/bin/env node

/**
 * Google Cloud Service Account Setup Guide
 * Run this script to get step-by-step instructions for setting up authentication
 */

const fs = require('fs');
const path = require('path');

class GoogleAuthSetup {
    constructor() {
        this.envPath = path.join(__dirname, '.env');
        this.credentialsPath = path.join(__dirname, 'credentials');
    }

    displaySetupInstructions() {
        console.log('\n🔐 GOOGLE CLOUD SERVICE ACCOUNT SETUP GUIDE\n');
        console.log('='.repeat(50));
        
        console.log('\n📋 STEP 1: Create Google Cloud Project');
        console.log('1. Go to https://console.cloud.google.com/');
        console.log('2. Create a new project or select existing project');
        console.log('3. Note your PROJECT_ID\n');
        
        console.log('📋 STEP 2: Enable Google Sheets API');
        console.log('1. Go to APIs & Services > Library');
        console.log('2. Search for "Google Sheets API"');
        console.log('3. Click "Enable"\n');
        
        console.log('📋 STEP 3: Create Service Account');
        console.log('1. Go to APIs & Services > Credentials');
        console.log('2. Click "Create Credentials" > Service Account');
        console.log('3. Name: "jiji-diving-bot-service"');
        console.log('4. Role: "Editor" (or "Sheets API User")');
        console.log('5. Click "Create"\n');
        
        console.log('📋 STEP 4: Download Service Account Key');
        console.log('1. Click on the created service account');
        console.log('2. Go to "Keys" tab');
        console.log('3. Click "Add Key" > "Create new key"');
        console.log('4. Select "JSON" format');
        console.log('5. Download the JSON file\n');
        
        console.log('📋 STEP 5: Setup Local Environment');
        console.log('1. Create "credentials" folder in your project root');
        console.log('2. Move the downloaded JSON file to credentials/');
        console.log('3. Rename it to "google-service-account.json"');
        console.log('4. Run this script again with --configure flag\n');
        
        console.log('💡 NEXT STEPS:');
        console.log('node setup-google-auth.js --configure');
        console.log('npm run setup-sheets');
    }

    async configureEnvironment() {
        console.log('\n🔧 CONFIGURING ENVIRONMENT...\n');
        
        // Check if credentials file exists
        const credentialsFile = path.join(this.credentialsPath, 'google-service-account.json');
        if (!fs.existsSync(credentialsFile)) {
            console.log('❌ Service account key file not found!');
            console.log(`Expected location: ${credentialsFile}`);
            console.log('Please follow the setup instructions first.');
            return;
        }

        // Read service account details
        const serviceAccount = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
        
        // Update or create .env file
        const envContent = `
# Google Sheets API Configuration
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./credentials/google-service-account.json
GOOGLE_SHEETS_PRIVATE_KEY="${serviceAccount.private_key}"
GOOGLE_SHEETS_CLIENT_EMAIL="${serviceAccount.client_email}"
GOOGLE_PROJECT_ID="${serviceAccount.project_id}"

# Jiji Shops Spreadsheet ID (will be created)
JIJI_SHOPS_SPREADSHEET_ID=""

# Other environment variables
NODE_ENV=development
PORT=3000
`;

        fs.writeFileSync(this.envPath, envContent.trim());
        console.log('✅ Environment configuration created!');
        console.log('📁 File: .env');
        
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. Create Google Sheet: node create-sheets.js');
        console.log('2. Migrate CSV data: node migrate-csv-data.js');
        console.log('3. Test connection: node test-sheets-connection.js');
    }

    createDirectories() {
        if (!fs.existsSync(this.credentialsPath)) {
            fs.mkdirSync(this.credentialsPath, { recursive: true });
            console.log('📁 Created credentials directory');
        }
    }
}

// Command line interface
const setup = new GoogleAuthSetup();
const args = process.argv.slice(2);

if (args.includes('--configure')) {
    setup.createDirectories();
    setup.configureEnvironment();
} else {
    setup.displaySetupInstructions();
}