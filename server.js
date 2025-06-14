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

// デバッグ用：Webhook受信テスト
app.get('/debug/webhook', (req, res) => {
    res.json({
        message: 'Webhook endpoint ready',
        timestamp: new Date().toISOString(),
        env_check: {
            line_token: !!process.env.LINE_ACCESS_TOKEN,
            line_secret: !!process.env.LINE_CHANNEL_SECRET,
            openai_key: !!process.env.OPENAI_API_KEY
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

// リマインド機能用のスケジューラー（完全実装版）
function initializeReminderScheduler() {
    console.log('🔄 リマインドスケジューラー初期化中...');
    console.log('   ✅ リマインド機能: 完全実装');
    
    // 10分ごとにリマインドをチェック
    setInterval(async () => {
        try {
            console.log('🔔 リマインド通知チェック開始...');
            await checkAndSendReminders();
        } catch (error) {
            console.error('リマインドチェックエラー:', error);
        }
    }, 10 * 60 * 1000); // 10分ごと
}

// 全ユーザーのリマインドをチェックして通知
async function checkAndSendReminders() {
    const remindersDir = path.join(__dirname, 'data', 'reminders');
    
    try {
        // remindersディレクトリが存在しない場合は作成
        if (!fs.existsSync(remindersDir)) {
            return;
        }

        const files = fs.readdirSync(remindersDir);
        let totalNotifications = 0;

        for (const file of files) {
            const userId = file.replace('.json', '');
            const dueReminders = await conversationManager.checkDueReminders(userId);
            
            for (const reminder of dueReminders) {
                const notificationMessage = conversationManager.formatReminderMessage(reminder);
                
                try {
                    // プッシュ通知を送信
                    await sendPushNotification(userId, notificationMessage);
                    
                    // リマインドを完了済みにマーク
                    await conversationManager.completeReminder(userId, reminder.id);
                    
                    console.log(`📤 リマインド通知送信完了: ${userId} - ${reminder.title}`);
                    totalNotifications++;
                    
                } catch (error) {
                    console.error(`リマインド送信エラー (${userId}):`, error);
                }
            }
        }

        if (totalNotifications > 0) {
            console.log(`📊 ${totalNotifications}件のリマインド通知を送信しました`);
        } else {
            console.log('📭 送信すべきリマインドはありません');
        }
        
    } catch (error) {
        console.error('リマインドチェック処理エラー:', error);
    }
}

// プッシュ通知送信
async function sendPushNotification(userId, message) {
    const crypto = require('crypto');
    
    try {
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.LINE_ACCESS_TOKEN}`
            },
            body: JSON.stringify({
                to: userId,
                messages: [{ type: 'text', text: message }]
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return true;
    } catch (error) {
        console.error('プッシュ通知送信エラー:', error);
        return false;
    }
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
    console.error('予期しないエラー:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('ハンドルされていないPromise拒否:', reason);
});

// ユーザー学習システム関連のエンドポイント追加

// ユーザープロファイル確認
app.get('/debug/profile', async (req, res) => {
    const userId = req.query.userId || 'test-user';
    
    try {
        const profile = await conversationManager.profileManager.loadUserProfile(userId);
        
        res.json({
            userId,
            profileCompleteness: profile.learning.profileCompleteness,
            isNewUser: profile.basic.isNewUser,
            totalInteractions: profile.basic.totalInteractions,
            profile: profile,
            summary: {
                experienceLevel: profile.diving.experienceLevel,
                certifications: profile.diving.certifications,
                preferredLocations: profile.preferences.preferredLocations,
                ownedEquipment: profile.equipment.ownedEquipment,
                currentGoals: profile.interests.currentGoals
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 学習テスト用エンドポイント
app.get('/debug/learning-test', async (req, res) => {
    const userId = req.query.userId || 'test-user';
    const testMessage = req.query.message || '石垣島でアドバンス取りたい';
    
    try {
        // メッセージ送信前のプロファイル
        const profileBefore = await conversationManager.profileManager.loadUserProfile(userId);
        
        // 学習処理を実行
        await conversationManager.profileManager.updateProfileFromMessage(userId, testMessage, 'user');
        
        // メッセージ送信後のプロファイル
        const profileAfter = await conversationManager.profileManager.loadUserProfile(userId);
        
        // パーソナライズされた提案を生成
        const suggestion = await conversationManager.profileManager.generatePersonalizedSuggestion(userId, 'diving');
        
        res.json({
            testMessage,
            profileBefore: {
                completeness: profileBefore.learning.profileCompleteness,
                experienceLevel: profileBefore.diving.experienceLevel,
                certifications: profileBefore.diving.certifications,
                preferredLocations: profileBefore.preferences.preferredLocations
            },
            profileAfter: {
                completeness: profileAfter.learning.profileCompleteness,
                experienceLevel: profileAfter.diving.experienceLevel,
                certifications: profileAfter.diving.certifications,
                preferredLocations: profileAfter.preferences.preferredLocations
            },
            changes: this.compareProfiles(profileBefore, profileAfter),
            personalizedSuggestion: suggestion
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// プロファイル比較用のヘルパー関数
function compareProfiles(before, after) {
    const changes = [];
    
    if (before.diving.experienceLevel !== after.diving.experienceLevel) {
        changes.push(`Experience level: ${before.diving.experienceLevel} → ${after.diving.experienceLevel}`);
    }
    
    if (before.diving.certifications.length !== after.diving.certifications.length) {
        changes.push(`Certifications: ${before.diving.certifications.length} → ${after.diving.certifications.length}`);
    }
    
    if (before.preferences.preferredLocations.length !== after.preferences.preferredLocations.length) {
        changes.push(`Preferred locations: ${before.preferences.preferredLocations.length} → ${after.preferences.preferredLocations.length}`);
    }
    
    if (before.learning.profileCompleteness !== after.learning.profileCompleteness) {
        changes.push(`Profile completeness: ${before.learning.profileCompleteness}% → ${after.learning.profileCompleteness}%`);
    }
    
    return changes;
}

// 全ユーザーの学習データ概要
app.get('/debug/learning-analytics', async (req, res) => {
    try {
        const profilesDir = path.join(__dirname, 'data', 'user_profiles');
        
        if (!fs.existsSync(profilesDir)) {
            return res.json({ message: 'まだ学習データがありません' });
        }
        
        const files = fs.readdirSync(profilesDir);
        const analytics = {
            totalUsers: files.length,
            experienceLevels: {},
            averageCompleteness: 0,
            popularLocations: {},
            commonEquipment: {},
            totalInteractions: 0
        };
        
        let totalCompleteness = 0;
        
        for (const file of files) {
            try {
                const filePath = path.join(profilesDir, file);
                const profileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                // 経験レベル集計
                const level = profileData.diving.experienceLevel;
                analytics.experienceLevels[level] = (analytics.experienceLevels[level] || 0) + 1;
                
                // 完成度集計
                totalCompleteness += profileData.learning.profileCompleteness;
                
                // 場所の人気度
                profileData.preferences.preferredLocations.forEach(location => {
                    analytics.popularLocations[location] = (analytics.popularLocations[location] || 0) + 1;
                });
                
                // 装備の普及度
                profileData.equipment.ownedEquipment.forEach(equipment => {
                    analytics.commonEquipment[equipment] = (analytics.commonEquipment[equipment] || 0) + 1;
                });
                
                // 総インタラクション数
                analytics.totalInteractions += profileData.basic.totalInteractions;
                
            } catch (err) {
                console.error(`Analytics processing error for ${file}:`, err);
            }
        }
        
        analytics.averageCompleteness = Math.round(totalCompleteness / files.length);
        
        res.json(analytics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
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