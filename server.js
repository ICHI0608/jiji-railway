// server.js - 環境変数名修正版
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const ConversationManager = require('./conversation');
const path = require('path');

const app = express();
const conversationManager = new ConversationManager();

// 環境変数の確認（実際の変数名に合わせて修正）
const requiredEnvVars = ['OPENAI_API_KEY', 'LINE_CHANNEL_SECRET', 'LINE_ACCESS_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ 必要な環境変数が設定されていません:', missingEnvVars);
    console.error('   .envファイルまたは環境変数に以下を設定してください:');
    missingEnvVars.forEach(varName => {
        console.error(`   ${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
}

// LINE Bot SDK設定（実際の変数名に合わせて修正）
const { Client, middleware } = require('@line/bot-sdk');
const config = {
    channelAccessToken: process.env.LINE_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(config);

// ミドルウェア設定（LINE Webhook用に調整）
app.use('/webhook', express.raw({type: 'application/json'}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ヘルスチェックエンドポイント
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Jiji Diving Bot',
        version: '1.2.0',
        timestamp: new Date().toISOString(),
        features: {
            conversation: true,
            reminder: 'in_development'
        }
    });
});

// 管理用API
app.get('/api/stats', (req, res) => {
    try {
        const dataDir = path.join(__dirname, 'data', 'conversations');
        let stats = {
            totalUsers: 0,
            totalConversations: 0,
            activeToday: 0
        };

        if (fs.existsSync(dataDir)) {
            const files = fs.readdirSync(dataDir);
            stats.totalUsers = files.length;
            
            // 各ユーザーの会話数をカウント
            files.forEach(file => {
                try {
                    const filePath = path.join(dataDir, file);
                    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    stats.totalConversations += data.messages ? data.messages.length : 0;
                    
                    // 今日のアクティビティチェック
                    if (data.lastUpdated) {
                        const lastUpdate = new Date(data.lastUpdated);
                        const today = new Date();
                        if (lastUpdate.toDateString() === today.toDateString()) {
                            stats.activeToday++;
                        }
                    }
                } catch (err) {
                    console.error(`ファイル読み込みエラー ${file}:`, err);
                }
            });
        }

        res.json(stats);
    } catch (error) {
        console.error('統計情報取得エラー:', error);
        res.status(500).json({ error: '統計情報の取得に失敗しました' });
    }
});

// データクリア API（開発用）
app.delete('/api/clear/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const success = await conversationManager.clearConversation(userId);
        
        if (success) {
            res.json({ message: `ユーザー ${userId} の会話履歴を削除しました` });
        } else {
            res.status(404).json({ error: 'ユーザーが見つかりません' });
        }
    } catch (error) {
        console.error('会話履歴削除エラー:', error);
        res.status(500).json({ error: '削除に失敗しました' });
    }
});

// LINE Webhook エンドポイント（エラー修正版）
app.post('/webhook', (req, res) => {
    // LINE署名検証
    const signature = req.get('x-line-signature');
    if (!signature) {
        return res.status(401).send('Unauthorized');
    }

    // rawBodyを文字列に変換
    const body = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body);
    
    try {
        // 署名検証
        const crypto = require('crypto');
        const hash = crypto.createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(body).digest('base64');
        
        if (hash !== signature) {
            return res.status(401).send('Unauthorized');
        }

        // イベント処理
        const events = JSON.parse(body).events;
        
        for (const event of events) {
            handleEvent(event);
        }
        
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook処理エラー:', error);
        res.status(500).send('Internal Server Error');
    }
});

// イベントハンドリング
async function handleEvent(event) {
    if (event.type !== 'message' || event.message.type !== 'text') {
        return Promise.resolve(null);
    }

    const userId = event.source.userId;
    const userMessage = event.message.text;

    try {
        console.log(`📨 受信メッセージ [${userId}]: ${userMessage}`);

        // AI応答生成
        const response = await conversationManager.generateResponse(userId, userMessage);
        
        console.log(`🤖 AI応答 [${userId}]: ${response.substring(0, 100)}...`);

        // LINE返信
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: response
        });

        console.log(`✅ 返信完了 [${userId}]`);

    } catch (error) {
        console.error('メッセージ処理エラー:', error);
        
        // エラー時のフォールバック応答
        try {
            await client.replyMessage(event.replyToken, {
                type: 'text',
                text: 'すみません、ちょっと調子が悪いみたいです。少し待ってからもう一度試してもらえますか？'
            });
        } catch (replyError) {
            console.error('エラー応答送信失敗:', replyError);
        }
    }
}

// リマインド機能用のスケジューラー（将来実装予定）
function initializeReminderScheduler() {
    console.log('🔄 リマインドスケジューラー初期化中...');
    console.log('   ※現在開発中（進捗30%）');
    
    // TODO: リマインド機能の実装
    // - cron job設定
    // - ダイビング予定管理
    // - 機材メンテナンス通知
    // - プッシュ通知機能
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
    console.error('予期しないエラー:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('ハンドルされていないPromise拒否:', reason);
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('🐙 Jiji Diving Bot サーバー起動完了!');
    console.log(`📡 ポート: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log('');
    console.log('🤖 Jijiが待機中...');
    console.log('💬 LINEからメッセージを送信してテストしてください');
    console.log('');
    
    // リマインドスケジューラー初期化
    initializeReminderScheduler();
});

module.exports = app;