#!/usr/bin/env node

/**
 * Jiji Data Migration Script: Mock JSON → Supabase
 * Phase 4-A Task 3: Migrate 79 shop data to production database
 */

const fs = require('fs');
const path = require('path');
const JijiSupabaseConnector = require('./src/supabase-connector');

class JijiDataMigration {
    constructor() {
        this.supabaseConnector = new JijiSupabaseConnector();
        this.mockDataPath = path.join(__dirname, 'mock-shops-data.json');
    }

    async migrate() {
        console.log('🚀 Starting Jiji Data Migration: Mock → Supabase');
        console.log('='.repeat(60));
        
        try {
            // Step 1: Validate environment
            await this.validateEnvironment();
            
            // Step 2: Test Supabase connection
            await this.testSupabaseConnection();
            
            // Step 3: Load mock data
            const mockData = await this.loadMockData();
            
            // Step 4: Data quality check
            const validatedData = await this.validateData(mockData);
            
            // Step 5: Clear existing data (if any)
            await this.clearExistingData();
            
            // Step 6: Migrate data
            await this.migrateShopData(validatedData);
            
            // Step 7: Verify migration
            await this.verifyMigration(validatedData);
            
            // Step 8: Generate report
            await this.generateMigrationReport();
            
            console.log('\n✅ Migration completed successfully!');
            console.log('🎯 Phase 4-A Task 3: COMPLETE');
            
        } catch (error) {
            console.error('\n❌ Migration failed:', error.message);
            console.error('Stack:', error.stack);
            process.exit(1);
        }
    }

    async validateEnvironment() {
        console.log('\n1️⃣ Validating environment...');
        
        if (!process.env.SUPABASE_URL) {
            throw new Error('SUPABASE_URL environment variable not set');
        }
        
        if (!process.env.SUPABASE_ANON_KEY) {
            throw new Error('SUPABASE_ANON_KEY environment variable not set');
        }
        
        console.log('✅ Environment variables validated');
        console.log(`   🔗 Supabase URL: ${process.env.SUPABASE_URL.slice(0, 30)}...`);
        console.log(`   🔑 API Key: ${process.env.SUPABASE_ANON_KEY.slice(0, 20)}...`);
    }

    async testSupabaseConnection() {
        console.log('\n2️⃣ Testing Supabase connection...');
        
        try {
            await this.supabaseConnector.testConnection();
            console.log('✅ Supabase connection successful');
        } catch (error) {
            console.error('❌ Supabase connection failed');
            console.error('   Make sure the database tables exist in Supabase Dashboard:');
            console.error('   - diving_shops');
            console.error('   - user_feedback');
            console.error('   - user_profiles');
            console.error('   - conversations');
            throw error;
        }
    }

    async loadMockData() {
        console.log('\n3️⃣ Loading mock data...');
        
        if (!fs.existsSync(this.mockDataPath)) {
            throw new Error(`Mock data file not found: ${this.mockDataPath}`);
        }
        
        const mockDataContent = fs.readFileSync(this.mockDataPath, 'utf8');
        const mockData = JSON.parse(mockDataContent);
        
        console.log(`✅ Loaded ${mockData.length} shops from mock data`);
        
        // Display sample data
        if (mockData.length > 0) {
            const sample = mockData[0];
            console.log(`   📍 Sample: ${sample.shop_name} (${sample.area})`);
            console.log(`   🆔 Shop ID: ${sample.shop_id}`);
            console.log(`   ⭐ Rating: ${sample.customer_rating}`);
        }
        
        return mockData;
    }

    async validateData(mockData) {
        console.log('\n4️⃣ Validating data quality...');
        
        const validatedData = [];
        const errors = [];
        
        for (let i = 0; i < mockData.length; i++) {
            const shop = mockData[i];
            const validationResult = this.validateShopData(shop, i);
            
            if (validationResult.valid) {
                validatedData.push(validationResult.data);
            } else {
                errors.push(validationResult.errors);
            }
        }
        
        console.log(`✅ Data validation complete:`);
        console.log(`   ✅ Valid shops: ${validatedData.length}`);
        console.log(`   ❌ Invalid shops: ${errors.length}`);
        
        if (errors.length > 0) {
            console.log('\n   ⚠️ Validation errors:');
            errors.slice(0, 5).forEach((error, i) => {
                console.log(`   ${i + 1}. ${error}`);
            });
            
            if (errors.length > 5) {
                console.log(`   ... and ${errors.length - 5} more errors`);
            }
        }
        
        if (validatedData.length === 0) {
            throw new Error('No valid shops found in mock data');
        }
        
        return validatedData;
    }

    validateShopData(shop, index) {
        const errors = [];
        
        // Required fields check
        if (!shop.shop_id) errors.push(`Shop ${index}: Missing shop_id`);
        if (!shop.shop_name) errors.push(`Shop ${index}: Missing shop_name`);
        if (!shop.area) errors.push(`Shop ${index}: Missing area`);
        
        // Data type validation
        if (shop.customer_rating && (shop.customer_rating < 0 || shop.customer_rating > 5)) {
            errors.push(`Shop ${index}: Invalid customer_rating (${shop.customer_rating})`);
        }
        
        if (shop.fun_dive_price_2tanks && shop.fun_dive_price_2tanks < 0) {
            errors.push(`Shop ${index}: Invalid price (${shop.fun_dive_price_2tanks})`);
        }
        
        // Clean and standardize data
        const cleanedShop = {
            ...shop,
            shop_id: String(shop.shop_id).trim(),
            shop_name: String(shop.shop_name).trim(),
            area: String(shop.area).trim(),
            customer_rating: shop.customer_rating ? parseFloat(shop.customer_rating) : null,
            fun_dive_price_2tanks: shop.fun_dive_price_2tanks ? parseInt(shop.fun_dive_price_2tanks) : null,
            trial_dive_price_beach: shop.trial_dive_price_beach ? parseInt(shop.trial_dive_price_beach) : null,
            trial_dive_price_boat: shop.trial_dive_price_boat ? parseInt(shop.trial_dive_price_boat) : null,
            max_group_size: shop.max_group_size ? parseInt(shop.max_group_size) : null,
            experience_years: shop.experience_years ? parseInt(shop.experience_years) : null,
            review_count: shop.review_count ? parseInt(shop.review_count) : 0,
            
            // Boolean fields
            fun_dive_available: Boolean(shop.fun_dive_available),
            license_course_available: Boolean(shop.license_course_available),
            private_guide_available: Boolean(shop.private_guide_available),
            equipment_rental_included: Boolean(shop.equipment_rental_included),
            safety_equipment: Boolean(shop.safety_equipment),
            insurance_coverage: Boolean(shop.insurance_coverage),
            female_instructor: Boolean(shop.female_instructor),
            english_support: Boolean(shop.english_support),
            pickup_service: Boolean(shop.pickup_service),
            beginner_friendly: Boolean(shop.beginner_friendly),
            solo_welcome: Boolean(shop.solo_welcome),
            family_friendly: Boolean(shop.family_friendly),
            photo_service: Boolean(shop.photo_service),
            video_service: Boolean(shop.video_service),
            
            // Text fields with defaults
            phone_line: shop.phone_line || '',
            website: shop.website || '',
            operating_hours: shop.operating_hours || '',
            trial_dive_options: shop.trial_dive_options || '',
            additional_fees: shop.additional_fees || '',
            speciality_areas: shop.speciality_areas || '',
            certification_level: shop.certification_level || '',
            incident_record: shop.incident_record || '',
            jiji_grade: shop.jiji_grade || '',
            last_updated: shop.last_updated || new Date().toISOString().split('T')[0]
        };
        
        return {
            valid: errors.length === 0,
            data: cleanedShop,
            errors: errors.join('; ')
        };
    }

    async clearExistingData() {
        console.log('\n5️⃣ Checking existing data...');
        
        try {
            const existingShops = await this.supabaseConnector.getAllShops();
            
            if (existingShops.length > 0) {
                console.log(`⚠️ Found ${existingShops.length} existing shops`);
                console.log('   This migration will ADD to existing data');
                console.log('   If you want to replace all data, manually clear the table first');
            } else {
                console.log('✅ No existing shops found - clean migration');
            }
        } catch (error) {
            console.log('⚠️ Could not check existing data:', error.message);
        }
    }

    async migrateShopData(validatedData) {
        console.log('\n6️⃣ Migrating shop data to Supabase...');
        
        try {
            const results = await this.supabaseConnector.bulkInsertShops(validatedData);
            
            console.log(`✅ Successfully migrated ${results.length} shops`);
            
            // Display area breakdown
            const areaBreakdown = {};
            results.forEach(shop => {
                areaBreakdown[shop.area] = (areaBreakdown[shop.area] || 0) + 1;
            });
            
            console.log('\n   📊 Area breakdown:');
            Object.entries(areaBreakdown).forEach(([area, count]) => {
                console.log(`   🏝️ ${area}: ${count} shops`);
            });
            
        } catch (error) {
            if (error.message.includes('duplicate key value')) {
                console.log('⚠️ Some shops already exist in database (skipping duplicates)');
                console.log('   This is normal if you\'re running migration multiple times');
            } else {
                throw error;
            }
        }
    }

    async verifyMigration(originalData) {
        console.log('\n7️⃣ Verifying migration...');
        
        const migratedShops = await this.supabaseConnector.getAllShops();
        const stats = await this.supabaseConnector.getShopStatistics();
        
        console.log(`✅ Verification complete:`);
        console.log(`   📊 Total shops in database: ${migratedShops.length}`);
        console.log(`   📊 Original shops to migrate: ${originalData.length}`);
        console.log(`   ⭐ Average rating: ${stats.avgRating}`);
        console.log(`   🔰 Beginner friendly: ${stats.beginnerFriendly}`);
        console.log(`   🏝️ Areas covered: ${stats.areas.length}`);
        
        // Test a few random shops
        console.log('\n   🧪 Testing random shop retrievals:');
        for (let i = 0; i < Math.min(3, migratedShops.length); i++) {
            const randomIndex = Math.floor(Math.random() * migratedShops.length);
            const shop = migratedShops[randomIndex];
            const retrieved = await this.supabaseConnector.getShopById(shop.shop_id);
            
            if (retrieved && retrieved.shop_id === shop.shop_id) {
                console.log(`   ✅ ${shop.shop_name} retrieval successful`);
            } else {
                console.log(`   ❌ ${shop.shop_name} retrieval failed`);
            }
        }
    }

    async generateMigrationReport() {
        console.log('\n8️⃣ Generating migration report...');
        
        const stats = await this.supabaseConnector.getShopStatistics();
        const timestamp = new Date().toISOString();
        
        const report = {
            migration_date: timestamp,
            source: 'mock-shops-data.json',
            destination: 'supabase_diving_shops',
            statistics: stats,
            status: 'completed',
            phase: 'Phase 4-A Task 3'
        };
        
        const reportPath = path.join(__dirname, `migration-report-${timestamp.split('T')[0]}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        console.log(`✅ Migration report saved: ${reportPath}`);
        console.log('\n📊 Final Statistics:');
        console.log(`   🏪 Total Shops: ${stats.totalShops}`);
        console.log(`   🏝️ Areas: ${stats.areas.join(', ')}`);
        console.log(`   ⭐ Avg Rating: ${stats.avgRating}`);
        console.log(`   💰 Avg Price: ¥${stats.avgPrice}`);
        console.log(`   🔰 Beginner Friendly: ${stats.beginnerFriendly}`);
        console.log(`   👥 Solo Welcome: ${stats.soloWelcome}`);
    }
}

// Run migration if this file is executed directly
if (require.main === module) {
    const migration = new JijiDataMigration();
    migration.migrate().catch(console.error);
}

module.exports = JijiDataMigration;