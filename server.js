// Jiji LINE Bot Server - Railway環境用（Redis無効化版）
// 開発計画書v2.1対応 - 79店舗DB投入準備完了版
// 元GLITCHから移行 - buddys-bot.glitch.me → Railway

const express = require('express');
const { Client, middleware, validateSignature } = require('@line/bot-sdk');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

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
// Redis削除 - メモリベースセッション管理に変更
const userSessions = new Map();

class SessionManager {
  static getUserSession(userId) {
    if (!userSessions.has(userId)) {
      userSessions.set(userId, {
        step: 'initial',
        profile: {},
        matchingData: {},
        lastActivity: new Date(),
        conversationHistory: []
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
  console.log(\`セッション数: \${userSessions.size}\`);
}, 60 * 60 * 1000);

// ========== Express設定 ==========
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Jiji LINE Bot',
    version: '2.1',
    phase: 'Phase 1 - 79店舗DB投入準備完了',
    progress: '75%',
    features: [
      'Redis無効化完了',
      'メモリベースセッション管理',
      'S/A/B/C級ショップマッチング',
      '79店舗データベース対応',
      'OpenAI GPT-4統合'
    ],
    environment: 'Railway Production',
    timestamp: new Date().toISOString()
  });
});

// LINE Webhook
app.post('/webhook', middleware(config), (req, res) => {
  res.json({ status: 'OK' });
});

// ========== サーバー起動 ==========
app.listen(PORT, () => {
  console.log(\`🌊 Jiji LINE Bot Server起動\`);
  console.log(\`📍 Port: \${PORT}\`);
  console.log(\`💾 Session: Memory-based (Redis無効化)\`);
  console.log(\`🚀 Environment: Railway Production\`);
});
