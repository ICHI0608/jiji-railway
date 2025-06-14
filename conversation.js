// conversation.js - リマインド機能完成版
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

class ConversationManager {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.conversationsDir = path.join(__dirname, 'data', 'conversations');
        this.remindersDir = path.join(__dirname, 'data', 'reminders');
        this.systemPrompt = this.getJijiPersona();
        this.initializeDirectories();
    }

    getJijiPersona() {
        return `あなたは「Jiji」という名前のベテランダイビングインストラクターです。

【キャラクター設定】
- 年齢：60代後半の経験豊富なインストラクター
- 性格：親しみやすく、安全第一、でも冒険心も大切にする
- 口調：丁寧で温かい標準語
- 経験：世界各地でのダイビング経験40年以上

【応答スタイル】
- 親しみやすい標準語を使用
- 安全面は絶対に妥協しない
- 初心者にも分かりやすく説明
- 実体験を交えたアドバイス
- 適度にユーモアを交える

【主な機能】
1. ダイビングの相談・アドバイス
2. 機材の選び方・メンテナンス
3. ダイビングスポットの情報
4. 安全管理・緊急時対応
5. 資格取得のサポート
6. リマインド機能（完全対応）

【リマインド機能について】
- ダイビング予定の管理
- 機材メンテナンスの通知
- 資格更新の提醒
- 安全チェックのリマインド
- カスタムリマインドの設定

【禁止事項】
- 危険な行為の推奨
- 不確実な医学的アドバイス
- ライセンス以上の技能を要求する内容`;
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
        const reminderPatterns = [
            // 日時指定パターン
            /明日.*?(\d{1,2})時.*?(ダイビング|潜る|海)/i,
            /(\d{1,2})月(\d{1,2})日.*?(ダイビング|潜る|海)/i,
            /(\d{1,2})日後.*?(ダイビング|潜る|海)/i,
            
            // 一般的なリマインド
            /(リマインド|思い出|忘れない|通知).*?(ダイビング|潜る|海|機材|メンテナンス)/i,
            /(ダイビング|潜る|海|機材|メンテナンス).*?(リマインド|思い出|忘れない|通知)/i,
            
            // 機材メンテナンス
            /(機材|器材|レギュレーター|BCD|ウェットスーツ).*?(メンテナンス|点検|チェック)/i,
            
            // 資格更新
            /(ライセンス|資格|認定).*?(更新|期限)/i
        ];

        for (const pattern of reminderPatterns) {
            if (pattern.test(message)) {
                return this.extractReminderDetails(message);
            }
        }
        
        return null;
    }

    extractReminderDetails(message) {
        const now = new Date();
        let reminderDate = new Date();
        let reminderType = 'custom';
        let title = message;
        let followUpReminder = null;

        // ダイビング予定の検出
        const divingKeywords = /(ダイビング|潜る|海|スキューバ|シュノーケル)/i;
        const isDivingRelated = divingKeywords.test(message);

        // 明日の指定
        if (/明日/i.test(message)) {
            reminderDate.setDate(now.getDate() + 1);
            
            // 時間指定があるか確認
            const timeMatch = message.match(/(\d{1,2})時/);
            if (timeMatch) {
                reminderDate.setHours(parseInt(timeMatch[1]), 0, 0, 0);
            } else {
                reminderDate.setHours(8, 0, 0, 0); // デフォルト8時
            }
            
            reminderType = 'diving';
            title = message.replace(/リマインド|通知|忘れない|思い出/gi, '').trim();

            // ダイビング関連の場合、アフターフォローアップを自動設定
            if (isDivingRelated) {
                followUpReminder = {
                    id: this.generateReminderId(),
                    type: 'diving_followup',
                    title: `${title}の感想・体験談`,
                    message: 'ダイビング後のフォローアップ',
                    dueDate: new Date(reminderDate.getTime() + 12 * 60 * 60 * 1000).toISOString(), // 12時間後
                    createdAt: now.toISOString(),
                    isCompleted: false,
                    originalActivity: title
                };
            }
        }
        
        // X日後の指定
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

        // 月日指定
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

        // 機材メンテナンス
        if /(機材|器材|メンテナンス)/i.test(message)) {
            reminderType = 'maintenance';
            if (reminderDate <= now) {
                reminderDate.setDate(now.getDate() + 30); // 1ヶ月後
            }
        }

        // 資格更新
        if /(ライセンス|資格|認定)/i.test(message)) {
            reminderType = 'license';
            if (reminderDate <= now) {
                reminderDate.setDate(now.getDate() + 365); // 1年後
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
        
        // メインリマインダーを追加
        if (reminderData.mainReminder) {
            reminders.push(reminderData.mainReminder);
        } else {
            reminders.push(reminderData);
        }
        
        // フォローアップリマインダーも追加
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
            
            // 1時間以内に期限のもの
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

        // フォローアップリマインダーの場合
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

        // 通常のリマインダー
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
        // リマインド一覧表示
        if (/リマインド.*?(一覧|確認|表示)/i.test(message) || 
            message.trim() === 'リマインド' || 
            message.trim() === 'reminder') {
            
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

        // 新しいリマインド設定
        const reminderResult = this.parseReminderRequest(message);
        
        if (reminderResult) {
            await this.addReminder(userId, reminderResult);
            
            let response = '';
            
            // メインリマインダーの確認
            const mainReminder = reminderResult.mainReminder || reminderResult;
            const dueDate = new Date(mainReminder.dueDate);
            const dateStr = dueDate.toLocaleDateString('ja-JP') + ' ' + 
                           dueDate.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

            response += `✅ リマインドを設定しました！\n\n` +
                       `📝 ${mainReminder.title}\n` +
                       `📅 ${dateStr}\n\n`;

            // フォローアップリマインダーがある場合
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

        // リマインド機能の説明
        return "リマインド機能の使い方:\n\n" +
               "🔹 「明日9時にダイビング予定をリマインドして」\n" +
               "🔹 「3日後に機材メンテナンスをリマインド」\n" +
               "🔹 「12月25日にライセンス更新をリマインド」\n" +
               "🔹 「リマインド一覧」で確認\n\n" +
               "ダイビングの予定管理はお任せください！";
    }

    async generateResponse(userId, userMessage) {
        try {
            const conversationHistory = await this.loadConversationHistory(userId);
            
            // リマインド機能のチェック
            if (this.isReminderRequest(userMessage)) {
                return await this.handleReminderRequest(userId, userMessage);
            }

            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const trimmedMessages = this.trimConversationHistory(messages);

            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: trimmedMessages,
                max_tokens: 1000,
                temperature: 0.8
            });

            const aiResponse = response.choices[0].message.content;
            const formattedResponse = this.formatResponse(aiResponse);

            const updatedHistory = [
                ...conversationHistory,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: formattedResponse }
            ];

            await this.saveConversationHistory(userId, updatedHistory);
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