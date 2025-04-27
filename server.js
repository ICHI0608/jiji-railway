require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// 環境変数
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// OpenAI APIクライアント（タイムアウト設定付き）
const openai = axios.create({
  baseURL: 'https://api.openai.com/v1',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30秒のタイムアウト
});

// チャット応答を取得
async function getChatResponse(message) {
  try {
    console.log(`OpenAIにリクエスト送信: "${message}"`);
    
    const response = await openai.post('/chat/completions', {
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "あなたは親切なダイビングコンシェルジュです。ダイビングスポット、装備、技術、安全対策などについての質問に丁寧に答えてください。"
        },
        {
          role: "user",
          content: message
        }
      ],
      max_tokens: 500 // 応答の長さを制限
    });
    
    const reply = response.data.choices[0].message.content;
    console.log(`OpenAI応答受信: ${reply.substring(0, 50)}...`);
    return reply;
  } catch (error) {
    console.error("OpenAI APIエラー:", error.response?.data || error.message);
    return "申し訳ありません、応答の生成中にエラーが発生しました。もう一度お試しください。";
  }
}

// LINE Webhook
app.post("/webhook", async (req, res) => {
  // 即座に200を返す
  res.sendStatus(200);
  
  try {
    const events = req.body.events || [];
    if (events.length === 0) return;
    
    const event = events[0];
    
    if (event.type === "message" && event.message.type === "text") {
      const userId = event.source.userId;
      const messageText = event.message.text;
      
      console.log(`ユーザー ${userId} からのメッセージ: ${messageText}`);
      
      // OpenAIから応答を取得
      const aiReply = await getChatResponse(messageText);
      
      // LINEに返信
      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        {
          replyToken: event.replyToken,
          messages: [{ type: "text", text: aiReply }]
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
          }
        }
      );
      
      console.log(`LINE返信完了: ユーザー ${userId}`);
    }
  } catch (error) {
    console.error("Webhook処理エラー:", error.response?.data || error.message);
  }
});

// OpenAIテスト用エンドポイント
app.get("/test-openai", async (req, res) => {
  const testMessage = req.query.message || "ダイビングについて教えてください";
  try {
    const response = await getChatResponse(testMessage);
    res.json({ success: true, message: testMessage, response });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ヘルスチェック
app.get("/", (req, res) => {
  res.send("LINE Bot サーバー稼働中");
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 サーバー起動: ポート ${PORT}`);
  console.log(`テスト URL: https://${process.env.PROJECT_DOMAIN || "your-project"}.glitch.me/test-openai?message=こんにちは`);
});