const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

// 分割されたモジュールをインポート
const { processUserMessage } = require('./src/message-handler');
const { testDatabaseConnection } = require('./src/database');
const { JIJI_PERSONA_CONFIG } = require('./src/jiji-persona');

// LINE設定
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

// ===== 起動時初期化 =====

async function initializeApp() {
    console.log('🚀 Jiji沖縄ダイビングバディ初期化開始...');
    
    try {
        // データベース接続確認
        console.log('💾 データベース接続確認中...');
        await testDatabaseConnection();
        
        console.log('🤖 Jijiペルソナ設定完了');
        console.log(`📍 対応エリア: ${JIJI_PERSONA_CONFIG.coverage_areas.join('、')}`);
        console.log(`🎭 3つの顔: ${JIJI_PERSONA_CONFIG.personalities.join(' / ')}`);
        
        return true;
    } catch (error) {
        console.error('❌ 初期化エラー:', error);
        return false;
    }
}

// ===== LINE Webhook処理 =====

app.post('/api/line-webhook', line.middleware(config), async (req, res) => {
    try {
        const events = req.body.events;
        console.log(`📥 Webhook受信: ${events.length}件のイベント`);

        const promises = events.map(async (event) => {
            // テキストメッセージの処理
            if (event.type === 'message' && event.message.type === 'text') {
                return await handleTextMessage(event);
            }
            
            // フォロー（友だち追加）イベントの処理
            if (event.type === 'follow') {
                return await handleFollowEvent(event);
            }
            
            // アンフォロー（ブロック）イベントの処理
            if (event.type === 'unfollow') {
                return await handleUnfollowEvent(event);
            }
        });

        await Promise.all(promises);
        res.status(200).end();

    } catch (error) {
        console.error('❌ Webhook処理エラー:', error);
        res.status(500).end();
    }
});

/**
 * テキストメッセージ処理
 * @param {Object} event - LINEイベント
 */
async function handleTextMessage(event) {
    const lineUserId = event.source.userId;
    const messageText = event.message.text;
    const sessionId = `session_${Date.now()}`;

    try {
        console.log(`💬 テキストメッセージ処理開始: ${lineUserId}`);
        
        // メッセージ処理とAI応答生成
        const aiResponse = await processUserMessage(lineUserId, messageText, sessionId);

        // LINE応答送信
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: aiResponse
        });

        console.log(`✅ 応答送信完了: ${lineUserId}`);

    } catch (error) {
        console.error(`❌ テキストメッセージ処理エラー: ${lineUserId}`, error);
        
        // エラー時のフォールバック応答
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'すみません、一時的にエラーが発生しました。もう一度お試しください。🙏'
        });
    }
}

/**
 * フォロー（友だち追加）イベント処理
 * @param {Object} event - LINEイベント
 */
async function handleFollowEvent(event) {
    const lineUserId = event.source.userId;
    
    try {
        console.log(`👋 新規フォロー: ${lineUserId}`);
        
        // ウェルカムメッセージ
        const welcomeMessage = `🌺 Jiji沖縄ダイビングバディへようこそ！

はいさい！私はJiji、あなた専用の沖縄ダイビングバディです🤿

沖縄の海を知り尽くした私が、石垣島・宮古島・沖縄本島・久米島・西表島・与那国島の全ポイントから、あなたにピッタリのダイビング体験をご提案します！

🏝️ どんなダイビングがお好みですか？
🤿 ダイビング経験はどのくらいですか？
🌊 気になる沖縄のエリアはありますか？

なんでも気軽に聞いてくださいね！
一緒に最高の沖縄ダイビングを楽しみましょう✨`;

        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: welcomeMessage
        });

        // 初回メッセージとして保存（ユーザープロファイルも自動作成される）
        await processUserMessage(lineUserId, '[友だち追加]', `follow_${Date.now()}`);

    } catch (error) {
        console.error(`❌ フォローイベント処理エラー: ${lineUserId}`, error);
    }
}

/**
 * アンフォロー（ブロック）イベント処理
 * @param {Object} event - LINEイベント
 */
async function handleUnfollowEvent(event) {
    const lineUserId = event.source.userId;
    
    try {
        console.log(`👋 ユーザーアンフォロー: ${lineUserId}`);
        
        // アンフォロー記録として保存
        await processUserMessage(lineUserId, '[ブロック/削除]', `unfollow_${Date.now()}`);

    } catch (error) {
        console.error(`❌ アンフォローイベント処理エラー: ${lineUserId}`, error);
    }
}

// ===== ヘルスチェック・管理機能 =====

app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Jiji沖縄ダイビングバディ',
        version: '2.0.0',
        features: [
            'データベース統合版',
            'PostgreSQL + Redis',
            '沖縄全島対応',
            '3つの顔（相談相手・コンシェルジュ・理解者）'
        ],
        coverage_areas: JIJI_PERSONA_CONFIG.coverage_areas,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', async (req, res) => {
    try {
        // データベース接続確認
        await testDatabaseConnection();
        
        res.json({
            status: 'healthy',
            database: 'connected',
            persona: 'loaded',
            message_handler: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== 統計・管理API =====

app.get('/stats', async (req, res) => {
    try {
        // 簡単な統計情報を返す
        res.json({
            service: 'Jiji沖縄ダイビングバディ',
            uptime: process.uptime(),
            memory_usage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// ===== エラーハンドリング =====

// 404エラー
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'このエンドポイントは存在しません',
        available_endpoints: ['/', '/health', '/stats', '/webhook']
    });
});

// 一般的なエラーハンドリング
app.use((error, req, res, next) => {
    console.error('❌ サーバーエラー:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'サーバー内部エラーが発生しました'
    });
});

// ===== プロセス終了時の処理 =====

process.on('SIGINT', () => {
    console.log('\n🛑 Jijiを終了しています...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Jijiを終了しています...');
    process.exit(0);
});

// ===== サーバー起動 =====

const PORT = process.env.PORT || 3000;

async function startServer() {
    // 初期化
    const initialized = await initializeApp();
    
    if (!initialized) {
        console.error('❌ 初期化に失敗しました。終了します。');
        process.exit(1);
    }

    // サーバー起動
    app.listen(PORT, () => {
        console.log('\n🎉=====================================');
        console.log('🚀 Jiji沖縄ダイビングバディ起動完了！');
        console.log('🤖 Database統合版 v2.0.0');
        console.log('=====================================');
        console.log(`📡 サーバー: http://localhost:${PORT}`);
        console.log(`🤖 Webhook: http://localhost:${PORT}/webhook`);
        console.log(`💾 データベース: PostgreSQL + Redis`);
        console.log(`🏝️ 対応エリア: ${JIJI_PERSONA_CONFIG.coverage_areas.join('、')}`);
        console.log('=====================================🎉\n');
    });
}

// アプリケーション開始
startServer();