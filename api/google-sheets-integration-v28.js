/**
 * Google Sheets API連携システム V2.8
 * 34項目完全対応版 - Jijiダイビングショップデータ管理
 */

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

class JijiShopDataManagerV28 {
    constructor() {
        this.spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
        this.doc = null;
        this.sheet = null;
        this.lastSync = null;
        this.syncInterval = 5 * 60 * 1000; // 5分間隔
        
        // V2.8完全対応 - 34項目データ構造定義
        this.schemaV28 = {
            // 基本情報
            shop_id: { type: 'VARCHAR(50)', required: true, unique: true },
            shop_name: { type: 'VARCHAR(255)', required: true },
            area: { type: 'VARCHAR(100)', required: true, enum: ['石垣島', '宮古島', '沖縄本島', '与那国島', '久米島', '座間味島'] },
            phone_line: { type: 'VARCHAR(50)', required: false },
            website: { type: 'TEXT', required: false },
            operating_hours: { type: 'VARCHAR(100)', required: false },
            
            // サービス提供可否
            fun_dive_available: { type: 'BOOLEAN', required: false, default: false },
            trial_dive_options: { type: 'TEXT', required: false },
            license_course_available: { type: 'BOOLEAN', required: false, default: false },
            
            // グループ・ガイド情報
            max_group_size: { type: 'INTEGER', required: false, default: 4 },
            private_guide_available: { type: 'BOOLEAN', required: false, default: false },
            
            // 料金情報
            fun_dive_price_2tanks: { type: 'INTEGER', required: false },
            trial_dive_price_beach: { type: 'INTEGER', required: false },
            trial_dive_price_boat: { type: 'INTEGER', required: false },
            equipment_rental_included: { type: 'BOOLEAN', required: false, default: false },
            additional_fees: { type: 'TEXT', required: false },
            
            // 安全・保険
            safety_equipment: { type: 'BOOLEAN', required: false, default: false },
            insurance_coverage: { type: 'BOOLEAN', required: false, default: false },
            
            // サポート体制
            female_instructor: { type: 'BOOLEAN', required: false, default: false },
            english_support: { type: 'BOOLEAN', required: false, default: false },
            pickup_service: { type: 'BOOLEAN', required: false, default: false },
            
            // 対応レベル
            beginner_friendly: { type: 'BOOLEAN', required: false, default: false },
            solo_welcome: { type: 'BOOLEAN', required: false, default: false },
            family_friendly: { type: 'BOOLEAN', required: false, default: false },
            
            // 撮影サービス
            photo_service: { type: 'BOOLEAN', required: false, default: false },
            video_service: { type: 'BOOLEAN', required: false, default: false },
            
            // 専門情報
            speciality_areas: { type: 'TEXT', required: false },
            certification_level: { type: 'VARCHAR(100)', required: false },
            experience_years: { type: 'INTEGER', required: false },
            
            // 評価・レビュー
            customer_rating: { type: 'DECIMAL(3,2)', required: false, min: 0, max: 5 },
            review_count: { type: 'INTEGER', required: false, default: 0 },
            incident_record: { type: 'TEXT', required: false },
            
            // Jiji独自評価
            jiji_grade: { type: 'VARCHAR(50)', required: false, enum: ['premium', 'standard', 'basic'] },
            
            // メタデータ
            last_updated: { type: 'DATE', required: false }
        };

        // CSVヘッダーとの対応関係
        this.csvMapping = {
            'エリア': 'area',
            'ショップ名': 'shop_name',
            'URL': 'website',
            '電話番号': 'phone_line',
            '評価': 'customer_rating',
            'レビュー数': 'review_count',
            '専門・特徴': 'speciality_areas',
            '料金（2ダイブ目安）': 'fun_dive_price_2tanks'
        };

        // データ検証ルール
        this.validationRules = {
            required: ['shop_name', 'area'],
            areas: ['石垣島', '宮古島', '沖縄本島', '与那国島', '久米島', '座間味島'],
            grades: ['premium', 'standard', 'basic'],
            certifications: ['PADI', 'NAUI', 'SSI', 'BSAC', 'CMAS', 'その他']
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
            
            console.log(`📊 V2.8スプレッドシート接続成功: ${this.doc.title}`);
            
            // V2.8対応ワークシート取得
            this.shopSheet = this.doc.sheetsByTitle['ショップマスタ34項目'] || this.doc.sheetsByIndex[0];
            this.reviewSheet = this.doc.sheetsByTitle['口コミデータ'] || null;
            this.weatherSheet = this.doc.sheetsByTitle['海況データ'] || null;
            this.priceSheet = this.doc.sheetsByTitle['価格情報'] || null;
            this.serviceSheet = this.doc.sheetsByTitle['サービス詳細'] || null;
            
            console.log(`✅ V2.8ワークシート準備完了: ${this.shopSheet.title}`);
            
            // ヘッダー行の確認・作成
            await this.ensureHeaderRow();
            
            return true;
        } catch (error) {
            console.error('❌ V2.8 Google Sheets初期化エラー:', error.message);
            throw error;
        }
    }

    /**
     * V2.8 34項目ヘッダー行の確認・作成
     */
    async ensureHeaderRow() {
        try {
            const expectedHeaders = [
                'shop_id', 'shop_name', 'area', 'phone_line', 'website', 'operating_hours',
                'fun_dive_available', 'trial_dive_options', 'license_course_available',
                'max_group_size', 'private_guide_available',
                'fun_dive_price_2tanks', 'trial_dive_price_beach', 'trial_dive_price_boat',
                'equipment_rental_included', 'additional_fees',
                'safety_equipment', 'insurance_coverage',
                'female_instructor', 'english_support', 'pickup_service',
                'beginner_friendly', 'solo_welcome', 'family_friendly',
                'photo_service', 'video_service',
                'speciality_areas', 'certification_level', 'experience_years',
                'customer_rating', 'review_count', 'incident_record',
                'jiji_grade', 'last_updated'
            ];

            const currentHeaders = await this.shopSheet.getHeaderRow();
            
            // ヘッダーが不完全な場合は更新
            if (currentHeaders.length !== expectedHeaders.length || 
                !expectedHeaders.every(header => currentHeaders.includes(header))) {
                
                console.log('🔄 V2.8ヘッダー行を更新中...');
                await this.shopSheet.setHeaderRow(expectedHeaders);
                console.log('✅ V2.8ヘッダー行更新完了');
            }
            
        } catch (error) {
            console.error('❌ ヘッダー行確認エラー:', error.message);
            throw error;
        }
    }

    /**
     * V2.8 34項目ショップデータの同期処理
     */
    async syncShopDataV28() {
        try {
            console.log('🔄 V2.8 34項目ショップデータ同期開始...');
            
            // シートからデータ取得
            const rows = await this.shopSheet.getRows();
            
            // V2.8形式でデータを構造化
            const shopData = this.parseShopDataV28(rows);
            
            // V2.8データ検証
            const validatedData = this.validateShopDataV28(shopData);
            
            // データベースに保存
            await this.saveShopDataV28(validatedData);
            
            this.lastSync = new Date();
            console.log(`✅ V2.8同期完了: ${validatedData.length}件のショップデータ`);
            
            return {
                success: true,
                count: validatedData.length,
                timestamp: this.lastSync,
                data: validatedData,
                version: '2.8'
            };
            
        } catch (error) {
            console.error('❌ V2.8ショップデータ同期エラー:', error.message);
            return {
                success: false,
                error: error.message,
                timestamp: new Date(),
                version: '2.8'
            };
        }
    }

    /**
     * V2.8 34項目データの構造化処理
     */
    parseShopDataV28(rows) {
        const shopData = [];
        
        rows.forEach((row, index) => {
            const shop = {
                // 基本情報
                shop_id: this.generateShopId(row.shop_name || `shop_${index}`),
                shop_name: row.shop_name || '',
                area: row.area || '',
                phone_line: row.phone_line || '',
                website: row.website || '',
                operating_hours: row.operating_hours || '',
                
                // サービス提供可否
                fun_dive_available: this.parseBoolean(row.fun_dive_available),
                trial_dive_options: row.trial_dive_options || '',
                license_course_available: this.parseBoolean(row.license_course_available),
                
                // グループ・ガイド情報
                max_group_size: this.parseInt(row.max_group_size) || 4,
                private_guide_available: this.parseBoolean(row.private_guide_available),
                
                // 料金情報
                fun_dive_price_2tanks: this.parsePrice(row.fun_dive_price_2tanks),
                trial_dive_price_beach: this.parsePrice(row.trial_dive_price_beach),
                trial_dive_price_boat: this.parsePrice(row.trial_dive_price_boat),
                equipment_rental_included: this.parseBoolean(row.equipment_rental_included),
                additional_fees: row.additional_fees || '',
                
                // 安全・保険
                safety_equipment: this.parseBoolean(row.safety_equipment),
                insurance_coverage: this.parseBoolean(row.insurance_coverage),
                
                // サポート体制
                female_instructor: this.parseBoolean(row.female_instructor),
                english_support: this.parseBoolean(row.english_support),
                pickup_service: this.parseBoolean(row.pickup_service),
                
                // 対応レベル
                beginner_friendly: this.parseBoolean(row.beginner_friendly),
                solo_welcome: this.parseBoolean(row.solo_welcome),
                family_friendly: this.parseBoolean(row.family_friendly),
                
                // 撮影サービス
                photo_service: this.parseBoolean(row.photo_service),
                video_service: this.parseBoolean(row.video_service),
                
                // 専門情報
                speciality_areas: row.speciality_areas || '',
                certification_level: row.certification_level || '',
                experience_years: this.parseInt(row.experience_years),
                
                // 評価・レビュー
                customer_rating: this.parseFloat(row.customer_rating),
                review_count: this.parseInt(row.review_count) || 0,
                incident_record: row.incident_record || '',
                
                // Jiji独自評価
                jiji_grade: row.jiji_grade || 'basic',
                
                // メタデータ
                last_updated: new Date(),
                source: 'google_sheets_v28'
            };
            
            shopData.push(shop);
        });
        
        return shopData;
    }

    /**
     * V2.8データ検証処理
     */
    validateShopDataV28(shopData) {
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
            
            // Jijiグレード検証
            if (shop.jiji_grade && !this.validationRules.grades.includes(shop.jiji_grade)) {
                shopErrors.push(`無効なJijiグレード: ${shop.jiji_grade}`);
            }
            
            // 電話番号検証
            if (shop.phone_line && !this.validatePhone(shop.phone_line)) {
                shopErrors.push(`無効な電話番号: ${shop.phone_line}`);
            }
            
            // 評価値検証
            if (shop.customer_rating && (shop.customer_rating < 0 || shop.customer_rating > 5)) {
                shopErrors.push(`評価は0-5の範囲で入力してください: ${shop.customer_rating}`);
            }
            
            // グループサイズ検証
            if (shop.max_group_size && (shop.max_group_size < 1 || shop.max_group_size > 20)) {
                shopErrors.push(`グループサイズは1-20の範囲で入力してください: ${shop.max_group_size}`);
            }
            
            // 料金検証
            if (shop.fun_dive_price_2tanks && shop.fun_dive_price_2tanks < 0) {
                shopErrors.push(`料金は0以上で入力してください: ${shop.fun_dive_price_2tanks}`);
            }
            
            // 経験年数検証
            if (shop.experience_years && (shop.experience_years < 0 || shop.experience_years > 100)) {
                shopErrors.push(`経験年数は0-100の範囲で入力してください: ${shop.experience_years}`);
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
     * 既存CSVデータからV2.8形式への変換
     */
    async convertCsvToV28(csvData) {
        const convertedData = [];
        
        csvData.forEach((row, index) => {
            const shop = {
                shop_id: this.generateShopId(row['ショップ名'] || `shop_${index}`),
                shop_name: row['ショップ名'] || '',
                area: row['エリア'] || '',
                phone_line: row['電話番号'] || '',
                website: row['URL'] || '',
                operating_hours: '',
                
                // CSVから推測できる項目
                fun_dive_available: true, // 全て提供していると仮定
                trial_dive_options: '',
                license_course_available: false, // 個別確認が必要
                
                max_group_size: 4, // デフォルト値
                private_guide_available: false,
                
                fun_dive_price_2tanks: this.parsePrice(row['料金（2ダイブ目安）']),
                trial_dive_price_beach: null,
                trial_dive_price_boat: null,
                equipment_rental_included: false,
                additional_fees: '',
                
                safety_equipment: false,
                insurance_coverage: false,
                
                female_instructor: false,
                english_support: false,
                pickup_service: false,
                
                beginner_friendly: this.isBeginnerFriendly(row['専門・特徴']),
                solo_welcome: false,
                family_friendly: false,
                
                photo_service: false,
                video_service: false,
                
                speciality_areas: row['専門・特徴'] || '',
                certification_level: this.extractCertification(row['専門・特徴']),
                experience_years: null,
                
                customer_rating: parseFloat(row['評価']) || null,
                review_count: parseInt(row['レビュー数']) || 0,
                incident_record: '',
                
                jiji_grade: this.determineJijiGrade(row),
                
                last_updated: new Date(),
                source: 'csv_conversion'
            };
            
            convertedData.push(shop);
        });
        
        return convertedData;
    }

    /**
     * V2.8マッチングアルゴリズム対応検索
     */
    async searchShopsV28(filters = {}) {
        try {
            const shopData = await this.getShopDataV28();
            let filteredShops = shopData;
            
            // エリアフィルター
            if (filters.area) {
                filteredShops = filteredShops.filter(shop => 
                    shop.area === filters.area
                );
            }
            
            // 初心者向けフィルター
            if (filters.beginnerFriendly) {
                filteredShops = filteredShops.filter(shop => 
                    shop.beginner_friendly === true
                );
            }
            
            // 一人参加歓迎フィルター
            if (filters.soloWelcome) {
                filteredShops = filteredShops.filter(shop => 
                    shop.solo_welcome === true
                );
            }
            
            // 女性インストラクターフィルター
            if (filters.femaleInstructor) {
                filteredShops = filteredShops.filter(shop => 
                    shop.female_instructor === true
                );
            }
            
            // 価格帯フィルター
            if (filters.maxPrice) {
                filteredShops = filteredShops.filter(shop => 
                    shop.fun_dive_price_2tanks <= filters.maxPrice
                );
            }
            
            // 評価フィルター
            if (filters.minRating) {
                filteredShops = filteredShops.filter(shop => 
                    shop.customer_rating >= filters.minRating
                );
            }
            
            // Jijiグレードフィルター
            if (filters.jijiGrade) {
                filteredShops = filteredShops.filter(shop => 
                    shop.jiji_grade === filters.jijiGrade
                );
            }
            
            // 専門分野フィルター
            if (filters.specialty) {
                filteredShops = filteredShops.filter(shop => 
                    shop.speciality_areas.includes(filters.specialty)
                );
            }
            
            // V2.8マッチングアルゴリズム適用
            if (filters.useV28Matching) {
                filteredShops = this.applyV28MatchingAlgorithm(filteredShops, filters);
            }
            
            // ソート
            if (filters.sortBy) {
                filteredShops = this.sortShopsV28(filteredShops, filters.sortBy);
            }
            
            return filteredShops;
            
        } catch (error) {
            console.error('❌ V2.8ショップ検索エラー:', error.message);
            throw error;
        }
    }

    /**
     * V2.8マッチングアルゴリズム（50/30/20）
     */
    applyV28MatchingAlgorithm(shops, filters) {
        return shops.map(shop => {
            let score = 0;
            
            // 口コミAI分析（50%）
            const reviewScore = this.calculateReviewScore(shop);
            score += reviewScore * 0.5;
            
            // 基本情報適合度（30%）
            const basicScore = this.calculateBasicScore(shop, filters);
            score += basicScore * 0.3;
            
            // プラン優遇（20%）
            const planScore = this.calculatePlanScore(shop);
            score += planScore * 0.2;
            
            return {
                ...shop,
                matching_score: score,
                score_breakdown: {
                    review: reviewScore,
                    basic: basicScore,
                    plan: planScore
                }
            };
        }).sort((a, b) => b.matching_score - a.matching_score);
    }

    // ===== ユーティリティ関数（V2.8対応） =====

    generateShopId(shopName) {
        return `shop_${shopName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    }

    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return ['true', '1', 'yes', 'はい', '○', 'TRUE', 'Yes'].includes(value);
        }
        return false;
    }

    parseInt(value) {
        const parsed = parseInt(value);
        return isNaN(parsed) ? null : parsed;
    }

    parseFloat(value) {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? null : parsed;
    }

    parsePrice(value) {
        if (!value) return null;
        const price = value.toString().replace(/[¥,円]/g, '');
        const parsed = parseInt(price);
        return isNaN(parsed) ? null : parsed;
    }

    isBeginnerFriendly(specialties) {
        const beginnerKeywords = ['初心者', '体験', 'ビギナー', '初回', '未経験'];
        return beginnerKeywords.some(keyword => specialties.includes(keyword));
    }

    extractCertification(specialties) {
        const certifications = ['PADI', 'NAUI', 'SSI', 'BSAC', 'CMAS'];
        return certifications.find(cert => specialties.includes(cert)) || '';
    }

    determineJijiGrade(row) {
        const rating = parseFloat(row['評価']) || 0;
        const reviewCount = parseInt(row['レビュー数']) || 0;
        
        if (rating >= 4.8 && reviewCount >= 100) return 'premium';
        if (rating >= 4.5 && reviewCount >= 50) return 'standard';
        return 'basic';
    }

    calculateReviewScore(shop) {
        const rating = shop.customer_rating || 0;
        const reviewCount = shop.review_count || 0;
        
        // 評価と口コミ数の重み付け
        const ratingScore = (rating / 5) * 0.7;
        const reviewScore = Math.min(reviewCount / 100, 1) * 0.3;
        
        return ratingScore + reviewScore;
    }

    calculateBasicScore(shop, filters) {
        let score = 0;
        let maxScore = 0;
        
        // エリア適合度
        if (filters.area) {
            maxScore += 0.3;
            if (shop.area === filters.area) score += 0.3;
        }
        
        // 初心者対応度
        if (filters.beginnerFriendly) {
            maxScore += 0.2;
            if (shop.beginner_friendly) score += 0.2;
        }
        
        // 価格適合度
        if (filters.maxPrice && shop.fun_dive_price_2tanks) {
            maxScore += 0.2;
            if (shop.fun_dive_price_2tanks <= filters.maxPrice) score += 0.2;
        }
        
        // グループサイズ適合度
        if (filters.groupSize) {
            maxScore += 0.1;
            if (shop.max_group_size >= filters.groupSize) score += 0.1;
        }
        
        // 特殊要求適合度
        if (filters.femaleInstructor) {
            maxScore += 0.1;
            if (shop.female_instructor) score += 0.1;
        }
        
        if (filters.englishSupport) {
            maxScore += 0.1;
            if (shop.english_support) score += 0.1;
        }
        
        return maxScore > 0 ? score / maxScore : 0;
    }

    calculatePlanScore(shop) {
        switch (shop.jiji_grade) {
            case 'premium': return 1.0;
            case 'standard': return 0.6;
            case 'basic': return 0.3;
            default: return 0.2;
        }
    }

    sortShopsV28(shops, sortBy) {
        switch (sortBy) {
            case 'matching_score':
                return shops.sort((a, b) => (b.matching_score || 0) - (a.matching_score || 0));
            case 'rating':
                return shops.sort((a, b) => (b.customer_rating || 0) - (a.customer_rating || 0));
            case 'price':
                return shops.sort((a, b) => (a.fun_dive_price_2tanks || 999999) - (b.fun_dive_price_2tanks || 999999));
            case 'name':
                return shops.sort((a, b) => a.shop_name.localeCompare(b.shop_name));
            case 'area':
                return shops.sort((a, b) => a.area.localeCompare(b.area));
            case 'jiji_grade':
                const gradeOrder = { 'premium': 3, 'standard': 2, 'basic': 1 };
                return shops.sort((a, b) => (gradeOrder[b.jiji_grade] || 0) - (gradeOrder[a.jiji_grade] || 0));
            default:
                return shops;
        }
    }

    validatePhone(phone) {
        // 日本の電話番号パターン
        const phonePattern = /^(\+81|0)[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4}$/;
        return phonePattern.test(phone);
    }

    // ===== データベース連携プレースホルダー =====

    async saveShopDataV28(shopData) {
        // 実際の実装では、Supabase/PostgreSQLに保存
        console.log(`📝 V2.8データベース保存: ${shopData.length}件`);
        
        // 将来的にはPrisma ORM等で実装
        /*
        await prisma.shop.createMany({
            data: shopData,
            skipDuplicates: true
        });
        */
    }

    async getShopDataV28() {
        // 実際の実装では、データベースから取得
        console.log('📋 V2.8データベースから取得');
        return [];
    }

    async notifyValidationErrors(errors) {
        // 実際の実装では、Slack/メール通知
        console.log('⚠️  V2.8データ検証エラー:', errors);
    }
}

module.exports = JijiShopDataManagerV28;