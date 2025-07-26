/**
 * 🌊 Dive Buddy's アンケートシステム v2.8
 * ユーザープロファイル構築・リッチメニュー対応
 */

const { supabase } = require('./database');
const { generateAdvancedSystemPrompt } = require('./jiji-persona');

// アンケート状態管理
const SURVEY_STATES = {
    Q1: 'q1',
    Q1_5: 'q1_5', 
    Q2: 'q2',
    COMPLETED: 'completed'
};

// アンケート質問定義
const SURVEY_QUESTIONS = {
    Q1: {
        id: 'q1',
        text: '🏝️ ダイビング経験はどのくらい？',
        type: 'quick_reply',
        options: [
            { value: 'okinawa_experienced', emoji: '🌊', text: '沖縄で何度もダイビング経験あり' },
            { value: 'okinawa_few_times', emoji: '🤿', text: '沖縄で1-2回だけ経験' },
            { value: 'other_location_experienced', emoji: '🏖️', text: '他の場所でダイビング経験あり（沖縄は未経験）' },
            { value: 'complete_beginner', emoji: '❓', text: 'ダイビング自体が初心者' },
            { value: 'skip', emoji: '⏭️', text: '後で答える' }
        ]
    },
    Q1_5: {
        id: 'q1_5',
        text: '🎫 ダイビングライセンスは？',
        type: 'quick_reply',
        options: [
            { value: 'owd', emoji: '🎫', text: 'オープンウォーター（OWD）' },
            { value: 'aow_plus', emoji: '🏆', text: 'アドバンス（AOW）以上' },
            { value: 'experience_only', emoji: '🔰', text: '体験ダイビングのみ' },
            { value: 'none', emoji: '❓', text: 'まだ持っていない' },
            { value: 'skip', emoji: '⏭️', text: '後で答える' }
        ]
    }
};

// Q2分岐質問定義
const Q2_BRANCHED_QUESTIONS = {
    // 沖縄経験者ルート
    okinawa_experienced: {
        id: 'q2_okinawa_areas',
        text: '📍 どのエリアで潜ったことがある？',
        options: [
            { value: 'ishigaki_yaeyama', emoji: '🏝️', text: '石垣島・八重山諸島' },
            { value: 'miyako_islands', emoji: '🌺', text: '宮古島・宮古諸島' },
            { value: 'okinawa_mainland', emoji: '🏖️', text: '沖縄本島周辺' },
            { value: 'multiple_areas', emoji: '🌊', text: '複数エリア経験あり' },
            { value: 'back', emoji: '◀️', text: '前の質問に戻る' }
        ]
    },
    okinawa_few_times: {
        id: 'q2_okinawa_areas', 
        text: '📍 どのエリアで潜ったことがある？',
        options: [
            { value: 'ishigaki_yaeyama', emoji: '🏝️', text: '石垣島・八重山諸島' },
            { value: 'miyako_islands', emoji: '🌺', text: '宮古島・宮古諸島' },
            { value: 'okinawa_mainland', emoji: '🏖️', text: '沖縄本島周辺' },
            { value: 'not_sure', emoji: '🤔', text: 'よく覚えていない' },
            { value: 'back', emoji: '◀️', text: '前の質問に戻る' }
        ]
    },
    // 他地域経験者ルート
    other_location_experienced: {
        id: 'q2_okinawa_interests',
        text: '💭 沖縄ダイビングで一番興味があることは？',
        options: [
            { value: 'big_creatures', emoji: '🦈', text: '大物（マンタ・ジンベエザメ）' },
            { value: 'underwater_topography', emoji: '🏞️', text: '地形（洞窟・アーチ）' },
            { value: 'healing_creatures', emoji: '🐢', text: '癒し系（ウミガメ・サンゴ）' },
            { value: 'clarity_beauty', emoji: '💙', text: '透明度・美しさ' },
            { value: 'back', emoji: '◀️', text: '前の質問に戻る' }
        ]
    },
    // 完全未経験者ルート
    complete_beginner: {
        id: 'q2_main_concerns',
        text: '💭 一番気になることは？',
        options: [
            { value: 'safety_concerns', emoji: '😰', text: '安全面・事故の心配' },
            { value: 'skill_anxiety', emoji: '🤿', text: '泳げない・スキル不安' },
            { value: 'budget_concerns', emoji: '💸', text: '費用・予算の心配' },
            { value: 'where_to_start', emoji: '📋', text: '何から始めればいいか分からない' },
            { value: 'back', emoji: '◀️', text: '前の質問に戻る' }
        ]
    }
};

/**
 * アンケートシステムクラス
 */
class SurveyManager {
    
    /**
     * アンケート開始
     * @param {string} userId - LINEユーザーID
     * @param {boolean} isInitialRegistration - 初回登録かどうか
     * @returns {Object} LINE応答メッセージ
     */
    async startSurvey(userId, isInitialRegistration = false) {
        try {
            console.log(`📋 アンケート開始: ${userId} (初回: ${isInitialRegistration})`);
            
            // 既存アンケート状況確認
            const existingSurvey = await this.getUserSurvey(userId);
            
            if (existingSurvey && existingSurvey.survey_completed && !isInitialRegistration) {
                return this.generateUpdateSurveyPrompt(existingSurvey);
            }
            
            // 新規アンケート開始
            await this.initializeSurvey(userId);
            
            const welcomeMessage = isInitialRegistration ? 
                this.getInitialWelcomeMessage() : 
                this.getUpdateWelcomeMessage();
            
            return {
                type: 'survey_start',
                message: welcomeMessage,
                quickReply: this.generateQuickReply(SURVEY_QUESTIONS.Q1)
            };
            
        } catch (error) {
            console.error('❌ アンケート開始エラー:', error);
            return {
                type: 'error',
                message: 'アンケートの開始でエラーが発生しました。もう一度お試しください。'
            };
        }
    }
    
    /**
     * アンケート回答処理
     * @param {string} userId - LINEユーザーID
     * @param {string} answer - 選択された回答
     * @returns {Object} 次の質問またはアンケート完了メッセージ
     */
    async processAnswer(userId, answer) {
        try {
            const survey = await this.getUserSurvey(userId);
            if (!survey) {
                return this.startSurvey(userId);
            }
            
            const currentState = survey.current_question;
            console.log(`📝 回答処理: ${userId} - 質問${currentState} - 回答${answer}`);
            
            // 戻るボタン処理
            if (answer === 'back') {
                return await this.handleBackNavigation(userId, currentState);
            }
            
            // スキップ処理
            if (answer === 'skip') {
                return await this.handleSkip(userId, currentState);
            }
            
            // 回答記録
            await this.recordAnswer(userId, currentState, answer);
            
            // 次の質問決定
            return await this.getNextQuestion(userId, currentState, answer);
            
        } catch (error) {
            console.error('❌ アンケート回答処理エラー:', error);
            return {
                type: 'error',
                message: 'すみません、回答の処理でエラーが発生しました。もう一度お試しください。'
            };
        }
    }
    
    /**
     * 次の質問を決定
     * @param {string} userId - ユーザーID
     * @param {string} currentState - 現在の質問状態
     * @param {string} answer - 回答
     * @returns {Object} 次の質問メッセージ
     */
    async getNextQuestion(userId, currentState, answer) {
        let nextState, nextQuestion;
        
        switch (currentState) {
            case SURVEY_STATES.Q1:
                // Q1 → Q1.5 (ライセンス質問)
                nextState = SURVEY_STATES.Q1_5;
                nextQuestion = SURVEY_QUESTIONS.Q1_5;
                break;
                
            case SURVEY_STATES.Q1_5:
                // Q1.5 → Q2 (分岐質問)
                nextState = SURVEY_STATES.Q2;
                const q1Answer = await this.getQ1Answer(userId);
                nextQuestion = this.getBranchedQ2Question(q1Answer);
                break;
                
            case SURVEY_STATES.Q2:
                // Q2 → アンケート完了
                await this.completeSurvey(userId);
                return await this.generateCompletionMessage(userId);
                
            default:
                return {
                    type: 'error',
                    message: 'アンケートの状態が不正です。最初からやり直してください。'
                };
        }
        
        // 次の質問の状態を更新
        await this.updateSurveyState(userId, nextState);
        
        return {
            type: 'survey_question',
            message: this.generateQuestionMessage(nextQuestion, currentState),
            quickReply: this.generateQuickReply(nextQuestion)
        };
    }
    
    /**
     * 分岐Q2質問を取得
     * @param {string} q1Answer - Q1の回答
     * @returns {Object} Q2質問オブジェクト
     */
    getBranchedQ2Question(q1Answer) {
        return Q2_BRANCHED_QUESTIONS[q1Answer] || Q2_BRANCHED_QUESTIONS.complete_beginner;
    }
    
    /**
     * QuickReply形式のメッセージ生成
     * @param {Object} question - 質問オブジェクト
     * @returns {Object} QuickReplyメッセージ
     */
    generateQuickReply(question) {
        return {
            items: question.options.map(option => ({
                type: 'action',
                action: {
                    type: 'message',
                    label: `${option.emoji} ${option.text.substring(0, 20)}`,
                    text: option.value
                }
            }))
        };
    }
    
    /**
     * 質問メッセージ生成
     * @param {Object} question - 質問オブジェクト
     * @param {string} currentState - 現在の状態
     * @returns {string} 質問メッセージ
     */
    generateQuestionMessage(question, currentState) {
        const progressText = this.getProgressText(currentState);
        return `${progressText}\n\n${question.text}\n\n下の選択肢から選んでくださいね！`;
    }
    
    /**
     * 進捗表示テキスト取得
     * @param {string} state - 現在の状態
     * @returns {string} 進捗テキスト
     */
    getProgressText(state) {
        const progressMap = {
            [SURVEY_STATES.Q1]: '📊 質問 1/3',
            [SURVEY_STATES.Q1_5]: '📊 質問 2/3', 
            [SURVEY_STATES.Q2]: '📊 質問 3/3'
        };
        return progressMap[state] || '📊 アンケート進行中';
    }
    
    /**
     * アンケート完了処理
     * @param {string} userId - ユーザーID
     * @returns {Promise<void>}
     */
    async completeSurvey(userId) {
        const completedAt = new Date();
        
        const { error } = await supabase
            .from('user_surveys')
            .update({
                survey_completed: true,
                completed_at: completedAt.toISOString(),
                current_question: SURVEY_STATES.COMPLETED
            })
            .eq('user_id', userId);
        
        if (error) {
            console.error('❌ アンケート完了更新エラー:', error);
            throw error;
        }
        
        // アンケート分析・洞察生成
        await this.generateSurveyInsights(userId);
        
        console.log(`✅ アンケート完了: ${userId}`);
    }
    
    /**
     * アンケート完了メッセージ生成
     * @param {string} userId - ユーザーID
     * @returns {Object} 完了メッセージ
     */
    async generateCompletionMessage(userId) {
        const survey = await this.getUserSurvey(userId);
        const insights = await this.getSurveyInsights(userId);
        
        let message = `🎉 アンケートありがとうございました！\n\n`;
        
        // パーソナライズされたメッセージ
        if (insights) {
            message += this.generatePersonalizedCompletionMessage(survey, insights);
        } else {
            message += `これで基本的なプロファイルができました。\n\n`;
        }
        
        message += `これからの会話で、あなたの好みや状況を\nもっと深く理解していくからね。\n\n`;
        message += `何でも気軽に相談してください！\n`;
        message += `沖縄の海のことなら任せて🌊\n\n`;
        message += `ショップをお探しの時は\n「ショップをマッチング」と送ってくださいね✨`;
        
        return {
            type: 'survey_completed',
            message: message
        };
    }
    
    /**
     * パーソナライズされた完了メッセージ生成
     * @param {Object} survey - アンケート結果
     * @param {Object} insights - 分析結果
     * @returns {string} メッセージ
     */
    generatePersonalizedCompletionMessage(survey, insights) {
        const segment = insights.user_segment;
        
        const messages = {
            'experienced_diver': `AOWホルダーということなので、\n沖縄の上級ポイントも含めて\n幅広くご提案できそうです！🤿\n\n`,
            'intermediate_diver': `ダイビング経験をお持ちなので、\n沖縄特有の魅力をたっぷり\nお伝えできそうです！🏝️\n\n`,
            'beginner_diver': `初心者ということなので、\n安全で楽しいダイビングから\n始めていきましょう！🌺\n\n`
        };
        
        return messages[segment] || `あなたに合った沖縄ダイビング体験を\nご提案していきますね！🌊\n\n`;
    }
    
    /**
     * データベース操作メソッド群
     */
    
    async initializeSurvey(userId) {
        // Supabaseが無効な場合は新規として扱う
        if (!supabase) {
            console.log('ℹ️ Survey初期化スキップ (DB無効):', userId);
            return;
        }
        
        const now = new Date().toISOString();
        
        try {
            // まず既存データを確認
            const { data: existing } = await supabase
                .from('user_surveys')
                .select('*')
                .eq('user_id', userId)
                .single();
        
        if (existing) {
            // 既存データを更新
            const { error } = await supabase
                .from('user_surveys')
                .update({
                    current_question: SURVEY_STATES.Q1,
                    started_at: now,
                    survey_completed: false
                })
                .eq('user_id', userId);
            
            if (error) {
                console.error('❌ アンケート更新エラー:', error);
                throw error;
            }
        } else {
            // 新規作成
            const { error } = await supabase
                .from('user_surveys')
                .insert({
                    user_id: userId,
                    current_question: SURVEY_STATES.Q1,
                    started_at: now,
                    survey_completed: false
                });
            
            if (error) {
                console.error('❌ アンケート作成エラー:', error);
                throw error;
            }
        }
        } catch (err) {
            console.error('❌ Survey初期化エラー:', err.message);
        }
    }
    
    async getUserSurvey(userId) {
        // Supabaseが無効な場合はnullを返す
        if (!supabase) {
            return null;
        }
        
        try {
            const { data, error } = await supabase
                .from('user_surveys')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
                console.error('❌ ユーザーアンケート取得エラー:', error);
                return null;
            }
            
            return data;
        } catch (err) {
            console.error('❌ Survey取得例外:', err.message);
            return null;
        }
    }
    
    async recordAnswer(userId, questionId, answer) {
        const question = this.getQuestionById(questionId);
        const option = question?.options?.find(opt => opt.value === answer);
        
        // Supabaseが利用可能な場合のみ記録
        if (!supabase) {
            console.log('ℹ️ Survey回答記録スキップ (DB無効):', userId, questionId, answer);
            return;
        }
        
        try {
            // survey_responses に回答を記録
            const { error: responseError } = await supabase
                .from('survey_responses')
                .insert({
                    user_id: userId,
                    question_id: questionId,
                    question_text: question?.text || 'Unknown question',
                    selected_option: answer,
                    option_emoji: option?.emoji || '❓',
                    option_text: option?.text || answer,
                    answered_at: new Date().toISOString()
            });
        
            if (responseError) {
                console.error('❌ 回答記録エラー:', responseError);
                return;
            }
            
            // user_surveys テーブルも更新
            const updateField = this.getUpdateField(questionId);
            if (updateField) {
                const updateData = {};
                updateData[updateField] = answer;
                
                const { error: updateError } = await supabase
                    .from('user_surveys')
                    .update(updateData)
                    .eq('user_id', userId);
                
                if (updateError) {
                    console.error('❌ アンケート更新エラー:', updateError);
                }
            }
        } catch (err) {
            console.error('❌ Survey記録処理エラー:', err.message);
        }
    }
    
    getQuestionById(questionId) {
        if (questionId === SURVEY_STATES.Q1) return SURVEY_QUESTIONS.Q1;
        if (questionId === SURVEY_STATES.Q1_5) return SURVEY_QUESTIONS.Q1_5;
        // Q2は動的なので別途処理
        return { text: 'Q2 question', options: [] };
    }
    
    getUpdateField(questionId) {
        const fieldMap = {
            [SURVEY_STATES.Q1]: 'experience_level',
            [SURVEY_STATES.Q1_5]: 'license_type',
            [SURVEY_STATES.Q2]: 'q2_response'
        };
        return fieldMap[questionId];
    }
    
    async updateSurveyState(userId, newState) {
        const { error } = await supabase
            .from('user_surveys')
            .update({ current_question: newState })
            .eq('user_id', userId);
        
        if (error) {
            console.error('❌ アンケート状態更新エラー:', error);
            throw error;
        }
    }
    
    async getQ1Answer(userId) {
        const { data, error } = await supabase
            .from('user_surveys')
            .select('experience_level')
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('❌ Q1回答取得エラー:', error);
            return 'complete_beginner';
        }
        
        return data?.experience_level || 'complete_beginner';
    }
    
    /**
     * アンケート分析・洞察生成
     * @param {string} userId - ユーザーID
     */
    async generateSurveyInsights(userId) {
        const survey = await this.getUserSurvey(userId);
        
        // ユーザーセグメント判定
        const userSegment = this.determineUserSegment(survey);
        const primaryMotivation = this.determinePrimaryMotivation(survey);
        const recommendedApproach = this.determineRecommendedApproach(survey);
        
        // 既存の分析結果を確認
        const { data: existing } = await supabase
            .from('survey_insights')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        const insightData = {
            user_id: userId,
            user_segment: userSegment,
            primary_motivation: primaryMotivation,
            recommended_approach: recommendedApproach,
            analysis_confidence: 0.85,
            generated_at: new Date().toISOString()
        };
        
        if (existing) {
            // 更新
            const { error } = await supabase
                .from('survey_insights')
                .update(insightData)
                .eq('user_id', userId);
            
            if (error) {
                console.error('❌ 分析結果更新エラー:', error);
                throw error;
            }
        } else {
            // 新規作成
            const { error } = await supabase
                .from('survey_insights')
                .insert(insightData);
            
            if (error) {
                console.error('❌ 分析結果作成エラー:', error);
                throw error;
            }
        }
    }
    
    determineUserSegment(survey) {
        if (survey.license_type === 'aow_plus') return 'experienced_diver';
        if (survey.experience_level === 'okinawa_experienced') return 'experienced_diver';
        if (survey.experience_level === 'other_location_experienced') return 'intermediate_diver';
        return 'beginner_diver';
    }
    
    determinePrimaryMotivation(survey) {
        // Q2回答から主要動機を判定
        if (survey.q2_response) {
            const q2 = JSON.parse(survey.q2_response);
            if (q2.safety_concerns) return 'safety';
            if (q2.big_creatures) return 'adventure';
            if (q2.healing_creatures) return 'relaxation';
        }
        return 'learning';
    }
    
    determineRecommendedApproach(survey) {
        const segment = this.determineUserSegment(survey);
        const approaches = {
            'experienced_diver': 'advanced_challenges',
            'intermediate_diver': 'skill_development',
            'beginner_diver': 'gradual_introduction'
        };
        return approaches[segment] || 'gradual_introduction';
    }
    
    async getSurveyInsights(userId) {
        const { data, error } = await supabase
            .from('survey_insights')
            .select('*')
            .eq('user_id', userId)
            .single();
        
        if (error && error.code !== 'PGRST116') {
            console.error('❌ 分析結果取得エラー:', error);
            return null;
        }
        
        return data || null;
    }
    
    /**
     * ウェルカムメッセージ生成
     */
    getInitialWelcomeMessage() {
        return `🌺 はいさい！Dive Buddy'sのJijiだよ！\n` +
               `沖縄ダイビングの専属バディとして\n` +
               `サポートさせてもらうね✨\n\n` +
               `まずは簡単なアンケート（3問30秒）で\n` +
               `あなたのことを教えてもらえる？`;
    }
    
    getUpdateWelcomeMessage() {
        return `📋 プロファイル更新\n\n` +
               `より良い提案のために、\n` +
               `アンケートを更新しますか？`;
    }
    
    generateUpdateSurveyPrompt(existingSurvey) {
        const profile = this.formatExistingProfile(existingSurvey);
        
        return {
            type: 'survey_update_prompt',
            message: `📋 現在のプロファイル設定\n\n${profile}\n\n設定を更新しますか？`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '✅ はい、更新する',
                            text: 'survey_update_yes'
                        }
                    },
                    {
                        type: 'action', 
                        action: {
                            type: 'message',
                            label: '❌ いいえ、戻る',
                            text: 'survey_update_no'
                        }
                    }
                ]
            }
        };
    }
    
    formatExistingProfile(survey) {
        const experienceText = {
            'okinawa_experienced': '🌊 沖縄で豊富な経験',
            'okinawa_few_times': '🤿 沖縄で少し経験',
            'other_location_experienced': '🏖️ 他地域で経験',
            'complete_beginner': '❓ 初心者'
        };
        
        const licenseText = {
            'aow_plus': '🏆 アドバンス以上',
            'owd': '🎫 オープンウォーター',
            'experience_only': '🔰 体験ダイビングのみ',
            'none': '❓ ライセンスなし'
        };
        
        return `🤿 ダイビング経験: ${experienceText[survey.experience_level] || '未設定'}\n` +
               `📝 ライセンス: ${licenseText[survey.license_type] || '未設定'}`;
    }
    
    /**
     * 戻るナビゲーション処理
     */
    async handleBackNavigation(userId, currentState) {
        let prevState;
        let prevQuestion;
        
        switch (currentState) {
            case SURVEY_STATES.Q2:
                prevState = SURVEY_STATES.Q1_5;
                prevQuestion = SURVEY_QUESTIONS.Q1_5;
                break;
            case SURVEY_STATES.Q1_5:
                prevState = SURVEY_STATES.Q1;
                prevQuestion = SURVEY_QUESTIONS.Q1;
                break;
            default:
                return {
                    type: 'error',
                    message: 'これ以上戻れません。'
                };
        }
        
        await this.updateSurveyState(userId, prevState);
        
        return {
            type: 'survey_question',
            message: `◀️ 前の質問に戻りました\n\n${this.generateQuestionMessage(prevQuestion, prevState)}`,
            quickReply: this.generateQuickReply(prevQuestion)
        };
    }
    
    /**
     * スキップ処理
     */
    async handleSkip(userId, currentState) {
        // スキップを記録
        await this.recordAnswer(userId, currentState, 'skip');
        
        // 次の質問へ
        return await this.getNextQuestion(userId, currentState, 'skip');
    }
}

// シングルトンパターンでエクスポート
const surveyManager = new SurveyManager();

module.exports = {
    SurveyManager,
    surveyManager,
    SURVEY_STATES,
    SURVEY_QUESTIONS
};