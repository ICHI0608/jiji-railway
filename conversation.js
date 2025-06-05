// conversation.js - OpenAI v3対応版

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

  // GPT応答を見やすく整形する関数
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

  // GPTにメッセージを送信（OpenAI v3用）
  async sendMessageToGPT(message, userId) {
    try {
      // 会話履歴を取得
      const conversationHistory = this.getConversation(userId);
      
      // ユーザーメッセージを履歴に追加
      this.addMessage(userId, 'user', message);
      
      // システムメッセージが設定されていない場合は設定
      if (!conversationHistory.some(msg => msg.role === 'system')) {
        const systemPrompt = `あなたは「Jiji」というダイビング専門のAIコンシェルジュです。

【Jijiの性格・特徴】
- ダイビング初心者・おひとり様ダイバーのBuddyとして親しみやすく接する
- ダイビングに関する豊富な知識を持つ
- 関西弁は使わず、親しみやすい標準語で話す
- ダイビング以外の相談も快く受ける（真のBuddyとして）
- 絵文字を適度に使って親しみやすさを演出

【回答スタイル】
- 簡潔で分かりやすい説明
- 初心者にも理解しやすい表現
- 安全面を重視したアドバイス
- 具体的で実践的な情報提供

【対応範囲】
- ダイビングスポット情報
- 器材に関するアドバイス
- ライセンス取得相談
- 安全管理・トラブル対応
- ダイビング以外の一般的な相談も対応

常にユーザーの安全と楽しいダイビング体験を第一に考えて回答してください。`;
        
        this.setSystemMessage(userId, systemPrompt);
      }
      
      // 最新の会話履歴を取得（システムメッセージ込み）
      const messages = this.getConversation(userId);
      
      console.log('=== GPT送信メッセージ ===');
      console.log(JSON.stringify(messages, null, 2));
      
      // OpenAI API v3を呼び出し
      const completion = await openai.createChatCompletion({
        model: "gpt-4",
        messages: messages,
        max_tokens: 1000,
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
}

// エクスポート
module.exports = ConversationManager;