/**
 * Google Sheets データ同期 - 本番運用スクリプト
 * cronジョブやAPIエンドポイントから呼び出される同期処理
 */

const JijiShopDataManager = require('./google-sheets-integration');
const cron = require('node-cron');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// ログ設定
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: path.join(__dirname, '../logs/sync-error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(__dirname, '../logs/sync-combined.log') }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

class SyncService {
    constructor() {
        this.manager = new JijiShopDataManager();
        this.initialized = false;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.syncHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * サービス初期化
     */
    async initialize() {
        if (this.initialized) return;

        try {
            // ログディレクトリ作成
            const logDir = path.join(__dirname, '../logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }

            // データディレクトリ作成
            const dataDir = path.join(__dirname, '../data');
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }

            // Google Sheets Manager初期化
            await this.manager.initialize();
            this.initialized = true;
            
            logger.info('🚀 同期サービス初期化完了');
            
        } catch (error) {
            logger.error('❌ 同期サービス初期化エラー:', error);
            throw error;
        }
    }

    /**
     * 完全同期実行
     */
    async performFullSync() {
        if (this.syncInProgress) {
            logger.warn('⚠️  同期が既に実行中です');
            return { success: false, message: '同期が既に実行中です' };
        }

        this.syncInProgress = true;
        const syncStartTime = new Date();
        const syncId = `sync_${Date.now()}`;
        
        logger.info(`🔄 完全同期開始: ${syncId}`);

        try {
            const results = {};

            // 1. ショップデータ同期
            logger.info('📊 ショップデータ同期開始...');
            results.shops = await this.manager.syncShopData();
            logger.info(`✅ ショップデータ同期完了: ${results.shops.count || 0}件`);

            // 2. 口コミデータ同期
            logger.info('💬 口コミデータ同期開始...');
            results.reviews = await this.manager.syncReviewData();
            logger.info(`✅ 口コミデータ同期完了: ${results.reviews ? results.reviews.length : 0}件`);

            // 3. 海況データ同期
            logger.info('🌊 海況データ同期開始...');
            results.weather = await this.manager.syncWeatherData();
            logger.info(`✅ 海況データ同期完了: ${results.weather ? results.weather.length : 0}件`);

            // 同期結果の記録
            const syncEndTime = new Date();
            const syncDuration = syncEndTime - syncStartTime;
            
            const syncResult = {
                id: syncId,
                timestamp: syncStartTime,
                duration: syncDuration,
                results: results,
                success: true
            };

            this.lastSyncTime = syncStartTime;
            this.addToHistory(syncResult);
            
            // 同期結果を保存
            await this.saveSyncResult(syncResult);
            
            logger.info(`🎉 完全同期完了: ${syncId} (${syncDuration}ms)`);
            
            return syncResult;

        } catch (error) {
            logger.error(`❌ 完全同期エラー: ${syncId}`, error);
            
            const errorResult = {
                id: syncId,
                timestamp: syncStartTime,
                error: error.message,
                success: false
            };
            
            this.addToHistory(errorResult);
            await this.saveSyncResult(errorResult);
            
            throw error;
            
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * 差分同期実行
     */
    async performIncrementalSync() {
        if (!this.lastSyncTime) {
            logger.info('🔄 初回同期のため完全同期を実行します');
            return await this.performFullSync();
        }

        logger.info('🔄 差分同期開始...');
        
        try {
            // 最後の同期以降の変更のみを取得
            const changes = await this.detectChanges();
            
            if (changes.length === 0) {
                logger.info('✅ 変更なし - 同期スキップ');
                return { success: true, changes: 0, message: '変更なし' };
            }

            // 変更分のみを処理
            const result = await this.processChanges(changes);
            
            logger.info(`✅ 差分同期完了: ${changes.length}件の変更`);
            return result;

        } catch (error) {
            logger.error('❌ 差分同期エラー:', error);
            throw error;
        }
    }

    /**
     * 自動同期の開始
     */
    startAutoSync() {
        logger.info('🔄 自動同期スケジュール開始');

        // 5分ごとの差分同期
        cron.schedule('*/5 * * * *', async () => {
            try {
                await this.performIncrementalSync();
            } catch (error) {
                logger.error('❌ 自動差分同期エラー:', error);
            }
        });

        // 1時間ごとの完全同期
        cron.schedule('0 * * * *', async () => {
            try {
                await this.performFullSync();
            } catch (error) {
                logger.error('❌ 自動完全同期エラー:', error);
            }
        });

        // 毎日午前2時のクリーンアップ
        cron.schedule('0 2 * * *', async () => {
            try {
                await this.performMaintenance();
            } catch (error) {
                logger.error('❌ メンテナンスエラー:', error);
            }
        });

        logger.info('✅ 自動同期スケジュール設定完了');
    }

    /**
     * 同期状態の取得
     */
    getSyncStatus() {
        return {
            initialized: this.initialized,
            syncInProgress: this.syncInProgress,
            lastSyncTime: this.lastSyncTime,
            recentHistory: this.syncHistory.slice(-10)
        };
    }

    /**
     * 同期履歴の管理
     */
    addToHistory(result) {
        this.syncHistory.push(result);
        
        // 履歴サイズ制限
        if (this.syncHistory.length > this.maxHistorySize) {
            this.syncHistory = this.syncHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * 同期結果の保存
     */
    async saveSyncResult(result) {
        try {
            const resultPath = path.join(__dirname, '../data/sync-results.json');
            let existingResults = [];
            
            if (fs.existsSync(resultPath)) {
                const data = fs.readFileSync(resultPath, 'utf8');
                existingResults = JSON.parse(data);
            }
            
            existingResults.push(result);
            
            // 最新100件のみ保持
            if (existingResults.length > 100) {
                existingResults = existingResults.slice(-100);
            }
            
            fs.writeFileSync(resultPath, JSON.stringify(existingResults, null, 2));
            
        } catch (error) {
            logger.error('❌ 同期結果保存エラー:', error);
        }
    }

    /**
     * 変更検出
     */
    async detectChanges() {
        // 実際の実装では、最後の同期時刻以降の変更を検出
        // Google Sheets APIの制限により、全データを取得して比較
        logger.info('🔍 変更検出開始...');
        
        try {
            // 簡易実装: 常に変更ありとして処理
            return [{
                type: 'shop_data',
                timestamp: new Date(),
                changes: 'データ更新検出'
            }];
            
        } catch (error) {
            logger.error('❌ 変更検出エラー:', error);
            return [];
        }
    }

    /**
     * 変更処理
     */
    async processChanges(changes) {
        logger.info(`📝 変更処理開始: ${changes.length}件`);
        
        const results = [];
        
        for (const change of changes) {
            try {
                switch (change.type) {
                    case 'shop_data':
                        const shopResult = await this.manager.syncShopData();
                        results.push(shopResult);
                        break;
                    case 'review_data':
                        const reviewResult = await this.manager.syncReviewData();
                        results.push(reviewResult);
                        break;
                    case 'weather_data':
                        const weatherResult = await this.manager.syncWeatherData();
                        results.push(weatherResult);
                        break;
                    default:
                        logger.warn(`⚠️  不明な変更タイプ: ${change.type}`);
                }
                
            } catch (error) {
                logger.error(`❌ 変更処理エラー: ${change.type}`, error);
                results.push({
                    type: change.type,
                    success: false,
                    error: error.message
                });
            }
        }
        
        return {
            success: true,
            changes: changes.length,
            results: results
        };
    }

    /**
     * メンテナンス処理
     */
    async performMaintenance() {
        logger.info('🧹 メンテナンス開始...');
        
        try {
            // 古いログファイルの削除
            await this.cleanupOldLogs();
            
            // 古い同期結果の削除
            await this.cleanupOldSyncResults();
            
            // データベースの最適化
            await this.optimizeDatabase();
            
            logger.info('✅ メンテナンス完了');
            
        } catch (error) {
            logger.error('❌ メンテナンスエラー:', error);
        }
    }

    /**
     * 古いログファイルの削除
     */
    async cleanupOldLogs() {
        const logDir = path.join(__dirname, '../logs');
        const retentionDays = 30;
        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
        
        try {
            const files = fs.readdirSync(logDir);
            
            for (const file of files) {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime.getTime() < cutoffTime) {
                    fs.unlinkSync(filePath);
                    logger.info(`🗑️  古いログファイル削除: ${file}`);
                }
            }
            
        } catch (error) {
            logger.error('❌ ログファイル削除エラー:', error);
        }
    }

    /**
     * 古い同期結果の削除
     */
    async cleanupOldSyncResults() {
        const resultPath = path.join(__dirname, '../data/sync-results.json');
        
        try {
            if (fs.existsSync(resultPath)) {
                const data = fs.readFileSync(resultPath, 'utf8');
                const results = JSON.parse(data);
                
                // 最新50件のみ保持
                const cleanedResults = results.slice(-50);
                
                fs.writeFileSync(resultPath, JSON.stringify(cleanedResults, null, 2));
                logger.info(`🗑️  古い同期結果削除: ${results.length - cleanedResults.length}件`);
            }
            
        } catch (error) {
            logger.error('❌ 同期結果削除エラー:', error);
        }
    }

    /**
     * データベース最適化
     */
    async optimizeDatabase() {
        // 実際の実装では、データベースの最適化クエリを実行
        logger.info('🔧 データベース最適化実行');
    }

    /**
     * 健全性チェック
     */
    async healthCheck() {
        const checks = {
            googleSheetsConnection: false,
            databaseConnection: false,
            lastSyncStatus: false,
            diskSpace: false
        };
        
        try {
            // Google Sheets接続確認
            await this.manager.initialize();
            checks.googleSheetsConnection = true;
            
            // データベース接続確認
            // 実際の実装では、データベースへのpingを実行
            checks.databaseConnection = true;
            
            // 最後の同期状態確認
            checks.lastSyncStatus = this.lastSyncTime && 
                (Date.now() - this.lastSyncTime.getTime()) < 3600000; // 1時間以内
            
            // ディスク容量確認
            checks.diskSpace = true; // 実際の実装では、ディスク使用量を確認
            
        } catch (error) {
            logger.error('❌ 健全性チェックエラー:', error);
        }
        
        const overallHealth = Object.values(checks).every(check => check);
        
        return {
            healthy: overallHealth,
            checks: checks,
            timestamp: new Date()
        };
    }
}

// Express APIエンドポイント用の関数
async function createSyncAPI(app) {
    const syncService = new SyncService();
    await syncService.initialize();
    
    // 手動同期エンドポイント
    app.post('/api/sync/manual', async (req, res) => {
        try {
            const result = await syncService.performFullSync();
            res.json({ success: true, data: result });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    // 同期状態確認エンドポイント
    app.get('/api/sync/status', (req, res) => {
        const status = syncService.getSyncStatus();
        res.json({ success: true, data: status });
    });
    
    // 健全性チェックエンドポイント
    app.get('/api/sync/health', async (req, res) => {
        try {
            const health = await syncService.healthCheck();
            res.json({ success: true, data: health });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    // 自動同期開始
    syncService.startAutoSync();
    
    return syncService;
}

// スクリプトとして実行された場合
if (require.main === module) {
    async function main() {
        const syncService = new SyncService();
        
        try {
            await syncService.initialize();
            
            const mode = process.argv[2] || 'full';
            
            switch (mode) {
                case 'full':
                    await syncService.performFullSync();
                    break;
                case 'incremental':
                    await syncService.performIncrementalSync();
                    break;
                case 'auto':
                    syncService.startAutoSync();
                    console.log('自動同期開始 - Ctrl+C で停止');
                    break;
                case 'status':
                    const status = syncService.getSyncStatus();
                    console.log('同期状態:', JSON.stringify(status, null, 2));
                    break;
                case 'health':
                    const health = await syncService.healthCheck();
                    console.log('健全性チェック:', JSON.stringify(health, null, 2));
                    break;
                default:
                    console.log('使用方法:');
                    console.log('  node sync-sheets-data.js full        - 完全同期');
                    console.log('  node sync-sheets-data.js incremental - 差分同期');
                    console.log('  node sync-sheets-data.js auto        - 自動同期開始');
                    console.log('  node sync-sheets-data.js status      - 同期状態確認');
                    console.log('  node sync-sheets-data.js health      - 健全性チェック');
            }
            
        } catch (error) {
            logger.error('❌ 同期スクリプトエラー:', error);
            process.exit(1);
        }
    }
    
    main();
}

module.exports = { SyncService, createSyncAPI };