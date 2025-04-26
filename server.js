// server.js
require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// 環境変数の取得
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

// OpenAI用共通ヘッダー
const openaiHeaders = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  "Content-Type": "application/json",
  "OpenAI-Beta": "assistants=v2",
};

let assistantId = "";
let threadId = "";

// アシスタント初期化
async function setupAssistant() {
  const assistantRes = await axios.post(
    "https://api.openai.com/v1/assistants",
    {
      model: "gpt-4o",
      instructions: "あなたは親切なダイビングコンシェルジュです。",
    },
    { headers: openaiHeaders }
  );
  assistantId = assistantRes.data.id;
  console.log("✅ Assistant ID:", assistantId);
}

// スレッド開始
async function startThread() {
  const res = await axios.post(
    "https://api.openai.com/v1/threads",
    {},
    { headers: openaiHeaders }
  );
  threadId = res.data.id;
  console.log("🧵 Thread ID:", threadId);
}

// OpenAI へメッセージ送信 → 返信取得
async function getOpenAIReply(userMessage) {
  await axios.post(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    { role: "user", content: userMessage },
    { headers: openaiHeaders }
  );

  const run = await axios.post(
    `https://api.openai.com/v1/threads/${threadId}/runs`,
    { assistant_id: assistantId },
    { headers: openaiHeaders }
  );

  let runStatus = null;
  do {
    const statusRes = await axios.get(
      `https://api.openai.com/v1/threads/${threadId}/runs/${run.data.id}`,
      { headers: openaiHeaders }
    );
    runStatus = statusRes.data.status;
    await new Promise((r) => setTimeout(r, 1500));
  } while (runStatus !== "completed");

  const msgs = await axios.get(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    { headers: openaiHeaders }
  );
  const last = msgs.data.data.find((m) => m.role === "assistant");
  return last.content[0].text.value;
}

// LINE Webhook
app.post("/webhook", async (req, res) => {
  console.log("✅ LINEからWebhookを受信:", req.body);
  const events = req.body.events;
  if (!events || events.length === 0) return res.sendStatus(200);

  const event = events[0];
  if (event.type === "message" && event.message.type === "text") {
    try {
      const userMessage = event.message.text;
      const aiReply = await getOpenAIReply(userMessage);

      await axios.post(
        "https://api.line.me/v2/bot/message/reply",
        {
          replyToken: event.replyToken,
          messages: [{ type: "text", text: aiReply }],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
          },
        }
      );

      console.log("✅ LINEへ返信完了");
    } catch (err) {
      console.error("❌ LINE返信エラー:", err.response?.data || err.message);
    }
  }

  res.sendStatus(200);
});

// 初期化＆サーバー起動
(async () => {
  try {
    await setupAssistant();
    await startThread();
  } catch (error) {
    console.error("致命的な初期化エラー:", error.response?.data || error.message);
  }
})();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
