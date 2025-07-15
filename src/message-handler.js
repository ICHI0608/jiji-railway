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
        }

        // 2. ユーザーメッセージをデータベースに保存
        await saveConversation(lineUserId, 'user', messageText, sessionId, {
            v28_enabled: true,
            knowledge_base_integrated: true
        });

        // 3. ユーザープロファイル取得
        const profileResult = await getUserProfile(lineUserId);
        const userProfile = profileResult.success ? profileResult.data : null;

        // 4. 会話履歴取得と分析（最新20件）
        const historyResult = await getConversationHistory(lineUserId, 20);
        const conversationHistory = historyResult.success ? historyResult.data : [];
        
        // 過去体験の抽出
        const pastExperiences = extractPastExperiences(conversationHistory);
        const divingPlans = extractDivingPlans(conversationHistory);

        // 5. V2.8: Web知識ベース統合参照
        const webKnowledge = await webKnowledgeBase.gatherKnowledge(messageText, userProfile);

        // 6. V2.8: ユーザーポイント残高取得
        const pointBalance = await getUserPointBalance(lineUserId);
        const currentPoints = pointBalance.success ? pointBalance.data : 0;

        // 7. プロファイル情報の自動更新チェック
        const updatedProfile = await checkAndUpdateProfile(lineUserId, messageText, userProfile);

        // 8. V2.8: 統合AI応答生成（Web知識ベース統合）
        const aiResponse = await generateV28AIResponse(
            messageText, 
            updatedProfile || userProfile, 
            conversationHistory, 
            pastExperiences, 
            divingPlans,
            webKnowledge,
            currentPoints
        );

        // 9. AI応答をデータベースに保存
        await saveConversation(lineUserId, 'assistant', aiResponse, sessionId, {
            v28_enabled: true,
            knowledge_base_used: webKnowledge.categories_matched,
            knowledge_references: webKnowledge.total_references
        });

        console.log(`🤖 V2.8 AI応答生成完了: ${lineUserId} (知識ベース: ${webKnowledge.total_references}件参照)`);
        return aiResponse;

    } catch (error) {
        console.error('❌ V2.8 メッセージ処理エラー:', error);
        return 'すみません、一時的にエラーが発生しました。僕がもう一度確認してみますね。🙏';
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
async function generateV28AIResponse(currentMessage, userProfile, conversationHistory, pastExperiences, divingPlans, webKnowledge, currentPoints) {
    try {
        // V2.8: 拡張システムプロンプト生成
        const systemPrompt = generateV28SystemPrompt(
            userProfile, 
            conversationHistory, 
            pastExperiences, 
            divingPlans, 
            webKnowledge, 
            currentPoints
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
function generateV28SystemPrompt(userProfile, conversationHistory, pastExperiences, divingPlans, webKnowledge, currentPoints) {
    // 基本的なJijiペルソナ
    const basePersona = generateSystemPrompt(userProfile, conversationHistory, pastExperiences, divingPlans);
    
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

    return basePersona + knowledgeBaseInfo + pointInfo + v28Instructions;
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
    WebKnowledgeBase
};