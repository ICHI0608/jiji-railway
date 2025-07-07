/**
 * Jiji沖縄ダイビングバディ - Google Sheets APIコネクター
 * スプレッドシート先行アプローチによるショップデータ管理
 */

const { google } = require('googleapis');
require('dotenv').config();

class JijiSheetsConnector {
    constructor() {
        // Google Sheets API認証設定
        this.auth = new google.auth.GoogleAuth({
            keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        this.spreadsheetId = process.env.JIJI_SHOPS_SPREADSHEET_ID;
        
        // シート名定義
        this.sheetNames = {
            shopMaster: 'ショップマスタ',
            statistics: '統計ダッシュボード',
            operationLog: '運用ログ'
        };
        
        // 34項目ヘッダー定義
        this.shopHeaders = [
            'shop_id', 'shop_name', 'area', 'phone_line', 'website', 'operating_hours',
            'fun_dive_available', 'trial_dive_options', 'license_course_available', 
            'max_group_size', 'private_guide_available', 'fun_dive_price_2tanks',
            'trial_dive_price_beach', 'trial_dive_price_boat', 'equipment_rental_included',
            'additional_fees', 'safety_equipment', 'insurance_coverage', 'female_instructor',
            'english_support', 'pickup_service', 'beginner_friendly', 'solo_welcome',
            'family_friendly', 'photo_service', 'video_service', 'speciality_areas',
            'certification_level', 'experience_years', 'customer_rating', 'review_count',
            'incident_record', 'jiji_grade', 'last_updated', 'notes'
        ];
        
        // データ変換マップ
        this.dataTypeMap = {
            // Boolean フィールド
            boolean: [
                'fun_dive_available', 'license_course_available', 'private_guide_available',
                'equipment_rental_included', 'safety_equipment', 'insurance_coverage',
                'female_instructor', 'english_support', 'pickup_service', 'beginner_friendly',
                'solo_welcome', 'family_friendly', 'photo_service', 'video_service'
            ],
            // Number フィールド
            number: [
                'max_group_size', 'fun_dive_price_2tanks', 'trial_dive_price_beach',
                'trial_dive_price_boat', 'experience_years', 'customer_rating', 'review_count'
            ],
            // String フィールド（デフォルト）
            string: ['shop_id', 'shop_name', 'area', 'phone_line', 'website', 'operating_hours']
        };
    }

    /**
     * ショップデータ取得（マッチング用）
     * @param {string} area - エリアフィルター（オプション）
     * @param {number} maxResults - 最大取得件数
     * @returns {Array} ショップデータ配列
     */
    async getShopsForMatching(area = null, maxResults = 100) {
        try {
            console.log('📊 Google Sheets からショップデータ取得開始:', { area, maxResults });

            // データ範囲設定（ヘッダー行除く）
            const range = `${this.sheetNames.shopMaster}!A2:AH${maxResults + 1}`;
            
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });

            if (!response.data.values) {
                console.warn('⚠️ スプレッドシートにデータが見つかりません');
                return [];
            }

            // 生データを構造化オブジェクトに変換
            let shops = this.parseSheetData(response.data.values);
            console.log(`✅ ${shops.length}件のショップデータを取得`);

            // エリアフィルタ適用
            if (area) {
                shops = shops.filter(shop => shop.area === area);
                console.log(`🎯 エリアフィルタ適用後: ${shops.length}件`);
            }

            // アクティブなショップのみ（基本的な品質フィルタ）
            shops = shops.filter(shop => 
                shop.shop_name && 
                shop.shop_name.trim() !== '' && 
                shop.area && 
                shop.jiji_grade
            );

            console.log(`🔍 品質フィルタ後: ${shops.length}件のアクティブショップ`);
            return shops;

        } catch (error) {
            console.error('❌ Google Sheets API エラー:', error);
            throw new Error(`ショップデータ取得エラー: ${error.message}`);
        }
    }

    /**
     * シートデータをオブジェクト配列に変換
     * @param {Array} rows - スプレッドシートの行データ
     * @returns {Array} 構造化されたショップオブジェクト配列
     */
    parseSheetData(rows) {
        return rows.map((row, index) => {
            const shop = {};
            
            this.shopHeaders.forEach((header, columnIndex) => {
                const rawValue = row[columnIndex] || '';
                shop[header] = this.convertDataType(header, rawValue);
            });

            // 自動生成フィールド
            shop._row_number = index + 2; // スプレッドシートの実際の行番号
            shop._data_source = 'google_sheets';
            shop._retrieved_at = new Date().toISOString();

            return shop;
        });
    }

    /**
     * データ型変換（スプレッドシート→システム）
     * @param {string} field - フィールド名
     * @param {string} value - 生の値
     * @returns {*} 変換後の値
     */
    convertDataType(field, value) {
        // Boolean 変換
        if (this.dataTypeMap.boolean.includes(field)) {
            const lowerValue = value.toString().toLowerCase();
            return lowerValue === 'true' || 
                   lowerValue === '1' || 
                   lowerValue === 'yes' || 
                   lowerValue === 'はい' ||
                   lowerValue === '○';
        }
        
        // Number 変換
        if (this.dataTypeMap.number.includes(field)) {
            const numValue = parseFloat(value);
            return isNaN(numValue) ? 0 : numValue;
        }
        
        // String 変換（デフォルト）
        return value.toString().trim();
    }

    /**
     * ショップデータ更新（管理用）
     * @param {string} shopId - ショップID
     * @param {Object} updates - 更新データ
     * @returns {Object} 更新結果
     */
    async updateShop(shopId, updates) {
        try {
            console.log('🔄 ショップデータ更新開始:', { shopId, updates });

            // shopIdから行番号を特定
            const rowIndex = await this.findShopRow(shopId);
            if (!rowIndex) {
                throw new Error(`ショップ ${shopId} が見つかりません`);
            }

            // 更新データを系列的にセルに反映
            const updatePromises = Object.entries(updates).map(async ([field, value]) => {
                const columnIndex = this.getColumnIndex(field);
                if (columnIndex === -1) {
                    console.warn(`⚠️ 未知のフィールド: ${field}`);
                    return null;
                }

                const range = `${this.sheetNames.shopMaster}!${this.getColumnLetter(columnIndex)}${rowIndex}`;
                const convertedValue = this.convertValueForSheet(field, value);
                
                return this.sheets.spreadsheets.values.update({
                    spreadsheetId: this.spreadsheetId,
                    range: range,
                    valueInputOption: 'USER_ENTERED',
                    resource: { values: [[convertedValue]] }
                });
            });

            const results = await Promise.all(updatePromises.filter(p => p !== null));
            
            // 更新日時記録
            await this.updateTimestamp(rowIndex);
            
            // 運用ログ記録
            await this.logOperation('UPDATE', shopId, updates);

            console.log(`✅ ショップ ${shopId} の更新完了: ${results.length}フィールド`);
            return { 
                success: true, 
                shopId, 
                updatedFields: Object.keys(updates).length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ ショップ更新エラー:', error);
            return { 
                success: false, 
                error: error.message,
                shopId 
            };
        }
    }

    /**
     * 新規ショップ追加
     * @param {Object} shopData - 新規ショップデータ
     * @returns {Object} 追加結果
     */
    async addShop(shopData) {
        try {
            console.log('🆕 新規ショップ追加開始:', shopData.shop_name);

            // ショップIDの自動生成
            if (!shopData.shop_id) {
                shopData.shop_id = this.generateShopId(shopData.area);
            }

            // 新規行のデータ準備
            const rowData = this.shopHeaders.map(header => {
                const value = shopData[header] || '';
                return this.convertValueForSheet(header, value);
            });

            // 最終行に追加
            const range = `${this.sheetNames.shopMaster}!A:AH`;
            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: [rowData] }
            });

            // 運用ログ記録
            await this.logOperation('CREATE', shopData.shop_id, shopData);

            console.log(`✅ 新規ショップ追加完了: ${shopData.shop_name}`);
            return { 
                success: true, 
                shopId: shopData.shop_id,
                rowIndex: response.data.updates.updatedRange
            };

        } catch (error) {
            console.error('❌ 新規ショップ追加エラー:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    /**
     * ショップID検索で行番号を特定
     * @param {string} shopId - ショップID
     * @returns {number|null} 行番号（1ベース）
     */
    async findShopRow(shopId) {
        try {
            const range = `${this.sheetNames.shopMaster}!A:A`;
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId: this.spreadsheetId,
                range: range,
            });

            if (!response.data.values) return null;

            const rowIndex = response.data.values.findIndex(row => row[0] === shopId);
            return rowIndex !== -1 ? rowIndex + 1 : null; // 1ベースに変換

        } catch (error) {
            console.error('❌ ショップ行検索エラー:', error);
            return null;
        }
    }

    /**
     * フィールド名から列インデックスを取得
     * @param {string} fieldName - フィールド名
     * @returns {number} 列インデックス（0ベース）
     */
    getColumnIndex(fieldName) {
        return this.shopHeaders.indexOf(fieldName);
    }

    /**
     * 列インデックスからアルファベット列名に変換
     * @param {number} columnIndex - 列インデックス（0ベース）
     * @returns {string} 列名（A, B, C...）
     */
    getColumnLetter(columnIndex) {
        let letter = '';
        let temp = columnIndex;
        while (temp >= 0) {
            letter = String.fromCharCode(65 + (temp % 26)) + letter;
            temp = Math.floor(temp / 26) - 1;
        }
        return letter;
    }

    /**
     * システム値をスプレッドシート用に変換
     * @param {string} field - フィールド名
     * @param {*} value - システム値
     * @returns {string} スプレッドシート用値
     */
    convertValueForSheet(field, value) {
        if (this.dataTypeMap.boolean.includes(field)) {
            return value ? 'TRUE' : 'FALSE';
        }
        
        if (this.dataTypeMap.number.includes(field)) {
            return value.toString();
        }
        
        return value.toString();
    }

    /**
     * 更新日時記録
     * @param {number} rowIndex - 行番号
     */
    async updateTimestamp(rowIndex) {
        try {
            const timestampColumn = this.getColumnIndex('last_updated');
            if (timestampColumn === -1) return;

            const range = `${this.sheetNames.shopMaster}!${this.getColumnLetter(timestampColumn)}${rowIndex}`;
            await this.sheets.spreadsheets.values.update({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[new Date().toISOString()]] }
            });
        } catch (error) {
            console.warn('⚠️ タイムスタンプ更新警告:', error.message);
        }
    }

    /**
     * 運用ログ記録
     * @param {string} operation - 操作タイプ（CREATE, UPDATE, DELETE）
     * @param {string} shopId - ショップID
     * @param {Object} data - 操作データ
     */
    async logOperation(operation, shopId, data) {
        try {
            const logData = [
                new Date().toISOString(), // タイムスタンプ
                operation, // 操作タイプ
                shopId, // ショップID
                JSON.stringify(data), // データ
                'system' // 操作者
            ];

            const range = `${this.sheetNames.operationLog}!A:E`;
            await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.spreadsheetId,
                range: range,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                resource: { values: [logData] }
            });

        } catch (error) {
            console.warn('⚠️ 運用ログ記録警告:', error.message);
        }
    }

    /**
     * 自動ショップID生成
     * @param {string} area - エリア名
     * @returns {string} 生成されたショップID
     */
    generateShopId(area) {
        const areaCode = this.getAreaCode(area);
        const timestamp = Date.now().toString().slice(-6); // 下6桁
        return `${areaCode}${timestamp}`;
    }

    /**
     * エリアコード取得
     * @param {string} area - エリア名
     * @returns {string} エリアコード
     */
    getAreaCode(area) {
        const areaCodes = {
            '石垣島': 'ISH',
            '宮古島': 'MYK',
            '沖縄本島': 'OKI',
            '慶良間': 'KER',
            '久米島': 'KUM',
            '西表島': 'IRI'
        };
        return areaCodes[area] || 'OTH';
    }

    /**
     * 統計情報取得
     * @returns {Object} 統計データ
     */
    async getStatistics() {
        try {
            const shops = await this.getShopsForMatching();
            
            const stats = {
                totalShops: shops.length,
                areaBreakdown: {},
                gradeBreakdown: {},
                averageRating: 0,
                priceRange: { min: 0, max: 0, average: 0 }
            };

            // エリア別統計
            shops.forEach(shop => {
                stats.areaBreakdown[shop.area] = (stats.areaBreakdown[shop.area] || 0) + 1;
                stats.gradeBreakdown[shop.jiji_grade] = (stats.gradeBreakdown[shop.jiji_grade] || 0) + 1;
            });

            // 評価・価格統計
            const ratings = shops.filter(s => s.customer_rating > 0).map(s => s.customer_rating);
            const prices = shops.filter(s => s.fun_dive_price_2tanks > 0).map(s => s.fun_dive_price_2tanks);

            if (ratings.length > 0) {
                stats.averageRating = ratings.reduce((a, b) => a + b) / ratings.length;
            }

            if (prices.length > 0) {
                stats.priceRange.min = Math.min(...prices);
                stats.priceRange.max = Math.max(...prices);
                stats.priceRange.average = prices.reduce((a, b) => a + b) / prices.length;
            }

            return stats;

        } catch (error) {
            console.error('❌ 統計取得エラー:', error);
            return null;
        }
    }

    /**
     * 接続テスト
     * @returns {boolean} 接続成功可否
     */
    async testConnection() {
        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.spreadsheetId
            });

            console.log('✅ Google Sheets 接続テスト成功');
            console.log(`📊 スプレッドシート名: ${response.data.properties.title}`);
            return true;

        } catch (error) {
            console.error('❌ Google Sheets 接続テスト失敗:', error);
            return false;
        }
    }
}

module.exports = { JijiSheetsConnector };