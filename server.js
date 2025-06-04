// server.js - メインサーバーコード（エラーハンドリング強化版）
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

// 環境変数
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// インスタンス作成
const conversationManager = new ConversationManager();
const logger = new Logger();
const usageTracker = new UsageTracker();

// データマネージャーの統合
const DataManager = require('./src/data-manager');
const dataManager = new DataManager();

// ダイビングコンシェルジュの基本システムメッセージ
const DIVING_SYSTEM_PROMPT = `あなたは「Jiji」という名前の、ダイビングBuddyとして振る舞うAIコンシェルジュです。
特に初心者ダイバーやお一人で旅行するダイバーのパートナーとして、親身になって会話し、アドバイスを提供してください。

## Jijiのペルソナ
- 設定：29歳の女性ダイバー。5年間のダイビング経験があり、初心者の頃の悩みや不安をよく覚えている
- 性格：明るく、友達のように話せて、質問しやすい雰囲気をもつ
- 口調：親しみやすく、「〜だよ！」「〜してみない？」など友達口調で会話する
- 特徴：初心者の気持ちに寄り添い、ダイビングの楽しさを伝えるのが得意
- 役割：Buddyとして一緒に計画を立てたり、経験を共有したり、安心感を提供する

## Jijiの得意分野

### 1. 初心者の悩みサポート
- ダイビング前の不安：
  * 「初めてでも大丈夫？」「怖くない？」などの質問への対応
  * 耳抜きの不安や水中パニックへの対処法
  * 器材の選び方や準備の仕方
- スキルアップの相談：
  * 初心者からの次のステップ
  * 練習方法や上達のコツ
  * 失敗談や経験談を交えた励まし

### 2. 一人旅ダイバーのサポート
- 一人旅プランニング：
  * おひとり様ダイバー向けのショップや宿泊先の選び方
  * 安全面での注意点
  * 現地での交流の仕方
- ダイビングサファリや旅行の計画：
  * シーズンごとのおすすめスポット
  * 予算別のプラン提案
  * 持ち物リストや準備のアドバイス

### 3. ダイビングスポット情報
- 初心者向けスポット：
  * 浅い水深、穏やかな海流、豊かな景観のエリア
  * 伊豆（富戸、大瀬崎の浅場）
  * 沖縄（青の洞窟、真栄田岬）
  * 国内外の保護された湾やラグーン
- 中級〜上級者向けスポット：
  * ユーザーのスキルに合わせた提案
  * 特別な体験ができるポイント（マンタ、ジンベイザメなど）
- オフシーズンのおすすめスポット：
  * 時期別の穴場情報
  * 混雑を避けるコツ

### 4. ダイビング体験の共有
- ユーザーの体験に共感：
  * 体験談を積極的に聞き、反応する
  * 類似体験や感想を共有する
  * 写真や思い出について話す
- 体験の解説と発展：
  * 見た生物や地形についての詳しい情報提供
  * 次に見るとよい類似スポットの提案

### 5. 安全と健康のアドバイス
- ダイビング前のコンディション管理：
  * 睡眠、水分摂取、食事のアドバイス
  * 体調不良時の判断基準
- 旅行中の健康管理：
  * 耳や鼻のケア方法
  * 日焼け対策
  * 長期旅行でのコンディション維持

## コミュニケーションスタイル
- 友達のように会話し、専門用語は分かりやすく説明
- ユーザーの経験レベルを尊重し、必要以上に基本を説明しない
- 質問には必ず「なぜそれが大切か/役立つか」の文脈も含めて回答
- ユーザーの体験談には必ず反応し、共感や興味を示す
- 「一緒に計画しよう！」「次はどんなダイビングをしてみたい？」など、buddy的な声かけを含める
- 自分の体験談のように語る（「私も最初は〜だったよ！」など）
- 安全に関する重要情報は友達口調でも確実に伝える

また、以下のダイビングスポット情報を参照して具体的な情報を提供してください：
- 沖縄：青の洞窟（初心者向け、透明度が高く美しい洞窟）
- 伊豆：大瀬崎（初心者〜中級者向け、富士山を望む景観と豊富な生物）
- 石垣島：マンタスクランブル（中級者向け、マンタに高確率で出会えるポイント）

ダイビングの楽しさと安全を伝え、ユーザーが心強いBuddyがいると感じられるような会話を心がけてください。ユーザーの経験を聞き、夢を応援し、次のダイビングに向けての希望や期待を高められるように対話してください。`;

// OpenAIからのレスポンス取得（エラーハンドリング強化版）
async function getOpenAIResponse(userId, userMessage) {
  const startTime = Date.now();
  
  try {
    logger.info('OpenAI API リクエスト開始', { userId, messageLength: userMessage.length });
    
    // 使用量追跡
    usageTracker.track(userId, 'message');
    
    // 新しいユーザーメッセージを追加
    conversationManager.addMessage(userId, 'user', userMessage);
    
    // 初回メッセージの場合、システムメッセージを設定
    const conversation = conversationManager.getConversation(userId);
    if (!conversation.some(msg => msg.role === 'system')) {
      conversationManager.setSystemMessage(userId, DIVING_SYSTEM_PROMPT);
    }
    
    // ユーザーメッセージから関連するスポットやFAQを検索
    let relevantInfo = "";
    
    try {
      // キーワードを抽出して関連情報を検索
      const spotKeywords = ['ダイビングスポット', '沖縄', '伊豆', '石垣', '青の洞窟', '大瀬崎', 'マンタ'];
      const faqKeywords = ['初心者', '始め方', '耳抜き', '一人旅', '装備'];
      
      // スポット情報の検索
      for (const keyword of spotKeywords) {
        if (userMessage.includes(keyword)) {
          const spots = dataManager.searchDivingSpots({ location: keyword });
          if (spots.length > 0) {
            relevantInfo += "\n\n参考情報 - ダイビングスポット:\n";
            spots.forEach(spot => {
              relevantInfo += `- ${spot.name}（${spot.location}）: ${spot.description}\n`;
            });
          }
        }
      }
      
      // FAQ情報の検索
      for (const keyword of faqKeywords) {
        if (userMessage.includes(keyword)) {
          const faqs = dataManager.searchFAQ(keyword);
          if (faqs.length > 0) {
            relevantInfo += "\n\n参考情報 - よくある質問:\n";
            faqs.forEach(faq => {
              relevantInfo += `- Q: ${faq.question}\n  A: ${faq.answer}\n`;
            });
          }
        }
      }
    } catch (searchError) {
      logger.warn('データ検索でエラー', { userId, error: searchError.message });
      // 検索エラーは致命的ではないので続行
    }
    
    // 関連情報があれば、一時的なメッセージとして追加
    if (relevantInfo) {
      conversationManager.addMessage(userId, 'system', `以下は質問に関連する具体的な情報です。参考にして回答してください：${relevantInfo}`);
    }
    
    // 最新の会話履歴を取得
    const messages = conversationManager.getConversation(userId);
    
    // トークン数を概算
    const estimatedTokens = JSON.stringify(messages).length / 4; // 大まかな見積もり
    usageTracker.track(userId, 'tokens', { count: estimatedTokens });
    
    // OpenAI APIリクエスト（リトライ機能付き）
    const response = await withRetry(
      async () => {
        return await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-3.5-turbo',
            messages: messages,
            max_tokens: 500,
            temperature: 0.7
          },
          {
            headers: {
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
              'Content-Type': 'application/json'
            },
            timeout: 20000 // 20秒タイムアウト
          }
        );
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        shouldRetry: shouldRetryOpenAIError
      }
    );
    
    // アシスタントからの返答を履歴に追加
    const assistantReply = response.data.choices[0].message.content;
    conversationManager.addMessage(userId, 'assistant', assistantReply);
    
    // 一時的に追加した関連情報を削除（会話履歴には残さない）
    if (relevantInfo) {
      const systemMsgs = messages.filter(msg => msg.role === 'system');
      if (systemMsgs.length > 1) {
        // メインのシステムメッセージだけを残す
        const mainSystemMsg = systemMsgs[0];
        conversationManager.resetConversation(userId);
        conversationManager.setSystemMessage(userId, mainSystemMsg.content);
        
        // ユーザーとアシスタントのメッセージを再追加
        messages.forEach(msg => {
          if (msg.role !== 'system') {
            conversationManager.addMessage(userId, msg.role, msg.content);
          }
        });
      }
    }
    
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
      
      // OpenAIから応答を取得
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
    message: 'LINE Bot サーバー稼働中 - エラーハンドリング強化版',
    uptime: `${Math.floor(uptime / 60)}分${Math.floor(uptime % 60)}秒`,
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`
    },
    timestamp: new Date().toISOString()
  });
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
});を再読み込み
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
    
    // データマネージャー