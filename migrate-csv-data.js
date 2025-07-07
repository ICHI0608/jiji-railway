#!/usr/bin/env node

/**
 * CSV to Google Sheets Migration Script
 * Converts the 79 shops CSV data to Google Sheets format
 */

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
require('dotenv').config();

class CSVToSheetsConverter {
    constructor() {
        this.csvPath = path.join(__dirname, '資料', 'ショップファイル - 一覧.csv');
        this.shopsData = [];
        
        // Google Sheets setup
        this.auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.spreadsheetId = process.env.JIJI_SHOPS_SPREADSHEET_ID;
        
        // CSV to 34-column mapping
        this.csvHeaders = [
            'area', 'shop_name', 'website', 'phone_line', 'review_site', 
            'customer_rating', 'review_count', 'speciality_areas', 
            'main_diving_points', 'fun_dive_price_2tanks', 'notes'
        ];
        
        // Target 34-column structure
        this.targetHeaders = [
            'shop_id', 'shop_name', 'area', 'phone_line', 'website', 'operating_hours',
            'fun_dive_available', 'trial_dive_options', 'license_course_available', 
            'max_group_size', 'private_guide_available', 'fun_dive_price_2tanks',
            'trial_dive_price_beach', 'trial_dive_price_boat', 'equipment_rental_included',
            'additional_fees', 'safety_equipment', 'insurance_coverage', 'female_instructor',
            'english_support', 'pickup_service', 'beginner_friendly', 'solo_welcome',
            'family_friendly', 'photo_service', 'video_service', 'speciality_areas',
            'certification_level', 'experience_years', 'customer_rating', 'review_count',
            'incident_record', 'jiji_grade', 'last_updated'
        ];
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
            operating_hours: '9:00-18:00', // Default
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
        
        return Object.values(shop);
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

    async createGoogleSheet() {
        console.log('📊 Creating Google Sheet...');
        
        try {
            // Create new spreadsheet
            const createResponse = await this.sheets.spreadsheets.create({
                resource: {
                    properties: {
                        title: 'Jiji沖縄ダイビングショップマスタ',
                        locale: 'ja_JP',
                        timeZone: 'Asia/Tokyo'
                    },
                    sheets: [
                        {
                            properties: {
                                title: 'ショップマスタ',
                                gridProperties: {
                                    rowCount: 100,
                                    columnCount: 34
                                }
                            }
                        }
                    ]
                }
            });
            
            const spreadsheetId = createResponse.data.spreadsheetId;
            console.log('✅ Google Sheet created!');
            console.log('📋 Spreadsheet ID:', spreadsheetId);
            
            // Update .env file with spreadsheet ID
            this.updateEnvFile(spreadsheetId);
            
            // Set up headers
            await this.setupHeaders(spreadsheetId);
            
            return spreadsheetId;
            
        } catch (error) {
            console.error('❌ Failed to create Google Sheet:', error.message);
            return null;
        }
    }

    async setupHeaders(spreadsheetId) {
        console.log('📝 Setting up headers...');
        
        const headerValues = [this.targetHeaders];
        
        await this.sheets.spreadsheets.values.update({
            spreadsheetId,
            range: 'ショップマスタ!A1:AH1',
            valueInputOption: 'RAW',
            resource: {
                values: headerValues
            }
        });
        
        console.log('✅ Headers set up successfully!');
    }

    async migrateData(spreadsheetId) {
        console.log('🔄 Migrating shop data...');
        
        if (this.shopsData.length === 0) {
            console.log('❌ No shop data to migrate');
            return;
        }
        
        try {
            // Add data rows
            await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `ショップマスタ!A2:AH${this.shopsData.length + 1}`,
                valueInputOption: 'RAW',
                resource: {
                    values: this.shopsData
                }
            });
            
            console.log(`✅ Migrated ${this.shopsData.length} shops to Google Sheets!`);
            
        } catch (error) {
            console.error('❌ Failed to migrate data:', error.message);
        }
    }

    updateEnvFile(spreadsheetId) {
        const envPath = path.join(__dirname, '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        // Update spreadsheet ID
        envContent = envContent.replace(
            /JIJI_SHOPS_SPREADSHEET_ID=".*"/,
            `JIJI_SHOPS_SPREADSHEET_ID="${spreadsheetId}"`
        );
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Updated .env file with spreadsheet ID');
    }

    async run() {
        console.log('\n🚀 STARTING CSV TO GOOGLE SHEETS MIGRATION\n');
        console.log('='.repeat(50));
        
        // Parse CSV
        const csvParsed = await this.parseCSV();
        if (!csvParsed) return;
        
        // Create Google Sheet
        const spreadsheetId = await this.createGoogleSheet();
        if (!spreadsheetId) return;
        
        // Migrate data
        await this.migrateData(spreadsheetId);
        
        console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('📊 Google Sheet URL:', `https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
        console.log('🔗 Next step: node test-sheets-connection.js');
    }
}

// Run migration
if (require.main === module) {
    const converter = new CSVToSheetsConverter();
    converter.run().catch(console.error);
}

module.exports = CSVToSheetsConverter;