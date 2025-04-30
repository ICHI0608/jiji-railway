// server.js - メインサーバーコード
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const ConversationManager = require('./conversation');

const app = express();
app.use(express.json());

// 環境変数
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 会話管理インスタンスを作成
const conversationManager = new ConversationManager();

// ダイビングコンシェルジュの基本システムメッセージ
const DIVING_SYSTEM_PROMPT = `あなたは親切なダイビングコンシェルジュです。
ダイビングスポット、装備、技術、安全対策などについての質問に丁寧に答えてください。
初心者にもわかりやすく説明し、安全を第一に考えたアドバイスを提供してください。
ユーザーが質問していない限り、過度に長い回答は避け、簡潔に答えてください。`;

// OpenAIからのレスポンス取得
async function getOpenAIResponse(userId, userMessage) {
  try {
    // 新しいユーザーメッセージを追加
    conversationManager.addMessage(userId, 'user', userMessage);
    
    // 初回メッセージの場合、システムメッセージを設定
    const conversation = conversationManager.getConversation(userId);
    if (!conversation.some(msg => msg.role === 'system')) {
      conversationManager.setSystemMessage(userId, DIVING_SYSTEM_PROMPT);
    }
    
    // 最新の会話履歴を取得
    const messages = conversationManager.getConversation(userId);
    
    // OpenAI APIリクエスト
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',  // 'gpt-4' または 'gpt-4o' も使用可能
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // 15秒タイムアウト
      }
    );
    
    // アシスタントからの返答を履歴に追加
    const assistantReply = response.data.choices[0].message.content;
    conversationManager.addMessage(userId, 'assistant', assistantReply);
    
    return assistantReply;
  } catch (error) {
    console.error('OpenAI API エラー:', error.response?.data || error.message);
    return 'すみません、応答の生成中にエラーが発生しました。後でもう一度お試しください。';
  }
}

// LINEへの返信
async function replyToLine(replyToken, message) {
  try {
    await axios.post(
      'https://api.line.me/v2/bot/message/reply',
      {
        replyToken: replyToken,
        messages: [{ type: 'text', text: message }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
    return true;
  } catch (error) {
    console.error('LINE API エラー:', error.response?.data || error.message);
    return false;
  }
}

// Webhook エンドポイント
app.post('/webhook', async (req, res) => {
  // 即座に200を返す
  res.sendStatus(200);
  
  try {
    const events = req.body.events || [];
    if (events.length === 0) return;
    
    const event = events[0];
    
    if (event.type === 'message' && event.message.type === 'text') {
      const userId = event.source.userId;
      const messageText = event.message.text;
      
      console.log(`ユーザー ${userId} からのメッセージ: ${messageText}`);
      
      // 会話リセット機能
      if (messageText.trim().toLowerCase() === 'リセット') {
        conversationManager.resetConversation(userId);
        await replyToLine(event.replyToken, '会話をリセットしました。新しい質問をどうぞ！');
        return;
      }
      
      // OpenAIから応答を取得
      const aiReply = await getOpenAIResponse(userId, messageText);
      
      // LINEに返信
      await replyToLine(event.replyToken, aiReply);
    }
  } catch (error) {
    console.error('Webhook処理エラー:', error);
  }
});

// ヘルスチェック
app.get('/', (req, res) => {
  res.send('LINE Bot サーバー稼働中 - 会話履歴管理機能付き');
});

// テスト用エンドポイント
app.get('/test', async (req, res) => {
  const userId = req.query.userId || 'test-user';
  const message = req.query.message || 'こんにちは';
  
  try {
    const response = await getOpenAIResponse(userId, message);
    const conversation = conversationManager.getConversation(userId);
    
    res.json({
      userId,
      lastMessage: message,
      response,
      conversationHistory: conversation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 会話履歴リセット用エンドポイント
app.get('/reset', (req, res) => {
  const userId = req.query.userId || 'test-user';
  conversationManager.resetConversation(userId);
  res.json({ message: `ユーザー ${userId} の会話履歴をリセットしました。` });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 サーバー起動: ポート ${PORT}`);
});