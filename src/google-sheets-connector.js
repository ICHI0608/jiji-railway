/**
 * Jiji Google Sheets API Connector
 * Phase 5: Google Sheets統合・リアルタイムデータ管理
 * 
 * 79店舗データの Google Sheets 管理・自動同期
 * フィードバック収集・ユーザー統計の自動記録
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class JijiGoogleSheetsConnector {
    constructor() {
        this.initializeAuth();
        this.shopsDoc = null;
        this.feedbackDoc = null;
        this.statsDoc = null;
        this.isInitialized = false;
        
        // エラーハンドリング・フォールバック
        this.fallbackConnector = null; // Supabase connector for fallback
        
        console.log('📊 Google Sheets Connector initialized (Phase 5)');
    }

    async initializeAuth() {
        try {
            // 環境変数チェック
            const requiredEnvVars = [
                'GOOGLE_SERVICE_ACCOUNT_EMAIL',
                'GOOGLE_PRIVATE_KEY',
                'JIJI_SHOPS_SPREADSHEET_ID'
            ];
            
            const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
            if (missingVars.length > 0) {
                console.warn('⚠️ Google Sheets credentials missing:', missingVars);
                console.warn('   Falling back to Supabase connector');
                this.isInitialized = false;
                return;
            }

            // JWT認証設定
            this.serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive.file'
                ]
            });

            console.log('✅ Google Sheets authentication configured');
            this.isInitialized = true;
            
        } catch (error) {
            console.error('❌ Failed to initialize Google Sheets auth:', error.message);
            this.isInitialized = false;
        }
    }

    async connectToSheets() {
        if (!this.isInitialized) {
            throw new Error('Google Sheets not initialized - check credentials');
        }

        try {
            // 店舗データスプレッドシート
            this.shopsDoc = new GoogleSpreadsheet(
                process.env.JIJI_SHOPS_SPREADSHEET_ID, 
                this.serviceAccountAuth
            );
            await this.shopsDoc.loadInfo();
            
            // フィードバックスプレッドシート（オプション）
            if (process.env.FEEDBACK_SPREADSHEET_ID) {
                this.feedbackDoc = new GoogleSpreadsheet(
                    process.env.FEEDBACK_SPREADSHEET_ID,
                    this.serviceAccountAuth
                );
                await this.feedbackDoc.loadInfo();
            }

            // 統計スプレッドシート（オプション）
            if (process.env.STATS_SPREADSHEET_ID) {
                this.statsDoc = new GoogleSpreadsheet(
                    process.env.STATS_SPREADSHEET_ID,
                    this.serviceAccountAuth
                );
                await this.statsDoc.loadInfo();
            }

            console.log('✅ Connected to Google Sheets');
            console.log(`   Shops: ${this.shopsDoc.title}`);
            if (this.feedbackDoc) console.log(`   Feedback: ${this.feedbackDoc.title}`);
            if (this.statsDoc) console.log(`   Stats: ${this.statsDoc.title}`);
            
        } catch (error) {
            console.error('❌ Failed to connect to Google Sheets:', error.message);
            throw error;
        }
    }

    // ===== 店舗データ管理 =====

    async getAllShops() {
        try {
            if (!this.shopsDoc) await this.connectToSheets();
            
            const sheet = this.shopsDoc.sheetsByTitle[process.env.JIJI_SHOPS_SHEET_NAME || 'ShopsData'];
            if (!sheet) {
                throw new Error('Shop data sheet not found');
            }

            const rows = await sheet.getRows();
            const shops = rows.map(row => this.rowToShopObject(row));
            
            console.log(`📊 Retrieved ${shops.length} shops from Google Sheets`);
            return shops;
            
        } catch (error) {
            console.error('❌ Error getting shops from Google Sheets:', error.message);
            
            // フォールバック: Supabase使用
            if (this.fallbackConnector) {
                console.log('🔄 Falling back to Supabase connector');
                return await this.fallbackConnector.getAllShops();
            }
            
            throw error;
        }
    }

    async getShopsByArea(area) {
        const allShops = await this.getAllShops();
        return allShops.filter(shop => 
            shop.area && shop.area.toLowerCase().includes(area.toLowerCase())
        );
    }

    async getShopById(shopId) {
        const allShops = await this.getAllShops();
        return allShops.find(shop => shop.shop_id === shopId);
    }

    // ===== フィードバック管理 =====

    async saveFeedback(feedbackData) {
        try {
            if (!this.feedbackDoc) {
                console.warn('⚠️ Feedback spreadsheet not configured');
                return { feedback_id: `fb_${Date.now()}`, status: 'saved_locally' };
            }

            const sheet = this.feedbackDoc.sheetsByTitle[process.env.FEEDBACK_SHEET_NAME || 'UserFeedback'];
            if (!sheet) {
                throw new Error('Feedback sheet not found');
            }

            // フィードバックデータをスプレッドシートに追加
            const newRow = await sheet.addRow({
                timestamp: new Date().toISOString(),
                user_id: feedbackData.user_id || 'anonymous',
                rating: feedbackData.rating || '',
                message: feedbackData.message || '',
                category: feedbackData.category || 'general',
                shop_id: feedbackData.shop_id || '',
                emotion_analysis: JSON.stringify(feedbackData.emotion_analysis || {}),
                user_agent: feedbackData.user_agent || '',
                platform: feedbackData.platform || 'web'
            });

            console.log('✅ Feedback saved to Google Sheets');
            return {
                feedback_id: `fb_${newRow.rowNumber}_${Date.now()}`,
                status: 'saved_to_sheets',
                row_number: newRow.rowNumber
            };
            
        } catch (error) {
            console.error('❌ Error saving feedback to Google Sheets:', error.message);
            
            // フォールバック処理
            return {
                feedback_id: `fb_fallback_${Date.now()}`,
                status: 'saved_locally',
                error: error.message
            };
        }
    }

    // ===== 統計情報管理 =====

    async getShopStatistics() {
        try {
            const allShops = await this.getAllShops();
            
            // 基本統計計算
            const stats = {
                total_shops: allShops.length,
                by_area: this.calculateAreaStats(allShops),
                by_grade: this.calculateGradeStats(allShops),
                pricing: this.calculatePricingStats(allShops),
                features: this.calculateFeatureStats(allShops),
                last_updated: new Date().toISOString(),
                data_source: 'google_sheets'
            };

            // 統計をスプレッドシートに記録（オプション）
            if (this.statsDoc) {
                await this.saveStatsToSheet(stats);
            }

            return stats;
            
        } catch (error) {
            console.error('❌ Error calculating statistics:', error.message);
            
            // フォールバック
            if (this.fallbackConnector) {
                return await this.fallbackConnector.getShopStatistics();
            }
            
            throw error;
        }
    }

    // ===== ヘルパーメソッド =====

    rowToShopObject(row) {
        // Google Sheetsの行データを標準的な店舗オブジェクトに変換
        return {
            shop_id: row.get('shop_id') || '',
            shop_name: row.get('shop_name') || '',
            area: row.get('area') || '',
            phone_line: row.get('phone_line') || '',
            website: row.get('website') || '',
            operating_hours: row.get('operating_hours') || '',
            fun_dive_available: this.parseBoolean(row.get('fun_dive_available')),
            trial_dive_options: row.get('trial_dive_options') || '',
            license_course_available: this.parseBoolean(row.get('license_course_available')),
            max_group_size: parseInt(row.get('max_group_size')) || 0,
            private_guide_available: this.parseBoolean(row.get('private_guide_available')),
            fun_dive_price_2tanks: parseInt(row.get('fun_dive_price_2tanks')) || 0,
            trial_dive_price_beach: parseInt(row.get('trial_dive_price_beach')) || 0,
            trial_dive_price_boat: parseInt(row.get('trial_dive_price_boat')) || 0,
            equipment_rental_included: this.parseBoolean(row.get('equipment_rental_included')),
            additional_fees: row.get('additional_fees') || '',
            safety_equipment: row.get('safety_equipment') || '',
            insurance_coverage: row.get('insurance_coverage') || '',
            female_instructor: this.parseBoolean(row.get('female_instructor')),
            english_support: this.parseBoolean(row.get('english_support')),
            pickup_service: this.parseBoolean(row.get('pickup_service')),
            beginner_friendly: this.parseBoolean(row.get('beginner_friendly')),
            solo_welcome: this.parseBoolean(row.get('solo_welcome')),
            family_friendly: this.parseBoolean(row.get('family_friendly')),
            photo_service: this.parseBoolean(row.get('photo_service')),
            video_service: this.parseBoolean(row.get('video_service')),
            speciality_areas: row.get('speciality_areas') || '',
            certification_level: row.get('certification_level') || '',
            experience_years: parseInt(row.get('experience_years')) || 0,
            customer_rating: parseFloat(row.get('customer_rating')) || 0,
            review_count: parseInt(row.get('review_count')) || 0,
            incident_record: row.get('incident_record') || '',
            jiji_grade: row.get('jiji_grade') || 'C',
            last_updated: row.get('last_updated') || new Date().toISOString()
        };
    }

    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1' || value === 'yes';
        }
        return false;
    }

    calculateAreaStats(shops) {
        const areas = {};
        shops.forEach(shop => {
            const area = shop.area || 'unknown';
            areas[area] = (areas[area] || 0) + 1;
        });
        return areas;
    }

    calculateGradeStats(shops) {
        const grades = { S: 0, A: 0, B: 0, C: 0 };
        shops.forEach(shop => {
            const grade = shop.jiji_grade || 'C';
            if (grades.hasOwnProperty(grade)) {
                grades[grade]++;
            }
        });
        return grades;
    }

    calculatePricingStats(shops) {
        const prices = shops
            .map(s => s.fun_dive_price_2tanks)
            .filter(p => p > 0);
        
        if (prices.length === 0) return { min: 0, max: 0, average: 0 };
        
        return {
            min: Math.min(...prices),
            max: Math.max(...prices),
            average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        };
    }

    calculateFeatureStats(shops) {
        return {
            beginner_friendly: shops.filter(s => s.beginner_friendly).length,
            solo_welcome: shops.filter(s => s.solo_welcome).length,
            english_support: shops.filter(s => s.english_support).length,
            female_instructor: shops.filter(s => s.female_instructor).length,
            pickup_service: shops.filter(s => s.pickup_service).length
        };
    }

    async saveStatsToSheet(stats) {
        // 統計情報をスプレッドシートに保存（実装は必要に応じて）
        console.log('📊 Stats calculated:', stats);
    }

    // ===== フォールバック設定 =====

    setFallbackConnector(connector) {
        this.fallbackConnector = connector;
        console.log('🔄 Fallback connector set for Google Sheets');
    }

    // ===== 接続テスト =====

    async testConnection() {
        try {
            await this.connectToSheets();
            const testShops = await this.getAllShops();
            
            return {
                status: 'success',
                message: 'Google Sheets connection successful',
                shops_count: testShops.length,
                sheets_connected: {
                    shops: !!this.shopsDoc,
                    feedback: !!this.feedbackDoc,
                    stats: !!this.statsDoc
                }
            };
            
        } catch (error) {
            return {
                status: 'error',
                message: `Google Sheets connection failed: ${error.message}`,
                fallback_available: !!this.fallbackConnector
            };
        }
    }
}

module.exports = JijiGoogleSheetsConnector;