#!/usr/bin/env node

/**
 * Google Sheets Connection Test
 * Verifies that the setup is working correctly
 */

const { JijiSheetsConnector } = require('./src/sheets-connector');
require('dotenv').config();

class SheetsConnectionTest {
    constructor() {
        this.connector = new JijiSheetsConnector();
    }

    async testConnection() {
        console.log('\n🔍 TESTING GOOGLE SHEETS CONNECTION\n');
        console.log('='.repeat(40));
        
        try {
            // Test 1: Check environment variables
            console.log('📋 Test 1: Environment Variables');
            const requiredEnvVars = [
                'GOOGLE_SERVICE_ACCOUNT_KEY_FILE',
                'JIJI_SHOPS_SPREADSHEET_ID'
            ];
            
            for (const envVar of requiredEnvVars) {
                if (process.env[envVar]) {
                    console.log(`✅ ${envVar}: OK`);
                } else {
                    console.log(`❌ ${envVar}: Missing`);
                }
            }
            
            // Test 2: Authentication
            console.log('\n📋 Test 2: Authentication');
            const authClient = await this.connector.auth.getClient();
            console.log('✅ Google Auth: OK');
            
            // Test 3: Spreadsheet Access
            console.log('\n📋 Test 3: Spreadsheet Access');
            const metadata = await this.connector.sheets.spreadsheets.get({
                spreadsheetId: this.connector.spreadsheetId
            });
            console.log(`✅ Spreadsheet Access: OK`);
            console.log(`📊 Title: ${metadata.data.properties.title}`);
            console.log(`📁 Sheets: ${metadata.data.sheets.length}`);
            
            // Test 4: Read Sample Data
            console.log('\n📋 Test 4: Data Reading');
            const sampleData = await this.connector.getShopById('SHOP_001');
            if (sampleData) {
                console.log('✅ Data Reading: OK');
                console.log(`📍 Sample Shop: ${sampleData.shop_name} (${sampleData.area})`);
            } else {
                console.log('⚠️  Data Reading: No data found (expected for new setup)');
            }
            
            // Test 5: Data Statistics
            console.log('\n📋 Test 5: Data Statistics');
            const stats = await this.connector.getShopStatistics();
            console.log(`📊 Total Shops: ${stats.totalShops}`);
            console.log(`🏝️  Areas: ${stats.areas.join(', ')}`);
            
            console.log('\n🎉 ALL TESTS PASSED!');
            console.log('🔗 Ready for: node src/emotional-matching-standalone.js');
            
        } catch (error) {
            console.error('\n❌ CONNECTION TEST FAILED:');
            console.error(error.message);
            
            console.log('\n🔧 TROUBLESHOOTING:');
            console.log('1. Check .env file configuration');
            console.log('2. Verify Google Service Account permissions');
            console.log('3. Ensure spreadsheet ID is correct');
            console.log('4. Run: node setup-google-auth.js --configure');
        }
    }

    async demonstrateFeatures() {
        console.log('\n🎯 DEMONSTRATING SHEETS FEATURES\n');
        
        try {
            // Feature 1: Search by area
            console.log('📋 Feature 1: Search by Area');
            const ishigakiShops = await this.connector.getShopsByArea('石垣島');
            console.log(`Found ${ishigakiShops.length} shops in 石垣島`);
            
            // Feature 2: Filter by criteria
            console.log('\n📋 Feature 2: Filter by Criteria');
            const beginnerShops = await this.connector.getShopsByCriteria({
                beginner_friendly: true,
                solo_welcome: true
            });
            console.log(`Found ${beginnerShops.length} beginner-friendly shops`);
            
            // Feature 3: Price range search
            console.log('\n📋 Feature 3: Price Range');
            const affordableShops = await this.connector.getShopsByPriceRange(10000, 16000);
            console.log(`Found ${affordableShops.length} shops in ¥10,000-16,000 range`);
            
            // Feature 4: Rating filter
            console.log('\n📋 Feature 4: High Rating Shops');
            const highRatingShops = await this.connector.getShopsByRating(4.7);
            console.log(`Found ${highRatingShops.length} shops with 4.7+ rating`);
            
            console.log('\n✅ All features working correctly!');
            
        } catch (error) {
            console.error('❌ Feature demonstration failed:', error.message);
        }
    }
}

// Run tests
if (require.main === module) {
    const test = new SheetsConnectionTest();
    
    const args = process.argv.slice(2);
    if (args.includes('--demo')) {
        test.demonstrateFeatures();
    } else {
        test.testConnection();
    }
}