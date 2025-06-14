// conversation.js - エラー修正版
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

class ConversationManager {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        this.conversationsDir = path.join(__dirname, 'data', 'conversations');
        this.systemPrompt = this.getJijiPersona();
    }

    getJijiPersona() {
        return `あなたは「Jiji」という名前のベテランダイビングインストラクターです。

【キャラクター設定】
- 年齢：60代後半の経験豊富なインストラクター
- 性格：親しみやすく、安全第一、でも冒険心も大切にする
- 口調：関西弁混じりの温かい口調
- 経験：世界各地でのダイビング経験40年以上

【応答スタイル】
- 親しみやすい関西弁を使用
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
6. リマインド機能（準備中）

【禁止事項】
- 危険な行為の推奨
- 不確実な医学的アドバイス
- ライセンス以上の技能を要求する内容`;
    }

    async ensureConversationsDir() {
        try {
            await fs.access(this.conversationsDir);
        } catch {
            await fs.mkdir(this.conversationsDir, { recursive: true });
        }
    }

    getConversationPath(userId) {
        return path.join(this.conversationsDir, `${userId}.json`);
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
            await this.ensureConversationsDir();
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

    trimConversationHistory(messages, maxMessages = 20) {
        if (messages.length <= maxMessages) {
            return messages;
        }
        
        // システムメッセージは保持
        const systemMessages = messages.filter(msg => msg.role === 'system');
        const userMessages = messages.filter(msg => msg.role !== 'system');
        
        // 最新のメッセージを保持
        const recentMessages = userMessages.slice(-maxMessages);
        
        return [...systemMessages, ...recentMessages];
    }

    formatResponse(text) {
        // 改行処理の改善
        return text
            .replace(/\n\n+/g, '\n\n')  // 複数の改行を2つに統一
            .replace(/([。！？])\s*/g, '$1\n')  // 文の終わりで改行
            .replace(/\n{3,}/g, '\n\n')  // 3つ以上の改行を2つに
            .trim();
    }

    async generateResponse(userId, userMessage) {
        try {
            // 会話履歴を読み込み
            const conversationHistory = await this.loadConversationHistory(userId);
            
            // リマインド機能のチェック
            if (this.isReminderRequest(userMessage)) {
                return this.handleReminderRequest(userMessage);
            }

            // メッセージ履歴を準備
            const messages = [
                { role: 'system', content: this.systemPrompt },
                ...conversationHistory,
                { role: 'user', content: userMessage }
            ];

            // 履歴が長すぎる場合は切り詰め
            const trimmedMessages = this.trimConversationHistory(messages);

            // OpenAI APIを呼び出し
            const response = await this.openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: trimmedMessages,
                max_tokens: 1000,
                temperature: 0.8
            });

            const aiResponse = response.choices[0].message.content;

            // 応答を整形
            const formattedResponse = this.formatResponse(aiResponse);

            // 会話履歴を更新
            const updatedHistory = [
                ...conversationHistory,
                { role: 'user', content: userMessage },
                { role: 'assistant', content: formattedResponse }
            ];

            // 履歴を保存
            await this.saveConversationHistory(userId, updatedHistory);

            return formattedResponse;

        } catch (error) {
            console.error('応答生成エラー:', error);
            return "すみません、ちょっと調子が悪いみたいです。もう一度試してもらえますか？";
        }
    }

    isReminderRequest(message) {
        const reminderKeywords = [
            'リマインド', 'reminder', '思い出', '予定', 'スケジュール',
            '忘れないで', 'アラーム', '通知', '予約'
        ];
        
        return reminderKeywords.some(keyword => 
            message.toLowerCase().includes(keyword.toLowerCase())
        );
    }

    // 修正された部分：文字列を適切に閉じる
    handleReminderRequest(message) {
        // リマインド機能は現在開発中（30%完了）
        return "リマインド機能は現在準備中です。\n\n" +
               "今開発チームががんばって作ってくれてるから、\n" +
               "もうちょっと待ってもらえるかな？\n\n" +
               "完成したら、ダイビングの予定や\n" +
               "機材のメンテナンス時期なんかを\n" +
               "お知らせできるようになる予定やで！\n\n" +
               "それまでは、何か他にダイビングのことで\n" +
               "聞きたいことがあったら遠慮なく言ってな〜";
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