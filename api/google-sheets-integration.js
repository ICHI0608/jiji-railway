/**
 * Google Sheets API連携システム
 * Jijiダイビングショップデータ管理
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class JijiShopDataManager {
    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        this.doc = null;
        this.sheet = null;
        this.lastSync = null;
        this.syncInterval = 5 * 60 * 1000; // 5分間隔
        
        // データ検証ルール
        this.validationRules = {
            required: ['shop_name', 'area', 'phone', 'status'],
            optional: ['rating', 'specialties', 'price_range', 'description', 'website'],
            areas: ['石垣島', '宮古島', '沖縄本島', '与那国島', '久米島', '座間味島'],
            status: ['active', 'inactive', 'pending']
        };
    }

    /**
     * Google Sheets認証・初期化
     */
    async initialize() {
        try {
            // JWT認証の設定
            const serviceAccountAuth = new JWT({
                email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            // スプレッドシート接続
            this.doc = new GoogleSpreadsheet(this.spreadsheetId, serviceAccountAuth);
            await this.doc.loadInfo();
            
            console.log(`📊 スプレッドシート接続成功: ${this.doc.title}`);
            
            // ワークシート取得（複数シート対応）
            this.shopSheet = this.doc.sheetsByTitle['ショップリスト'] || this.doc.sheetsByIndex[0];
            this.reviewSheet = this.doc.sheetsByTitle['口コミデータ'] || null;
            this.weatherSheet = this.doc.sheetsByTitle['海況データ'] || null;
            
            console.log(`✅ ワークシート準備完了: ${this.shopSheet.title}`);
            
            return true;
        } catch (error) {
            console.error('❌ Google Sheets初期化エラー:', error.message);
            throw error;
        }
    }

    /**
     * ショップデータの同期処理
     */
    async syncShopData() {
        try {
            console.log('🔄 ショップデータ同期開始...');
            
            // シートからデータ取得
            const rows = await this.shopSheet.getRows();
            const rawData = rows.map(row => row._rawData);
            
            // ヘッダー行取得
            const headers = await this.shopSheet.getHeaderRow();
            
            // データを構造化
            const shopData = this.parseShopData(rawData, headers);
            
            // データ検証
            const validatedData = this.validateShopData(shopData);
            
            // データベースに保存
            await this.saveShopData(validatedData);
            
            this.lastSync = new Date();
            console.log(`✅ 同期完了: ${validatedData.length}件のショップデータ`);
            
            return {
                success: true,
                count: validatedData.length,
                timestamp: this.lastSync,
                data: validatedData
            };
            
        } catch (error) {
            console.error('❌ ショップデータ同期エラー:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    /**
     * データの構造化処理
     */
    parseShopData(rawData, headers) {
        const shopData = [];
        
        for (let i = 1; i < rawData.length; i++) { // ヘッダー行をスキップ
            const row = rawData[i];
            if (!row || row.length === 0) continue;
            
            const shop = {
                id: this.generateShopId(row[0] || `shop_${i}`),
                shop_name: row[0] || '',
                area: row[1] || '',
                phone: row[2] || '',
                status: row[3] || 'active',
                rating: this.parseFloat(row[4]),
                specialties: this.parseArray(row[5]),
                price_range: row[6] || '',
                description: row[7] || '',
                website: row[8] || '',
                email: row[9] || '',
                address: row[10] || '',
                coordinates: this.parseCoordinates(row[11]),
                business_hours: row[12] || '',
                languages: this.parseArray(row[13]),
                certifications: this.parseArray(row[14]),
                equipment_rental: this.parseBoolean(row[15]),
                beginner_friendly: this.parseBoolean(row[16]),
                boat_diving: this.parseBoolean(row[17]),
                shore_diving: this.parseBoolean(row[18]),
                night_diving: this.parseBoolean(row[19]),
                photo_service: this.parseBoolean(row[20]),
                updated_at: new Date(),
                source: 'google_sheets'
            };
            
            shopData.push(shop);
        }
        
        return shopData;
    }

    /**
     * データ検証処理
     */
    validateShopData(shopData) {
        const validatedData = [];
        const errors = [];
        
        shopData.forEach((shop, index) => {
            const shopErrors = [];
            
            // 必須項目チェック
            this.validationRules.required.forEach(field => {
                if (!shop[field] || shop[field].toString().trim() === '') {
                    shopErrors.push(`${field}は必須項目です`);
                }
            });
            
            // エリア検証
            if (shop.area && !this.validationRules.areas.includes(shop.area)) {
                shopErrors.push(`無効なエリア: ${shop.area}`);
            }
            
            // ステータス検証
            if (shop.status && !this.validationRules.status.includes(shop.status)) {
                shopErrors.push(`無効なステータス: ${shop.status}`);
            }
            
            // 電話番号検証
            if (shop.phone && !this.validatePhone(shop.phone)) {
                shopErrors.push(`無効な電話番号: ${shop.phone}`);
            }
            
            // 評価値検証
            if (shop.rating && (shop.rating < 0 || shop.rating > 5)) {
                shopErrors.push(`評価は0-5の範囲で入力してください: ${shop.rating}`);
            }
            
            if (shopErrors.length > 0) {
                errors.push({
                    row: index + 2, // Excelの行番号
                    shop_name: shop.shop_name,
                    errors: shopErrors
                });
            } else {
                validatedData.push(shop);
            }
        });
        
        // エラーがある場合は通知
        if (errors.length > 0) {
            this.notifyValidationErrors(errors);
        }
        
        return validatedData;
    }

    /**
     * データベース保存処理
     */
    async saveShopData(shopData) {
        try {
            // 既存データとの比較
            const existingData = await this.getExistingShopData();
            const changes = this.detectChanges(existingData, shopData);
            
            // 変更があった場合のみ更新
            if (changes.length > 0) {
                await this.updateDatabase(changes);
                await this.notifyChanges(changes);
            }
            
            return changes;
            
        } catch (error) {
            console.error('❌ データベース保存エラー:', error.message);
            throw error;
        }
    }

    /**
     * 自動同期の開始
     */
    startAutoSync() {
        console.log(`🔄 自動同期開始: ${this.syncInterval / 1000}秒間隔`);
        
        setInterval(async () => {
            try {
                await this.syncShopData();
            } catch (error) {
                console.error('❌ 自動同期エラー:', error.message);
                await this.notifyError(error);
            }
        }, this.syncInterval);
    }

    /**
     * 手動同期API
     */
    async manualSync() {
        return await this.syncShopData();
    }

    /**
     * ショップ検索API
     */
    async searchShops(filters = {}) {
        try {
            const shopData = await this.getShopData();
            let filteredShops = shopData;
            
            // エリアフィルター
            if (filters.area) {
                filteredShops = filteredShops.filter(shop => 
                    shop.area === filters.area
                );
            }
            
            // 評価フィルター
            if (filters.minRating) {
                filteredShops = filteredShops.filter(shop => 
                    shop.rating >= filters.minRating
                );
            }
            
            // 初心者向けフィルター
            if (filters.beginnerFriendly) {
                filteredShops = filteredShops.filter(shop => 
                    shop.beginner_friendly === true
                );
            }
            
            // 特殊ダイビングフィルター
            if (filters.specialty) {
                filteredShops = filteredShops.filter(shop => 
                    shop.specialties.includes(filters.specialty)
                );
            }
            
            // ソート
            if (filters.sortBy) {
                filteredShops = this.sortShops(filteredShops, filters.sortBy);
            }
            
            return filteredShops;
            
        } catch (error) {
            console.error('❌ ショップ検索エラー:', error.message);
            throw error;
        }
    }

    /**
     * 口コミデータ同期
     */
    async syncReviewData() {
        if (!this.reviewSheet) return null;
        
        try {
            const rows = await this.reviewSheet.getRows();
            const reviewData = rows.map(row => ({
                id: this.generateReviewId(row.shop_name, row.user_name, row.date),
                shop_name: row.shop_name,
                user_name: row.user_name,
                rating: this.parseFloat(row.rating),
                comment: row.comment,
                date: new Date(row.date),
                diving_type: row.diving_type,
                experience_level: row.experience_level,
                photos: this.parseArray(row.photos),
                verified: this.parseBoolean(row.verified),
                helpful_count: parseInt(row.helpful_count) || 0,
                updated_at: new Date()
            }));
            
            await this.saveReviewData(reviewData);
            return reviewData;
            
        } catch (error) {
            console.error('❌ 口コミデータ同期エラー:', error.message);
            throw error;
        }
    }

    /**
     * 海況データ同期
     */
    async syncWeatherData() {
        if (!this.weatherSheet) return null;
        
        try {
            const rows = await this.weatherSheet.getRows();
            const weatherData = rows.map(row => ({
                id: this.generateWeatherId(row.area, row.date),
                area: row.area,
                date: new Date(row.date),
                weather: row.weather,
                temperature: this.parseFloat(row.temperature),
                wind_speed: this.parseFloat(row.wind_speed),
                wind_direction: row.wind_direction,
                wave_height: this.parseFloat(row.wave_height),
                visibility: this.parseFloat(row.visibility),
                water_temperature: this.parseFloat(row.water_temperature),
                diving_conditions: row.diving_conditions,
                updated_at: new Date()
            }));
            
            await this.saveWeatherData(weatherData);
            return weatherData;
            
        } catch (error) {
            console.error('❌ 海況データ同期エラー:', error.message);
            throw error;
        }
    }

    // ===== ユーティリティ関数 =====

    generateShopId(shopName) {
        return `shop_${shopName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    }

    generateReviewId(shopName, userName, date) {
        const dateStr = new Date(date).toISOString().split('T')[0];
        return `review_${shopName}_${userName}_${dateStr}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    generateWeatherId(area, date) {
        const dateStr = new Date(date).toISOString().split('T')[0];
        return `weather_${area}_${dateStr}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    parseFloat(value) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }

    parseArray(value) {
        if (!value) return [];
        return value.toString().split(',').map(item => item.trim()).filter(item => item);
    }

    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return ['true', '1', 'yes', 'はい', '○'].includes(value.toLowerCase());
        }
        return false;
    }

    parseCoordinates(value) {
        if (!value) return null;
        const coords = value.toString().split(',');
        if (coords.length === 2) {
            const lat = parseFloat(coords[0].trim());
            const lng = parseFloat(coords[1].trim());
            if (!isNaN(lat) && !isNaN(lng)) {
                return { lat, lng };
            }
        }
        return null;
    }

    validatePhone(phone) {
        // 日本の電話番号パターン
        const phonePattern = /^(\+81|0)[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4}$/;
        return phonePattern.test(phone);
    }

    // ===== 外部連携用プレースホルダー =====

    async getExistingShopData() {
        // 実際の実装では既存のデータベースから取得
        return [];
    }

    detectChanges(existingData, newData) {
        // 実際の実装では詳細な差分検出
        return newData;
    }

    async updateDatabase(changes) {
        // 実際の実装ではデータベース更新
        console.log(`📝 データベース更新: ${changes.length}件`);
    }

    async saveReviewData(reviewData) {
        // 実際の実装では口コミデータベース保存
        console.log(`📝 口コミデータ保存: ${reviewData.length}件`);
    }

    async saveWeatherData(weatherData) {
        // 実際の実装では海況データベース保存
        console.log(`📝 海況データ保存: ${weatherData.length}件`);
    }

    async notifyValidationErrors(errors) {
        // 実際の実装ではSlackやメール通知
        console.log('⚠️  データ検証エラー:', errors);
    }

    async notifyChanges(changes) {
        // 実際の実装では変更通知
        console.log('🔔 データ変更通知:', changes.length);
    }

    async notifyError(error) {
        // 実際の実装ではエラー通知
        console.error('🚨 エラー通知:', error.message);
    }

    sortShops(shops, sortBy) {
        switch (sortBy) {
            case 'rating':
                return shops.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            case 'name':
                return shops.sort((a, b) => a.shop_name.localeCompare(b.shop_name));
            case 'area':
                return shops.sort((a, b) => a.area.localeCompare(b.area));
            default:
                return shops;
        }
    }

    async getShopData() {
        // 実際の実装ではキャッシュまたはデータベースから取得
        return [];
    }
}

module.exports = JijiShopDataManager;