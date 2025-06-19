/**
 * Jiji沖縄ダイビングバディ - メッセージ処理ハンドラー（Glitch対応版）
 * ユーザーメッセージの処理とAI応答生成
 */

// src/message-handler.js

const OpenAI = require('openai');
const {
    // jiji-persona.jsから、プロンプト生成関数と知識ベース関数をインポート
    generateSystemPrompt,
    getRecommendedSpots,
    getMarineLifeInfo
} = require('./jiji-persona.js');

const {
    // database.jsから、データベース操作関数をインポート
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    saveConversation,
    getConversationHistory,
    userExists
} = require('./database.js');

// OpenAIクライアントを初期化
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// === AIに利用させるツール（関数）の定義 ===
const tools = [
    {
        type: "function",
        function: {
            name: "update_user_profile_in_db",
            description: "ユーザーのダイビング経験、Cカードランク、名前、興味のあるエリアなどのプロフィール情報をデータベースに保存または更新する。",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "ユーザーの名前。例: 田中" },
                    diving_experience: { type: "string", enum: ["beginner", "open_water", "advanced", "pro"], description: "ユーザーのダイビング経験レベル。" },
                    license_type: { type: "string", enum: ["OWD", "AOW", "RED", "DM"], description: "ユーザーが保持しているCカードのランク。" },
                    interested_areas: { type: "array", items: { type: "string" }, description: "ユーザーが興味を示している沖縄のダイビングエリア。例: ['石垣島', '慶良間']" }
                },
                required: [],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_diving_spot_recommendation",
            description: "ユーザーの経験レベルや興味のあるエリアに基づいて、おすすめのダイビングスポット情報を検索して返す。",
            parameters: {
                type: "object",
                properties: {
                    level: { type: "string", enum: ["beginner", "intermediate", "advanced"], description: "ダイビングの経験レベル" },
                    area: { type: "string", description: "興味のある特定のエリア名。例: 石垣島" }
                },
                required: ["level"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "get_marine_life_information",
            description: "特定の海洋生物（マンタ、ウミガメなど）に関する情報（見られる場所、ベストシーズンなど）を検索して返す。",
            parameters: {
                type: "object",
                properties: {
                    life_form_name: { type: "string", description: "情報を知りたい海洋生物の名前。例: マンタ" }
                },
                required: ["life_form_name"],
            },
        },
    }
];

/**
 * ユーザーメッセージのメイン処理関数
 */
async function processUserMessage(lineUserId, messageText) {
    try {
        console.log(`📨 メッセージ処理開始: ${lineUserId} - "${messageText}"`);

        // 1. ユーザープロファイルと会話履歴を取得（なければ新規作成）
        const userProfile = await getOrCreateUserProfile(lineUserId);
        const conversationHistory = await getConversationHistory(lineUserId, 10);
        await saveConversation(lineUserId, 'user', messageText, null); // ユーザーのメッセージを先に保存

        // 2. AIに渡すためのメッセージ履歴をフォーマット
        const messages = formatMessagesForAI(userProfile, conversationHistory, messageText);
        
        // 3. OpenAI APIを呼び出し（ツール使用を許可）
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            tools: tools,
            tool_choice: "auto",
        });

        const responseMessage = response.choices[0].message;

        // 4. AIがツールの使用を決定したか確認
        if (responseMessage.tool_calls) {
            // ツール実行結果を含めて、再度AIに最終応答を生成させる
            const finalResponse = await handleToolCalls(lineUserId, messages, responseMessage.tool_calls);
            await saveConversation(lineUserId, 'assistant', finalResponse, null);
            return finalResponse;
        }

        // 5. 通常のテキスト応答を保存して返す
        const aiResponseText = responseMessage.content;
        await saveConversation(lineUserId, 'assistant', aiResponseText, null);
        console.log(`🤖 AI応答生成完了: ${lineUserId}`);
        return aiResponseText;

    } catch (error) {
        console.error('❌ メッセージ処理全体のエラー:', error);
        return 'すみません、一時的にエラーが発生しました。もう一度お試しください。🙏';
    }
}

/**
 * AIからのツール呼び出し要求を処理する
 */
async function handleToolCalls(lineUserId, messages, toolCalls) {
    // 実行したツールの結果を格納する配列
    const toolResponses = [];

    for (const toolCall of toolCalls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        let functionResponse;

        console.log(`🔄 AIがツール「${functionName}」を実行します。引数:`, functionArgs);

        // 関数名に応じて、実際に定義した関数を実行
        switch (functionName) {
            case "update_user_profile_in_db":
                await updateUserProfile(lineUserId, functionArgs);
                functionResponse = { success: true, message: "プロフィールを更新しました。" };
                break;
            case "get_diving_spot_recommendation":
                functionResponse = getRecommendedSpots(functionArgs.level, functionArgs.area);
                break;
            case "get_marine_life_information":
                functionResponse = getMarineLifeInfo(functionArgs.life_form_name);
                break;
            default:
                functionResponse = { error: "Unknown function" };
        }
        
        // ツール実行結果を整形して配列に追加
        toolResponses.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: JSON.stringify(functionResponse), // 結果をJSON文字列として渡す
        });
    }

    // 元の会話履歴に、AIの思考（tool_calls）とツールの実行結果を追加
    const newMessages = [
        ...messages,
        ...toolCalls.map(toolCall => ({ role: 'assistant', tool_calls: [toolCall] })), // AIの思考を履歴に追加
        ...toolResponses // ツールの実行結果を履歴に追加
    ];

    // 更新された会話履歴で、再度AIに最終的な自然言語の応答を生成させる
    const secondResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: newMessages,
    });

    return secondResponse.choices[0].message.content;
}

// --------------------------------
// ヘルパー関数
// --------------------------------

async function getOrCreateUserProfile(lineUserId) {
    if (!(await userExists(lineUserId))) {
        console.log(`🆕 新規ユーザー登録: ${lineUserId}`);
        await createUserProfile(lineUserId, {});
    }
    const profileResult = await getUserProfile(lineUserId);
    return profileResult.data;
}

function formatMessagesForAI(userProfile, conversationHistory, currentMessage) {
    const systemPrompt = generateSystemPrompt(userProfile, conversationHistory);
    const formattedHistory = conversationHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant', // DBのroleをAIのroleにマッピング
        content: msg.content,
    }));
    return [
        { role: "system", content: systemPrompt },
        ...formattedHistory,
        { role: "user", content: currentMessage },
    ];
}

module.exports = {
    processUserMessage
};