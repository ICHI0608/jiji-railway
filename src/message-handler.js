/**
 * Jiji沖縄ダイビングバディ - V2.8 メッセージ処理ハンドラー
 * LINE Bot完結型・Web知識ベース統合対応
 * ユーザーメッセージの処理とAI応答生成
 */

const OpenAI = require('openai');
const { generateSystemPrompt } = require('./jiji-persona');
const {
    createUserProfile,
    getUserProfile,
    updateUserProfile,
    saveConversation,
    getConversationHistory,
    userExists,
    // V2.8 追加: 新しいデータベース関数
    getShopReviews,
    calculateShopAverageRatings,
    getUserPointBalance,
    createMemberProfile
} = require('./database');

// V2.8 追加: アンケート・リッチメニュー統合
const { surveyManager } = require('./survey-manager');
const { richMenuManager } = require('./rich-menu-manager');

// OpenAI設定
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// ===== V2.8 追加: Web知識ベース統合 =====

/**
 * V2.8: Web知識ベース参照システム
 */
class WebKnowledgeBase {
    constructor() {
        // 知識ベースカテゴリ定義
        this.categories = {
            shops: {
                keywords: ['ショップ', '店舗', 'ダイビングセンター', '予約', '口コミ', '評価'],
                handler: this.getShopKnowledge.bind(this)
            },
            travel: {
                keywords: ['宿泊', 'ホテル', '交通', '航空券', '旅行', '予算', 'アクセス'],
                handler: this.getTravelKnowledge.bind(this)
            },
            weather: {
                keywords: ['天気', '海況', '波', '風', '台風', 'シーズン', '時期'],
                handler: this.getWeatherKnowledge.bind(this)
            },
            guide: {
                keywords: ['初心者', 'ライセンス', '器材', '準備', '安全', 'コツ'],
                handler: this.getGuideKnowledge.bind(this)
            },
            area: {
                keywords: ['石垣島', '宮古島', '沖縄本島', '慶良間', '久米島', '西表島', '与那国'],
                handler: this.getAreaKnowledge.bind(this)
            }
        };
    }

    /**
     * メッセージ内容を分析してWeb知識ベースから関連情報を取得
     * @param {string} message - ユーザーメッセージ
     * @param {Object} userProfile - ユーザープロファイル
     * @returns {Object} 知識ベース情報
     */
    async gatherKnowledge(message, userProfile) {
        const knowledge = {
            categories_matched: [],
            shop_info: null,
            travel_info: null,
            weather_info: null,
            guide_info: null,
            area_info: null,
            total_references: 0
        };

        // カテゴリマッチング
        for (const [category, config] of Object.entries(this.categories)) {
            const hasKeyword = config.keywords.some(keyword => 
                message.toLowerCase().includes(keyword.toLowerCase())
            );

            if (hasKeyword) {
                knowledge.categories_matched.push(category);
                try {
                    const categoryData = await config.handler(message, userProfile);
                    knowledge[`${category}_info`] = categoryData;
                    knowledge.total_references++;
                } catch (error) {
                    console.error(`❌ ${category}知識ベース取得エラー:`, error);
                }
            }
        }

        console.log(`📚 Web知識ベース参照: ${knowledge.categories_matched.join(', ')} (${knowledge.total_references}件)`);
        return knowledge;
    }

    /**
     * ショップ関連知識取得
     */
    async getShopKnowledge(message, userProfile) {
        // エリア特定
        const areas = ['石垣島', '宮古島', '沖縄本島', '慶良間'];
        const targetArea = areas.find(area => message.includes(area)) || '石垣島';

        // ダミーデータ（実際はデータベースから取得）
        return {
            area: targetArea,
            shop_count: targetArea === '石垣島' ? 44 : 35,
            top_rated_shops: [
                {
                    name: `${targetArea}プレミアムダイビング`,
                    rating: 4.8,
                    review_count: 89,
                    features: ['初心者歓迎', 'マンタポイント', '少人数制'],
                    subscription_plan: 'premium'
                }
            ],
            knowledge_base_url: `https://jiji-diving.com/shops-database/${targetArea.toLowerCase()}`
        };
    }

    /**
     * 旅行関連知識取得
     */
    async getTravelKnowledge(message, userProfile) {
        const area = this.extractArea(message) || '石垣島';
        
        return {
            area: area,
            accommodation: {
                budget_range: '¥3,000-15,000/泊',
                recommendations: ['民宿', 'ゲストハウス', 'リゾートホテル'],
                booking_tips: '早期予約で30%OFF'
            },
            transportation: {
                flight_cost: '¥25,000-45,000（往復）',
                local_transport: 'レンタカー推奨',
                pickup_service: '多くのショップで送迎あり'
            },
            knowledge_base_url: `https://jiji-diving.com/travel-guide/${area.toLowerCase()}`
        };
    }

    /**
     * 天気・海況知識取得
     */
    async getWeatherKnowledge(message, userProfile) {
        const area = this.extractArea(message) || '石垣島';
        const currentSeason = this.getCurrentSeason();
        
        return {
            area: area,
            current_season: currentSeason,
            diving_conditions: currentSeason === 'summer' ? '最高' : '良好',
            best_months: ['4月', '5月', '9月', '10月'],
            typhoon_season: '7-9月（要注意）',
            water_temperature: currentSeason === 'summer' ? '27-29°C' : '24-26°C',
            knowledge_base_url: `https://jiji-diving.com/weather-ocean/${area.toLowerCase()}`
        };
    }

    /**
     * ガイド・初心者向け知識取得
     */
    async getGuideKnowledge(message, userProfile) {
        const experience = userProfile?.diving_experience || 'none';
        
        return {
            user_level: experience,
            beginner_tips: [
                '不安は誰でも感じるもの',
                'インストラクターが必ず付きます',
                '呼吸を忘れずに',
                '無理は禁物'
            ],
            safety_reminders: [
                '体調管理',
                '前日の飲酒を控える',
                '持病がある場合は事前申告'
            ],
            preparation_list: ['水着', 'タオル', '日焼け止め', '着替え'],
            knowledge_base_url: 'https://jiji-diving.com/diving-blog/beginner-guide'
        };
    }

    /**
     * エリア特化知識取得
     */
    async getAreaKnowledge(message, userProfile) {
        const area = this.extractArea(message) || '石垣島';
        
        const areaData = {
            '石垣島': {
                highlights: ['マンタポイント', '川平湾', '美しい珊瑚礁'],
                dive_sites: ['川平石崎', 'マンタスクランブル', 'リンクモンスター'],
                best_for: '初心者からベテランまで',
                season_info: '年中ダイビング可能'
            },
            '宮古島': {
                highlights: ['地形ダイビング', '透明度抜群', 'ウミガメ遭遇'],
                dive_sites: ['魔王の宮殿', 'アーチ', '下地島'],
                best_for: '中級者以上推奨',
                season_info: '4-10月がベストシーズン'
            }
        };

        return {
            area: area,
            info: areaData[area] || areaData['石垣島'],
            knowledge_base_url: `https://jiji-diving.com/area-guide/${area.toLowerCase()}`
        };
    }

    /**
     * メッセージからエリアを抽出
     */
    extractArea(message) {
        const areas = ['石垣島', '宮古島', '沖縄本島', '慶良間', '久米島', '西表島', '与那国'];
        return areas.find(area => message.includes(area));
    }

    /**
     * 現在の季節を取得
     */
    getCurrentSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 6 && month <= 9) return 'summer';
        if (month >= 10 || month <= 2) return 'winter';
        return 'spring_autumn';
    }
}

// V2.8: Web知識ベースインスタンス
const webKnowledgeBase = new WebKnowledgeBase();

/**
 * V2.8: ユーザーメッセージを処理してAI応答を生成
 * Web知識ベース統合・LINE Bot完結型対応
 * @param {string} lineUserId - LINEユーザーID
 * @param {string} messageText - ユーザーのメッセージ
 * @param {string} sessionId - セッションID（オプション）
 * @returns {string} AI応答
 */
async function processUserMessage(lineUserId, messageText, sessionId = null) {
    try {
        console.log(`📨 V2.8 メッセージ受信: ${lineUserId} - ${messageText}`);

        // 🔍 V2.8: アンケート・リッチメニュー処理の優先判定
        const specialResponse = await handleSpecialMessages(lineUserId, messageText);
        if (specialResponse) {
            return specialResponse;
        }

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
            
            // V2.8: 会員プロフィール作成
            await createMemberProfile(lineUserId);
            
            // 🔥 新規ユーザーは必須アンケート開始
            const surveyResponse = await surveyManager.startSurvey(lineUserId, true);
            return formatResponseMessage(surveyResponse);
        }

        // 2. ユーザーメッセージをデータベースに保存
        let userProfile = null;
        let conversationHistory = [];
        let currentPoints = 0;
        let webKnowledge = { shops: '', travel: '', weather: '', diving: '' };
        
        try {
            await saveConversation(lineUserId, 'user', messageText, sessionId, {
                v28_enabled: true,
                knowledge_base_integrated: true
            });

            // 3. ユーザープロファイル取得
            const profileResult = await getUserProfile(lineUserId);
            userProfile = profileResult.success ? profileResult.data : null;

            // 4. 会話履歴取得と分析（最新20件）
            const historyResult = await getConversationHistory(lineUserId, 20);
            conversationHistory = historyResult.success ? historyResult.data : [];

            // 6. V2.8: ユーザーポイント残高取得
            const pointBalance = await getUserPointBalance(lineUserId);
            currentPoints = pointBalance.success ? pointBalance.data : 0;
        } catch (dbError) {
            console.error('❌ データベース処理エラー（処理継続）:', dbError.message);
        }
        
        // 過去体験の抽出
        const pastExperiences = extractPastExperiences(conversationHistory);
        const divingPlans = extractDivingPlans(conversationHistory);

        // 5. V2.8: Web知識ベース統合参照
        try {
            webKnowledge = await webKnowledgeBase.gatherKnowledge(messageText, userProfile);
        } catch (kbError) {
            console.error('❌ 知識ベース処理エラー（処理継続）:', kbError.message);
        }

        // 7. プロファイル情報の自動更新チェック
        let updatedProfile = userProfile;
        try {
            updatedProfile = await checkAndUpdateProfile(lineUserId, messageText, userProfile);
        } catch (profileError) {
            console.error('❌ プロファイル更新エラー（処理継続）:', profileError.message);
        }

        // 8. 重複回答分析（新機能）
        const recentResponses = extractRecentResponses(conversationHistory, 5);
        const conversationContext = analyzeConversationContext(conversationHistory, messageText);
        
        // 9. V2.8: 統合AI応答生成（Web知識ベース統合 + 重複防止）
        const aiResponse = await generateV28AIResponse(
            messageText, 
            updatedProfile || userProfile, 
            conversationHistory, 
            pastExperiences, 
            divingPlans,
            webKnowledge,
            currentPoints,
            recentResponses,
            conversationContext
        );

        // 9. AI応答をデータベースに保存
        try {
            await saveConversation(lineUserId, 'assistant', aiResponse, sessionId, {
                v28_enabled: true,
                knowledge_base_used: webKnowledge.categories_matched,
                knowledge_references: webKnowledge.total_references
            });
        } catch (saveError) {
            console.error('❌ AI応答保存エラー（処理継続）:', saveError.message);
        }

        console.log(`🤖 V2.8 AI応答生成完了: ${lineUserId} (知識ベース: ${webKnowledge.total_references || 0}件参照)`);
        return aiResponse;

    } catch (error) {
        console.error('❌ V2.8 メッセージ処理エラー:', error);
        return 'すみません、一時的にエラーが発生しました。僕がもう一度確認してみますね。🙏';
    }
}

/**
 * 過去の応答を抽出して重複防止に活用
 * @param {Array} conversationHistory - 会話履歴
 * @param {number} limit - 取得する応答数
 * @returns {Array} 最近の応答情報
 */
function extractRecentResponses(conversationHistory, limit = 5) {
    const recentResponses = conversationHistory
        .filter(conv => conv.message_type === 'assistant')
        .slice(-limit)
        .map(conv => ({
            content: conv.message_content,
            timestamp: conv.timestamp,
            length: conv.message_content.length,
            keywords: extractKeywords(conv.message_content)
        }));
    
    return recentResponses;
}

/**
 * 会話の文脈を分析
 * @param {Array} conversationHistory - 会話履歴
 * @param {string} currentMessage - 現在のメッセージ
 * @returns {Object} 文脈情報
 */
function analyzeConversationContext(conversationHistory, currentMessage) {
    const recentMessages = conversationHistory.slice(-10); // 最新10件
    
    // 話題の継続性を分析
    const topicContinuity = analyzeTopic(recentMessages, currentMessage);
    
    // 質問の種類を判定
    const questionType = classifyQuestion(currentMessage);
    
    // 会話の段階を判定
    const conversationStage = determineConversationStage(recentMessages);
    
    return {
        topicContinuity,
        questionType,
        conversationStage,
        messageCount: conversationHistory.length,
        recentTopic: extractMainTopic(recentMessages)
    };
}

/**
 * メッセージからキーワードを抽出
 * @param {string} message - メッセージ
 * @returns {Array} キーワード配列
 */
function extractKeywords(message) {
    const keywords = [];
    const patterns = [
        /石垣島|宮古島|沖縄本島|久米島|西表島|与那国島/g,
        /ダイビング|シュノーケル|体験|ライセンス/g,
        /初心者|経験者|上級者/g,
        /マンタ|ウミガメ|サンゴ|魚/g,
        /予約|料金|アクセス|宿泊/g
    ];
    
    patterns.forEach(pattern => {
        const matches = message.match(pattern);
        if (matches) keywords.push(...matches);
    });
    
    return [...new Set(keywords)]; // 重複除去
}

/**
 * 話題の継続性を分析
 * @param {Array} recentMessages - 最近のメッセージ
 * @param {string} currentMessage - 現在のメッセージ
 * @returns {Object} 話題継続性情報
 */
function analyzeTopic(recentMessages, currentMessage) {
    const currentKeywords = extractKeywords(currentMessage);
    let continuityScore = 0;
    let mainTopic = null;
    
    if (recentMessages.length > 0) {
        const recentKeywords = recentMessages
            .map(msg => extractKeywords(msg.message_content))
            .flat();
        
        // 共通キーワードの数で継続性を判定
        const commonKeywords = currentKeywords.filter(kw => 
            recentKeywords.includes(kw)
        );
        
        continuityScore = commonKeywords.length / Math.max(currentKeywords.length, 1);
        mainTopic = findMostFrequentTopic(recentKeywords);
    }
    
    return {
        score: continuityScore,
        mainTopic,
        isTopicShift: continuityScore < 0.3
    };
}

/**
 * 質問の種類を分類
 * @param {string} message - メッセージ
 * @returns {string} 質問タイプ
 */
function classifyQuestion(message) {
    if (message.includes('？') || message.includes('?')) {
        if (message.match(/どこ|場所|エリア/)) return 'location';
        if (message.match(/いつ|時期|季節/)) return 'timing';
        if (message.match(/いくら|料金|値段|費用/)) return 'price';
        if (message.match(/どう|方法|やり方/)) return 'howto';
        if (message.match(/なに|何|どんな/)) return 'what';
        return 'general_question';
    }
    
    if (message.match(/教えて|知りたい|聞きたい/)) return 'information_request';
    if (message.match(/予約|申し込み|手続き/)) return 'booking';
    if (message.match(/不安|心配|大丈夫/)) return 'concern';
    
    return 'statement';
}

/**
 * 会話の段階を判定
 * @param {Array} recentMessages - 最近のメッセージ
 * @returns {string} 会話段階
 */
function determineConversationStage(recentMessages) {
    const messageCount = recentMessages.length;
    
    if (messageCount <= 2) return 'initial';
    if (messageCount <= 5) return 'exploration';
    if (messageCount <= 10) return 'planning';
    return 'detailed_consultation';
}

/**
 * 主要な話題を抽出
 * @param {Array} messages - メッセージ配列
 * @returns {string} 主要話題
 */
function extractMainTopic(messages) {
    const allKeywords = messages
        .map(msg => extractKeywords(msg.message_content))
        .flat();
    
    return findMostFrequentTopic(allKeywords);
}

/**
 * 最も頻出する話題を特定
 * @param {Array} keywords - キーワード配列
 * @returns {string} 主要話題
 */
function findMostFrequentTopic(keywords) {
    const frequency = {};
    keywords.forEach(kw => {
        frequency[kw] = (frequency[kw] || 0) + 1;
    });
    
    return Object.keys(frequency).reduce((a, b) => 
        frequency[a] > frequency[b] ? a : b, null
    );
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
/**
 * V2.8: Web知識ベース統合AI応答生成
 * @param {string} currentMessage - 現在のメッセージ
 * @param {Object} userProfile - ユーザープロファイル
 * @param {Array} conversationHistory - 会話履歴
 * @param {Array} pastExperiences - 過去のダイビング体験
 * @param {Array} divingPlans - ダイビング予定
 * @param {Object} webKnowledge - Web知識ベース情報
 * @param {number} currentPoints - 現在のポイント残高
 * @returns {string} AI応答
 */
async function generateV28AIResponse(currentMessage, userProfile, conversationHistory, pastExperiences, divingPlans, webKnowledge, currentPoints, recentResponses = [], conversationContext = {}) {
    try {
        // V2.8: 拡張システムプロンプト生成（重複防止・文脈考慮）
        const systemPrompt = generateV28SystemPrompt(
            userProfile, 
            conversationHistory, 
            pastExperiences, 
            divingPlans, 
            webKnowledge, 
            currentPoints,
            recentResponses,
            conversationContext
        );

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: currentMessage }
            ],
            max_tokens: 1000,
            temperature: 0.7,
            presence_penalty: 0.1,
            frequency_penalty: 0.1
        });

        return response.choices[0].message.content;

    } catch (error) {
        console.error('❌ V2.8 AI応答生成エラー:', error);
        return 'すみません、ちょっと考えがまとまりません。もう一度聞いてもらえますか？🤔';
    }
}

/**
 * V2.8: 拡張システムプロンプト生成（Web知識ベース統合）
 * @param {Object} userProfile - ユーザープロファイル
 * @param {Array} conversationHistory - 会話履歴
 * @param {Array} pastExperiences - 過去体験
 * @param {Array} divingPlans - ダイビング予定
 * @param {Object} webKnowledge - Web知識ベース情報
 * @param {number} currentPoints - 現在のポイント残高
 * @returns {string} システムプロンプト
 */
function generateV28SystemPrompt(userProfile, conversationHistory, pastExperiences, divingPlans, webKnowledge, currentPoints, recentResponses = [], conversationContext = {}) {
    // 会話分析結果を使用した高度なペルソナ生成
    const { generateAdvancedSystemPrompt } = require('./jiji-persona');
    
    // 基本的なJijiペルソナ（高度版）
    const basePersona = generateAdvancedSystemPrompt(
        userProfile, 
        conversationHistory, 
        pastExperiences, 
        divingPlans,
        conversationContext
    );
    
    // V2.8: Web知識ベース統合情報
    let knowledgeBaseInfo = '';
    if (webKnowledge.total_references > 0) {
        knowledgeBaseInfo = `

=== V2.8 Web知識ベース統合情報 ===

知識ベース参照カテゴリ: ${webKnowledge.categories_matched.join(', ')}
総参照件数: ${webKnowledge.total_references}件

`;

        // ショップ情報
        if (webKnowledge.shop_info) {
            knowledgeBaseInfo += `
🏪 ショップ情報:
- 対象エリア: ${webKnowledge.shop_info.area}
- 登録店舗数: ${webKnowledge.shop_info.shop_count}店舗
- 詳細情報: ${webKnowledge.shop_info.knowledge_base_url}

`;
        }

        // 旅行情報
        if (webKnowledge.travel_info) {
            knowledgeBaseInfo += `
✈️ 旅行情報:
- 対象エリア: ${webKnowledge.travel_info.area}
- 宿泊予算: ${webKnowledge.travel_info.accommodation.budget_range}
- 航空券: ${webKnowledge.travel_info.transportation.flight_cost}
- 詳細情報: ${webKnowledge.travel_info.knowledge_base_url}

`;
        }

        // 天気・海況情報
        if (webKnowledge.weather_info) {
            knowledgeBaseInfo += `
🌊 天気・海況情報:
- 対象エリア: ${webKnowledge.weather_info.area}
- 現在の季節: ${webKnowledge.weather_info.current_season}
- ダイビング条件: ${webKnowledge.weather_info.diving_conditions}
- 水温: ${webKnowledge.weather_info.water_temperature}
- 詳細情報: ${webKnowledge.weather_info.knowledge_base_url}

`;
        }

        // ガイド情報
        if (webKnowledge.guide_info) {
            knowledgeBaseInfo += `
🤿 初心者ガイド情報:
- ユーザーレベル: ${webKnowledge.guide_info.user_level}
- 準備物: ${webKnowledge.guide_info.preparation_list.join(', ')}
- 詳細情報: ${webKnowledge.guide_info.knowledge_base_url}

`;
        }

        // エリア情報
        if (webKnowledge.area_info) {
            knowledgeBaseInfo += `
🏝️ エリア情報:
- 対象エリア: ${webKnowledge.area_info.area}
- 特徴: ${webKnowledge.area_info.info.highlights?.join(', ')}
- おすすめ度: ${webKnowledge.area_info.info.best_for}
- 詳細情報: ${webKnowledge.area_info.knowledge_base_url}

`;
        }
    }

    // V2.8: ポイントシステム情報
    const pointInfo = `

=== V2.8 ポイントシステム情報 ===

現在のポイント残高: ${currentPoints}ポイント

ポイント獲得方法:
- 口コミ投稿: 100-200ポイント
- 詳細レビュー: +50ポイント
- 写真付きレビュー: +50ポイント
- 友達紹介: 300ポイント

交換可能特典:
- 体験ダイビング無料チケット: 3,000ポイント
- 水中写真撮影サービス: 1,200ポイント
- 防水カメラレンタル: 800ポイント

口コミ投稿について自然に案内する場合:
「体験後のレビューを投稿していただくと、他の初心者の方にもとても参考になります。ポイントも貯まりますよ！」

`;

    // V2.8: LINE Bot完結型指示
    const v28Instructions = `

=== V2.8 LINE Bot完結型対応指示 ===

1. Web知識ベース統合:
   - 上記の知識ベース情報を自然に活用して回答
   - 詳細情報のURLを適切に案内
   - 「詳しくはこちら」として知識ベースURLを紹介

2. LINE Bot完結型:
   - 基本的な問題解決はLINE内で完結
   - 追加の詳細情報が必要な場合のみWebページを案内
   - 自然な会話の流れを重視

3. 口コミ・ポイント統合:
   - 適切なタイミングで口コミ投稿を案内
   - ポイント情報を自然に組み込む
   - 「〇〇ポイントで△△と交換できます」などの情報

4. 応答スタイル:
   - 親しみやすく、初心者に寄り添う
   - 知識ベースの情報を「僕が調べた情報」として自然に提供
   - 専門性を保ちながら分かりやすく説明

`;

    // 重複防止・文脈考慮情報
    let conversationEnhancement = '';
    
    if (recentResponses.length > 0) {
        conversationEnhancement += `

=== 重複防止・会話継続性向上指示 ===

最近の応答履歴（重複回避のため）:
`;
        recentResponses.forEach((response, index) => {
            conversationEnhancement += `
${index + 1}. [${response.timestamp}] (${response.length}文字)
   キーワード: ${response.keywords.join(', ')}
   内容要約: ${response.content.substring(0, 100)}...
`;
        });
        
        conversationEnhancement += `

重要な指示:
- 上記の応答内容と同じ情報を繰り返さない
- 同じキーワードでも異なる角度からアプローチ
- 新しい価値のある情報を提供
- 会話の発展を意識した応答
`;
    }
    
    if (conversationContext.questionType) {
        conversationEnhancement += `

=== 文脈情報 ===

現在の会話状況:
- 質問タイプ: ${conversationContext.questionType}
- 会話段階: ${conversationContext.conversationStage}
- 主要話題: ${conversationContext.recentTopic || '新規話題'}
- 話題継続性: ${conversationContext.topicContinuity?.score || 0}
- 話題変更: ${conversationContext.topicContinuity?.isTopicShift ? 'あり' : 'なし'}

応答指針:
- ${getResponseGuideline(conversationContext)}
- 話題変更の場合は自然な移行を心がける
- 会話段階に応じて情報の詳細度を調整
- ユーザーの興味に合わせて関連情報を提案
`;
    }

    return basePersona + knowledgeBaseInfo + pointInfo + v28Instructions + conversationEnhancement;
}

/**
 * 文脈に基づいた応答指針を生成
 * @param {Object} conversationContext - 会話文脈
 * @returns {string} 応答指針
 */
function getResponseGuideline(conversationContext) {
    const { questionType, conversationStage, topicContinuity } = conversationContext;
    
    let guideline = '';
    
    // 質問タイプ別の指針
    switch (questionType) {
        case 'location':
            guideline = '具体的な場所情報と特徴を詳しく説明';
            break;
        case 'timing':
            guideline = '季節やタイミングの詳細とメリット・デメリットを説明';
            break;
        case 'price':
            guideline = '料金体系と価値、コストパフォーマンスを重視';
            break;
        case 'concern':
            guideline = '不安に共感し、具体的な解決策と安心材料を提供';
            break;
        case 'booking':
            guideline = '手続きの流れを分かりやすく段階的に説明';
            break;
        default:
            guideline = '相手のニーズに合わせた情報を提供';
    }
    
    // 会話段階による調整
    switch (conversationStage) {
        case 'initial':
            guideline += '、基本的な情報から始めて親しみやすく';
            break;
        case 'exploration':
            guideline += '、興味を引く情報で関心を深める';
            break;
        case 'planning':
            guideline += '、具体的で実用的な情報を中心に';
            break;
        case 'detailed_consultation':
            guideline += '、専門的で詳細な情報まで含めて';
            break;
    }
    
    // 話題継続性による調整
    if (topicContinuity?.isTopicShift) {
        guideline += '、話題の変化を自然に受け入れて新しい方向性を提示';
    } else {
        guideline += '、これまでの話題を発展させて深堀り';
    }
    
    return guideline;
}

/**
 * 旧バージョン互換性のためのAI応答生成
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

/**
 * LINE Bot応答品質テストシステム
 */
async function testConversationQuality() {
    console.log('🧪 LINE Bot品質テスト開始...');
    
    const testScenarios = [
        {
            name: '初回利用者テスト',
            userId: 'test_user_001',
            messages: [
                'はじめまして！ダイビングに興味があります',
                'マンタが見たいのですが、どこがおすすめですか？',
                '初心者でも大丈夫でしょうか？'
            ]
        },
        {
            name: '継続利用者テスト',
            userId: 'test_user_002', 
            messages: [
                '前回の石垣島でマンタ見れました！',
                'また石垣島に行きたいのですが、違うポイントはありますか？',
                '今度は宮古島も考えています'
            ]
        },
        {
            name: '重複防止テスト',
            userId: 'test_user_003',
            messages: [
                'マンタが見たいです',
                'マンタについて教えて',
                'マンタはどこで見れますか？'
            ]
        }
    ];
    
    for (const scenario of testScenarios) {
        console.log(`\n📋 ${scenario.name} 実行中...`);
        
        for (let i = 0; i < scenario.messages.length; i++) {
            const message = scenario.messages[i];
            console.log(`💬 メッセージ ${i+1}: ${message}`);
            
            try {
                const response = await processUserMessage(scenario.userId, message);
                console.log(`🤖 応答: ${response.substring(0, 100)}...`);
                
                // 品質チェック
                const quality = analyzeResponseQuality(response, scenario.messages.slice(0, i));
                console.log(`📊 品質スコア: ${quality.overallScore}/100`);
                
            } catch (error) {
                console.error(`❌ テストエラー: ${error.message}`);
            }
            
            // 次のメッセージまで少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    console.log('✅ LINE Bot品質テスト完了');
}

/**
 * 応答品質を分析
 * @param {string} response - AI応答
 * @param {Array} previousMessages - 過去のメッセージ
 * @returns {Object} 品質分析結果
 */
function analyzeResponseQuality(response, previousMessages) {
    let score = 0;
    const analysis = {
        length: response.length,
        hasEmoji: /[\u{1F300}-\u{1F9FF}]/u.test(response),
        hasSpecificLocation: /石垣島|宮古島|沖縄本島|慶良間|青の洞窟/.test(response),
        hasPersonality: /はいさい|Jiji/.test(response),
        isDuplicate: false,
        continuity: false
    };
    
    // 長さチェック（適切な長さ）
    if (analysis.length >= 50 && analysis.length <= 300) score += 20;
    
    // 絵文字使用
    if (analysis.hasEmoji) score += 15;
    
    // 具体的な場所言及
    if (analysis.hasSpecificLocation) score += 20;
    
    // ペルソナ表現
    if (analysis.hasPersonality) score += 15;
    
    // 重複チェック
    analysis.isDuplicate = previousMessages.some(msg => 
        response.includes(msg.substring(0, 30))
    );
    if (!analysis.isDuplicate) score += 20;
    
    // 継続性チェック
    if (previousMessages.length > 0) {
        analysis.continuity = previousMessages.some(msg => 
            response.includes('前回') || response.includes('先ほど')
        );
        if (analysis.continuity) score += 10;
    }
    
    return {
        overallScore: score,
        details: analysis
    };
}

module.exports = {
    processUserMessage,
    extractPastExperiences,
    extractDivingPlans,
    checkAndUpdateProfile,
    generateAIResponse,
    detectMessageType,
    checkReminderNeeded,
    // V2.8 追加
    generateV28AIResponse,
    generateV28SystemPrompt,
    WebKnowledgeBase,
    // 品質テスト機能
    testConversationQuality,
    analyzeResponseQuality,
    extractRecentResponses,
    analyzeConversationContext,
    // V2.8 アンケート・リッチメニュー追加
    handleSpecialMessages,
    formatResponseMessage
};

/**
 * 🔍 V2.8: 特別メッセージ処理（アンケート・リッチメニュー）
 * @param {string} userId - ユーザーID
 * @param {string} messageText - メッセージテキスト
 * @returns {string|null} 特別処理の応答またはnull
 */
async function handleSpecialMessages(userId, messageText) {
    try {
        // アンケート関連の処理
        if (await isInSurveyMode(userId)) {
            console.log(`📋 アンケート回答処理: ${userId} - ${messageText}`);
            const surveyResponse = await surveyManager.processAnswer(userId, messageText);
            return formatResponseMessage(surveyResponse);
        }
        
        // リッチメニューアクション処理
        const menuActions = [
            '体験相談', 'ショップDB', 'アンケート開始', 
            '旅行計画', '海況情報', 'ヘルプ'
        ];
        
        if (menuActions.includes(messageText)) {
            console.log(`🎨 リッチメニューアクション: ${userId} - ${messageText}`);
            
            if (messageText === 'アンケート開始') {
                const surveyResponse = await surveyManager.startSurvey(userId, false);
                return formatResponseMessage(surveyResponse);
            }
            
            const menuResponse = await richMenuManager.handleMenuAction(userId, messageText);
            return formatResponseMessage(menuResponse);
        }
        
        // アンケート更新確認
        if (messageText === 'survey_update_yes') {
            const surveyResponse = await surveyManager.startSurvey(userId, false);
            return formatResponseMessage(surveyResponse);
        }
        
        if (messageText === 'survey_update_no') {
            return '了解しました！何か他にお手伝いできることがあれば、気軽に話しかけてくださいね🌊';
        }
        
        // ショップマッチング処理
        if (messageText.includes('ショップをマッチング') || messageText.includes('マッチング')) {
            console.log(`🎯 ショップマッチング要求: ${userId}`);
            return await generateShopMatching(userId);
        }
        
        return null; // 特別処理対象外
        
    } catch (error) {
        console.error('❌ 特別メッセージ処理エラー:', error);
        return null;
    }
}

/**
 * アンケート実行中かどうか判定
 * @param {string} userId - ユーザーID
 * @returns {boolean} アンケート中かどうか
 */
async function isInSurveyMode(userId) {
    try {
        const survey = await surveyManager.getUserSurvey(userId);
        return survey && !survey.survey_completed && survey.current_question !== 'completed';
    } catch (error) {
        console.error('❌ アンケート状態確認エラー:', error);
        return false;
    }
}

/**
 * 応答メッセージのフォーマット処理
 * @param {Object} response - 応答オブジェクト
 * @returns {string} フォーマット済みメッセージ
 */
function formatResponseMessage(response) {
    if (typeof response === 'string') {
        return response;
    }
    
    if (response && response.message) {
        return response.message;
    }
    
    return 'すみません、応答の準備でエラーが発生しました。もう一度お試しください。';
}

/**
 * 🎯 ショップマッチング機能
 * @param {string} userId - ユーザーID
 * @returns {string} マッチング結果
 */
async function generateShopMatching(userId) {
    try {
        console.log(`🎯 ショップマッチング開始: ${userId}`);
        
        // ユーザープロファイル取得
        const profileResult = await getUserProfile(userId);
        const userProfile = profileResult.success ? profileResult.data : null;
        
        // アンケート結果取得
        const survey = await surveyManager.getUserSurvey(userId);
        
        // 会話履歴取得
        const historyResult = await getConversationHistory(userId, 20);
        const conversationHistory = historyResult.success ? historyResult.data : [];
        
        // 会話分析（既存システム活用）
        const conversationContext = analyzeConversationContext(conversationHistory, '');
        
        // マッチング判定
        const matchingCriteria = generateMatchingCriteria(survey, conversationContext, userProfile);
        
        // ショップ3選を取得（実装は後で詳細化）
        const selectedShops = await findBestShops(matchingCriteria);
        
        return formatShopMatchingResponse(selectedShops, matchingCriteria);
        
    } catch (error) {
        console.error('❌ ショップマッチングエラー:', error);
        return 'ショップマッチングでエラーが発生しました。少し時間をおいてもう一度お試しください。';
    }
}

/**
 * マッチング条件生成
 * @param {Object} survey - アンケート結果
 * @param {Object} conversationContext - 会話分析結果
 * @param {Object} userProfile - ユーザープロファイル
 * @returns {Object} マッチング条件
 */
function generateMatchingCriteria(survey, conversationContext, userProfile) {
    const criteria = {
        experience_level: 'beginner',
        preferred_areas: [],
        interests: [],
        safety_priority: false,
        budget_conscious: false,
        group_friendly: false
    };
    
    // アンケート結果から判定
    if (survey) {
        if (survey.license_type === 'aow_plus') {
            criteria.experience_level = 'advanced';
        } else if (survey.license_type === 'owd') {
            criteria.experience_level = 'intermediate';
        }
        
        if (survey.experience_level === 'okinawa_experienced') {
            criteria.experience_level = 'experienced';
        }
        
        // Q2回答分析
        if (survey.q2_response) {
            const q2 = JSON.parse(survey.q2_response);
            if (q2.safety_concerns) criteria.safety_priority = true;
            if (q2.budget_concerns) criteria.budget_conscious = true;
            if (q2.big_creatures) criteria.interests.push('manta', 'big_fish');
            if (q2.healing_creatures) criteria.interests.push('turtle', 'coral');
        }
    }
    
    // 会話履歴から補強（70%ウェイト）
    if (conversationContext.recentKeywords) {
        const keywords = conversationContext.recentKeywords;
        
        if (keywords.includes('石垣島') || keywords.includes('マンタ')) {
            criteria.preferred_areas.push('ishigaki');
        }
        if (keywords.includes('宮古島') || keywords.includes('地形')) {
            criteria.preferred_areas.push('miyako');
        }
        if (keywords.includes('青の洞窟') || keywords.includes('沖縄本島')) {
            criteria.preferred_areas.push('okinawa_main');
        }
        
        if (keywords.includes('予算') || keywords.includes('安い')) {
            criteria.budget_conscious = true;
        }
        if (keywords.includes('家族') || keywords.includes('グループ')) {
            criteria.group_friendly = true;
        }
    }
    
    return criteria;
}

/**
 * 最適ショップ検索（サンプル実装）
 * @param {Object} criteria - マッチング条件
 * @returns {Array} ショップリスト
 */
async function findBestShops(criteria) {
    // 実際の実装では詳細なデータベース検索を行う
    // ここではサンプルデータを返す
    
    const sampleShops = [
        {
            name: '石垣マリンプロ',
            url: 'https://example-ishigaki-marine.com',
            reason: criteria.experience_level === 'advanced' ? 
                'AOW向け上級ポイント対応・マンタ遭遇率95%' : 
                '初心者専門・安全第一の丁寧指導'
        },
        {
            name: 'ダイビングサービス海風',
            url: 'https://example-umikaze.com', 
            reason: criteria.group_friendly ? 
                '家族向けプラン豊富・グループ割引あり' : 
                '少人数制で個別サポート充実'
        },
        {
            name: '宮古島マリンクラブ',
            url: 'https://example-miyako-marine.com',
            reason: criteria.interests.includes('地形') ? 
                '地形ダイビング専門・洞窟ガイド経験豊富' : 
                '透明度抜群のポイント案内・初心者歓迎'
        }
    ];
    
    return sampleShops;
}

/**
 * ショップマッチング結果フォーマット
 * @param {Array} shops - ショップリスト
 * @param {Object} criteria - マッチング条件
 * @returns {string} フォーマット済み応答
 */
function formatShopMatchingResponse(shops, criteria) {
    let response = `🏪 あなたにピッタリのショップを3つ厳選しました！\n\n`;
    
    shops.forEach((shop, index) => {
        response += `【${index + 1}位】🌊 ${shop.name}\n`;
        response += `URL: ${shop.url}\n`;
        response += `💡 マッチング理由: ${shop.reason}\n\n`;
    });
    
    response += `詳しく聞きたいショップがあれば、\n`;
    response += `「${shops[0].name}について詳しく」と送ってくださいね✨\n\n`;
    response += `予約や相談は各ショップに直接お問い合わせください🤿`;
    
    return response;
}