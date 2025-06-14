// server.js - メインサーバーコード（リマインド機能統合完璧版）
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const ConversationManager = require('./conversation');
const path = require('path');

// エラーハンドリングユーティリティをインポート
const { 
  Logger, 
  withRetry, 
  shouldRetryOpenAIError, 
  shouldRetryLineError,
  UsageTracker,
  generateUserFriendlyErrorMessage 
} = require('./src/utils');

const app = express();
app.use(express.json());

// 環境変数（.envファイルから自動読み込み）
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// インスタンス作成
const conversationManager = new ConversationManager();
const logger = new Logger();
const usageTracker = new UsageTracker();

// データマネージャーの統合
const DataManager = require('./src/data-manager');
const dataManager = new DataManager();

// 🆕 OpenAIからのレスポンス取得（conversationManager使用版）
async function getOpenAIResponse(userId, userMessage) {
  const startTime = Date.now();
  
  try {
    logger.info('OpenAI API リクエスト開始', { userId, messageLength: userMessage.length });
    
    // 使用量追跡
    usageTracker.track(userId, 'message');
    
    // 🚀 conversationManager.sendMessageToGPTを使用（改行改善・リマインド機能付き）
    const assistantReply = await conversationManager.sendMessageToGPT(userMessage, userId);
    
    const responseTime = Date.now() - startTime;
    logger.info('OpenAI API リクエスト成功', { 
      userId, 
      responseTime: `${responseTime}ms`,
      responseLength: assistantReply.length 
    });
    
    return assistantReply;
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    usageTracker.track(userId, 'error');
    
    logger.error('OpenAI API エラー', error, { 
      userId, 
      responseTime: `${responseTime}ms`,
      messageLength: userMessage.length 
    });
    
    return generateUserFriendlyErrorMessage(error, { userId, operation: 'openai_chat' });
  }
}

// LINEへの返信（エラーハンドリング強化版）
async function replyToLine(replyToken, message) {
  try {
    logger.info('LINE返信送信開始', { replyToken: replyToken.substring(0, 10) + '...', messageLength: message.length });
    
    await withRetry(
      async () => {
        return await axios.post(
          'https://api.line.me/v2/bot/message/reply',
          {
            replyToken: replyToken,
            messages: [{ type: 'text', text: message }]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            },
            timeout: 10000 // 10秒タイムアウト
          }
        );
      },
      {
        maxRetries: 2,
        initialDelay: 500,
        shouldRetry: shouldRetryLineError
      }
    );
    
    logger.info('LINE返信送信成功');
    return true;
    
  } catch (error) {
    logger.error('LINE API エラー', error, { replyToken: replyToken.substring(0, 10) + '...' });
    return false;
  }
}

// 🆕 プッシュメッセージ送信（通知専用）
async function sendPushMessage(userId, message) {
  try {
    logger.info('プッシュメッセージ送信開始', { userId, messageLength: message.length });
    
    await withRetry(
      async () => {
        return await axios.post(
          'https://api.line.me/v2/bot/message/push',
          {
            to: userId,
            messages: [{ type: 'text', text: message }]
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
            },
            timeout: 10000
          }
        );
      },
      {
        maxRetries: 2,
        initialDelay: 500,
        shouldRetry: shouldRetryLineError
      }
    );
    
    logger.info('プッシュメッセージ送信成功', { userId });
    return true;
    
  } catch (error) {
    logger.error('プッシュメッセージ送信エラー', error, { userId });
    return false;
  }
}

// 🆕 リマインド通知の定期チェック（1時間ごと）
setInterval(async () => {
  try {
    console.log('🔔 リマインド通知チェック開始...');
    
    const notificationsToSend = await conversationManager.checkAndSendNotifications();
    
    if (notificationsToSend.length > 0) {
      console.log(`📤 ${notificationsToSend.length}件の通知を送信中...`);
      
      for (const notification of notificationsToSend) {
        await sendPushMessage(notification.userId, notification.message);
        logger.info('リマインド通知送信完了', {
          userId: notification.userId,
          type: notification.type,
          reminderId: notification.reminderId
        });
      }
    } else {
      console.log('📭 送信すべき通知はありません');
    }
  } catch (error) {
    logger.error('リマインド通知チェックエラー', error);
  }
}, 60 * 60 * 1000); // 1時間ごと

// グローバルエラーハンドラー
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', error);
  // プロセスは継続（本番環境では再起動を検討）
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', reason, { promise: promise.toString() });
});

// Webhook エンドポイント（エラーハンドリング強化版）
app.post('/webhook', async (req, res) => {
  // 即座に200を返す
  res.sendStatus(200);
  
  try {
    const events = req.body.events || [];
    if (events.length === 0) {
      logger.debug('空のWebhookイベントを受信');
      return;
    }
    
    const event = events[0];
    logger.info('Webhookイベント受信', { 
      eventType: event.type, 
      messageType: event.message?.type,
      userId: event.source?.userId 
    });
    
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const messageText = event.message.text;
      
      logger.info('テキストメッセージ処理開始', { userId, messageText });
      
      // 会話リセット機能
      if (messageText.trim().toLowerCase() === 'リセット') {
        conversationManager.resetConversation(userId);
        await replyToLine(event.replyToken, '会話をリセットしました。新しい質問をどうぞ！');
        logger.info('会話リセット実行', { userId });
        return;
      }
      
      // 🚀 OpenAIから応答を取得（改行改善・リマインド機能付き）
      const aiReply = await getOpenAIResponse(userId, messageText);
      
      // LINEに返信
      const success = await replyToLine(event.replyToken, aiReply);
      
      if (success) {
        logger.info('メッセージ処理完了', { userId });
      } else {
        logger.error('LINE返信失敗', null, { userId, aiReply: aiReply.substring(0, 100) + '...' });
      }
    } else {
      logger.debug('サポート外のイベント', { eventType: event.type, messageType: event.message?.type });
    }
    
  } catch (error) {
    logger.error('Webhook処理エラー', error, { requestBody: req.body });
  }
});

// ヘルスチェック
app.get('/', (req, res) => {
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'ok',
    message: 'LINE Bot サーバー稼働中 - 完璧版',
    uptime: `${Math.floor(uptime / 60)}分${Math.floor(uptime % 60)}秒`,
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
    },
    timestamp: new Date().toISOString()
  });
});

// 🆕 リマインド機能テスト用エンドポイント
app.get('/test-reminder', async (req, res) => {
  const userId = req.query.userId || 'test-user';
  const message = req.query.message || '明日石垣島でダイビング予定';
  
  try {
    const response = await conversationManager.sendMessageToGPT(message, userId);
    const reminders = conversationManager.reminderManager?.getUserReminders(userId) || [];
    
    res.json({
      userId,
      message,
      response,
      registeredReminders: reminders,
      reminderEnabled: !!conversationManager.reminderManager
    });
  } catch (error) {
    logger.error('リマインドテストエラー', error, { userId, message });
    res.status(500).json({ error: error.message });
  }
});

// 🆕 通知送信テスト用エンドポイント
app.get('/test-notification', async (req, res) => {
  try {
    const notificationsToSend = await conversationManager.checkAndSendNotifications();
    
    res.json({
      message: '通知チェック完了',
      notifications: notificationsToSend,
      count: notificationsToSend.length,
      reminderEnabled: !!conversationManager.reminderManager
    });
  } catch (error) {
    logger.error('通知テストエラー', error);
    res.status(500).json({ error: error.message });
  }
});

// テスト用エンドポイント（使用状況付き）
app.get('/test', async (req, res) => {
  const userId = req.query.userId || 'test-user';
  const message = req.query.message || 'こんにちは';
  
  try {
    const response = await getOpenAIResponse(userId, message);
    const conversation = conversationManager.getConversation(userId);
    const usage = usageTracker.getUsage(userId);
    
    res.json({
      userId,
      lastMessage: message,
      response,
      conversationHistory: conversation,
      dailyUsage: usage
    });
  } catch (error) {
    logger.error('テストエンドポイントエラー', error, { userId, message });
    res.status(500).json({ error: error.message });
  }
});

// 会話履歴リセット用エンドポイント
app.get('/reset', (req, res) => {
  const userId = req.query.userId || 'test-user';
  conversationManager.resetConversation(userId);
  logger.info('会話履歴リセット', { userId });
  res.json({ message: `ユーザー ${userId} の会話履歴をリセットしました。` });
});

// データ取得用エンドポイント
app.get('/api/spots', (req, res) => {
  try {
    const locations = req.query.location;
    const difficulty = req.query.difficulty;
    
    let spots;
    if (locations || difficulty) {
      spots = dataManager.searchDivingSpots({
        location: locations,
        difficulty: difficulty
      });
    } else {
      spots = dataManager.getAllDivingSpots();
    }
    
    logger.info('スポット情報取得', { count: spots.length, location: locations, difficulty });
    res.json(spots);
  } catch (error) {
    logger.error('スポット情報取得エラー', error);
    res.status(500).json({ error: 'データ取得エラー' });
  }
});

app.get('/api/faq', (req, res) => {
  try {
    const keyword = req.query.keyword;
    const category = req.query.category;
    
    let faqs;
    if (keyword) {
      faqs = dataManager.searchFAQ(keyword);
    } else if (category) {
      faqs = dataManager.getFAQByCategory(category);
    } else {
      faqs = dataManager.getAllFAQ();
    }
    
    logger.info('FAQ情報取得', { count: faqs.length, keyword, category });
    res.json(faqs);
  } catch (error) {
    logger.error('FAQ情報取得エラー', error);
    res.status(500).json({ error: 'データ取得エラー' });
  }
});

// システム統計エンドポイント
app.get('/api/stats', (req, res) => {
  try {
    const { password } = req.query;
    
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: '認証エラー' });
    }
    
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({
      uptime: uptime,
      memory: memoryUsage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('統計情報取得エラー', error);
    res.status(500).json({ error: 'データ取得エラー' });
  }
});

// ========== 管理API（データ更新用） ==========

// 認証ミドルウェア
function authenticateAdmin(req, res, next) {
  const { password } = req.body;
  
  if (password !== process.env.ADMIN_PASSWORD) {
    logger.warn('管理API認証失敗', { ip: req.ip });
    return res.status(401).json({ 
      success: false, 
      error: '認証エラー: 無効なパスワードです' 
    });
  }
  
  next();
}

// ダイビングスポット情報の更新
app.post('/admin/update-spots', authenticateAdmin, (req, res) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'データは配列形式である必要があります'
      });
    }
    
    // JSONファイルに書き込み
    const filePath = path.join(__dirname, 'data', 'diving-spots.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    // データマネージャーを再読み込み
    dataManager.loadAllData();
    
    logger.info('ダイビングスポット情報更新', { count: data.length });
    
    res.json({ 
      success: true, 
      message: `${data.length}件のダイビングスポット情報を更新しました`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('スポット情報更新エラー', error);
    res.status(500).json({ 
      success: false, 
      error: 'データ更新中にエラーが発生しました: ' + error.message 
    });
  }
});

// FAQ情報の更新
app.post('/admin/update-faq', authenticateAdmin, (req, res) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data)) {
      return res.status(400).json({
        success: false,
        error: 'データは配列形式である必要があります'
      });
    }
    
    // JSONファイルに書き込み
    const filePath = path.join(__dirname, 'data', 'faq.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    // データマネージャーを再読み込み
    dataManager.loadAllData();
    
    logger.info('FAQ情報更新', { count: data.length });
    
    res.json({ 
      success: true, 
      message: `${data.length}件のFAQ情報を更新しました`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('FAQ更新エラー', error);
    res.status(500).json({ 
      success: false, 
      error: 'データ更新中にエラーが発生しました: ' + error.message 
    });
  }
});

// 単一スポットの追加
app.post('/admin/add-spot', authenticateAdmin, (req, res) => {
  try {
    const { spotData } = req.body;
    
    if (!spotData || !spotData.id || !spotData.name) {
      return res.status(400).json({
        success: false,
        error: 'スポットデータにはid, nameが必須です'
      });
    }
    
    // 既存データを読み込み
    const filePath = path.join(__dirname, 'data', 'diving-spots.json');
    let existingData = [];
    
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      existingData = JSON.parse(fileContent);
    }
    
    // 同じIDが存在するかチェック
    const existingIndex = existingData.findIndex(spot => spot.id === spotData.id);
    
    if (existingIndex >= 0) {
      // 既存データを更新
      existingData[existingIndex] = spotData;
    } else {
      // 新規追加
      existingData.push(spotData);
    }
    
    // ファイルに保存
    fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), 'utf8');
    
    // データマネージャーを再読み込み
    dataManager.loadAllData();
    
    const action = existingIndex >= 0 ? '更新' : '追加';
    logger.info(`スポット${action}`, { spotId: spotData.id, spotName: spotData.name });
    
    res.json({ 
      success: true, 
      message: `スポット「${spotData.name}」を${action}しました`,
      action: existingIndex >= 0 ? 'updated' : 'added',
      spotId: spotData.id
    });
    
  } catch (error) {
    logger.error('スポット追加エラー', error);
    res.status(500).json({ 
      success: false, 
      error: 'スポット追加中にエラーが発生しました: ' + error.message 
    });
  }
});

// 現在のデータ確認
app.get('/admin/data/:type', (req, res) => {
  try {
    const { type } = req.params;
    const { password } = req.query;
    
    if (password !== process.env.ADMIN_PASSWORD) {
      logger.warn('管理API認証失敗（データ確認）', { ip: req.ip, type });
      return res.status(401).json({ 
        success: false, 
        error: '認証エラー: 無効なパスワードです' 
      });
    }
    
    let data;
    switch (type) {
      case 'spots':
        data = dataManager.getAllDivingSpots();
        break;
      case 'faq':
        data = dataManager.getAllFAQ();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '無効なデータタイプです。spots または faq を指定してください'
        });
    }
    
    logger.info('管理API データ確認', { type, count: data.length });
    
    res.json({
      success: true,
      type: type,
      count: data.length,
      data: data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('データ取得エラー（管理API）', error);
    res.status(500).json({ 
      success: false, 
      error: 'データ取得中にエラーが発生しました: ' + error.message 
    });
  }
});

// データ削除
app.delete('/admin/data/:type/:id', authenticateAdmin, (req, res) => {
  try {
    const { type, id } = req.params;
    
    let filePath, data;
    
    switch (type) {
      case 'spots':
        filePath = path.join(__dirname, 'data', 'diving-spots.json');
        break;
      case 'faq':
        filePath = path.join(__dirname, 'data', 'faq.json');
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '無効なデータタイプです'
        });
    }
    
    // 既存データを読み込み
    const fileContent = fs.readFileSync(filePath, 'utf8');
    data = JSON.parse(fileContent);
    
    // 指定IDのデータを削除
    const initialLength = data.length;
    data = data.filter(item => item.id !== id);
    
    if (data.length === initialLength) {
      return res.status(404).json({
        success: false,
        error: `ID: ${id} のデータが見つかりません`
      });
    }
    
    // ファイルに保存
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    
    // データマネージャーを再読み込み
    dataManager.loadAllData();
    
    logger.info('データ削除完了', { type, id, remainingCount: data.length });
    
    res.json({
      success: true,
      message: `ID: ${id} のデータを削除しました`,
      deletedId: id,
      remainingCount: data.length
    });
    
  } catch (error) {
    logger.error('データ削除エラー', error);
    res.status(500).json({ 
      success: false, 
      error: 'データ削除中にエラーが発生しました: ' + error.message 
    });
  }
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info('サーバー起動完了', { port: PORT });
  console.log(`🚀 サーバー起動: ポート ${PORT}`);
  console.log(`✅ エラーハンドリング機能: 有効`);
  console.log(`✅ ロギング機能: 有効`);
  console.log(`✅ 使用量追跡機能: 有効`);
  console.log(`✅ 管理API機能: 有効`);
  console.log(`🆕 改行改善機能: 有効`);
  console.log(`🆕 リマインド機能: 有効`);
});// server.js - メインサーバーコード（リマインド機能統合完整版）
require('dotenv').config();
const express = require('express');
// const axios = require('axios'); // ← この行を削除またはコメントアウト
const fs = require('fs');
const ConversationManager = require('./conversation');
const path = require('path');

const app = express();
const conversationManager = new ConversationManager();

// 環境変数の確認
const requiredEnvVars = ['OPENAI_API_KEY', 'LINE_CHANNEL_SECRET', 'LINE_CHANNEL_ACCESS_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ 必要な環境変数が設定されていません:', missingEnvVars);
    console.error('   .envファイルに以下を設定してください:');
    missingEnvVars.forEach(varName => {
        console.error(`   ${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
}

// LINE Bot SDK設定
const { Client, middleware } = require('@line/bot-sdk');
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(config);

// ミドルウェア設定
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
            reminder: 'in_development', // 30%完了
            data_management: true,
            error_handling: true
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

// LINE Webhook エンドポイント
app.post('/webhook', middleware(config), async (req, res) => {
    try {
        const events = req.body.events;
        
        for (const event of events) {
            await handleEvent(event);
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