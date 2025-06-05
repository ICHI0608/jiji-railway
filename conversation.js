// conversation.js - 会話管理クラス（改行改善機能付き完全版）

const { Configuration, OpenAIApi } = require('openai');

// OpenAI設定（v3用）
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// 会話管理クラス
class ConversationManager {
  constructor(maxHistoryLength = 10) {
    this.conversations = {}; // ユーザーIDをキーとした会話履歴の保存
    this.maxHistoryLength = maxHistoryLength; // 保持する最大メッセージ数
  }

  // 新しいメッセージを追加
  addMessage(userId, role, content) {
    if (!this.conversations[userId]) {
      this.conversations[userId] = [];
    }
    
    this.conversations[userId].push({ role, content });
    
    // 最大数を超えたら古いメッセージを削除
    if (this.conversations[userId].length > this.maxHistoryLength) {
      // システムメッセージは保持
      const systemMessages = this.conversations[userId].filter(msg => msg.role === 'system');
      const otherMessages = this.conversations[userId]
        .filter(msg => msg.role !== 'system')
        .slice(-(this.maxHistoryLength - systemMessages.length));
      
      this.conversations[userId] = [...systemMessages, ...otherMessages];
    }
  }

  // ユーザーの会話履歴を取得
  getConversation(userId) {
    return this.conversations[userId] || [];
  }

  // 会話をリセット (システムメッセージは保持)
  resetConversation(userId) {
    const systemMessages = this.conversations[userId]?.filter(msg => msg.role === 'system') || [];
    this.conversations[userId] = systemMessages;
  }

  // システムメッセージを設定
  setSystemMessage(userId, content) {
    // 既存のシステムメッセージを削除
    if (this.conversations[userId]) {
      this.conversations[userId] = this.conversations[userId].filter(msg => msg.role !== 'system');
    } else {
      this.conversations[userId] = [];
    }
    
    // 新しいシステムメッセージを先頭に追加
    this.conversations[userId].unshift({ role: 'system', content });
  }

  // 🎯 GPT応答を見やすく整形する関数（改行改善）
  formatJijiResponse(response) {
    if (!response || typeof response !== 'string') {
      return response;
    }

    let formatted = response;

    // 1. 句点の後に改行を追加（最も重要）
    formatted = formatted.replace(/。\s*/g, '。\n\n');
    
    // 2. 感嘆符・疑問符の後に改行
    formatted = formatted.replace(/！\s*/g, '！\n\n');
    formatted = formatted.replace(/？\s*/g, '？\n\n');
    
    // 3. 「また、」「そして、」「さらに、」などの接続詞の前で改行
    formatted = formatted.replace(/(また、|そして、|さらに、|ちなみに、|それから、|特に)/g, '\n$1');
    
    // 4. 箇条書き風の整形
    formatted = formatted.replace(/([。！？])\s*(・|−|ー)\s*/g, '$1\n$2 ');
    
    // 5. 連続する改行を2つまでに制限
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    // 6. 先頭と末尾の余分な改行・スペースを削除
    formatted = formatted.trim();
    
    // 7. 絵文字の周りのスペース調整
    formatted = formatted.replace(/\s*([🤿🏝️✨🐠🌊🏖️🐟🦈🐙🦑🏊‍♀️🏊‍♂️🤽‍♀️🤽‍♂️])\s*/g, '$1');

    // 8. 最後に絵文字を追加（もしなければ）
    if (!formatted.match(/[🤿🏝️✨🐠🌊🏖️🐟🦈🐙🦑]/)) {
      formatted += ' 🤿';
    }

    return formatted;
  }

  // 🚀 GPTにメッセージを送信（改行改善付き）
  async sendMessageToGPT(message, userId) {
    try {
      // 会話履歴を取得
      const conversationHistory = this.getConversation(userId);
      
      // ユーザーメッセージを履歴に追加
      this.addMessage(userId, 'user', message);
      
      // システムメッセージが設定されていない場合は設定
      if (!conversationHistory.some(msg => msg.role === 'system')) {
        const systemPrompt = `あなたは「Jiji」という名前の、ダイビングBuddyとして振る舞うAIコンシェルジュです。
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

また、以下のダイビングスポット情報を参照して具体的な情報を提供してください：
- 沖縄：青の洞窟（初心者向け、透明度が高く美しい洞窟）
- 伊豆：大瀬崎（初心者〜中級者向け、富士山を望む景観と豊富な生物）
- 石垣島：マンタスクランブル（中級者向け、マンタに高確率で出会えるポイント）

ダイビングの楽しさと安全を伝え、ユーザーが心強いBuddyがいると感じられるような会話を心がけてください。ユーザーの経験を聞き、夢を応援し、次のダイビングに向けての希望や期待を高められるように対話してください。`;
        
        this.setSystemMessage(userId, systemPrompt);
      }
      
      // 最新の会話履歴を取得（システムメッセージ込み）
      const messages = this.getConversation(userId);
      
      console.log('=== GPT送信メッセージ ===');
      console.log(JSON.stringify(messages, null, 2));
      
      // OpenAI API v3を呼び出し
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });

      let response = completion.data.choices[0].message.content;
      
      console.log('=== GPT応答（改行改善前） ===');
      console.log(response);
      
      // 🆕 改行改善を適用
      response = this.formatJijiResponse(response);
      
      console.log('=== GPT応答（改行改善後） ===');
      console.log(response);
      console.log('========================');
      
      // Jijiの応答を履歴に追加
      this.addMessage(userId, 'assistant', response);
      
      return response;
      
    } catch (error) {
      console.error('GPT API Error:', error);
      
      // エラーの種類に応じて適切なメッセージを返す
      let errorMessage = "申し訳ありません。\n\n少し時間をおいてから再度お試しください。🙏";
      
      if (error.response?.status === 429) {
        errorMessage = "たくさんのご質問ありがとうございます！\n\n少し休憩してから再度お声かけください。😊";
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = "少し混雑しているようです。\n\n少し時間をおいてから再度お試しください。🙏";
      }
      
      return errorMessage;
    }
  }

  // 🔧 特定のケース用の追加整形関数
  formatDivingSpotInfo(text) {
    // ダイビングスポット情報の特別な整形
    let formatted = text;
    
    // スポット名の強調
    formatted = formatted.replace(/(石垣島|宮古島|沖縄|伊豆|小笠原|慶良間|瀬底島)/g, '\n🏝️ $1');
    
    // 深度情報の整形
    formatted = formatted.replace(/深度[：:]\s*(\d+[m|メートル])/g, '\n📏 深度: $1');
    
    // 透明度情報の整形
    formatted = formatted.replace(/透明度[：:]\s*(\d+[m|メートル])/g, '\n👁️ 透明度: $1');
    
    return formatted;
  }
}

// エクスポート
module.exports = ConversationManager;