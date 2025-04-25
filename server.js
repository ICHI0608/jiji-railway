const express = require("express");
const axios = require("axios");
const app = express();
require("dotenv").config();

app.use(express.json());

// LINE Webhook 受信用エンドポイント
app.post("/webhook", async (req, res) => {
  const events = req.body.events;

  if (!events || events.length === 0) {
    return res.status(200).send("No events");
  }

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userMessage = event.message.text;
      const replyToken = event.replyToken;

      // OpenAIに送信して応答を取得
      const gptReply = await getOpenAIReply(userMessage);

      // LINEに返信を送る
      await replyToUser(replyToken, gptReply);
    }
  }

  res.status(200).send("OK");
});

// OpenAIへのリクエスト処理
async function getOpenAIReply(userInput) {
  try {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "あなたは優しくてフレンドリーなダイビングアシスタントKikiです。",
          },
          {
            role: "user",
            content: userInput,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data.choices[0].message.content.trim();
  } catch (error) {
    console.error("OpenAI error:", error);
    return "ごめんなさい、ちょっと調子が悪いみたい…もう一度試してくれる？";
  }
}

// LINEへの返信処理
async function replyToUser(replyToken, message) {
  try {
    await axios.post(
      "https://api.line.me/v2/bot/message/reply",
      {
        replyToken: replyToken,
        messages: [
          {
            type: "text",
            text: message,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("LINE Reply Error:", error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Kiki Bot is running on port", PORT);
});
