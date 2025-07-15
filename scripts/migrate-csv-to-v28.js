/**
 * CSV → V2.8 34項目データ変換・移行スクリプト
 * 既存のCSVデータを V2.8 の 34項目構造に変換
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const JijiShopDataManagerV28 = require('../api/google-sheets-integration-v28');

class CsvToV28Migrator {
    constructor() {
        this.csvFilePath = path.join(__dirname, '../資料/ショップファイル - 一覧.csv');
        this.outputPath = path.join(__dirname, '../data/v28-migrated-shops.json');
        this.manager = new JijiShopDataManagerV28();
        this.migrationResults = {
            totalRows: 0,
            successful: 0,
            failed: 0,
            warnings: [],
            errors: []
        };
    }

    /**
     * メイン移行処理
     */
    async migrate() {
        console.log('🚀 CSV → V2.8 34項目データ移行開始');
        
        try {
            // 1. CSVデータ読み込み
            const csvData = await this.readCsvFile();
            console.log(`📊 CSVデータ読み込み完了: ${csvData.length}件`);

            // 2. V2.8形式に変換
            const v28Data = await this.convertToV28Format(csvData);
            console.log(`🔄 V2.8形式変換完了: ${v28Data.length}件`);

            // 3. データ検証
            const validatedData = await this.validateV28Data(v28Data);
            console.log(`✅ データ検証完了: ${validatedData.length}件`);

            // 4. 不足項目の推定・補完
            const enhancedData = await this.enhanceDataWithDefaults(validatedData);
            console.log(`🔧 データ補完完了: ${enhancedData.length}件`);

            // 5. 結果保存
            await this.saveResults(enhancedData);
            console.log(`💾 結果保存完了: ${this.outputPath}`);

            // 6. Google Sheetsにアップロード（オプション）
            if (process.env.GOOGLE_SPREADSHEET_ID) {
                await this.uploadToGoogleSheets(enhancedData);
                console.log('📤 Google Sheetsアップロード完了');
            }

            // 7. 移行レポート生成
            await this.generateMigrationReport();
            console.log('📋 移行レポート生成完了');

            return {
                success: true,
                results: this.migrationResults,
                data: enhancedData
            };

        } catch (error) {
            console.error('❌ 移行処理エラー:', error.message);
            this.migrationResults.errors.push(error.message);
            return {
                success: false,
                error: error.message,
                results: this.migrationResults
            };
        }
    }

    /**
     * CSVファイル読み込み
     */
    async readCsvFile() {
        return new Promise((resolve, reject) => {
            const results = [];
            
            fs.createReadStream(this.csvFilePath)
                .pipe(csv())
                .on('data', (data) => {
                    results.push(data);
                    this.migrationResults.totalRows++;
                })
                .on('end', () => {
                    resolve(results);
                })
                .on('error', reject);
        });
    }

    /**
     * V2.8 34項目形式への変換
     */
    async convertToV28Format(csvData) {
        const v28Data = [];
        
        for (let i = 0; i < csvData.length; i++) {
            const row = csvData[i];
            
            try {
                const shop = {
                    // 基本情報（CSVから直接取得）
                    shop_id: this.generateShopId(row['ショップ名'], i),
                    shop_name: row['ショップ名'] || '',
                    area: row['エリア'] || '',
                    phone_line: row['電話番号'] || '',
                    website: row['URL'] || '',
                    operating_hours: '', // CSVにないのでデフォルト
                    
                    // サービス提供可否（推測・デフォルト）
                    fun_dive_available: true, // 基本的に全て提供
                    trial_dive_options: this.extractTrialOptions(row),
                    license_course_available: this.hasLicenseCourse(row),
                    
                    // グループ・ガイド情報（推測）
                    max_group_size: this.estimateGroupSize(row),
                    private_guide_available: this.hasPrivateGuide(row),
                    
                    // 料金情報（CSVから変換）
                    fun_dive_price_2tanks: this.parsePrice(row['料金（2ダイブ目安）']),
                    trial_dive_price_beach: null, // 個別調査が必要
                    trial_dive_price_boat: null,
                    equipment_rental_included: this.hasEquipmentRental(row),
                    additional_fees: '', // 個別調査が必要
                    
                    // 安全・保険（推測）
                    safety_equipment: this.hasSafetyEquipment(row),
                    insurance_coverage: this.hasInsuranceCoverage(row),
                    
                    // サポート体制（推測）
                    female_instructor: this.hasFemaleInstructor(row),
                    english_support: this.hasEnglishSupport(row),
                    pickup_service: this.hasPickupService(row),
                    
                    // 対応レベル（専門・特徴から推測）
                    beginner_friendly: this.isBeginnerFriendly(row['専門・特徴']),
                    solo_welcome: this.isSoloWelcome(row['専門・特徴']),
                    family_friendly: this.isFamilyFriendly(row['専門・特徴']),
                    
                    // 撮影サービス（推測）
                    photo_service: this.hasPhotoService(row),
                    video_service: this.hasVideoService(row),
                    
                    // 専門情報（CSVから抽出）
                    speciality_areas: row['専門・特徴'] || '',
                    certification_level: this.extractCertification(row['専門・特徴']),
                    experience_years: this.estimateExperienceYears(row),
                    
                    // 評価・レビュー（CSVから直接取得）
                    customer_rating: this.parseFloat(row['評価']),
                    review_count: this.parseInt(row['レビュー数']),
                    incident_record: '', // 個別調査が必要
                    
                    // Jiji独自評価（評価・レビュー数から算出）
                    jiji_grade: this.determineJijiGrade(row),
                    
                    // メタデータ
                    last_updated: new Date().toISOString().split('T')[0],
                    source: 'csv_migration',
                    migration_confidence: this.calculateMigrationConfidence(row),
                    notes: this.generateMigrationNotes(row)
                };
                
                v28Data.push(shop);
                this.migrationResults.successful++;
                
            } catch (error) {
                console.error(`❌ 行 ${i+1} 変換エラー:`, error.message);
                this.migrationResults.failed++;
                this.migrationResults.errors.push(`行 ${i+1}: ${error.message}`);
            }
        }
        
        return v28Data;
    }

    /**
     * データ検証
     */
    async validateV28Data(v28Data) {
        const validatedData = [];
        
        for (const shop of v28Data) {
            const validationErrors = [];
            
            // 必須項目チェック
            if (!shop.shop_name) validationErrors.push('shop_name is required');
            if (!shop.area) validationErrors.push('area is required');
            
            // エリア検証
            const validAreas = ['石垣島', '宮古島', '沖縄本島', '与那国島', '久米島', '座間味島'];
            if (shop.area && !validAreas.includes(shop.area)) {
                validationErrors.push(`Invalid area: ${shop.area}`);
            }
            
            // 評価値検証
            if (shop.customer_rating && (shop.customer_rating < 0 || shop.customer_rating > 5)) {
                validationErrors.push(`Invalid rating: ${shop.customer_rating}`);
            }
            
            // 価格検証
            if (shop.fun_dive_price_2tanks && shop.fun_dive_price_2tanks < 0) {
                validationErrors.push(`Invalid price: ${shop.fun_dive_price_2tanks}`);
            }
            
            if (validationErrors.length > 0) {
                this.migrationResults.warnings.push({
                    shop_name: shop.shop_name,
                    errors: validationErrors
                });
            }
            
            validatedData.push(shop);
        }
        
        return validatedData;
    }

    /**
     * 不足項目の推定・補完
     */
    async enhanceDataWithDefaults(validatedData) {
        const enhancedData = validatedData.map(shop => {
            // 営業時間のデフォルト値
            if (!shop.operating_hours) {
                shop.operating_hours = '8:00-17:00';
            }
            
            // 最大グループサイズのデフォルト
            if (!shop.max_group_size) {
                shop.max_group_size = 4;
            }
            
            // 体験ダイビング料金の推定
            if (!shop.trial_dive_price_beach && shop.fun_dive_price_2tanks) {
                shop.trial_dive_price_beach = Math.round(shop.fun_dive_price_2tanks * 0.7);
            }
            
            if (!shop.trial_dive_price_boat && shop.fun_dive_price_2tanks) {
                shop.trial_dive_price_boat = Math.round(shop.fun_dive_price_2tanks * 0.8);
            }
            
            // 経験年数の推定
            if (!shop.experience_years) {
                if (shop.review_count > 100) shop.experience_years = 10;
                else if (shop.review_count > 50) shop.experience_years = 5;
                else shop.experience_years = 3;
            }
            
            // 信頼度の計算
            shop.data_confidence = this.calculateDataConfidence(shop);
            
            return shop;
        });
        
        return enhancedData;
    }

    /**
     * Google Sheetsへのアップロード
     */
    async uploadToGoogleSheets(v28Data) {
        try {
            await this.manager.initialize();
            
            // ヘッダー行の設定
            const headers = Object.keys(v28Data[0]);
            await this.manager.shopSheet.setHeaderRow(headers);
            
            // データの追加
            await this.manager.shopSheet.addRows(v28Data);
            
            console.log('✅ Google Sheetsアップロード完了');
            
        } catch (error) {
            console.error('❌ Google Sheetsアップロードエラー:', error.message);
            this.migrationResults.errors.push(`Google Sheets upload: ${error.message}`);
        }
    }

    /**
     * 結果保存
     */
    async saveResults(v28Data) {
        // データディレクトリの作成
        const dataDir = path.dirname(this.outputPath);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // V2.8データの保存
        fs.writeFileSync(this.outputPath, JSON.stringify(v28Data, null, 2));
        
        // 統計情報の保存
        const statsPath = path.join(dataDir, 'migration-stats.json');
        fs.writeFileSync(statsPath, JSON.stringify(this.migrationResults, null, 2));
        
        // CSVファイルとしても保存
        const csvPath = path.join(dataDir, 'v28-migrated-shops.csv');
        const csvContent = this.convertToCSV(v28Data);
        fs.writeFileSync(csvPath, csvContent);
    }

    /**
     * 移行レポート生成
     */
    async generateMigrationReport() {
        const reportPath = path.join(__dirname, '../reports/migration-report.md');
        const reportDir = path.dirname(reportPath);
        
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        
        const report = `
# CSV → V2.8 34項目データ移行レポート

## 移行結果
- **処理日時**: ${new Date().toISOString()}
- **総行数**: ${this.migrationResults.totalRows}
- **成功**: ${this.migrationResults.successful}
- **失敗**: ${this.migrationResults.failed}
- **成功率**: ${((this.migrationResults.successful / this.migrationResults.totalRows) * 100).toFixed(1)}%

## データ項目対応表

### 直接対応（8項目）
| CSV項目 | V2.8項目 | 変換処理 |
|---------|----------|----------|
| エリア | area | 直接対応 |
| ショップ名 | shop_name | 直接対応 |
| URL | website | 直接対応 |
| 電話番号 | phone_line | 直接対応 |
| 評価 | customer_rating | 数値変換 |
| レビュー数 | review_count | 数値変換 |
| 専門・特徴 | speciality_areas | 直接対応 |
| 料金（2ダイブ目安） | fun_dive_price_2tanks | 価格変換 |

### 推測対応（26項目）
| V2.8項目 | 推測方法 | 信頼度 |
|----------|----------|--------|
| beginner_friendly | 「初心者」キーワード検索 | 80% |
| jiji_grade | 評価・レビュー数から算出 | 90% |
| certification_level | 「PADI」「NAUI」等キーワード検索 | 70% |
| max_group_size | 「少人数」等から推測 | 60% |
| photo_service | 「撮影」「写真」キーワード検索 | 70% |
| その他 | デフォルト値またはfalse | 50% |

## 警告・エラー一覧

### 警告 (${this.migrationResults.warnings.length}件)
${this.migrationResults.warnings.map(w => `- ${w.shop_name}: ${w.errors.join(', ')}`).join('\n')}

### エラー (${this.migrationResults.errors.length}件)
${this.migrationResults.errors.map(e => `- ${e}`).join('\n')}

## 推奨事項

### 高優先度
1. **体験ダイビング料金**: 個別調査が必要（26項目）
2. **営業時間**: 公式サイトから確認（26項目）
3. **女性インストラクター**: 個別確認が必要（26項目）

### 中優先度
1. **英語サポート**: 外国人観光客対応状況確認
2. **送迎サービス**: 利便性向上のため確認
3. **プライベートガイド**: 高単価サービス確認

### 低優先度
1. **事故記録**: 安全性評価のため将来的に必要
2. **追加料金**: 透明性向上のため確認
3. **保険カバー**: 安心感向上のため確認

## 次のステップ

1. **手動確認作業**: 推測項目の個別確認
2. **Google Sheets設定**: 34項目シートの準備
3. **自動同期テスト**: API連携の動作確認
4. **データ品質向上**: 継続的な情報更新
`;
        
        fs.writeFileSync(reportPath, report);
    }

    // ===== ユーティリティ関数 =====

    generateShopId(shopName, index) {
        const base = shopName ? shopName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() : `shop_${index}`;
        return `shop_${base}`;
    }

    parsePrice(priceStr) {
        if (!priceStr) return null;
        const cleaned = priceStr.replace(/[¥,円]/g, '');
        const match = cleaned.match(/\d+/);
        return match ? parseInt(match[0]) : null;
    }

    parseInt(str) {
        if (!str) return 0;
        const parsed = parseInt(str);
        return isNaN(parsed) ? 0 : parsed;
    }

    parseFloat(str) {
        if (!str) return null;
        const parsed = parseFloat(str);
        return isNaN(parsed) ? null : parsed;
    }

    isBeginnerFriendly(specialties) {
        if (!specialties) return false;
        const keywords = ['初心者', '体験', 'ビギナー', '初回', '未経験', '初めて'];
        return keywords.some(keyword => specialties.includes(keyword));
    }

    isSoloWelcome(specialties) {
        if (!specialties) return false;
        const keywords = ['一人', '1人', 'ソロ', '個人'];
        return keywords.some(keyword => specialties.includes(keyword));
    }

    isFamilyFriendly(specialties) {
        if (!specialties) return false;
        const keywords = ['ファミリー', '家族', '親子', '子供', 'キッズ'];
        return keywords.some(keyword => specialties.includes(keyword));
    }

    hasPhotoService(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        const keywords = ['撮影', '写真', 'フォト', 'カメラ', 'Photo'];
        return keywords.some(keyword => text.includes(keyword));
    }

    hasVideoService(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        const keywords = ['動画', 'ビデオ', 'Video', '撮影'];
        return keywords.some(keyword => text.includes(keyword));
    }

    extractCertification(specialties) {
        if (!specialties) return '';
        const certifications = ['PADI', 'NAUI', 'SSI', 'BSAC', 'CMAS'];
        return certifications.find(cert => specialties.includes(cert)) || '';
    }

    determineJijiGrade(row) {
        const rating = this.parseFloat(row['評価']) || 0;
        const reviewCount = this.parseInt(row['レビュー数']) || 0;
        
        if (rating >= 4.8 && reviewCount >= 100) return 'premium';
        if (rating >= 4.5 && reviewCount >= 50) return 'standard';
        return 'basic';
    }

    estimateGroupSize(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        if (text.includes('少人数')) return 3;
        if (text.includes('貸切') || text.includes('プライベート')) return 2;
        return 4; // デフォルト
    }

    hasPrivateGuide(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        const keywords = ['プライベート', '貸切', '個人', '1組'];
        return keywords.some(keyword => text.includes(keyword));
    }

    hasLicenseCourse(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        const keywords = ['ライセンス', '講習', 'コース', 'PADI', 'NAUI'];
        return keywords.some(keyword => text.includes(keyword));
    }

    hasEquipmentRental(row) {
        // 大半のショップで提供しているため、デフォルトtrue
        return true;
    }

    hasSafetyEquipment(row) {
        // 基本的に全ショップで装備していると仮定
        return true;
    }

    hasInsuranceCoverage(row) {
        // 営業ショップは基本的に保険加入済みと仮定
        return true;
    }

    hasFemaleInstructor(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        const keywords = ['女性', '女性インストラクター', '女性スタッフ'];
        return keywords.some(keyword => text.includes(keyword));
    }

    hasEnglishSupport(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        const keywords = ['英語', 'English', '外国人', '海外'];
        return keywords.some(keyword => text.includes(keyword));
    }

    hasPickupService(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        const keywords = ['送迎', 'ピックアップ', '迎え', '市街地'];
        return keywords.some(keyword => text.includes(keyword));
    }

    extractTrialOptions(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        if (text.includes('体験')) return '体験ダイビング対応';
        return '';
    }

    estimateExperienceYears(row) {
        const text = `${row['専門・特徴']} ${row['備考']}`;
        if (text.includes('老舗') || text.includes('年以上')) return 15;
        if (text.includes('経験豊富') || text.includes('ベテラン')) return 10;
        return 5; // デフォルト
    }

    calculateMigrationConfidence(row) {
        let confidence = 0;
        
        // 基本情報の完全性
        if (row['ショップ名']) confidence += 20;
        if (row['エリア']) confidence += 20;
        if (row['電話番号']) confidence += 15;
        if (row['URL']) confidence += 15;
        if (row['評価']) confidence += 10;
        if (row['レビュー数']) confidence += 10;
        if (row['専門・特徴']) confidence += 10;
        
        return confidence;
    }

    calculateDataConfidence(shop) {
        let confidence = 0;
        let totalFields = 0;
        
        Object.keys(shop).forEach(key => {
            if (key !== 'source' && key !== 'notes' && key !== 'data_confidence') {
                totalFields++;
                if (shop[key] !== null && shop[key] !== '' && shop[key] !== false) {
                    confidence++;
                }
            }
        });
        
        return Math.round((confidence / totalFields) * 100);
    }

    generateMigrationNotes(row) {
        const notes = [];
        
        if (!row['電話番号']) notes.push('電話番号要確認');
        if (!row['URL']) notes.push('ウェブサイト要確認');
        if (!row['評価']) notes.push('評価情報要確認');
        
        return notes.join(', ');
    }

    convertToCSV(data) {
        if (data.length === 0) return '';
        
        const headers = Object.keys(data[0]);
        const rows = data.map(row => 
            headers.map(header => {
                const value = row[header];
                if (typeof value === 'string' && value.includes(',')) {
                    return `"${value}"`;
                }
                return value;
            }).join(',')
        );
        
        return [headers.join(','), ...rows].join('\n');
    }
}

// スクリプトとして実行された場合
if (require.main === module) {
    async function main() {
        const migrator = new CsvToV28Migrator();
        
        try {
            const result = await migrator.migrate();
            
            if (result.success) {
                console.log('\n🎉 移行完了！');
                console.log(`✅ 成功: ${result.results.successful}件`);
                console.log(`⚠️  警告: ${result.results.warnings.length}件`);
                console.log(`❌ エラー: ${result.results.errors.length}件`);
                console.log(`📄 出力ファイル: ${migrator.outputPath}`);
            } else {
                console.log('\n❌ 移行失敗');
                console.log(`エラー: ${result.error}`);
            }
            
        } catch (error) {
            console.error('❌ 移行スクリプトエラー:', error);
            process.exit(1);
        }
    }
    
    main();
}

module.exports = CsvToV28Migrator;