/**
 * Jiji沖縄ダイビングバディ - メッセージ処理ハンドラー（Glitch対応版）
 * ユーザーメッセージの処理とAI応答生成
 */

const OpenAI = require('openai');

// 一時的にコメントアウト - モジュール読み込みエラー回避
// const { generateSystemPrompt } = require('./jiji-persona.js');

const {
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    saveConversation,
    getConversationHistory,
    userExists
} = require('./database.js');

// 一時的な代替関数
function generateSystemPrompt(userProfile, conversationHistory, pastExperiences, divingPlans) {
    return `あなたは「Jiji」という沖縄ダイビングの専門ガイドです。
沖縄の海を知り尽くした親しみやすいダイビングバディとして、
ユーザーの質問に答えてください。

石垣島・宮古島・沖縄本島・久米島・西表島・与那国島の
全ポイントに詳しく、安全で楽しいダイビング体験を提案します。

適度に絵文字を使い（🐠🌊🏝️🤿✨）、親しみやすく応答してください。`;
}

// OpenAI設定
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * ユーザーメッセージを処理してAI応答を生成
 * @param {string} lineUserId - LINEユーザーID
 * @param {string} messageText - ユーザーのメッセージ
 * @param {string} sessionId - セッションID（オプション）
 * @returns {string} AI応答
 */
async function processUserMessage(lineUserId, messageText, sessionId) {
    sessionId = sessionId || null;
    
    try {
        console.log(`📨 メッセージ受信: ${lineUserId} - ${messageText}`);

        // 1. ユーザー存在確認・新規登録
        const exists = await userExists(lineUserId);
        if (!exists) {
            console.log(`🆕 新規ユーザー登録: ${lineUserId}`);
            await createUserProfile(lineUserId, {
                name: null,
                diving_experience: null,
                license_type: null,
                preferences: {}
            });
        }

        // 2. ユーザーメッセージをデータベースに保存
        await saveConversation(lineUserId, 'user', messageText, sessionId);

        // 3. ユーザープロファイル取得
        const profileResult = await getUserProfile(lineUserId);
        const userProfile = profileResult.success ? profileResult.data : null;

        // 4. 会話履歴取得と分析（最新20件）
        const historyResult = await getConversationHistory(lineUserId, 20);
        const conversationHistory = historyResult.success ? historyResult.data : [];
        
        // 過去体験の抽出
        const pastExperiences = extractPastExperiences(conversationHistory);
        const divingPlans = extractDivingPlans(conversationHistory);

        // 5. プロファイル情報の自動更新チェック
        const updatedProfile = await checkAndUpdateProfile(lineUserId, messageText, userProfile);

        // 6. AI応答生成（過去体験と予定を含む）
        const aiResponse = await generateAIResponse(
            messageText, 
            updatedProfile || userProfile, 
            conversationHistory, 
            pastExperiences, 
            divingPlans
        );

        // 7. AI応答をデータベースに保存
        await saveConversation(lineUserId, 'assistant', aiResponse, sessionId);

        console.log(`🤖 AI応答生成完了: ${lineUserId}`);
        return aiResponse;

    } catch (error) {
        console.error('❌ メッセージ処理エラー:', error);
        return 'すみません、一時的にエラーが発生しました。もう一度お試しください。🙏';
    }
}

/**
 * 過去のダイビング体験を抽出
 * @param {Array} conversationHistory - 会話履歴
 * @returns {Array} 体験情報
 */
function extractPastExperiences(conversationHistory) {
    const experiences = [];
    const divingKeywords = [
        'ダイビング', '潜っ', '青の洞窟', 'ケラマ', '慶良間', '万座', '真栄田岬',
        '石垣島', '宮古島', '与那国', '久米島', '西表島',
        'マンタ', 'ウミガメ', 'ジンベエザメ', 'ハンマーヘッド',
        '川平石崎', 'マンタスクランブル', '下地島', '八重干瀬'
    ];
    
    conversationHistory.forEach(conv => {
        if (conv.message_type === 'user') {
            const hasExperience = divingKeywords.some(keyword => 
                conv.message_content.includes(keyword)
            );
            
            if (hasExperience) {
                experiences.push({
                    content: conv.message_content,
                    timestamp: conv.timestamp
                });
            }
        }
    });
    
    return experiences.slice(-5); // 最新5件
}

/**
 * ダイビング予定を検知
 * @param {Array} conversationHistory - 会話履歴
 * @returns {Array} 予定情報
 */
function extractDivingPlans(conversationHistory) {
    const plans = [];
    const planKeywords = [
        '明日', '来週', '今度', '予約', '行く予定', '行きます',
        '計画', 'プラン', '旅行', 'ツアー', '予定'
    ];
    const divingKeywords = ['ダイビング', '沖縄', '石垣', '宮古', '潜り'];
    
    conversationHistory.forEach(conv => {
        if (conv.message_type === 'user') {
            const hasPlan = planKeywords.some(keyword => 
                conv.message_content.includes(keyword)
            );
            const hasDiving = divingKeywords.some(keyword => 
                conv.message_content.includes(keyword)
            );
            
            if (hasPlan && hasDiving) {
                plans.push({
                    content: conv.message_content,
                    timestamp: conv.timestamp
                });
            }
        }
    });
    
    return plans.slice(-3); // 最新3件
}

/**
 * メッセージからプロファイル情報を自動更新
 * @param {string} lineUserId - LINEユーザーID  
 * @param {string} messageText - メッセージテキスト
 * @param {Object} currentProfile - 現在のプロファイル
 * @returns {Object|null} 更新されたプロファイル（更新があった場合）
 */
async function checkAndUpdateProfile(lineUserId, messageText, currentProfile) {
    if (!currentProfile) return null;

    const updates = {};
    let hasUpdates = false;

    // 経験レベルの自動検知
    if (!currentProfile.diving_experience) {
        if (messageText.includes('初心者') || messageText.includes('体験ダイビング')) {
            updates.diving_experience = 'beginner';
            hasUpdates = true;
        } else if (messageText.includes('アドバンス') || messageText.includes('AOW')) {
            updates.diving_experience = 'advanced';
            hasUpdates = true;
        } else if (messageText.includes('オープンウォーター') || messageText.includes('OWD')) {
            updates.diving_experience = 'open_water';
            hasUpdates = true;
        }
    }

    // ライセンス情報の自動検知
    if (!currentProfile.license_type) {
        if (messageText.includes('オープンウォーター') || messageText.includes('OWD')) {
            updates.license_type = 'OWD';
            hasUpdates = true;
        } else if (messageText.includes('アドバンス') || messageText.includes('AOW')) {
            updates.license_type = 'AOW';
            hasUpdates = true;
        } else if (messageText.includes('レスキュー') || messageText.includes('RED')) {
            updates.license_type = 'RED';
            hasUpdates = true;
        }
    }

    // 名前の自動検知（簡単なパターン）
    if (!currentProfile.name) {
        const namePatterns = [
            /私は(.+?)です/,
            /(.+?)と申します/,
            /名前は(.+?)です/,
            /(.+?)と言います/
        ];
        
        for (const pattern of namePatterns) {
            const match = messageText.match(pattern);
            if (match && match[1]) {
                updates.name = match[1].trim();
                hasUpdates = true;
                break;
            }
        }
    }

    // 好みエリアの自動検知
    const areas = ['石垣島', '宮古島', '沖縄本島', '慶良間', '久米島', '西表島', '与那国島'];
    const preferences = currentProfile.preferences || {};
    const interestedAreas = preferences.interested_areas || [];
    
    areas.forEach(area => {
        if (messageText.includes(area) && !interestedAreas.includes(area)) {
            if (!updates.preferences) updates.preferences = { ...preferences };
            if (!updates.preferences.interested_areas) updates.preferences.interested_areas = [...interestedAreas];
            updates.preferences.interested_areas.push(area);
            hasUpdates = true;
        }
    });

    // 更新があった場合のみデータベース更新
    if (hasUpdates) {
        console.log(`🔄 プロファイル自動更新: ${lineUserId}`, updates);
        const result = await updateUserProfile(lineUserId, updates);
        return result.success ? result.data : null;
    }

    return null;
}

/**
 * OpenAI GPTを使ってAI応答を生成
 * @param {string} currentMessage - 現在のメッセージ
 * @param {Object} userProfile - ユーザープロファイル
 * @param {Array} conversationHistory - 会話履歴
 * @param {Array} pastExperiences - 過去のダイビング体験
 * @param {Array} divingPlans - ダイビング予定
 * @returns {string} AI応答
 */
async function generateAIResponse(currentMessage, userProfile, conversationHistory, pastExperiences, divingPlans) {
    try {
        // システムプロンプト生成
        const systemPrompt = generateSystemPrompt(userProfile, conversationHistory, pastExperiences, divingPlans);

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: currentMessage }
            ],
            max_tokens: 1000,
            temperature: 0.8
        });

        return response.choices[0].message.content;

    } catch (error) {
        console.error('❌ OpenAI API エラー:', error);
        
        // エラータイプに応じた対応
        if (error.code === 'rate_limit_exceeded') {
            return 'すみません、現在多くのご利用をいただいており、少し時間をおいてからもう一度お試しください。🙏';
        } else if (error.code === 'insufficient_quota') {
            return 'すみません、AIサービスの利用上限に達しました。少し時間をおいてからもう一度お試しください。🙏';
        } else {
            return 'すみません、ただいまAIサービスに接続できません。少し時間をおいてからもう一度お試しください。🙏';
        }
    }
}

/**
 * メッセージタイプを判定
 * @param {string} messageText - メッセージテキスト
 * @returns {string} メッセージタイプ
 */
function detectMessageType(messageText) {
    // 挨拶
    if (/こんにちは|はじめまして|よろしく/.test(messageText)) {
        return 'greeting';
    }
    
    // 質問
    if (/\?|？|教えて|どう|いつ|どこ|何/.test(messageText)) {
        return 'question';
    }
    
    // 予定・計画
    if (/明日|来週|今度|予約|行く予定|計画/.test(messageText)) {
        return 'plan';
    }
    
    // 体験談
    if (/行った|潜った|見た|楽しかった|良かった/.test(messageText)) {
        return 'experience';
    }
    
    return 'general';
}

/**
 * リマインダー設定が必要かチェック
 * @param {string} messageText - メッセージテキスト
 * @returns {Object|null} リマインダー情報
 */
function checkReminderNeeded(messageText) {
    const reminderKeywords = [
        '明日ダイビング', '来週ダイビング', '今度ダイビング',
        '明日潜る', '来週潜る', '今度潜る',
        '予約した', '予約取った', '行く予定'
    ];
    
    const hasReminderKeyword = reminderKeywords.some(keyword => 
        messageText.includes(keyword)
    );
    
    if (hasReminderKeyword) {
        return {
            type: 'diving_preparation',
            message: messageText,
            detected_keywords: reminderKeywords.filter(k => messageText.includes(k))
        };
    }
    
    return null;
}

module.exports = {
    processUserMessage,
    extractPastExperiences,
    extractDivingPlans,
    checkAndUpdateProfile,
    generateAIResponse,
    detectMessageType,
    checkReminderNeeded
};