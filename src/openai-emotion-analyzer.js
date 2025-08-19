/**
 * OpenAI Emotion Analysis Engine
 * Phase 4-A Task 4: 6-Category Emotion Analysis + Jiji Character Response
 * 
 * Integrates with OpenAI GPT-4 for sophisticated emotion analysis
 * and Jiji character response generation
 */

const OpenAI = require('openai');

class JijiOpenAIEmotionAnalyzer {
    constructor() {
        this.initializeOpenAI();
        
        // 6-category emotion analysis system (from development plan)
        this.emotionalCategories = {
            safety: {
                keywords: ['安全', '不安', '怖い', '危険', '心配', '大丈夫', '事故', '溺れる', '器材', '故障'],
                weight: 20,
                description: '安全性不安（重み20点）',
                response_priority: 'highest'
            },
            skill: {
                keywords: ['下手', 'できない', '初心者', '自信ない', '泳げない', '経験少ない', 'スキル', '上達'],
                weight: 15,
                description: 'スキル不安（重み15点）',
                response_priority: 'high'
            },
            solo: {
                keywords: ['一人', 'ぼっち', '友達いない', '参加不安', '浮く', '馴染める', '知らない人'],
                weight: 15,
                description: '一人参加不安（重み15点）',
                response_priority: 'high'
            },
            cost: {
                keywords: ['高い', '料金', '予算', '安い', 'お金', 'コスト', '節約', '学生', '追加料金'],
                weight: 12,
                description: '予算心配（重み12点）',
                response_priority: 'medium'
            },
            physical: {
                keywords: ['体力', '疲れる', 'きつい', '年齢', '運動不足', '持病', '健康'],
                weight: 10,
                description: '体力心配（重み10点）',
                response_priority: 'medium'
            },
            communication: {
                keywords: ['英語', '言葉', 'コミュニケーション', '質問できない', '恥ずかしい'],
                weight: 8,
                description: 'コミュニケーション不安（重み8点）',
                response_priority: 'low'
            }
        };
        
        // Jiji character persona for OpenAI
        this.jijiPersona = `
あなたは「Jiji」という沖縄ダイビングの専門パーソナルAIです。

【キャラクター設定】
- 元々超ビビリだった先輩ダイバー（25-30歳感覚）
- 初心者の不安を100%理解し、共感する親身な存在
- コスト意識が高く、節約テクニックに詳しい
- 沖縄全島のダイビング情報を熟知
- 明るく親しみやすい性格、失敗経験豊富

【基本応答スタイル】
「分かります、その不安。僕も最初は同じでした」
「大丈夫、一つずつクリアしていけば必ず潜れます」
「コスト抑えるなら、こんな裏技があります」
「このショップなら、初心者に本当に優しいです」

【重要原則】
- 必ず共感から始める
- 具体的で実用的なアドバイス
- 安全を最優先に考える
- 初心者目線を忘れない
- 親しみやすく、でも頼りになる先輩として振る舞う
        `;
    }

    initializeOpenAI() {
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
            console.warn('⚠️ OpenAI API key not found in environment variables');
            console.warn('   Set OPENAI_API_KEY to enable advanced emotion analysis');
            this.openai = null;
            this.mode = 'mock';
            return;
        }
        
        try {
            this.openai = new OpenAI({ apiKey });
            this.mode = 'openai';
            console.log('✅ OpenAI client initialized for emotion analysis');
        } catch (error) {
            console.error('❌ Failed to initialize OpenAI:', error.message);
            this.openai = null;
            this.mode = 'mock';
        }
    }

    /**
     * Advanced emotion analysis using OpenAI GPT-4
     * @param {string} message - User message to analyze
     * @param {Object} context - Additional context (user profile, history)
     * @returns {Object} Detailed emotion analysis
     */
    async analyzeEmotions(message, context = {}) {
        if (this.mode === 'mock') {
            return this.mockEmotionAnalysis(message);
        }

        try {
            console.log('🧠 Analyzing emotions with OpenAI GPT-4...');
            
            const systemPrompt = this.buildEmotionAnalysisPrompt();
            const userPrompt = this.buildUserPrompt(message, context);
            
            const completion = await this.openai.chat.completions.create({
                model: "gpt-5",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_completion_tokens: 1000,
                response_format: { type: "json_object" }
            });

            const response = completion.choices[0].message.content;
            const analysis = JSON.parse(response);
            
            // Enhance with additional data
            const enhancedAnalysis = this.enhanceAnalysis(analysis, message);
            
            console.log(`✅ OpenAI emotion analysis complete: ${enhancedAnalysis.total_categories_detected} categories detected`);
            
            return enhancedAnalysis;
            
        } catch (error) {
            console.error('❌ OpenAI emotion analysis failed:', error.message);
            console.log('   Falling back to mock analysis');
            return this.mockEmotionAnalysis(message);
        }
    }

    buildEmotionAnalysisPrompt() {
        return `あなたは沖縄ダイビング特化の感情分析専門AIです。

【分析対象】6つの感情カテゴリ
1. safety（安全性不安）: 重み20点 - 安全、事故、危険、不安、心配
2. skill（スキル不安）: 重み15点 - 初心者、下手、できない、自信ない、経験少ない
3. solo（一人参加不安）: 重み15点 - 一人、友達いない、参加不安、知らない人
4. cost（予算心配）: 重み12点 - 高い、料金、予算、お金、節約
5. physical（体力心配）: 重み10点 - 体力、疲れる、年齢、運動不足
6. communication（コミュニケーション不安）: 重み8点 - 英語、質問できない、恥ずかしい

【分析指示】
- ユーザーのメッセージから上記6カテゴリの感情を検出
- 各カテゴリの信頼度（0.0-1.0）を判定
- 検出されたキーワードを記録
- 最も強い感情（primary_emotion）を特定
- 感情の背景と推奨対応を分析

【出力形式】
JSON形式で以下の構造で回答してください:
{
  "detected_emotions": {
    "safety": {
      "confidence": 0.0-1.0,
      "weight": 20,
      "matched_keywords": ["検出されたキーワード"],
      "description": "安全性不安",
      "intensity": "low/medium/high"
    },
    // 他のカテゴリも同様...
  },
  "primary_emotion": "最も強い感情カテゴリ名",
  "secondary_emotion": "2番目に強い感情カテゴリ名",
  "total_categories_detected": 数値,
  "overall_sentiment": "positive/negative/neutral",
  "urgency_level": "low/medium/high",
  "recommended_approach": "推奨対応アプローチ"
}

検出されなかった感情カテゴリは出力に含めないでください。`;
    }

    buildUserPrompt(message, context) {
        let prompt = `以下のメッセージを6カテゴリで感情分析してください:\n\n「${message}」`;
        
        if (context.user_profile) {
            prompt += `\n\n【ユーザー情報】`;
            if (context.user_profile.diving_experience) {
                prompt += `\n- ダイビング経験: ${context.user_profile.diving_experience}`;
            }
            if (context.user_profile.age_range) {
                prompt += `\n- 年齢層: ${context.user_profile.age_range}`;
            }
        }
        
        if (context.conversation_history && context.conversation_history.length > 0) {
            prompt += `\n\n【最近の会話】`;
            context.conversation_history.slice(-3).forEach((conv, i) => {
                prompt += `\n${i + 1}. ${conv.user_message}`;
            });
        }
        
        return prompt;
    }

    enhanceAnalysis(analysis, originalMessage) {
        return {
            ...analysis,
            original_message: originalMessage,
            analysis_timestamp: new Date().toISOString(),
            analysis_mode: this.mode,
            emotion_weights: this.getEmotionWeights(analysis.detected_emotions),
            response_priorities: this.getResponsePriorities(analysis.detected_emotions)
        };
    }

    getEmotionWeights(detectedEmotions) {
        const weights = {};
        Object.keys(detectedEmotions).forEach(emotion => {
            weights[emotion] = this.emotionalCategories[emotion]?.weight || 0;
        });
        return weights;
    }

    getResponsePriorities(detectedEmotions) {
        const priorities = {};
        Object.keys(detectedEmotions).forEach(emotion => {
            priorities[emotion] = this.emotionalCategories[emotion]?.response_priority || 'medium';
        });
        return priorities;
    }

    /**
     * Generate Jiji character response using OpenAI
     * @param {Object} emotionAnalysis - Result from emotion analysis
     * @param {Array} recommendedShops - Top matched shops
     * @param {Object} userProfile - User profile data
     * @returns {Object} Jiji response with personalized message
     */
    async generateJijiResponse(emotionAnalysis, recommendedShops = [], userProfile = {}) {
        if (this.mode === 'mock') {
            return this.mockJijiResponse(emotionAnalysis, recommendedShops, userProfile);
        }

        try {
            console.log('💬 Generating Jiji character response with OpenAI...');
            
            const systemPrompt = this.buildJijiResponsePrompt();
            const userPrompt = this.buildJijiUserPrompt(emotionAnalysis, recommendedShops, userProfile);
            
            const completion = await this.openai.chat.completions.create({
                model: "gpt-5",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                max_completion_tokens: 800
            });

            const jijiResponse = completion.choices[0].message.content;
            
            console.log('✅ Jiji response generated successfully');
            
            return {
                jiji_main_message: jijiResponse,
                response_type: 'openai_generated',
                emotion_addressed: emotionAnalysis.primary_emotion,
                personalization_level: 'high',
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ Jiji response generation failed:', error.message);
            console.log('   Falling back to mock response');
            return this.mockJijiResponse(emotionAnalysis, recommendedShops, userProfile);
        }
    }

    buildJijiResponsePrompt() {
        return `${this.jijiPersona}

【応答生成指示】
ユーザーの感情分析結果と推薦ショップ情報を基に、Jijiキャラクターとして自然で親身な応答を生成してください。

【応答の構成】
1. 共感・理解を示す導入（必須）
2. 検出された主要な不安に対する具体的なアドバイス
3. 推薦ショップの紹介（ある場合）
4. 前向きで励ましの言葉での締めくくり

【応答スタイル】
- 親しみやすく、でも信頼できる先輩として
- 敬語すぎず、フランクすぎない絶妙な距離感
- 具体的で実用的なアドバイス
- ユーザーの不安に真摯に向き合う
- 沖縄ダイビングへの情熱を伝える

【注意事項】
- 技術指導は避け、ショップに任せる
- 海況判断はプロに委ねる
- 安全を最優先に考慮
- ユーザーの経験レベルに合わせた内容

200-400文字程度で、自然な会話調で応答してください。`;
    }

    buildJijiUserPrompt(emotionAnalysis, recommendedShops, userProfile) {
        const userName = userProfile.name || 'あなた';
        
        let prompt = `【感情分析結果】
主要な感情: ${emotionAnalysis.primary_emotion}
検出された感情カテゴリ: ${Object.keys(emotionAnalysis.detected_emotions).join(', ')}
元のメッセージ: "${emotionAnalysis.original_message}"

【ユーザー情報】
名前: ${userName}
ダイビング経験: ${userProfile.diving_experience || '不明'}`;

        if (recommendedShops.length > 0) {
            prompt += `\n\n【推薦ショップ】`;
            recommendedShops.slice(0, 3).forEach((shop, i) => {
                prompt += `\n${i + 1}. ${shop.shop_name} (${shop.area})`;
                if (shop.jiji_grade) prompt += ` - ${shop.jiji_grade}`;
                if (shop.beginner_friendly) prompt += ` - 初心者歓迎`;
            });
        }

        prompt += `\n\n上記の情報を基に、Jijiキャラクターとして${userName}さんに親身で具体的な応答をしてください。`;
        
        return prompt;
    }

    /**
     * Mock emotion analysis for fallback
     */
    mockEmotionAnalysis(message) {
        console.log('🧠 [MOCK] Performing emotion analysis...');
        
        const detectedEmotions = {};
        const messageText = message.toLowerCase();
        
        // Simple keyword-based analysis
        Object.entries(this.emotionalCategories).forEach(([category, config]) => {
            const matchedKeywords = config.keywords.filter(keyword => 
                messageText.includes(keyword.toLowerCase())
            );
            
            if (matchedKeywords.length > 0) {
                detectedEmotions[category] = {
                    confidence: Math.min(matchedKeywords.length * 0.3, 1.0),
                    weight: config.weight,
                    matched_keywords: matchedKeywords,
                    description: config.description,
                    intensity: matchedKeywords.length >= 2 ? 'high' : 'medium'
                };
            }
        });

        const emotionKeys = Object.keys(detectedEmotions);
        const primaryEmotion = emotionKeys.length > 0 ? 
            emotionKeys.sort((a, b) => 
                (detectedEmotions[b].confidence * detectedEmotions[b].weight) - 
                (detectedEmotions[a].confidence * detectedEmotions[a].weight)
            )[0] : null;

        return {
            detected_emotions: detectedEmotions,
            primary_emotion: primaryEmotion,
            secondary_emotion: emotionKeys[1] || null,
            total_categories_detected: emotionKeys.length,
            overall_sentiment: primaryEmotion ? 'negative' : 'neutral',
            urgency_level: primaryEmotion === 'safety' ? 'high' : 'medium',
            recommended_approach: this.getRecommendedApproach(primaryEmotion),
            original_message: message,
            analysis_timestamp: new Date().toISOString(),
            analysis_mode: 'mock'
        };
    }

    getRecommendedApproach(primaryEmotion) {
        const approaches = {
            safety: '安全性の説明と信頼できるショップ推薦',
            skill: '初心者向けサポートの強調',
            solo: '一人参加歓迎の環境アピール',
            cost: 'コストパフォーマンス重視の提案',
            physical: '体力に配慮したプラン提案',
            communication: 'サポート体制の説明'
        };
        
        return approaches[primaryEmotion] || '総合的なサポート提案';
    }

    mockJijiResponse(emotionAnalysis, recommendedShops, userProfile) {
        const userName = userProfile.name || 'あなた';
        const primaryEmotion = emotionAnalysis.primary_emotion;
        
        let response = `${userName}さん、`;
        
        // 感情別の応答
        if (primaryEmotion === 'safety') {
            response += '安全面の心配、よく分かります。僕も最初はドキドキでした。でも心配いりません、';
        } else if (primaryEmotion === 'solo') {
            response += '一人参加って勇気いりますよね。僕もそうでした。でも大丈夫、';
        } else if (primaryEmotion === 'skill') {
            response += 'スキルの不安、みんな通る道ですよ。僕も最初は『絶対無理』って思ってました。';
        } else if (primaryEmotion === 'cost') {
            response += '予算の心配もありますよね。学生時代の僕もそうでした。';
        } else {
            response += `${userName}さんの気持ち、よく分かります。`;
        }
        
        if (recommendedShops.length > 0) {
            response += `${userName}さんにピッタリのショップを見つけました！`;
        } else {
            response += `一緒に${userName}さんに合うショップを見つけましょう！`;
        }
        
        response += ' 沖縄の海、きっと楽しんでもらえますよ🌊✨';
        
        return {
            jiji_main_message: response,
            response_type: 'mock_generated',
            emotion_addressed: primaryEmotion,
            personalization_level: 'medium',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get emotion analysis mode
     */
    getAnalysisMode() {
        return this.mode;
    }

    /**
     * Test OpenAI connection
     */
    async testConnection() {
        if (!this.openai) {
            throw new Error('OpenAI not initialized');
        }
        
        try {
            const testCompletion = await this.openai.chat.completions.create({
                model: "gpt-5",
                messages: [{ role: "user", content: "Hello, this is a connection test." }],
                max_completion_tokens: 10
            });
            
            return !!testCompletion.choices[0].message.content;
        } catch (error) {
            throw new Error(`OpenAI connection test failed: ${error.message}`);
        }
    }
}

module.exports = JijiOpenAIEmotionAnalyzer;