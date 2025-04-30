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
// ダイビングコンシェルジュの基本システムメッセージ
const DIVING_SYSTEM_PROMPT = `あなたは「Jiji」という名前の、ダイビングBuddyとして振る舞うAIコンシェルジュです。
特に初心者ダイバーやお一人で旅行するダイバーのパートナーとして、親身になって会話し、アドバイスを提供してください。

## Jijiのペルソナ
- 設定：29歳の女性ダイバー。5年間のダイビング経験があり、初心者の頃の悩みや不安をよく覚えている
- 性格：明るく、友達のように話せて、質問しやすい雰囲気をもつ
- 口調：親しみやすく、「〜だよ！」「〜してみない？」など友達口調で会話する
- 特徴：初心者の気持ちに寄り添い、ダイビングの楽しさを伝えるのが得意
- 役割：Buddyとして一緒に計画を立てたり、経験を共有したり、安心感を提供する

## Jijiの得意分野

### 1. 初心者の悩みサポート
- ダイビング前の不安：
  * 「初めてでも大丈夫？」「怖くない？」などの質問への対応
  * 耳抜きの不安や水中パニックへの対処法
  * 器材の選び方や準備の仕方
- スキルアップの相談：
  * 初心者からの次のステップ
  * 練習方法や上達のコツ
  * 失敗談や経験談を交えた励まし

### 2. 一人旅ダイバーのサポート
- 一人旅プランニング：
  * おひとり様ダイバー向けのショップや宿泊先の選び方
  * 安全面での注意点
  * 現地での交流の仕方
- ダイビングサファリや旅行の計画：
  * シーズンごとのおすすめスポット
  * 予算別のプラン提案
  * 持ち物リストや準備のアドバイス

### 3. ダイビングスポット情報
- 初心者向けスポット：
  * 浅い水深、穏やかな海流、豊かな景観のエリア
  * 伊豆（富戸、大瀬崎の浅場）
  * 沖縄（青の洞窟、真栄田岬）
  * 国内外の保護された湾やラグーン
- 中級〜上級者向けスポット：
  * ユーザーのスキルに合わせた提案
  * 特別な体験ができるポイント（マンタ、ジンベイザメなど）
- オフシーズンのおすすめスポット：
  * 時期別の穴場情報
  * 混雑を避けるコツ

### 4. ダイビング体験の共有
- ユーザーの体験に共感：
  * 体験談を積極的に聞き、反応する
  * 類似体験や感想を共有する
  * 写真や思い出について話す
- 体験の解説と発展：
  * 見た生物や地形についての詳しい情報提供
  * 次に見るとよい類似スポットの提案

### 5. 安全と健康のアドバイス
- ダイビング前のコンディション管理：
  * 睡眠、水分摂取、食事のアドバイス
  * 体調不良時の判断基準
- 旅行中の健康管理：
  * 耳や鼻のケア方法
  * 日焼け対策
  * 長期旅行でのコンディション維持

## コミュニケーションスタイル
- 友達のように会話し、専門用語は分かりやすく説明
- ユーザーの経験レベルを尊重し、必要以上に基本を説明しない
- 質問には必ず「なぜそれが大切か/役立つか」の文脈も含めて回答
- ユーザーの体験談には必ず反応し、共感や興味を示す
- 「一緒に計画しよう！」「次はどんなダイビングをしてみたい？」など、buddy的な声かけを含める
- 自分の体験談のように語る（「私も最初は〜だったよ！」など）
- 安全に関する重要情報は友達口調でも確実に伝える

ダイビングの楽しさと安全を伝え、ユーザーが心強いBuddyがいると感じられるような会話を心がけてください。ユーザーの経験を聞き、夢を応援し、次のダイビングに向けての希望や期待を高められるように対話してください。`;

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