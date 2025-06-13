// conversation.js - 会話管理クラス（リマインド機能統合版）

const { Configuration, OpenAIApi } = require('openai');
const ReminderManager = require('./src/reminder-manager');

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
    this.reminderManager = new ReminderManager(); // リマインド機能
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

  // リマインド関連のメッセージかチェック
  isReminderRelated(message) {
    const reminderKeywords = [
      'ダイビング', '潜る', '海', 'ライセンス', '体験ダイビング',
      '予定', 'スケジュール', '行く', '講習', '器材', 'ギア',
      '明日', '明後日', '来週', '来月', '日後', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜',
      '月', '日', '年'
    ];

    const timeKeywords = [
      '明日', 'あした', '明後日', '来週', '再来週', '来月',
      '月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜',
      '今度', '次回', '予定', 'スケジュール'
    ];

    const hasDivingKeyword = reminderKeywords.some(keyword => message.includes(keyword));
    const hasTimeKeyword = timeKeywords.some(keyword => message.includes(keyword));

    return hasDivingKeyword && hasTimeKeyword;
  }

  // リマインダー管理コマンドかチェック
  isReminderCommand(message) {
    const commands = [
      'リマインダー', 'リマインド', '予定確認', '予定一覧', 
      '予定削除', 'スケジュール確認', 'リマインダー一覧'
    ];

    return commands.some(command => message.includes(command));
  }

  // リマインダー処理
  async handleReminder(message, userId) {
    try {
      // リマインダー管理コマンドの処理
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

      // 予定削除の処理
      if (message.includes('予定削除')) {
        return "予定削除機能は実装中です。しばらくお待ちください 🙏";
      }

      // 新しいリマインダーの登録
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

  // GPT応答を見やすく整形する関数（改行改善）
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

  // GPTにメッセージを送信（リマインド機能統合版）
  async sendMessageToGPT(message, userId) {
    try {
      // リマインド関連のメッセージかチェック
      if (this.isReminderRelated(message) || this.isReminderCommand(message)) {
        const reminderResponse = await this.handleReminder(message, userId);
        if (reminderResponse) {
          return this.formatJijiResponse(reminderResponse);
        }
      }

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

## 新機能：リマインド機能
- ダイビング予定の日時が含まれるメッセージには、自動でリマインダー登録を提案
- 「明日ダイビング」「来週石垣島行く」などの表現を認識
- 3日前、前日、当日、翌日に適切なフォローアップを実施

## コミュニケーションスタイル
- 友達のように会話し、専門用語は分かりやすく説明
- ユーザーの経験レベルを尊重し、必要以上に基本を説明しない
- 質問には必ず「なぜそれが大切か/役立つか」の文脈も含めて回答
- ユーザーの体験談には必ず反応し、共感や興味を示す
- 「一緒に計画しよう！」「次はどんなダイビングをしてみたい？」など、buddy的な声かけを含める
- 安全に関する重要情報は友達口調でも確実に伝える

ダイビングの楽しさと安全を伝え、ユーザーが心強いBuddyがいると感じられるような会話を心がけてください。`;
        
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
      
      // 改行改善を適用
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

  // 定期的な通知チェック（外部から呼び出される）
  async checkAndSendNotifications() {
    try {
      const pendingNotifications = this.reminderManager.checkPendingNotifications();
      const notificationsToSend = [];

      for (const notification of pendingNotifications) {
        const message = this.reminderManager.generateNotificationMessage(notification);
        
        notificationsToSend.push({
          userId: notification.userId,
          message: this.formatJijiResponse(message),
          reminderId: notification.reminderId,
          type: notification.type
        });

        // 通知送信完了をマーク
        this.reminderManager.markNotificationSent(
          notification.userId,
          notification.reminderId,
          notification.type
        );
      }

      return notificationsToSend;
    } catch (error) {
      console.error('通知チェックエラー:', error);
      return [];
    }
  }
}

// エクスポート
module.exports = ConversationManager;
