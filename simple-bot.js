const express = require('express');
const line = require('@line/bot-sdk');
const OpenAI = require('openai');
require('dotenv').config();

// 分割されたモジュールをインポート
const { generateSystemPrompt, JIJI_PERSONA_CONFIG } = require('./src/jiji-persona');

// ===== アンケートシステム（安全な追加機能） =====

/**
 * アンケート状態定義
 */
const SURVEY_STATES = {
    NONE: 'none',                    // アンケート実施なし
    STARTED: 'survey_started',       // アンケート開始
    Q1: 'survey_q1',                // Q1: ダイビング経験
    Q1_5: 'survey_q1_5',            // Q1.5: ライセンス
    Q2: 'survey_q2',                // Q2: 分岐質問
    COMPLETED: 'survey_completed'    // アンケート完了
};

/**
 * メモリベースのユーザーセッション管理（データベース無効でも動作）
 */
const userSessions = new Map();

/**
 * ユーザーセッション取得（安全版）
 * @param {string} userId - ユーザーID
 * @returns {Object} セッション情報
 */
function getUserSession(userId) {
    if (!userSessions.has(userId)) {
        userSessions.set(userId, {
            surveyState: SURVEY_STATES.NONE,
            surveyData: {},
            lastActivity: new Date()
        });
    }
    return userSessions.get(userId);
}

/**
 * ユーザーセッション更新
 * @param {string} userId - ユーザーID
 * @param {Object} updates - 更新内容
 */
function updateUserSession(userId, updates) {
    const session = getUserSession(userId);
    Object.assign(session, updates, { lastActivity: new Date() });
    userSessions.set(userId, session);
    console.log(`📊 セッション更新: ${userId} - ${session.surveyState}`);
}

/**
 * アンケート起動キーワード検知
 * @param {string} messageText - メッセージテキスト
 * @returns {boolean} アンケート起動対象かどうか
 */
function isSurveyTrigger(messageText) {
    const triggers = [
        'アンケート開始',
        'アンケート',
        'プロファイル設定',
        '📋'
    ];
    return triggers.some(trigger => messageText.includes(trigger));
}

/**
 * アンケート処理中かどうか判定
 * @param {Object} session - ユーザーセッション
 * @returns {boolean} アンケート処理中かどうか
 */
function isInSurvey(session) {
    return session.surveyState !== SURVEY_STATES.NONE && 
           session.surveyState !== SURVEY_STATES.COMPLETED;
}

/**
 * QuickReplyメッセージ作成
 * @param {string} text - メッセージテキスト
 * @param {Array} quickReplyItems - QuickReply選択肢
 * @returns {Object} LINE Message Object
 */
function createQuickReplyMessage(text, quickReplyItems) {
    const items = quickReplyItems.map(item => ({
        type: 'action',
        action: {
            type: 'message',
            label: item.label,
            text: item.text
        }
    }));

    return {
        type: 'text',
        text: text,
        quickReply: {
            items: items
        }
    };
}

/**
 * アンケートQ1の選択肢定義
 */
function getSurveyQ1Options() {
    return [
        { label: '🌊 沖縄で何度も経験', text: '沖縄で何度も経験' },
        { label: '🤿 沖縄で1-2回だけ', text: '沖縄で1-2回だけ' },
        { label: '🏖️ 他地域で経験', text: '他地域で経験' },
        { label: '❓ 完全未経験', text: '完全未経験' }
    ];
}

/**
 * アンケートQ1.5の選択肢定義
 */
function getSurveyQ1_5Options() {
    return [
        { label: '🎫 オープンウォーター', text: 'オープンウォーター' },
        { label: '🏆 アドバンス以上', text: 'アドバンス以上' },
        { label: '🔰 体験のみ', text: '体験のみ' },
        { label: '❓ 未取得', text: '未取得' }
    ];
}

/**
 * アンケートQ2の選択肢定義（分岐対応）
 * @param {string} experienceLevel - 経験レベル
 * @returns {Array} 選択肢配列
 */
function getSurveyQ2Options(experienceLevel) {
    if (experienceLevel === '沖縄で何度も経験' || experienceLevel === '沖縄で1-2回だけ') {
        // 沖縄経験者向け
        return [
            { label: '🏝️ 石垣島・八重山', text: '石垣島・八重山' },
            { label: '🌺 宮古島・宮古諸島', text: '宮古島・宮古諸島' },
            { label: '🏖️ 沖縄本島周辺', text: '沖縄本島周辺' },
            { label: '🌊 複数エリア経験', text: '複数エリア経験' }
        ];
    } else if (experienceLevel === '他地域で経験') {
        // 他地域経験者向け
        return [
            { label: '🦈 大物狙い', text: '大物狙い' },
            { label: '🏞️ 地形ダイビング', text: '地形ダイビング' },
            { label: '🐢 癒し系', text: '癒し系' },
            { label: '💙 透明度重視', text: '透明度重視' }
        ];
    } else {
        // 完全未経験者向け
        return [
            { label: '😰 安全面の心配', text: '安全面の心配' },
            { label: '🤿 スキル不安', text: 'スキル不安' },
            { label: '💸 予算の心配', text: '予算の心配' },
            { label: '📋 何から始めるか不明', text: '何から始めるか不明' }
        ];
    }
}

/**
 * アンケート処理メイン関数
 * @param {string} userId - ユーザーID
 * @param {string} messageText - メッセージテキスト
 * @param {Object} event - LINEイベント
 * @returns {boolean} アンケート処理を実行したかどうか
 */
async function handleSurveyFlow(userId, messageText, event) {
    const session = getUserSession(userId);
    
    // アンケート開始トリガー
    if (isSurveyTrigger(messageText) && !isInSurvey(session)) {
        console.log(`📋 アンケート開始: ${userId}`);
        return await startSurvey(userId, event);
    }
    
    // アンケート進行中の処理
    if (isInSurvey(session)) {
        console.log(`📝 アンケート進行中: ${userId} - ${session.surveyState}`);
        return await processSurveyResponse(userId, messageText, event);
    }
    
    return false; // アンケート処理なし
}

/**
 * アンケート開始
 * @param {string} userId - ユーザーID
 * @param {Object} event - LINEイベント
 * @returns {boolean} 処理完了
 */
async function startSurvey(userId, event) {
    updateUserSession(userId, { 
        surveyState: SURVEY_STATES.Q1,
        surveyData: {}
    });
    
    const message = createQuickReplyMessage(
        `🌺 はいさい！\n\n沖縄ダイビングのプロファイル設定をしよう！\n\n【質問1/3】ダイビング経験はどのくらい？`,
        getSurveyQ1Options()
    );
    
    await client.replyMessage(event.replyToken, message);
    console.log(`✅ アンケートQ1送信: ${userId}`);
    return true;
}

/**
 * アンケート回答処理
 * @param {string} userId - ユーザーID
 * @param {string} messageText - メッセージテキスト
 * @param {Object} event - LINEイベント
 * @returns {boolean} 処理完了
 */
async function processSurveyResponse(userId, messageText, event) {
    const session = getUserSession(userId);
    
    switch (session.surveyState) {
        case SURVEY_STATES.Q1:
            return await processSurveyQ1(userId, messageText, event);
        case SURVEY_STATES.Q1_5:
            return await processSurveyQ1_5(userId, messageText, event);
        case SURVEY_STATES.Q2:
            return await processSurveyQ2(userId, messageText, event);
        default:
            console.log(`⚠️ 不明なアンケート状態: ${session.surveyState}`);
            return false;
    }
}

/**
 * Q1: ダイビング経験回答処理
 */
async function processSurveyQ1(userId, messageText, event) {
    const validAnswers = ['沖縄で何度も経験', '沖縄で1-2回だけ', '他地域で経験', '完全未経験'];
    
    if (!validAnswers.includes(messageText)) {
        // 無効な回答の場合、再度質問
        const message = createQuickReplyMessage(
            `選択肢から選んでくださいね！\n\n【質問1/3】ダイビング経験はどのくらい？`,
            getSurveyQ1Options()
        );
        await client.replyMessage(event.replyToken, message);
        return true;
    }
    
    // 回答を保存してQ1.5へ
    updateUserSession(userId, {
        surveyState: SURVEY_STATES.Q1_5,
        surveyData: { experience: messageText }
    });
    
    const message = createQuickReplyMessage(
        `【質問2/3】ダイビングライセンスは？`,
        getSurveyQ1_5Options()
    );
    
    await client.replyMessage(event.replyToken, message);
    console.log(`✅ アンケートQ1.5送信: ${userId} - ${messageText}`);
    return true;
}

/**
 * Q1.5: ライセンス回答処理
 */
async function processSurveyQ1_5(userId, messageText, event) {
    const validAnswers = ['オープンウォーター', 'アドバンス以上', '体験のみ', '未取得'];
    
    if (!validAnswers.includes(messageText)) {
        const message = createQuickReplyMessage(
            `選択肢から選んでくださいね！\n\n【質問2/3】ダイビングライセンスは？`,
            getSurveyQ1_5Options()
        );
        await client.replyMessage(event.replyToken, message);
        return true;
    }
    
    // 回答を保存してQ2へ
    const session = getUserSession(userId);
    const updatedData = { ...session.surveyData, license: messageText };
    
    updateUserSession(userId, {
        surveyState: SURVEY_STATES.Q2,
        surveyData: updatedData
    });
    
    // 分岐質問を生成
    const q2Options = getSurveyQ2Options(session.surveyData.experience);
    let q2Text = '【質問3/3】';
    
    if (session.surveyData.experience === '沖縄で何度も経験' || session.surveyData.experience === '沖縄で1-2回だけ') {
        q2Text += 'どのエリアで潜ったことがある？';
    } else if (session.surveyData.experience === '他地域で経験') {
        q2Text += '沖縄ダイビングで一番興味があることは？';
    } else {
        q2Text += '一番気になることは？';
    }
    
    const message = createQuickReplyMessage(q2Text, q2Options);
    
    await client.replyMessage(event.replyToken, message);
    console.log(`✅ アンケートQ2送信: ${userId} - ${messageText}`);
    return true;
}

/**
 * Q2: 分岐質問回答処理
 */
async function processSurveyQ2(userId, messageText, event) {
    const session = getUserSession(userId);
    const validAnswers = getSurveyQ2Options(session.surveyData.experience).map(opt => opt.text);
    
    if (!validAnswers.includes(messageText)) {
        const q2Options = getSurveyQ2Options(session.surveyData.experience);
        let q2Text = '選択肢から選んでくださいね！\n\n【質問3/3】';
        
        if (session.surveyData.experience === '沖縄で何度も経験' || session.surveyData.experience === '沖縄で1-2回だけ') {
            q2Text += 'どのエリアで潜ったことがある？';
        } else if (session.surveyData.experience === '他地域で経験') {
            q2Text += '沖縄ダイビングで一番興味があることは？';
        } else {
            q2Text += '一番気になることは？';
        }
        
        const message = createQuickReplyMessage(q2Text, q2Options);
        await client.replyMessage(event.replyToken, message);
        return true;
    }
    
    // アンケート完了
    const finalData = { ...session.surveyData, q2_answer: messageText };
    
    updateUserSession(userId, {
        surveyState: SURVEY_STATES.COMPLETED,
        surveyData: finalData
    });
    
    // データベースへの保存を試行
    if (databaseAvailable && databaseFunctions.saveSurveyToDatabase) {
        try {
            const saveResult = await databaseFunctions.saveSurveyToDatabase(userId, finalData);
            if (saveResult.success && !saveResult.skipped) {
                console.log(`📊 アンケートデータDB保存成功: ${userId} - ${saveResult.action}`);
            } else if (saveResult.skipped) {
                console.log(`ℹ️ アンケートDB保存スキップ: ${userId}`);
            } else {
                console.log(`⚠️ アンケートDB保存失敗: ${userId} - ${saveResult.error}`);
            }
        } catch (error) {
            console.log(`⚠️ アンケートDB保存例外: ${userId} - ${error.message}`);
        }
    }
    
    // 完了メッセージ（経験レベル別）
    let completionMessage = generateSurveyCompletionMessage(finalData);
    
    await client.replyMessage(event.replyToken, {
        type: 'text',
        text: completionMessage
    });
    
    console.log(`🎉 アンケート完了: ${userId}`, finalData);
    return true;
}

/**
 * アンケート完了メッセージ生成
 * @param {Object} surveyData - アンケートデータ
 * @returns {string} 完了メッセージ
 */
function generateSurveyCompletionMessage(surveyData) {
    const baseMessage = `🎉 アンケート完了！ありがとう！\n\n`;
    
    if (surveyData.experience === '沖縄で何度も経験' || surveyData.experience === '沖縄で1-2回だけ') {
        return baseMessage + `${surveyData.q2_answer}での経験があるんですね！\n今回はさらに深く沖縄の海を楽しんでもらえるよう、前回とは違った魅力を持つショップやポイントをご提案できそうです✨\n\n何でも気軽に相談してください！\n「ショップをマッチング」と送ってもらえれば、あなたにピッタリのショップを3つ厳選してご提案しますよ🌊`;
    } else if (surveyData.experience === '他地域で経験') {
        return baseMessage + `他の海でのダイビング経験があるんですね！\n沖縄の海は世界的にも特別な美しさで、きっと感動してもらえると思います！\n\n${surveyData.q2_answer}がお好みということなので、沖縄特有の魅力をたっぷりお伝えしますね🦈\n\n「ショップをマッチング」でお聞かせいただければ、あなたの経験を活かせる最適なショップをご提案します🏝️`;
    } else {
        return baseMessage + `初めてのダイビング、ワクワクしますね！\n\n${surveyData.q2_answer}のお気持ち、とてもよく分かります。沖縄には初心者に本当に優しいショップがたくさんあるので、一つずつ不安を解消していきましょう！\n\nどんな小さなことでも遠慮なく聞いてください！\n準備ができたら「ショップをマッチング」で初心者に最適なショップをご紹介しますね🤿`;
    }
}

// データベース機能（エラー耐性強化版）
let databaseFunctions = null;
let databaseAvailable = false;

try {
    databaseFunctions = require('./src/database');
    databaseAvailable = true;
    console.log('✅ データベース機能利用可能');
} catch (error) {
    console.log('⚠️ データベース機能無効 - 基本機能のみで動作:', error.message);
    databaseAvailable = false;
}

// LINE設定
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

// OpenAI設定（オプショナル）
let openai = null;
let openaiAvailable = false;

try {
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-your_openai_api_key_here') {
        openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        openaiAvailable = true;
        console.log('✅ OpenAI利用可能');
    } else {
        console.log('⚠️ OpenAI無効 - 固定応答モードで動作');
        openaiAvailable = false;
    }
} catch (error) {
    console.log('⚠️ OpenAI初期化失敗 - 固定応答モードで動作:', error.message);
    openaiAvailable = false;
}

// ===== データベース安全操作ヘルパー関数 =====

/**
 * 安全にデータベース関数を実行
 * @param {string} functionName - 実行する関数名
 * @param {...any} args - 引数
 * @returns {Object} 実行結果
 */
async function safeDbOperation(functionName, ...args) {
    if (!databaseAvailable || !databaseFunctions || !databaseFunctions[functionName]) {
        console.log(`ℹ️ DB操作スキップ (${functionName}): データベース無効`);
        return { success: false, skipped: true, data: null };
    }
    
    try {
        const result = await databaseFunctions[functionName](...args);
        return result;
    } catch (error) {
        console.error(`❌ DB操作エラー (${functionName}):`, error.message);
        return { success: false, error: error.message, data: null };
    }
}

/**
 * ユーザープロファイル取得（安全版）
 * @param {string} userId - ユーザーID
 * @returns {Object|null} ユーザープロファイル
 */
async function getUserProfileSafe(userId) {
    const result = await safeDbOperation('getUserProfile', userId);
    return result.success ? result.data : null;
}

/**
 * 会話履歴取得（安全版）
 * @param {string} userId - ユーザーID
 * @param {number} limit - 取得件数
 * @returns {Array} 会話履歴
 */
async function getConversationHistorySafe(userId, limit = 20) {
    const result = await safeDbOperation('getConversationHistory', userId, limit);
    return result.success ? result.data : [];
}

/**
 * 会話保存（安全版）
 * @param {string} userId - ユーザーID
 * @param {string} messageType - メッセージタイプ
 * @param {string} content - 内容
 */
async function saveConversationSafe(userId, messageType, content) {
    await safeDbOperation('saveConversation', userId, messageType, content, `session_${Date.now()}`, {});
}

/**
 * ユーザー存在確認（安全版）
 * @param {string} userId - ユーザーID
 * @returns {boolean} 存在するかどうか
 */
async function userExistsSafe(userId) {
    const result = await safeDbOperation('userExists', userId);
    return result.success ? result.data : false;
}

// ===== シンプルなLINE Webhook処理 =====

// Webhook検証用
app.get('/webhook', (req, res) => {
    console.log('📡 LINE Webhook検証リクエスト受信');
    res.status(200).send('LINE Webhook endpoint is active');
});

app.post('/webhook', line.middleware(config), async (req, res) => {
    try {
        const events = req.body.events;
        console.log(`📥 Webhook受信: ${events.length}件のイベント`);

        const promises = events.map(async (event) => {
            if (event.type === 'message' && event.message.type === 'text') {
                return await handleTextMessage(event);
            }
            
            if (event.type === 'follow') {
                return await handleFollowEvent(event);
            }
        });

        await Promise.all(promises);
        res.status(200).end();

    } catch (error) {
        console.error('❌ Webhook処理エラー:', error);
        res.status(500).end();
    }
});

/**
 * テキストメッセージ処理
 */
async function handleTextMessage(event) {
    const lineUserId = event.source.userId;
    const messageText = event.message.text;

    try {
        console.log(`💬 メッセージ受信: ${lineUserId} - ${messageText}`);
        
        // 🔴 アンケート処理の優先チェック（既存機能を壊さない安全な追加）
        const surveyHandled = await handleSurveyFlow(lineUserId, messageText, event);
        if (surveyHandled) {
            console.log(`📋 アンケート処理完了: ${lineUserId}`);
            return; // アンケート処理が完了したら通常処理をスキップ
        }
        
        // 1. ユーザープロファイルとデータ取得（安全版）
        let userProfile = null;
        let conversationHistory = [];
        let pastExperiences = [];
        let divingPlans = [];
        
        if (databaseAvailable) {
            console.log(`🔍 ユーザーデータ取得中: ${lineUserId}`);
            
            // ユーザー存在確認・新規作成
            const exists = await userExistsSafe(lineUserId);
            if (!exists) {
                console.log(`🆕 新規ユーザー登録: ${lineUserId}`);
                await safeDbOperation('createUserProfile', lineUserId, {
                    name: null,
                    diving_experience: null,
                    license_type: null,
                    preferences: {}
                });
            }
            
            // データ取得
            userProfile = await getUserProfileSafe(lineUserId);
            conversationHistory = await getConversationHistorySafe(lineUserId, 20);
            
            // 過去体験・計画の抽出
            pastExperiences = extractPastExperiences(conversationHistory);
            divingPlans = extractDivingPlans(conversationHistory);
            
            console.log(`📊 データ取得完了: プロファイル=${userProfile ? 'あり' : 'なし'}, 会話履歴=${conversationHistory.length}件`);
        } else {
            console.log(`ℹ️ データベース無効 - 基本モードで動作`);
        }
        
        // 2. AI応答生成（OpenAI利用可能な場合はAI、そうでなければ固定応答）
        let aiResponse;
        if (openaiAvailable) {
            aiResponse = await generateAIResponse(messageText, userProfile, conversationHistory, pastExperiences, divingPlans);
        } else {
            aiResponse = generateFixedResponse(messageText, userProfile, pastExperiences);
        }

        // 3. 会話履歴保存（安全版）
        if (databaseAvailable) {
            await saveConversationSafe(lineUserId, 'user', messageText);
            await saveConversationSafe(lineUserId, 'assistant', aiResponse);
        }

        // 4. LINE応答送信
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: aiResponse
        });

        console.log(`✅ 応答送信完了: ${lineUserId}`);

    } catch (error) {
        console.error(`❌ メッセージ処理エラー: ${lineUserId}`, error);
        
        // エラー時のフォールバック応答
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'すみません、一時的にエラーが発生しました。もう一度お試しください。🙏'
        });
    }
}

/**
 * フォロー（友だち追加）イベント処理
 */
async function handleFollowEvent(event) {
    const lineUserId = event.source.userId;
    
    try {
        console.log(`👋 新規フォロー: ${lineUserId}`);
        
        const welcomeMessage = `🌺 はいさい！Jijiだよ！

沖縄ダイビングの専属バディとして
サポートさせてもらうね🤿

石垣島・宮古島・沖縄本島・久米島・西表島・与那国島の
全ポイントから、あなたにピッタリの
ダイビング体験をご提案します！

🏝️ どんなダイビングがお好み？
🤿 ダイビング経験はどのくらい？
🌊 気になる沖縄のエリアはある？

なんでも気軽に聞いてくださいね！
一緒に最高の沖縄ダイビングを楽しもう✨`;

        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: welcomeMessage
        });

    } catch (error) {
        console.error(`❌ フォローイベント処理エラー: ${lineUserId}`, error);
    }
}

/**
 * 過去のダイビング体験を抽出
 * @param {Array} conversationHistory - 会話履歴
 * @returns {Array} 体験情報
 */
function extractPastExperiences(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) return [];
    
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
                conv.message_content && conv.message_content.includes(keyword)
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
    if (!conversationHistory || conversationHistory.length === 0) return [];
    
    const plans = [];
    const planKeywords = [
        '明日', '来週', '今度', '予約', '行く予定', '行きます',
        '計画', 'プラン', '旅行', 'ツアー', '予定'
    ];
    const divingKeywords = ['ダイビング', '沖縄', '石垣', '宮古', '潜り'];
    
    conversationHistory.forEach(conv => {
        if (conv.message_type === 'user') {
            const hasPlan = planKeywords.some(keyword => 
                conv.message_content && conv.message_content.includes(keyword)
            );
            const hasDiving = divingKeywords.some(keyword => 
                conv.message_content && conv.message_content.includes(keyword)
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
 * OpenAI GPT-4oによるAI応答生成
 * @param {string} currentMessage - 現在のメッセージ
 * @param {Object} userProfile - ユーザープロファイル（nullでも可）
 * @param {Array} conversationHistory - 会話履歴
 * @param {Array} pastExperiences - 過去のダイビング体験
 * @param {Array} divingPlans - ダイビング予定
 * @returns {string} AI応答
 */
async function generateAIResponse(currentMessage, userProfile, conversationHistory, pastExperiences, divingPlans) {
    try {
        // システムプロンプト生成（基本ペルソナ）
        const systemPrompt = generateSystemPrompt(userProfile, conversationHistory, pastExperiences, divingPlans);

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: currentMessage }
            ],
            max_completion_tokens: 1000,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
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
 * OpenAI無効時の固定応答生成
 * @param {string} messageText - ユーザーメッセージ
 * @param {Object} userProfile - ユーザープロファイル（nullでも可）
 * @param {Array} pastExperiences - 過去のダイビング体験
 * @returns {string} 固定応答
 */
function generateFixedResponse(messageText, userProfile, pastExperiences) {
    const message = messageText.toLowerCase();
    
    // 基本的な挨拶パターン
    if (message.includes('こんにちは') || message.includes('はじめまして') || message.includes('こんばんは')) {
        return `🌺 はいさい！Jijiだよ！\n\n沖縄ダイビングのことなら何でも聞いてね！\n石垣島・宮古島・沖縄本島・久米島・西表島・与那国島の\n全ポイントから、あなたにピッタリの\nダイビング体験をご提案するよ！🤿✨\n\nどんなダイビングがお好み？🌊`;
    }
    
    // マンタ関連
    if (message.includes('マンタ')) {
        return `🦈 マンタといえば石垣島が一番！\n\n「川平石崎」と「マンタスクランブル」では\n遭遇率なんと90%を誇ってるよ！\n\n特に3-11月がベストシーズンで、\n優雅に泳ぐマンタの姿は一生の思い出になるはず✨\n\n石垣島のマンタツアー、おすすめのショップも\n紹介できるから聞いてね！🏝️`;
    }
    
    // 初心者向け
    if (message.includes('初心者') || message.includes('はじめて') || message.includes('初回')) {
        return `🌊 初めてのダイビングなら青の洞窟がおすすめ！\n\n真栄田岬の青の洞窟は浅くて穏やかで、\n神秘的な青い光に包まれる体験は最高だよ💙\n\n初心者さんでも安心してダイビングを\n楽しめるポイントです！\n\n他にも慶良間諸島や石垣島の米原など、\n初心者向けの素晴らしいポイントがたくさん！\n\nどのエリアに興味がある？🐠`;
    }
    
    // 石垣島関連
    if (message.includes('石垣島') || message.includes('石垣')) {
        return `🏝️ 石垣島は沖縄ダイビングの聖地！\n\n【おすすめポイント】\n🦈 川平石崎・マンタスクランブル（マンタ）\n🐠 米原（初心者向けサンゴ礁）\n🌊 白保（美しいサンゴ礁）\n\n特にマンタシーズン（3-11月）は絶対見逃せない！\n6-8月にはジンベエザメにも会えるかも？✨\n\n石垣島のダイビング、詳しく知りたいポイントある？`;
    }
    
    // 宮古島関連
    if (message.includes('宮古島') || message.includes('宮古')) {
        return `🌊 宮古島は地形ダイビングの宝庫！\n\n【絶対行くべきポイント】\n🕳️ 下地島（ドロップオフ・地形）\n🐠 八重干瀬（日本最大のサンゴ礁）\n🌀 通り池（神秘的な洞窟）\n🏛️ アントニオガウディ（アーチ地形）\n\n透明度抜群で、ダイナミックな地形が楽しめる\n上級者にも初心者にも人気のエリアだよ！\n\nどの地形ポイントに興味がある？🤿`;
    }
    
    // 沖縄本島関連
    if (message.includes('沖縄本島') || message.includes('本島') || message.includes('慶良間') || message.includes('青の洞窟')) {
        return `🐢 沖縄本島なら慶良間と青の洞窟が最高！\n\n【人気ポイント】\n💙 青の洞窟（真栄田岬）\n🐢 慶良間諸島（ウミガメ・透明度抜群）\n🌊 万座（ドロップオフ）\n\n慶良間諸島は「ケラマブルー」と呼ばれる\n美しい海で、ウミガメ遭遇率も85%！\n\nアクセスも良くて、那覇から日帰りで\n楽しめるのも魅力だね✨\n\nどっちのエリアが気になる？`;
    }
    
    // ダイビング経験について
    if (message.includes('経験') || message.includes('ライセンス') || message.includes('資格')) {
        return `🤿 ダイビング経験について教えて！\n\n【レベル別おすすめ】\n🔰 初心者・体験：青の洞窟、米原\n📖 OW〜AOW：慶良間、石垣島\n🏆 上級者：宮古島地形、与那国島\n\nあなたのダイビング経験はどのくらい？\nライセンスは持ってる？\n\n経験に合わせて最適なポイントを\n提案させてもらうよ！🌺`;
    }
    
    // 季節・時期について
    if (message.includes('いつ') || message.includes('時期') || message.includes('季節') || message.includes('ベスト')) {
        const currentMonth = new Date().getMonth() + 1;
        let seasonInfo = '';
        
        if (currentMonth >= 6 && currentMonth <= 8) {
            seasonInfo = `今の時期（6-8月）はベストシーズン！\n☀️ 海況安定・透明度最高\n🦈 ジンベエザメシーズン\n🌊 全エリアでダイビング可能`;
        } else if (currentMonth >= 3 && currentMonth <= 5) {
            seasonInfo = `今の時期（3-5月）は穴場シーズン！\n🌸 過ごしやすい気候\n🦈 マンタシーズン開始\n💰 料金も安めでお得`;
        } else if (currentMonth >= 9 && currentMonth <= 11) {
            seasonInfo = `今の時期（9-11月）は透明度抜群！\n🍂 台風後のクリアな海\n🦈 秋マンタが活発\n😌 混雑も落ち着く`;
        } else {
            seasonInfo = `今の時期（冬季）は与那国がアツい！\n🦈 ハンマーヘッドシーズン\n🐋 ホエールウォッチング\n💰 料金安い穴場時期`;
        }
        
        return `📅 沖縄ダイビングの時期について！\n\n${seasonInfo}\n\n沖縄は年中ダイビングが楽しめるけど、\n目的によってベストシーズンが違うよ！\n\n何か見たい生物とかある？🐠`;
    }
    
    // 一般的な応答
    return `🌺 はいさい！沖縄ダイビングのことなら\nJijiにお任せ！\n\n石垣島・宮古島・沖縄本島・久米島・西表島・与那国島の\n全ポイントから、あなたにピッタリの\nダイビング体験をご提案するよ🤿\n\n🦈 マンタが見たい？\n🐢 ウミガメと泳ぎたい？\n🕳️ 地形ダイビングに挑戦？\n💙 青の洞窟を体験？\n\n何でも気軽に聞いてね！✨`;
}

// ===== ヘルスチェック =====

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'Jiji沖縄ダイビングバディ',
        version: 'AI-integrated-1.0.0',
        features: ['OpenAI GPT-4o', 'Jijiペルソナ', '沖縄ダイビング専門'],
        timestamp: new Date().toISOString()
    });
});

// ===== サーバー起動 =====

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log('\n🎉=====================================');
    console.log('🚀 Jiji沖縄ダイビングバディ起動完了！');
    console.log('🤖 シンプル版 v1.0.0');
    console.log('=====================================');
    console.log(`📡 サーバー: http://localhost:${PORT}`);
    console.log(`🤖 Webhook: http://localhost:${PORT}/webhook`);
    console.log(`🏝️ 対応エリア: 石垣島、宮古島、沖縄本島、久米島、西表島、与那国島`);
    console.log('=====================================🎉\n');
});