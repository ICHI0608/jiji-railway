// reminder-manager.js - リマインド機能管理クラス（完璧版）

const fs = require('fs');
const path = require('path');

class ReminderManager {
  constructor() {
    this.remindersFile = path.join(__dirname, 'data', 'reminders.json');
    this.reminders = this.loadReminders();
    console.log('📅 ReminderManager初期化完了');
  }

  // リマインダーデータの読み込み
  loadReminders() {
    try {
      if (fs.existsSync(this.remindersFile)) {
        const data = fs.readFileSync(this.remindersFile, 'utf8');
        const parsed = JSON.parse(data);
        console.log('📂 リマインダーデータ読み込み成功');
        return parsed;
      }
      console.log('📂 新規リマインダーファイル作成');
      return {};
    } catch (error) {
      console.error('❌ リマインダーデータ読み込みエラー:', error);
      return {};
    }
  }

  // リマインダーデータの保存
  saveReminders() {
    try {
      // dataディレクトリが存在しない場合は作成
      const dataDir = path.dirname(this.remindersFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(this.remindersFile, JSON.stringify(this.reminders, null, 2), 'utf8');
      console.log('💾 リマインダーデータ保存成功');
    } catch (error) {
      console.error('❌ リマインダーデータ保存エラー:', error);
    }
  }

  // 自然言語から日時を解析
  parseDateTime(text) {
    const now = new Date();
    let targetDate = null;

    // 相対的な日時パターン
    const relativePatterns = [
      { pattern: /明日/g, days: 1 },
      { pattern: /あした/g, days: 1 },
      { pattern: /明後日/g, days: 2 },
      { pattern: /(\d+)日後/g, days: 'match' },
      { pattern: /来週/, days: 7 },
      { pattern: /再来週/, days: 14 },
      { pattern: /来月/, days: 30 },
    ];

    // 曜日パターン
    const dayPatterns = [
      { pattern: /月曜(日)?/g, day: 1 },
      { pattern: /火曜(日)?/g, day: 2 },
      { pattern: /水曜(日)?/g, day: 3 },
      { pattern: /木曜(日)?/g, day: 4 },
      { pattern: /金曜(日)?/g, day: 5 },
      { pattern: /土曜(日)?/g, day: 6 },
      { pattern: /日曜(日)?/g, day: 0 },
    ];

    // 絶対的な日付パターン
    const absolutePatterns = [
      /(\d{4})年(\d{1,2})月(\d{1,2})日/,
      /(\d{1,2})月(\d{1,2})日/,
      /(\d{1,2})\/(\d{1,2})/,
    ];

    // 相対的な日時の処理
    for (const { pattern, days } of relativePatterns) {
      const match = text.match(pattern);
      if (match) {
        targetDate = new Date(now);
        if (days === 'match') {
          const dayCount = parseInt(match[0].match(/\d+/)[0]);
          targetDate.setDate(now.getDate() + dayCount);
        } else {
          targetDate.setDate(now.getDate() + days);
        }
        console.log('📅 相対日時解析成功:', text, '→', targetDate.toDateString());
        break;
      }
    }

    // 曜日の処理
    if (!targetDate) {
      for (const { pattern, day } of dayPatterns) {
        if (pattern.test(text)) {
          targetDate = new Date(now);
          const currentDay = now.getDay();
          let daysToAdd = (day - currentDay + 7) % 7;
          if (daysToAdd === 0) daysToAdd = 7; // 今日が同じ曜日の場合は来週
          
          // "来週の"が含まれている場合は追加で7日
          if (text.includes('来週')) {
            daysToAdd += 7;
          }
          
          targetDate.setDate(now.getDate() + daysToAdd);
          console.log('📅 曜日解析成功:', text, '→', targetDate.toDateString());
          break;
        }
      }
    }

    // 絶対的な日付の処理
    if (!targetDate) {
      for (const pattern of absolutePatterns) {
        const match = text.match(pattern);
        if (match) {
          if (match.length === 4) {
            // YYYY年MM月DD日
            targetDate = new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
          } else if (match.length === 3) {
            // MM月DD日
            targetDate = new Date(now.getFullYear(), parseInt(match[1]) - 1, parseInt(match[2]));
            // 過去の日付の場合は来年にする
            if (targetDate < now) {
              targetDate.setFullYear(now.getFullYear() + 1);
            }
          }
          console.log('📅 絶対日時解析成功:', text, '→', targetDate.toDateString());
          break;
        }
      }
    }

    return targetDate;
  }

  // ダイビング関連のキーワードを抽出
  extractDivingInfo(text) {
    const info = {
      activity: 'ダイビング',
      location: null,
      type: null,
      shop: null
    };

    // ロケーション抽出
    const locations = ['沖縄', '石垣島', '宮古島', '伊豆', '大瀬崎', '富戸', '熱海', '初島', '八丈島', '小笠原'];
    for (const location of locations) {
      if (text.includes(location)) {
        info.location = location;
        break;
      }
    }

    // アクティビティタイプ抽出
    const types = [
      { keywords: ['ライセンス', 'ライセンス取得', 'オープンウォーター', 'OWD'], type: 'ライセンス講習' },
      { keywords: ['ファンダイビング', 'ファンダイブ'], type: 'ファンダイビング' },
      { keywords: ['体験ダイビング', '体験'], type: '体験ダイビング' },
      { keywords: ['ナイトダイビング', 'ナイト'], type: 'ナイトダイビング' },
      { keywords: ['器材購入', '器材', 'ギア'], type: '器材購入' }
    ];

    for (const { keywords, type } of types) {
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          info.type = type;
          info.activity = type;
          break;
        }
      }
      if (info.type) break;
    }

    console.log('🔍 ダイビング情報抽出:', info);
    return info;
  }

  // リマインダーを登録
  addReminder(userId, text, parsedDate, divingInfo) {
    if (!this.reminders[userId]) {
      this.reminders[userId] = [];
    }

    const reminder = {
      id: Date.now().toString(),
      originalText: text,
      scheduledDate: parsedDate.toISOString(),
      divingInfo: divingInfo,
      notificationsSent: {
        threeDaysBefore: false,
        dayBefore: false,
        dayOf: false,
        dayAfter: false
      },
      isActive: true,
      createdAt: new Date().toISOString()
    };

    this.reminders[userId].push(reminder);
    this.saveReminders();

    console.log('✅ リマインダー登録成功:', reminder.id, '-', divingInfo.activity);
    return reminder;
  }

  // ユーザーのリマインダー一覧を取得
  getUserReminders(userId) {
    const userReminders = this.reminders[userId]?.filter(r => r.isActive) || [];
    console.log('📋 ユーザーリマインダー取得:', userId, '- 件数:', userReminders.length);
    return userReminders;
  }

  // リマインダーを削除
  deleteReminder(userId, reminderId) {
    if (!this.reminders[userId]) return false;

    const index = this.reminders[userId].findIndex(r => r.id === reminderId);
    if (index !== -1) {
      this.reminders[userId][index].isActive = false;
      this.saveReminders();
      console.log('🗑️ リマインダー削除成功:', reminderId);
      return true;
    }
    console.log('❌ リマインダー削除失敗:', reminderId);
    return false;
  }

  // 送信すべき通知をチェック
  checkPendingNotifications() {
    const now = new Date();
    const pendingNotifications = [];

    for (const userId in this.reminders) {
      for (const reminder of this.reminders[userId]) {
        if (!reminder.isActive) continue;

        const scheduledDate = new Date(reminder.scheduledDate);
        const timeDiff = scheduledDate.getTime() - now.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

        // 3日前通知
        if (daysDiff === 3 && !reminder.notificationsSent.threeDaysBefore) {
          pendingNotifications.push({
            userId,
            reminderId: reminder.id,
            type: 'threeDaysBefore',
            reminder
          });
        }

        // 前日通知
        if (daysDiff === 1 && !reminder.notificationsSent.dayBefore) {
          pendingNotifications.push({
            userId,
            reminderId: reminder.id,
            type: 'dayBefore',
            reminder
          });
        }

        // 当日通知
        if (daysDiff === 0 && !reminder.notificationsSent.dayOf) {
          pendingNotifications.push({
            userId,
            reminderId: reminder.id,
            type: 'dayOf',
            reminder
          });
        }

        // 翌日通知
        if (daysDiff === -1 && !reminder.notificationsSent.dayAfter) {
          pendingNotifications.push({
            userId,
            reminderId: reminder.id,
            type: 'dayAfter',
            reminder
          });
        }
      }
    }

    console.log('🔔 通知チェック完了:', pendingNotifications.length, '件');
    return pendingNotifications;
  }

  // 通知送信完了をマーク
  markNotificationSent(userId, reminderId, notificationType) {
    if (!this.reminders[userId]) return;

    const reminder = this.reminders[userId].find(r => r.id === reminderId);
    if (reminder) {
      reminder.notificationsSent[notificationType] = true;
      this.saveReminders();
      console.log('✅ 通知送信マーク完了:', notificationType, '-', reminderId);
    }
  }

  // 通知メッセージを生成
  generateNotificationMessage(notification) {
    const { reminder, type } = notification;
    const { divingInfo, scheduledDate } = reminder;
    const date = new Date(scheduledDate);
    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;

    const messages = {
      threeDaysBefore: `🤿 ${dateStr}の${divingInfo.activity}まであと3日ですね！

準備は順調ですか？
${divingInfo.location ? `${divingInfo.location}の` : ''}天気予報もチェックしておきましょう！

何か心配なことがあれば、いつでも相談してくださいね 😊`,

      dayBefore: `🌊 いよいよ明日は${divingInfo.activity}ですね！

最終確認をしましょう：
✅ 器材の準備
✅ 体調管理
✅ 集合時間・場所の確認

${divingInfo.type === 'ライセンス講習' ? '教材の復習も忘れずに！' : '海況も良好のようです！'}

素敵なダイビングになりそうですね 🐠`,

      dayOf: `🎉 今日は${divingInfo.activity}の日ですね！

安全に楽しんできてください！

📷 素敵な海の写真が撮れたら、ぜひ見せてくださいね

行ってらっしゃい！🤿✨`,

      dayAfter: `🌟 昨日の${divingInfo.activity}はいかがでしたか？

海の様子や見た魚のこと、ぜひ聞かせてください！

写真があれば見せてもらえると嬉しいです 📸

次のダイビング計画も一緒に考えましょう 😊`
    };

    console.log('📝 通知メッセージ生成:', type, '-', divingInfo.activity);
    return messages[type] || '📅 リマインダー通知です';
  }
}

module.exports = ReminderManager;