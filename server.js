require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

// LINE Webhook エンドポイント
app.post("/webhook", async (req, res) => {
  // 即座に200を返す
  res.sendStatus(200);
  
  try {
    const events = req.body.events || [];
    console.log(`Webhook受信: ${events.length}件のイベント`);
    
    if (events.length === 0) return;
    
    const event = events[0];
    
    if (event.type === "message" && event.message.type === "text") {
      const userId = event.source.userId;
      const messageText = event.message.text;
      
      console.log(`ユーザー ${userId} からのメッセージ: ${messageText}`);
      
      // 固定のメッセージを返信
      const replyMessage = "こんにちは！あなたのメッセージを受け取りました。これはテスト返信です。";
      
      // LINEに返信
      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        {
          replyToken: event.replyToken,
          messages: [{ type: "text", text: replyMessage }]
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
          }
        }
      );
      
      console.log("LINE返信完了");
    }
  } catch (error) {
    console.error("Webhook処理エラー:", error.response?.data || error.message);
  }
});

// ヘルスチェック
app.get("/", (req, res) => {
  res.send("LINE Bot サーバー稼働中");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 サーバー起動: ポート ${PORT}`);
});