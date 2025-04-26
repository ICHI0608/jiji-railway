require("dotenv").config();
const express = require("express");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
app.use(bodyParser.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;

const headers = {
  Authorization: `Bearer ${OPENAI_API_KEY}`,
  "Content-Type": "application/json",
  "OpenAI-Beta": "assistants=v2"
};

let assistantId = "";
let threadId = "";

// OpenAIアシスタント初期化
async function setupAssistant() {
  const assistantRes = await axios.post(
    "https://api.openai.com/v1/assistants",
    {
      model: "gpt-4o",
      instructions: "あなたは親切なダイビングコンシェルジュです。"
    },
    { headers }
  );
  assistantId = assistantRes.data.id;
  console.log("✅ Assistant ID:", assistantId);
}

// スレッド作成
async function startThread() {
  const res = await axios.post("https://api.openai.com/v1/threads", {}, { headers });
  threadId = res.data.id;
  console.log("🧵 Thread ID:", threadId);
}

// メッセージ送信と返信取得
async function getOpenAIReply(userMessage) {
  await axios.post(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    {
      role: "user",
      content: userMessage
    },
    { headers }
  );

  const run = await axios.post(
    `https://api.openai.com/v1/threads/${threadId}/runs`,
    {
      assistant_id: assistantId
    },
    { headers }
  );

  let runStatus = null;
  do {
    const statusRes = await axios.get(
      `https://api.openai.com/v1/threads/${threadId}/runs/${run.data.id}`,
      { headers }
    );
    runStatus = statusRes.data.status;
    await new Promise((r) => setTimeout(r, 1500));
  } while (runStatus !== "completed");

  const msgs = await axios.get(
    `https://api.openai.com/v1/threads/${threadId}/messages`,
    { headers }
  );
  const last = msgs.data.data.find((m) => m.role === "assistant");
  return last.content[0].text.value;
}

// LINE Webhook受信と返信
app.post("/webhook", async (req, res) => {
  console.log("✅ LINEからWebhookを受信:", req.body);
  const events = req.body.events;
  if (!events || events.length === 0) return res.sendStatus(200);

  const event = events[0];

  if (event.type === "message" && event.message.type === "text") {
    try {
      const userMessage = event.message.text;

      // OpenAIに問い合わせて返信を取得
      const aiReply = await getOpenAIReply(userMessage);

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
            Authorization: `Bearer ${process.env.LINE_ACCESS_TOKEN}` // ← ここ重要！
          }
        }
      );

      console.log("✅ LINEに返信しました");
    } catch (err) {
      console.error("❌ LINE返信エラー:", err.response?.data || err.message);
    }
  }

  res.sendStatus(200);
});

// 初期セットアップ実行
(async () => {
  try {
    await setupAssistant();
    await startThread();
  } catch (error) {
    console.error("致命的なエラー:", error.response?.data || error.message);
  }
})();

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
