/**
 * Google Sheets API セットアップ・テスト用スクリプト
 * 実際の環境でAPIを試すためのセットアップファイル
 */

const JijiShopDataManager = require('./google-sheets-integration');
const fs = require('fs');
const path = require('path');

// 環境変数の設定例
const ENV_TEMPLATE = `
# Google Sheets API設定
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----"

# データベース設定（将来用）
DATABASE_URL=postgresql://username:password@localhost:5432/jiji_diving
REDIS_URL=redis://localhost:6379

# 通知設定
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your/webhook/url
ADMIN_EMAIL=admin@jiji-diving.com

# その他設定
NODE_ENV=development
PORT=3000
`;

class GoogleSheetsSetup {
    constructor() {
        this.manager = new JijiShopDataManager();
        this.setupCompleted = false;
    }

    /**
     * セットアップの実行
     */
    async runSetup() {
        console.log('🚀 Google Sheets API セットアップ開始');
        
        try {
            // 1. 環境変数チェック
            await this.checkEnvironmentVariables();
            
            // 2. Google Sheets接続テスト
            await this.testGoogleSheetsConnection();
            
            // 3. サンプルデータ作成
            await this.createSampleData();
            
            // 4. API機能テスト
            await this.testAPIFunctions();
            
            // 5. セットアップ完了
            this.setupCompleted = true;
            console.log('✅ セットアップ完了！');
            
        } catch (error) {
            console.error('❌ セットアップエラー:', error.message);
            process.exit(1);
        }
    }

    /**
     * 環境変数の確認
     */
    async checkEnvironmentVariables() {
        console.log('📋 環境変数チェック...');
        
        const requiredEnvVars = [
            'GOOGLE_SPREADSHEET_ID',
            'GOOGLE_SERVICE_ACCOUNT_EMAIL',
            'GOOGLE_PRIVATE_KEY'
        ];
        
        const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
        
        if (missingVars.length > 0) {
            console.error('❌ 以下の環境変数が設定されていません:');
            missingVars.forEach(varName => console.error(`  - ${varName}`));
            
            // .env.example ファイルを作成
            const envPath = path.join(__dirname, '../.env.example');
            fs.writeFileSync(envPath, ENV_TEMPLATE);
            console.log(`📄 .env.example ファイルを作成しました: ${envPath}`);
            
            throw new Error('環境変数が不足しています。.env.example を参考に設定してください。');
        }
        
        console.log('✅ 環境変数チェック完了');
    }

    /**
     * Google Sheets接続テスト
     */
    async testGoogleSheetsConnection() {
        console.log('🔗 Google Sheets接続テスト...');
        
        try {
            await this.manager.initialize();
            console.log('✅ Google Sheets接続成功');
        } catch (error) {
            console.error('❌ Google Sheets接続エラー:', error.message);
            console.error('確認事項:');
            console.error('1. GOOGLE_SPREADSHEET_ID が正しいか');
            console.error('2. サービスアカウントが作成されているか');
            console.error('3. スプレッドシートの共有設定でサービスアカウントに編集権限があるか');
            throw error;
        }
    }

    /**
     * サンプルデータの作成
     */
    async createSampleData() {
        console.log('📝 サンプルデータ作成...');
        
        const sampleShops = [
            {
                shop_name: 'S2クラブ石垣',
                area: '石垣島',
                phone: '0980-88-1234',
                status: 'active',
                rating: 4.8,
                specialties: 'マンタ,地形ダイビング,初心者歓迎',
                price_range: '¥8,000-15,000',
                description: '石垣島でのマンタ遭遇率No.1！初心者から上級者まで楽しめる多彩なポイントをご案内します。',
                website: 'https://s2club-ishigaki.com',
                email: 'info@s2club-ishigaki.com',
                address: '沖縄県石垣市美崎町1-5',
                coordinates: '24.3369,124.1614',
                business_hours: '8:00-18:00',
                languages: '日本語,英語',
                certifications: 'PADI,NAUI',
                equipment_rental: 'true',
                beginner_friendly: 'true',
                boat_diving: 'true',
                shore_diving: 'false',
                night_diving: 'true',
                photo_service: 'true'
            },
            {
                shop_name: 'アクアティックアドベンチャー',
                area: '宮古島',
                phone: '0980-76-5678',
                status: 'active',
                rating: 4.6,
                specialties: '地形ダイビング,洞窟,アドバンス',
                price_range: '¥9,000-18,000',
                description: '宮古島の美しい地形を存分に楽しめる本格的なダイビングサービス。',
                website: 'https://aquatic-adventure.com',
                email: 'info@aquatic-adventure.com',
                address: '沖縄県宮古島市平良字下里1234',
                coordinates: '24.8059,125.2659',
                business_hours: '7:30-17:30',
                languages: '日本語,英語,中国語',
                certifications: 'PADI,SSI',
                equipment_rental: 'true',
                beginner_friendly: 'false',
                boat_diving: 'true',
                shore_diving: 'true',
                night_diving: 'false',
                photo_service: 'true'
            },
            {
                shop_name: '青の洞窟ダイビング',
                area: '沖縄本島',
                phone: '098-123-4567',
                status: 'active',
                rating: 4.3,
                specialties: '青の洞窟,シュノーケリング,初心者',
                price_range: '¥6,000-12,000',
                description: '沖縄本島の青の洞窟で神秘的な体験を。初心者大歓迎のアットホームなショップです。',
                website: 'https://blue-cave-diving.com',
                email: 'info@blue-cave-diving.com',
                address: '沖縄県国頭郡恩納村真栄田476',
                coordinates: '26.4972,127.8148',
                business_hours: '8:00-17:00',
                languages: '日本語',
                certifications: 'PADI',
                equipment_rental: 'true',
                beginner_friendly: 'true',
                boat_diving: 'false',
                shore_diving: 'true',
                night_diving: 'false',
                photo_service: 'true'
            }
        ];

        // サンプルデータをローカルJSONファイルに保存
        const sampleDataPath = path.join(__dirname, '../data/sample-shops.json');
        const dataDir = path.dirname(sampleDataPath);
        
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        fs.writeFileSync(sampleDataPath, JSON.stringify(sampleShops, null, 2));
        console.log(`📄 サンプルデータ作成完了: ${sampleDataPath}`);
        
        return sampleShops;
    }

    /**
     * API機能テスト
     */
    async testAPIFunctions() {
        console.log('🧪 API機能テスト開始...');
        
        try {
            // 1. データ同期テスト
            console.log('1. データ同期テスト...');
            const syncResult = await this.manager.syncShopData();
            console.log('同期結果:', syncResult);
            
            // 2. ショップ検索テスト
            console.log('2. ショップ検索テスト...');
            const searchResults = await this.manager.searchShops({
                area: '石垣島',
                minRating: 4.5,
                beginnerFriendly: true
            });
            console.log('検索結果:', searchResults.length, '件');
            
            // 3. 口コミ同期テスト
            console.log('3. 口コミ同期テスト...');
            const reviewResult = await this.manager.syncReviewData();
            console.log('口コミ同期結果:', reviewResult ? reviewResult.length : 0, '件');
            
            // 4. 海況データ同期テスト
            console.log('4. 海況データ同期テスト...');
            const weatherResult = await this.manager.syncWeatherData();
            console.log('海況データ同期結果:', weatherResult ? weatherResult.length : 0, '件');
            
            console.log('✅ API機能テスト完了');
            
        } catch (error) {
            console.error('❌ API機能テストエラー:', error.message);
            throw error;
        }
    }

    /**
     * デモンストレーション用のインタラクティブテスト
     */
    async runInteractiveDemo() {
        if (!this.setupCompleted) {
            console.log('⚠️  まずセットアップを実行してください');
            return;
        }

        console.log('\n🎮 インタラクティブデモモード');
        console.log('以下のコマンドを試してみてください:');
        console.log('1. syncShopData() - ショップデータ同期');
        console.log('2. searchShops({area: "石垣島"}) - ショップ検索');
        console.log('3. manualSync() - 手動同期');
        console.log('4. startAutoSync() - 自動同期開始');
        
        // REPLモードの開始
        const repl = require('repl');
        const replServer = repl.start('jiji-api> ');
        
        // コンテキストに管理オブジェクトを追加
        replServer.context.manager = this.manager;
        replServer.context.syncShopData = () => this.manager.syncShopData();
        replServer.context.searchShops = (filters) => this.manager.searchShops(filters);
        replServer.context.manualSync = () => this.manager.manualSync();
        replServer.context.startAutoSync = () => this.manager.startAutoSync();
    }

    /**
     * パフォーマンステスト
     */
    async runPerformanceTest() {
        console.log('⚡ パフォーマンステスト開始...');
        
        const tests = [
            {
                name: '大量データ同期',
                fn: async () => {
                    const start = Date.now();
                    await this.manager.syncShopData();
                    return Date.now() - start;
                }
            },
            {
                name: '検索クエリ',
                fn: async () => {
                    const start = Date.now();
                    await this.manager.searchShops({
                        area: '石垣島',
                        minRating: 4.0
                    });
                    return Date.now() - start;
                }
            },
            {
                name: '複数シート同期',
                fn: async () => {
                    const start = Date.now();
                    await Promise.all([
                        this.manager.syncShopData(),
                        this.manager.syncReviewData(),
                        this.manager.syncWeatherData()
                    ]);
                    return Date.now() - start;
                }
            }
        ];

        for (const test of tests) {
            try {
                const duration = await test.fn();
                console.log(`✅ ${test.name}: ${duration}ms`);
            } catch (error) {
                console.error(`❌ ${test.name}: ${error.message}`);
            }
        }
    }
}

// スクリプトの実行
if (require.main === module) {
    const setup = new GoogleSheetsSetup();
    
    // コマンドライン引数による実行モード選択
    const mode = process.argv[2] || 'setup';
    
    switch (mode) {
        case 'setup':
            setup.runSetup();
            break;
        case 'demo':
            setup.runSetup().then(() => setup.runInteractiveDemo());
            break;
        case 'performance':
            setup.runSetup().then(() => setup.runPerformanceTest());
            break;
        default:
            console.log('使用方法:');
            console.log('  node setup-google-sheets.js setup      - セットアップ実行');
            console.log('  node setup-google-sheets.js demo       - デモモード');
            console.log('  node setup-google-sheets.js performance - パフォーマンステスト');
    }
}

module.exports = GoogleSheetsSetup;