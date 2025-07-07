#!/usr/bin/env node

/**
 * CSV to Mock Data Migration Script
 * Converts the 79 shops CSV data to local JSON format for development
 */

const fs = require('fs');
const path = require('path');
const MockJijiSheetsConnector = require('./src/sheets-connector-mock');

class CSVToMockConverter {
    constructor() {
        this.csvPath = path.join(__dirname, '資料', 'ショップファイル - 一覧.csv');
        this.mockDataPath = path.join(__dirname, 'mock-shops-data.json');
        this.shopsData = [];
        this.connector = new MockJijiSheetsConnector();
    }

    async parseCSV() {
        console.log('📖 Reading CSV file...');
        
        if (!fs.existsSync(this.csvPath)) {
            console.log('❌ CSV file not found:', this.csvPath);
            return false;
        }
        
        const csvContent = fs.readFileSync(this.csvPath, 'utf8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        
        // Skip header line
        const dataLines = lines.slice(1);
        
        this.shopsData = dataLines.map((line, index) => {
            const values = this.parseCSVLine(line);
            return this.convertToTargetFormat(values, index + 1);
        });
        
        console.log(`✅ Parsed ${this.shopsData.length} shops from CSV`);
        return true;
    }

    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        values.push(current.trim());
        return values;
    }

    convertToTargetFormat(csvRow, shopId) {
        const shop = {
            shop_id: `SHOP_${shopId.toString().padStart(3, '0')}`,
            shop_name: csvRow[1] || '',
            area: csvRow[0] || '',
            phone_line: csvRow[3] || '',
            website: csvRow[2] || '',
            operating_hours: '9:00-18:00',
            fun_dive_available: true,
            trial_dive_options: csvRow[7]?.includes('体験') || false,
            license_course_available: csvRow[7]?.includes('ライセンス') || false,
            max_group_size: this.extractGroupSize(csvRow[7]),
            private_guide_available: csvRow[7]?.includes('少人数') || csvRow[7]?.includes('貸切') || false,
            fun_dive_price_2tanks: this.extractPrice(csvRow[9]),
            trial_dive_price_beach: 8000,
            trial_dive_price_boat: 12000,
            equipment_rental_included: csvRow[10]?.includes('器材') || false,
            additional_fees: '',
            safety_equipment: true,
            insurance_coverage: true,
            female_instructor: csvRow[7]?.includes('女性') || false,
            english_support: csvRow[7]?.includes('英語') || false,
            pickup_service: csvRow[10]?.includes('送迎') || false,
            beginner_friendly: csvRow[7]?.includes('初心者') || false,
            solo_welcome: csvRow[7]?.includes('一人') || false,
            family_friendly: csvRow[7]?.includes('家族') || false,
            photo_service: csvRow[10]?.includes('写真') || false,
            video_service: csvRow[10]?.includes('動画') || false,
            speciality_areas: csvRow[7] || '',
            certification_level: 'PADI',
            experience_years: 10,
            customer_rating: parseFloat(csvRow[5]) || 4.5,
            review_count: parseInt(csvRow[6]) || 50,
            incident_record: 'なし',
            jiji_grade: this.calculateJijiGrade(csvRow[5], csvRow[6]),
            last_updated: new Date().toISOString().split('T')[0]
        };
        
        return shop;
    }

    extractGroupSize(specialityText) {
        if (!specialityText) return 6;
        if (specialityText.includes('少人数')) return 4;
        if (specialityText.includes('貸切')) return 2;
        return 6;
    }

    extractPrice(priceText) {
        if (!priceText) return 15000;
        const match = priceText.match(/¥?([\d,]+)/);
        if (match) {
            return parseInt(match[1].replace(',', ''));
        }
        return 15000;
    }

    calculateJijiGrade(rating, reviewCount) {
        const r = parseFloat(rating) || 4.5;
        const rc = parseInt(reviewCount) || 50;
        
        if (r >= 4.8 && rc >= 200) return 'S级';
        if (r >= 4.6 && rc >= 100) return 'A级';
        if (r >= 4.3 && rc >= 50) return 'B级';
        return 'C级';
    }

    async saveMockData() {
        console.log('💾 Saving mock data...');
        
        try {
            fs.writeFileSync(this.mockDataPath, JSON.stringify(this.shopsData, null, 2));
            console.log(`✅ Saved ${this.shopsData.length} shops to ${this.mockDataPath}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to save mock data:', error.message);
            return false;
        }
    }

    async displayStatistics() {
        console.log('\n📊 DATA STATISTICS');
        console.log('='.repeat(30));
        
        const stats = {
            totalShops: this.shopsData.length,
            areas: [...new Set(this.shopsData.map(shop => shop.area))],
            avgRating: this.shopsData.reduce((sum, shop) => sum + shop.customer_rating, 0) / this.shopsData.length,
            avgPrice: this.shopsData.reduce((sum, shop) => sum + shop.fun_dive_price_2tanks, 0) / this.shopsData.length,
            beginnerFriendly: this.shopsData.filter(shop => shop.beginner_friendly).length,
            soloWelcome: this.shopsData.filter(shop => shop.solo_welcome).length
        };
        
        console.log(`📊 Total Shops: ${stats.totalShops}`);
        console.log(`🏝️  Areas: ${stats.areas.join(', ')}`);
        console.log(`⭐ Average Rating: ${stats.avgRating.toFixed(1)}`);
        console.log(`💰 Average Price: ¥${Math.round(stats.avgPrice).toLocaleString()}`);
        console.log(`👍 Beginner Friendly: ${stats.beginnerFriendly}`);
        console.log(`🙋 Solo Welcome: ${stats.soloWelcome}`);
        
        // Area breakdown
        console.log('\n🏝️  AREA BREAKDOWN:');
        stats.areas.forEach(area => {
            const count = this.shopsData.filter(shop => shop.area === area).length;
            console.log(`  ${area}: ${count} shops`);
        });
        
        // Top rated shops
        console.log('\n⭐ TOP RATED SHOPS:');
        const topRated = this.shopsData
            .sort((a, b) => b.customer_rating - a.customer_rating)
            .slice(0, 5);
        
        topRated.forEach((shop, index) => {
            console.log(`  ${index + 1}. ${shop.shop_name} (${shop.area}) - ${shop.customer_rating}★`);
        });
    }

    async run() {
        console.log('\n🚀 STARTING CSV TO MOCK DATA MIGRATION\n');
        console.log('='.repeat(50));
        
        // Parse CSV
        const csvParsed = await this.parseCSV();
        if (!csvParsed) return;
        
        // Save to mock data
        const saved = await this.saveMockData();
        if (!saved) return;
        
        // Display statistics
        await this.displayStatistics();
        
        console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('💾 Mock data saved to:', this.mockDataPath);
        console.log('🔗 Next step: npm run test-sheets');
    }
}

// Run migration
if (require.main === module) {
    const converter = new CSVToMockConverter();
    converter.run().catch(console.error);
}

module.exports = CSVToMockConverter;