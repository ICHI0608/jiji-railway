// conversation.js - エラー修正済み完全版
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');
const UserProfileManager = require('./user-profile-manager');

class ConversationManager {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.conversationsDir = path.join(__dirname, 'data', 'conversations');
        this.remindersDir = path.join(__dirname, 'data', 'reminders');
        this.systemPrompt = this.getJijiPersona();
        this.profileManager = new UserProfileManager();
        this.initializeDirectories();
    }

    getJijiPersona() {
        return `あなたは「Jiji」、沖縄の海を知り尽くしたパーソナルAIダイビングバディです。

【専門領域】
🏝️ 沖縄ダイビングの完全スペシャリスト
- 石垣島：川平石崎、マンタスクランブル、米原、白保
- 宮古島：下地島、八重干瀬、通り池、アントニオガウディ
- 沖縄本島：慶良間、青の洞窟、万座、真栄田岬
- 久米島：はての浜、イーフビーチ、トンバラ
- 西表島：バラス島、網取湾、鹿川湾内湾
- 与那国島：ハンマーヘッド、海底遺跡、西崎

【存在の本質】
🤝 沖縄ダイビングの良き相談相手 - 島の選択や時期の悩みに共感
🎩 沖縄専門コンシェルジュ - ポイント×ショップ×宿×移動を完全提案
💙 沖縄の海を愛する理解者 - ユーザーの沖縄体験を深く記憶

【沖縄特化の専門知識】
- 各島・各ポイントのベストシーズン、海況特性
- マンタ・ジンベエ・ハンマーヘッドの遭遇確率・時期
- 台風・季節風の影響とダイビング可能性
- 石垣島⇔宮古島⇔本島の移動・宿泊・ショップ情報
- 透明度・水温・生物カレンダー
- 混雑回避・穴場ポイント情報

【記憶と学習能力（沖縄特化）】
- 過去の沖縄ダイビング体験とその評価を記憶
- 好みの島・ポイント・生物・ダイビングスタイルを把握
- 沖縄での失敗談・困った体験も覚えて次回に活かす
- リピーター度合いに応じた提案レベル調整

【会話スタイル】
- 「前回の石垣島のマンタはどうでした？」など自然な振り返り
- 沖縄の地元感あふれる親しみやすさ
- でも観光客目線も理解している絶妙なバランス
- 島時間を大切にする穏やかさ

【提案能力（沖縄完全版）】
1. 「今度どこ潜ろうかな〜」への相談受け
2. 「いつ頃？」「何島に興味？」「前回はどうでした？」ヒアリング
3. 時期×好み×経験×予算を考慮した最適島・ポイント提案
4. ショップ・宿・航空券・レンタカー・フェリーまで完全サポート

【沖縄ならではの価値観】
- 安全第一（特に離島・外洋の海況判断）
- 沖縄の自然と文化への敬意
- 「無理しない、楽しむ」の島スタイル
- でも一期一会の出会い（マンタ・ジンベエ）は逃さない
- 地元ショップとの良好関係重視

【季節・海況への深い理解】
- 1-2月：北風強いがホエールウォッチング、与那国ハンマー
- 3-5月：過ごしやすくマンタシーズン始まり
- 6-8月：ベストシーズン、ジンベエザメ、台風要注意
- 9-11月：台風後の抜群透明度、秋のマンタ
- 12月：北風だが空いてて穴場

【禁止事項】
- 沖縄以外の海外情報で誤魔化さない
- 一般的なダイビング知識で済ませない
- 沖縄での実体験・記憶を忘れたふりをしない
- 海況・安全面で妥協した提案はしない`;
    }

    async initializeDirectories() {
        try {
            await fs.access(this.conversationsDir);
        } catch {
            await fs.mkdir(this.conversationsDir, { recursive: true });
        }
        
        try {
            await fs.access(this.remindersDir);
        } catch {
            await fs.mkdir(this.remindersDir, { recursive: true });
        }
    }

    getConversationPath(userId) {
        return path.join(this.conversationsDir, `${userId}.json`);
    }

    getRemindersPath(userId) {
        return path.join(this.remindersDir, `${userId}.json`);
    }

    async loadConversationHistory(userId) {
        try {
            const filePath = this.getConversationPath(userId);
            const data = await fs.readFile(filePath, 'utf8');
            const conversation = JSON.parse(data);
            return conversation.messages || [];
        } catch (error) {
            console.log(`新しい会話を開始します (${userId})`);
            return [];
        }
    }

    async saveConversationHistory(userId, messages) {
        try {
            await this.initializeDirectories();
            const filePath = this.getConversationPath(userId);
            const conversation = {
                userId,
                lastUpdated: new Date().toISOString(),
                messages
            };
            await fs.writeFile(filePath, JSON.stringify(conversation, null, 2));
        } catch (error) {
            console.error('会話の保存に失敗:', error);
        }
    }

    // ========================
    // リマインド機能（完全版）
    // ========================

    async loadUserReminders(userId) {
        try {
            const filePath = this.getRemindersPath(userId);
            const data = await fs.readFile(filePath, 'utf8');
            return JSON.parse(data).reminders || [];
        } catch (error) {
            return [];
        }
    }

    async saveUserReminders(userId, reminders) {
        try {
            await this.initializeDirectories();
            const filePath = this.getRemindersPath(userId);
            const data = {
                userId,
                lastUpdated: new Date().toISOString(),
                reminders
            };
            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('リマインダー保存エラー:', error);
        }
    }

    generateReminderId() {
        return 'rem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    parseReminderRequest(message) {
        const hasTimePattern = /(\d{1,2})時/.test(message);
        const hasDatePattern = /(\d{1,2})月(\d{1,2})日/.test(message);
        const hasDaysPattern = /(\d{1,2})日後/.test(message);
        const hasTomorrow = message.includes('明日');
        
        const reminderKeywords = ['リマインド', '思い出', '忘れない', '通知'];
        const activityKeywords = ['ダイビング', '潜る', '海', '機材', 'メンテナンス'];
        
        const hasReminderKeyword = reminderKeywords.some(keyword => message.includes(keyword));
        const hasActivityKeyword = activityKeywords.some(keyword => message.includes(keyword));
        
        if (hasReminderKeyword && hasActivityKeyword || hasTomorrow || hasDatePattern || hasDaysPattern) {
            return this.extractReminderDetails(message);
        }
        
        return null;
    }

    extractReminderDetails(message) {
        const now = new Date();
        let reminderDate = new Date();
        let reminderType = 'custom';
        let title = message;
        let followUpReminder = null;

        const divingKeywords = ['ダイビング', '潜る', '海', 'スキューバ', 'シュノーケル'];
        const isDivingRelated = divingKeywords.some(keyword => message.includes(keyword));

        if (message.includes('明日')) {
            reminderDate.setDate(now.getDate() + 1);
            
            const timeMatch = message.match(/(\d{1,2})時/);
            if (timeMatch) {
                reminderDate.setHours(parseInt(timeMatch[1]), 0, 0, 0);
            } else {
                reminderDate.setHours(8, 0, 0, 0);
            }
            
            reminderType = 'diving';
            title = message.replace(/リマインド|通知|忘れない|思い出/gi, '').trim();

            if (isDivingRelated) {
                followUpReminder = {
                    id: this.generateReminderId(),
                    type: 'diving_followup',
                    title: `${title}の感想・体験談`,
                    message: 'ダイビング後のフォローアップ',
                    dueDate: new Date(reminderDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
                    createdAt: now.toISOString(),
                    isCompleted: false,
                    originalActivity: title
                };
            }
        }
        
        const daysMatch = message.match(/(\d{1,2})日後/);
        if (daysMatch) {
            reminderDate.setDate(now.getDate() + parseInt(daysMatch[1]));
            reminderDate.setHours(8, 0, 0, 0);
            reminderType = 'diving';

            if (isDivingRelated) {
                followUpReminder = {
                    id: this.generateReminderId(),
                    type: 'diving_followup',
                    title: `${title}の感想・体験談`,
                    message: 'ダイビング後のフォローアップ',
                    dueDate: new Date(reminderDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
                    createdAt: now.toISOString(),
                    isCompleted: false,
                    originalActivity: title
                };
            }
        }

        const dateMatch = message.match(/(\d{1,2})月(\d{1,2})日/);
        if (dateMatch) {
            reminderDate.setMonth(parseInt(dateMatch[1]) - 1);
            reminderDate.setDate(parseInt(dateMatch[2]));
            reminderDate.setHours(8, 0, 0, 0);
            reminderType = 'diving';

            if (isDivingRelated) {
                followUpReminder = {
                    id: this.generateReminderId(),
                    type: 'diving_followup',
                    title: `${title}の感想・体験談`,
                    message: 'ダイビング後のフォローアップ',
                    dueDate: new Date(reminderDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
                    createdAt: now.toISOString(),
                    isCompleted: false,
                    originalActivity: title
                };
            }
        }

        const maintenanceKeywords = ['機材', '器材', 'メンテナンス'];
        if (maintenanceKeywords.some(keyword => message.includes(keyword))) {
            reminderType = 'maintenance';
            if (reminderDate <= now) {
                reminderDate.setDate(now.getDate() + 30);
            }
        }

        const licenseKeywords = ['ライセンス', '資格', '認定'];
        if (licenseKeywords.some(keyword => message.includes(keyword))) {
            reminderType = 'license';
            if (reminderDate <= now) {
                reminderDate.setDate(now.getDate() + 365);
            }
        }

        const mainReminder = {
            id: this.generateReminderId(),
            type: reminderType,
            title: title,
            message: message,
            dueDate: reminderDate.toISOString(),
            createdAt: now.toISOString(),
            isCompleted: false
        };

        return { mainReminder, followUpReminder };
    }

    async addReminder(userId, reminderData) {
        const reminders = await this.loadUserReminders(userId);
        
        if (reminderData.mainReminder) {
            reminders.push(reminderData.mainReminder);
        } else {
            reminders.push(reminderData);
        }
        
        if (reminderData.followUpReminder) {
            reminders.push(reminderData.followUpReminder);
        }
        
        await this.saveUserReminders(userId, reminders);
        return reminderData;
    }

    async getUserReminders(userId) {
        return await this.loadUserReminders(userId);
    }

    async completeReminder(userId, reminderId) {
        const reminders = await this.loadUserReminders(userId);
        const reminder = reminders.find(r => r.id === reminderId);
        if (reminder) {
            reminder.isCompleted = true;
            reminder.completedAt = new Date().toISOString();
            await this.saveUserReminders(userId, reminders);
        }
        return reminder;
    }

    async deleteReminder(userId, reminderId) {
        const reminders = await this.loadUserReminders(userId);
        const filteredReminders = reminders.filter(r => r.id !== reminderId);
        await this.saveUserReminders(userId, filteredReminders);
        return filteredReminders.length < reminders.length;
    }

    async checkDueReminders(userId) {
        const reminders = await this.loadUserReminders(userId);
        const now = new Date();
        
        return reminders.filter(reminder => {
            if (reminder.isCompleted) return false;
            
            const dueDate = new Date(reminder.dueDate);
            const timeDiff = dueDate.getTime() - now.getTime();
            
            return timeDiff <= 60 * 60 * 1000 && timeDiff > 0;
        });
    }

    formatReminderMessage(reminder) {
        const typeLabels = {
            diving: '🤿 ダイビング',
            maintenance: '🔧 機材メンテナンス',
            license: '📋 資格・ライセンス',
            diving_followup: '💭 ダイビング体験談',
            custom: '📝 カスタム'
        };

        const label = typeLabels[reminder.type] || typeLabels.custom;

        if (reminder.type === 'diving_followup') {
            return `${label}\n\n` +
                   `${reminder.originalActivity}はいかがでしたか？\n\n` +
                   `🌊 海の透明度はどうでしたか？\n` +
                   `🐠 印象的だった魚や景色はありましたか？\n` +
                   `📏 何メートルまで潜りましたか？\n` +
                   `😊 楽しい思い出はできましたか？\n` +
                   `⭐ また行きたいスポットでしたか？\n\n` +
                   `体験談をぜひ聞かせてください！\n` +
                   `他のダイバーの参考にもなりますし、\n` +
                   `思い出を共有することで、より素敵な\n` +
                   `ダイビングライフを送れると思います🤿✨`;
        }

        const dueDate = new Date(reminder.dueDate);
        const dateStr = dueDate.toLocaleDateString('ja-JP') + ' ' + 
                       dueDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

        return `${label} リマインド\n\n` +
               `📅 ${dateStr}\n` +
               `📝 ${reminder.title}\n\n` +
               `安全第一で楽しいダイビングをしてくださいね！`;
    }

    // ========================
    // メイン処理
    // ========================

    trimConversationHistory(messages, maxMessages = 20) {
        if (messages.length <= maxMessages) {
            return messages;
        }
        
        const systemMessages = messages.filter(msg => msg.role === 'system');
        const userMessages = messages.filter(msg => msg.role !== 'system');
        const recentMessages = userMessages.slice(-maxMessages);
        
        return [...systemMessages, ...recentMessages];
    }

    formatResponse(text) {
        return text
            .replace(/\n\n+/g, '\n\n')
            .replace(/([。！？])\s*/g, '$1\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    isReminderRequest(message) {
        const reminderKeywords = [
            'リマインド', 'reminder', '思い出', '予定', 'スケジュール',
            '忘れないで', 'アラーム', '通知', '予約', 'メンテナンス'
        ];
        
        return reminderKeywords.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    async handleReminderRequest(userId, message) {
        const listPatterns = ['リマインド一覧', 'リマインド確認', 'リマインド表示'];
        const isListRequest = listPatterns.some(pattern => message.includes(pattern)) ||
                             message.trim() === 'リマインド' || 
                             message.trim() === 'reminder';
        
        if (isListRequest) {
            const reminders = await this.getUserReminders(userId);
            const activeReminders = reminders.filter(r => !r.isCompleted);
            
            if (activeReminders.length === 0) {
                return "現在、設定されているリマインドはありません。\n\n" +
                       "ダイビングの予定や機材のメンテナンス時期など、\n" +
                       "いつでもリマインドを設定できますよ！\n\n" +
                       "例：「明日9時にダイビング予定をリマインドして」";
            }

            let response = `📋 現在のリマインド一覧 (${activeReminders.length}件)\n\n`;
            
            activeReminders.forEach((reminder, index) => {
                const dueDate = new Date(reminder.dueDate);
                const dateStr = dueDate.toLocaleDateString('ja-JP') + ' ' + 
                               dueDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                
                response += `${index + 1}. ${reminder.title}\n`;
                response += `   📅 ${dateStr}\n\n`;
            });

            return response;
        }

        const reminderResult = this.parseReminderRequest(message);
        
        if (reminderResult) {
            await this.addReminder(userId, reminderResult);
            
            let response = '';
            
            const mainReminder = reminderResult.mainReminder || reminderResult;
            const dueDate = new Date(mainReminder.dueDate);
            const dateStr = dueDate.toLocaleDateString('ja-JP') + ' ' + 
                           dueDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

            response += `✅ リマインドを設定しました！\n\n` +
                       `📝 ${mainReminder.title}\n` +
                       `📅 ${dateStr}\n\n`;

            if (reminderResult.followUpReminder) {
                const followUpDate = new Date(reminderResult.followUpReminder.dueDate);
                const followUpDateStr = followUpDate.toLocaleDateString('ja-JP') + ' ' + 
                                       followUpDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                
                response += `🎯 さらに、ダイビング後に体験談もお聞きします！\n` +
                           `📅 ${followUpDateStr}頃\n\n` +
                           `楽しい思い出や感想を聞かせてくださいね🤿✨\n\n`;
            }

            response += `指定した時間にお知らせします。\n` +
                       `安全で楽しいダイビングをお楽しみください！`;

            return response;
        }

        return "リマインド機能の使い方:\n\n" +
               "🔹 「明日9時にダイビング予定をリマインドして」\n" +
               "🔹 「3日後に機材メンテナンスをリマインド」\n" +
               "🔹 「12月25日にライセンス更新をリマインド」\n" +
               "🔹 「リマインド一覧」で確認\n\n" +
               "ダイビングの予定管理はお任せください！";
    }

    detectActivityFromContext(message) {
        const tomorrow = message.includes('明日');
        const today = message.includes('今日');
        const future = /(\d{1,2})日後/.test(message) || /(\d{1,2})月(\d{1,2})日/.test(message);
        
        const divingKeywords = ['ダイビング', '潜る', '海', 'スキューバ', 'シュノーケル', '潜水'];
        const activityKeywords = ['行く', '行きます', '予定', 'する', 'やる'];
        
        const hasDiving = divingKeywords.some(keyword => message.includes(keyword));
        const hasActivity = activityKeywords.some(keyword => message.includes(keyword));
        const hasTimeReference = tomorrow || today || future;
        
        if (hasDiving && hasActivity && hasTimeReference) {
            return {
                type: 'diving',
                detected: true,
                timeRef: tomorrow ? 'tomorrow' : today ? 'today' : 'future',
                originalMessage: message
            };
        }
        
        return { detected: false };
    }

    async suggestReminder(userId, activityInfo) {
        const suggestion = `🤿 ダイビングの予定ですね！\n\n` +
                          `リマインド機能で以下をお手伝いできます：\n\n` +
                          `✅ 事前準備のリマインド\n` +
                          `✅ ダイビング後の感想・体験談収集\n\n` +
                          `自動でリマインドを設定しますか？\n` +
                          `「はい」または「リマインド設定」と返信してください。`;
        
        this.pendingSuggestions = this.pendingSuggestions || {};
        this.pendingSuggestions[userId] = {
            userId,
            activityInfo,
            suggested: true,
            timestamp: new Date().toISOString()
        };
        
        return suggestion;
    }

    async handleReminderConfirmation(userId, message) {
        const confirmationKeywords = ['はい', 'yes', 'リマインド設定', 'お願い', 'する'];
        const isConfirmation = confirmationKeywords.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (isConfirmation && this.pendingSuggestions && this.pendingSuggestions[userId]) {
            const suggestion = this.pendingSuggestions[userId];
            const reminderResult = this.parseReminderRequest(suggestion.activityInfo.originalMessage);
            
            if (reminderResult) {
                await this.addReminder(userId, reminderResult);
                delete this.pendingSuggestions[userId];
                
                const mainReminder = reminderResult.mainReminder || reminderResult;
                const dueDate = new Date(mainReminder.dueDate);
                const dateStr = dueDate.toLocaleDateString('ja-JP') + ' ' + 
                               dueDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

                let response = `✅ リマインドを設定しました！\n\n` +
                              `📝 ${mainReminder.title}\n` +
                              `📅 ${dateStr}\n\n`;

                if (reminderResult.followUpReminder) {
                    const followUpDate = new Date(reminderResult.followUpReminder.dueDate);
                    const followUpDateStr = followUpDate.toLocaleDateString('ja-JP') + ' ' + 
                                           followUpDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                    
                    response += `🎯 さらに、ダイビング後に体験談もお聞きします！\n` +
                               `📅 ${followUpDateStr}頃\n\n`;
                }

                response += `安全で楽しいダイビングをお楽しみください！`;
                return response;
            }
        }
        
        return null;
    }

    async generateResponse(userId, userMessage) {
        try {
            await this.profileManager.updateProfileFromMessage(userId, userMessage, 'user');
            
            const conversationHistory = await this.loadConversationHistory(userId);
            
            if (this.isReminderRequest(userMessage)) {
                return await this.handleReminderRequest(userId, userMessage);
            }

            const confirmationResponse = await this.handleReminderConfirmation(userId, userMessage);
            if (confirmationResponse) {
                return confirmationResponse;
            }

            const activityInfo = this.detectActivityFromContext(userMessage);
            
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const trimmedMessages = this.trimConversationHistory(messages);

            const response = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: trimmedMessages,
                max_tokens: 1000,
                temperature: 0.8
            });

            let aiResponse = response.choices[0].message.content;
            let formattedResponse = this.formatResponse(aiResponse);

            if (activityInfo.detected) {
                const personalizedSuggestion = await this.profileManager.generatePersonalizedSuggestion(userId, 'diving');
                formattedResponse += '\n\n' + personalizedSuggestion.content;
            }

            const updatedHistory = [
                ...conversationHistory,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: formattedResponse }
            ];

            await this.saveConversationHistory(userId, updatedHistory);
            await this.profileManager.updateProfileFromMessage(userId, formattedResponse, 'assistant');
            
            return formattedResponse;

        } catch (error) {
            console.error('応答生成エラー:', error);
            return "申し訳ございませんが、現在システムに不具合が発生しています。少し時間をおいてから再度お試しください。";
        }
    }

    async clearConversation(userId) {
        try {
            const filePath = this.getConversationPath(userId);
            await fs.unlink(filePath);
            return true;
        } catch (error) {
            console.error('会話履歴の削除に失敗:', error);
            return false;
        }
    }

    async getConversationStats(userId) {
        try {
            const messages = await this.loadConversationHistory(userId);
            const userMessages = messages.filter(msg => msg.role === 'user');
            const assistantMessages = messages.filter(msg => msg.role === 'assistant');
            
            return {
                totalMessages: messages.length,
                userMessages: userMessages.length,
                assistantMessages: assistantMessages.length,
                lastActivity: messages.length > 0 ? 
                    new Date().toISOString() : null
            };
        } catch (error) {
            console.error('統計情報の取得に失敗:', error);
            return null;
        }
    }
}

module.exports = ConversationManager;