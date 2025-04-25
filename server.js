require("dotenv").config();
const axios = require("axios");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const headers = {
  "Authorization": `Bearer ${OPENAI_API_KEY}`,
  "Content-Type": "application/json",
  "OpenAI-Beta": "assistants=v1"
};

let assistantId = "";
let threadId = "";

async function setupAssistant() {
  const res = await axios.post("https://api.openai.com/v1/assistants", {
    name: "Kiki",
    instructions: "あなたはフレンドリーで丁寧なダイビングアシスタントKikiです。潜る場所や不安などをやさしく聞き出しながら、おすすめを提案してください。",
    model: "gpt-4o"
  }, { headers });

  assistantId = res.data.id;
  console.log("Assistant ID:", assistantId);
}

async function startThread() {
  const res = await axios.post("https://api.openai.com/v1/threads", {}, { headers });
  threadId = res.data.id;
  console.log("Thread ID:", threadId);
}

async function sendMessage(userMessage) {
  await axios.post(`https://api.openai.com/v1/threads/${threadId}/messages`, {
    role: "user",
    content: userMessage
  }, { headers });

  const run = await axios.post(`https://api.openai.com/v1/threads/${threadId}/runs`, {
    assistant_id: assistantId
  }, { headers });

  let runStatus = null;
  do {
    const statusRes = await axios.get(`https://api.openai.com/v1/threads/${threadId}/runs/${run.data.id}`, { headers });
    runStatus = statusRes.data.status;
    await new Promise(r => setTimeout(r, 1500));
  } while (runStatus !== "completed");

  const msgs = await axios.get(`https://api.openai.com/v1/threads/${threadId}/messages`, { headers });
  const last = msgs.data.data.find(m => m.role === "assistant");
  console.log("Kiki:", last.content[0].text.value);
}

// ----------------------------
// 実行（テスト）
(async () => {
  await setupAssistant();
  await startThread();
  await sendMessage("こんにちは、沖縄で潜りたいんだけどおすすめある？");
})();
