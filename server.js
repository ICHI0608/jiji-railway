// Jiji LINE Bot Server - Railway環境用（署名検証無効化版）
// 開発計画書v2.5対応 - 緊急修正版

const express = require('express');
const { Client } = require('@line/bot-sdk');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 8080;

// ========== 環境変数設定 ==========
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ========== LINE Bot クライアント ==========
const lineClient = new Client(config);

// ========== セッション管理（メモリベース） ==========
const userSessions = new Map();

class SessionManager {
  static getUserSession(userId) {
    if (!userSessions.has(userId)) {
      userSessions.set(userId, {
        step: 'initial',
        profile: {},
        matchingData: {},
        lastActivity: new Date(),
        conversationHistory: [],
        messageCount: 0
      });
    }
    return userSessions.get(userId);
  }

  static updateUserSession(userId, updates) {
    const session = this.getUserSession(userId);
    Object.assign(session, updates, { lastActivity: new Date() });
    userSessions.set(userId, session);
    return session;
  }

  static clearOldSessions() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [userId, session] of userSessions.entries()) {
      if (session.lastActivity < cutoff) {
        userSessions.delete(userId);
      }
    }
  }
}

setInterval(() => {
  SessionManager.clearOldSessions();
  console.log(`📊 アクティブセッション数: ${userSessions.size}`);
}, 60 * 60 * 1000);

// ========== Express設定 ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== ヘルスチェック ==========
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Jiji LINE Bot',
    version: '2.5-emergency-fix',
    phase: 'Phase 4-A - 緊急修正版',
    progress: '90%',
    features: [
      '署名検証無効化（一時的）',
      'メモリベースセッション管理',
      'Railway本番環境対応',
      'Jijiキャラクター応答',
      'LINE Bot基本機能'
    ],
    environment: 'Railway Production',
    timestamp: new Date().toISOString(),
    sessions: userSessions.size
  });
});

// ========== LINE Webhook（署名検証無効化版） ==========
app.post('/webhook', (req, res) => {
  console.log('📨 Webhook受信');
  
  try {
    // 署名検証をスキップ（一時的）
    console.log('⚠️ 署名検証をスキップしています');
    
    // eventsの直接取得
    const events = req.body.events || [];
    
    console.log(`📋 イベント数: ${events.length}`);
    
    // イベント処理
    events.forEach((event) => {
      console.log(`🎯 イベントタイプ: ${event.type}`);
      if (event.type === 'message' && event.message.type === 'text') {
        handleMessage(event);
      }
    });
    
    res.json({ status: 'OK' });
  } catch (error) {
    console.error('❌ Webhook処理エラー:', error);
    res.status(500).send('Internal Server Error');
  }
});

// ========== メッセージ処理関数 ==========
async function handleMessage(event) {
  const userId = event.source.userId;
  const userMessage = event.message.text;
  
  console.log(`📨 メッセージ受信: "${userMessage}" (User: ${userId})`);
  
  try {
    const session = SessionManager.getUserSession(userId);
    const messageCount = (session.messageCount || 0) + 1;
    
    let replyMessage;
    
    if (messageCount === 1) {
      replyMessage = `🌊 はじめまして！Jijiです！

沖縄ダイビングの相談に来てくれてありがとうございます！

「${userMessage}」についてお答えしますね！

現在、感情分析マッチングシステムを準備中です。
79店舗から最適なショップをご提案できるようになります！

💡 気軽に相談してください：
- 初心者でも大丈夫？
- 一人参加でも安心？
- 予算を抑えたい
- 石垣島と宮古島どっち？`;
    } else {
      replyMessage = `🤿 「${userMessage}」ですね！

分かります、その気持ち。僕も最初は同じような不安がありました。

🔧 準備中の機能：
- 6カテゴリ感情分析
- 79店舗×34項目データベース
- S/A/B/C級ショップ認定
- 個別最適化マッチング

何でも相談してくださいね！🏝️`;
    }
    
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: replyMessage
    });
    
    SessionManager.updateUserSession(userId, {
      lastMessage: userMessage,
      messageCount: messageCount,
      step: messageCount === 1 ? 'welcomed' : 'chatting'
    });
    
    console.log(`✅ 応答送信完了 (メッセージ数: ${messageCount})`);
    
  } catch (error) {
    console.error('❌ メッセージ処理エラー:', error);
    
    try {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: '🙇‍♂️ 申し訳ありません！一時的にエラーが発生しました。'
      });
    } catch (replyError) {
      console.error('❌ エラー応答送信失敗:', replyError);
    }
  }
}

// ========== サーバー起動 ==========
app.listen(PORT, () => {
  console.log(`🌊 Jiji LINE Bot Server起動`);
  console.log(`📍 Port: ${PORT}`);
  console.log(`💾 Session: Memory-based`);
  console.log(`⚠️ Signature: 一時的に無効化`);
  console.log(`🚀 Environment: Railway Production`);
});
