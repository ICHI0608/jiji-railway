require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// 環境変数
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// LINEへ返信する関数
async function replyToLine(replyToken, text) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken: replyToken,
        messages: [{ type: "text", text: text }]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
    return true;
  } catch (error) {
    console.error("LINE API エラー:", error.response?.data || error.message);
    return false;
  }
}

// OpenAIからの応答を取得（シンプル版）
async function getAIResponse(text) {
  try {
    // OpenAIにリクエスト
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo", // より軽量なモデルで試す
        messages: [
          {
            role: "system",
            content: "あなたは親切なダイビングコンシェルジュです。短く簡潔に回答してください。"
          },
          { role: "user", content: text }
        ],
        max_tokens: 300 // 短い応答に制限
      },
      {
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000 // 10秒タイムアウト
      }
    );
    
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API エラー:", error.response?.data || error.message);
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
      const userMessage = event.message.text;
      
      console.log(`メッセージ受信: ${userMessage}`);
      
      // まずは受信確認メッセージを送信
      await replyToLine(event.replyToken, `「${userMessage}」を受け付けました。回答を生成中...`);
      
      // 後でAI応答を送信（トークンは再利用できないが、ユーザー体験向上のため）
      try {
        const aiResponse = await getAIResponse(userMessage);
        
        // プッシュメッセージとして送信
        if (event.source && event.source.userId) {
          await axios.post(
            "https://api.line.me/v2/bot/message/push",
            {
              to: event.source.userId,
              messages: [{ type: "text", text: aiResponse }]
            },
            {
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
              }
            }
          );
        }
      } catch (error) {
        console.error("AI応答エラー:", error);
      }
    }
  } catch (error) {
    console.error("Webhook処理エラー:", error);
  }
});

// テスト用エンドポイント
app.get("/test", async (req, res) => {
  const message = req.query.text || "こんにちは";
  try {
    const response = await getAIResponse(message);
    res.json({ success: true, message, response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`サーバー起動: ポート ${PORT}`);
});