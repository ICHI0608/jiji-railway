// conversation.js - 会話管理クラス（パスデバッグ版）

const { Configuration, OpenAIApi } = require('openai');
const path = require('path');

// 🔧 パスのデバッグ
console.log('現在のディレクトリ:', __dirname);
console.log('探しているパス:', path.join(__dirname, 'src', 'reminder-manager.js'));

// 🔧 複数のパスパターンを試行
let ReminderManager;
let reminderEnabled = false;

const possiblePaths = [
  './src/reminder-manager',
  './src/reminder-manager.js',
  path.join(__dirname, 'src', 'reminder-manager'),
  path.join(__dirname, 'src', 'reminder-manager.js')
];

for (const testPath of possiblePaths) {
  try {
    console.log('パステスト:', testPath);
    ReminderManager = require(testPath);
    reminderEnabled = true;
    console.log('✅ リマインド機能: 有効 (パス:', testPath, ')');
    break;
  } catch (error) {
    console.log('❌ パス失敗:', testPath, '-', error.message);
  }
}

if (!reminderEnabled) {
  console.log('❌ リマインド機能: すべてのパスで失敗');
}

// OpenAI設定（v3用）
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// 会話管理クラス
class ConversationManager {
  constructor(maxHistoryLength = 10) {
    this.conversations = {}; 
    this.maxHistoryLength = maxHistoryLength;
    
    // リマインド機能が有効な場合のみ初期化
    if (reminderEnabled && ReminderManager) {
      try {
        this.reminderManager = new ReminderManager();
        console.log('✅ ReminderManager初期化成功');
      } catch (error) {
        console.log('❌ ReminderManager初期化失敗:', error.message);
        this.reminderManager = null;
      }
    } else {
      this.reminderManager = null;
    }
  }

  // 基本機能は前回と同じ
  addMessage(userId, role, content) {
    if (!this.conversations[userId]) {
      this.conversations[userId] = [];
    }
    
    this.conversations[userId].push({ role, content });
    
    if (this.conversations[userId].length > this.maxHistoryLength) {
      const systemMessages = this.conversations[userId].filter(msg => msg.role === 'system');
      const otherMessages = this.conversations[userId]
        .filter(msg => msg.role !== 'system')
        .slice(-(this.maxHistoryLength - systemMessages.length));
      
      this.conversations[userId] = [...systemMessages, ...otherMessages];
    }
  }

  getConversation(userId) {
    return this.conversations[userId] || [];
  }

  resetConversation(userId) {
    const systemMessages = this.conversations[userId]?.filter(msg => msg.role === 'system') || [];
    this.conversations[userId] = systemMessages;
  }

  setSystemMessage(userId, content) {
    if (this.conversations[userId]) {
      this.conversations[userId] = this.conversations[userId].filter(msg => msg.role !== 'system');
    } else {
      this.conversations[userId] = [];
    }
    
    this.conversations[userId].unshift({ role: 'system', content });
  }

  // リマインド関連チェック（安全版）
  isReminderRelated(message) {
    if (!this.reminderManager) return false;
    
    const reminderKeywords = ['ダイビング', '潜る', '海', 'ライセンス', '体験ダイビング', '予定', 'スケジュール', '行く', '講習', '器材', 'ギア'];
    const timeKeywords = ['明日', 'あした', '明後日', '来週', '再来週', '来月', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜', '今度', '次回', '予定', 'スケジュール'];

    const hasDivingKeyword = reminderKeywords.some(keyword => message.includes(keyword));
    const hasTimeKeyword = timeKeywords.some(keyword => message.includes(keyword));

    return hasDivingKeyword && hasTimeKeyword;
  }

  isReminderCommand(message) {
    if (!this.reminderManager) return false;
    
    const commands = ['リマインダー', 'リマインド', '予定確認', '予定一覧', '予定削除', 'スケジュール確認', 'リマインダー一覧'];
    return commands.some(command => message.includes(command));
  }

  async handleReminder(message, userId) {
    if (!this.reminderManager) {
      return "リマインド機能は現在準備中です。しばらくお待ちください 🙏";
    }

    try {
      if (message.includes('予定一覧') || message.includes('リマインダー一覧') || message.includes('予定確認')) {
        const reminders = this.reminderManager.getUserReminders(userId);
        
        if (reminders.length === 0) {
          return "現在、登録されているダイビング予定はありません。\n\n新しい予定ができたら、ぜひ教えてくださいね！ 🤿";
        }

        let response = "📅 登録済みのダイビング予定\n\n";
        reminders.forEach((reminder, index) => {
          const date = new Date(reminder.scheduledDate);
          const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
          response += `${index + 1}. ${dateStr} - ${reminder.divingInfo.activity}`;
          if (reminder.divingInfo.location) {
            response += ` (${reminder.divingInfo.location})`;
          }
          response += "\n";
        });

        response += "\n予定を削除したい場合は「予定削除」と言ってくださいね 😊";
        return response;
      }

      if (message.includes('予定削除')) {
        return "予定削除機能は実装中です。しばらくお待ちください 🙏";
      }

      const parsedDate = this.reminderManager.parseDateTime(message);
      
      if (!parsedDate) {
        return "日時が認識できませんでした 😅\n\n「明日ダイビング」「来週の土曜日に石垣島でダイビング」のように具体的に教えてください！";
      }

      const divingInfo = this.reminderManager.extractDivingInfo(message);
      const reminder = this.reminderManager.addReminder(userId, message, parsedDate, divingInfo);

      const dateStr = `${parsedDate.getMonth() + 1}月${parsedDate.getDate()}日`;
      
      let response = `📅 ${dateStr}の${divingInfo.activity}予定を登録しました！\n\n`;
      
      if (divingInfo.location) {
        response += `📍 場所: ${divingInfo.location}\n`;
      }
      
      response += `🔔 以下のタイミングでリマインドします：\n`;
      response += `・3日前: 準備確認・天気予報\n`;
      response += `・前日: 最終確認・持ち物チェック\n`;
      response += `・当日: 応援メッセージ\n`;
      response += `・翌日: 体験の振り返り\n\n`;
      response += `素敵なダイビングになりそうですね！ 🤿✨`;

      return response;

    } catch (error) {
      console.error('リマインダー処理エラー:', error);
      return "リマインダーの処理中にエラーが発生しました。もう一度試してみてください 🙏";
    }
  }

  formatJijiResponse(response) {
    if (!response || typeof response !== 'string') {
      return response;
    }

    let formatted = response;

    formatted = formatted.replace(/。\s*/g, '。\n\n');
    formatted = formatted.replace(/！\s*/g, '！\n\n');
    formatted = formatted.replace(/？\s*/g, '？\n\n');
    formatted = formatted.replace(/(また、|そして、|さらに、|ちなみに、|それから、|特に)/g, '\n$1');
    formatted = formatted.replace(/([。！？])\s*(・|−|ー)\s*/g, '$1\n$2 ');
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    formatted = formatted.trim();
    formatted = formatted.replace(/\s*([🤿🏝️✨🐠🌊🏖️🐟🦈🐙🦑🏊‍♀️🏊‍♂️🤽‍♀️🤽‍♂️])\s*/g, '$1');

    if (!formatted.match(/[🤿🏝️✨🐠🌊🏖️🐟🦈🐙🦑]/)) {
      formatted += ' 🤿';
    }

    return formatted;
  }

  async sendMessageToGPT(message, userId) {
    try {
      if (this.reminderManager && (this.isReminderRelated(message) || this.isReminderCommand(message))) {
        const reminderResponse = await this.handleReminder(message, userId);
        if (reminderResponse) {
          return this.formatJijiResponse(reminderResponse);
        }
      }

      const conversationHistory = this.getConversation(userId);
      this.addMessage(userId, 'user', message);
      
      if (!conversationHistory.some(msg => msg.role === 'system')) {
        const systemPrompt = `あなたは「Jiji」という名前の、ダイビングBuddyとして振る舞うAIコンシェルジュです。
特に初心者ダイバーやお一人で旅行するダイバーのパートナーとして、親身になって会話し、アドバイスを提供してください。

## Jijiのペルソナ
- 設定：29歳の女性ダイバー。5年間のダイビング経験があり、初心者の頃の悩みや不安をよく覚えている
- 性格：明るく、友達のように話せて、質問しやすい雰囲気をもつ
- 口調：親しみやすく、「〜だよ！」「〜してみない？」など友達口調で会話する
- 特徴：初心者の気持ちに寄り添い、ダイビングの楽しさを伝えるのが得意
- 役割：Buddyとして一緒に計画を立てたり、経験を共有したり、安心感を提供する

ダイビングの楽しさと安全を伝え、ユーザーが心強いBuddyがいると感じられるような会話を心がけてください。`;
        
        this.setSystemMessage(userId, systemPrompt);
      }
      
      const messages = this.getConversation(userId);
      
      const completion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 500,
        temperature: 0.7
      });

      let response = completion.data.choices[0].message.content;
      response = this.formatJijiResponse(response);
      this.addMessage(userId, 'assistant', response);
      
      return response;
      
    } catch (error) {
      console.error('GPT API Error:', error);
      
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

module.exports = ConversationManager;
