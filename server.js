// Jiji LINE Bot Server - Railway環境用（署名検証エラー修正版）
// 開発計画書v2.5対応 - 段階的移行戦略実装
// 手動署名検証による LINE SDK middleware エラー解決

const express = require('express');
const { Client, validateSignature } = require('@line/bot-sdk');
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
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24時間
    for (const [userId, session] of userSessions.entries()) {
      if (session.lastActivity < cutoff) {
        userSessions.delete(userId);
      }
    }
  }
}

// 古いセッションのクリーンアップ（1時間ごと）
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
    version: '2.5',
    phase: 'Phase 4-A - 段階的移行戦略実装中',
    progress: '85%',
    features: [
      '手動署名検証実装済み',
      'メモリベースセッション管理',
      'Railway本番環境対応',
      '79店舗データベース統合準備',
      'OpenAI GPT-4統合準備',
      '6カテゴリ感情分析準備'
    ],
    environment: 'Railway Production',
    timestamp: new Date().toISOString(),
    sessions: userSessions.size
  });
});

// ========== LINE Webhook（手動署名検証版） ==========
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const signature = req.get('X-Line-Signature');
  
  if (!signature) {
    console.error('❌ 署名ヘッダーなし');
    return res.status(401).send('Unauthorized');
  }
  
  try {
    // 手動署名検証
    if (!validateSignature(req.body, config.channelSecret, signature)) {
      console.error('❌ 署名検証失敗');
      return res.status(401).send('Invalid signature');
    }
    
    console.log('✅ 署名検証成功');
    
    // JSONパース
    const events = JSON.parse(req.body).events;
    
    // イベント処理
    events.forEach((event) => {
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
    // セッション取得
    const session = SessionManager.getUserSession(userId);
    
    // メッセージカウント更新
    const messageCount = (session.messageCount || 0) + 1;
    
    // Jiji応答メッセージ生成
    let replyMessage;
    
    if (messageCount === 1) {
      // 初回メッセージ
      replyMessage = `🌊 はじめまして！Jijiです！

沖縄ダイビングの相談に来てくれてありがとうございます！

僕は元々超ビビリだった先輩ダイバーで、初心者の不安を100%理解しています。

「${userMessage}」についてお答えしますね！

現在、感情分析マッチングシステムを準備中です。まもなく79店舗から最適なショップをご提案できるようになります！

💡 気軽に相談してください：
- 初心者でも大丈夫？
- 一人参加でも安心？
- 予算を抑えたい
- 石垣島と宮古島どっち？
- 安全面が心配`;
    } else {
      // 継続メッセージ
      replyMessage = `🤿 「${userMessage}」ですね！

分かります、その気持ち。僕も最初は同じような不安がありました。

現在、あなたの感情を分析して最適なダイビングショップをマッチングするシステムを開発中です！

🔧 準備中の機能：
- 6カテゴリ感情分析
- 79店舗×34項目データベース
- S/A/B/C級ショップ認定
- 個別最適化マッチング

まもなく完成予定です。それまでは何でも相談してくださいね！

石垣島、宮古島の初心者向けショップ情報なら今でもお答えできます🏝️`;
    }
    
    // LINE応答送信
    await lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: replyMessage
    });
    
    // セッション更新
    SessionManager.updateUserSession(userId, {
      lastMessage: userMessage,
      messageCount: messageCount,
      step: messageCount === 1 ? 'welcomed' : 'chatting'
    });
    
    console.log(`✅ 応答送信完了 (メッセージ数: ${messageCount})`);
    
  } catch (error) {
    console.error('❌ メッセージ処理エラー:', error);
    
    // エラー時の応答
    try {
      await lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: `🙇‍♂️ 申し訳ありません！

一時的にエラーが発生しました。
少し待ってから再度お試しください。

困った時はいつでも声をかけてくださいね！
Jijiより`
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
  console.log(`💾 Session: Memory-based (Redis無効化)`);
  console.log(`🔧 Signature: 手動検証実装済み`);
  console.log(`🚀 Environment: Railway Production`);
  console.log(`📋 Phase: 4-A 段階的移行戦略実装中`);
});
