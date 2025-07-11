/**
 * Jiji β-testing Manager
 * Phase 5: β-testing運用・ユーザーフィードバック管理
 * 
 * ユーザーテスト管理・フィードバック分析・改善提案生成
 */

class JijiBetaTestingManager {
    constructor() {
        this.testUsers = new Map(); // userId -> userData
        this.feedbackCollection = [];
        this.testScenarios = [];
        this.metricsCollector = null;
        
        this.initializeTestScenarios();
        console.log('🧪 Beta Testing Manager initialized');
    }

    // ===== β-testing シナリオ設定 =====

    initializeTestScenarios() {
        this.testScenarios = [
            {
                id: 'scenario_1',
                name: '初心者ダイバー - 不安解消テスト',
                description: '初回ダイビング検討者の不安解消・共感度テスト',
                target_user: 'beginner',
                test_flow: [
                    'LINE Bot初回接触',
                    '不安表現入力（"初めてで怖いです"）',
                    '感情分析結果確認',
                    '店舗推薦受取',
                    'Web App詳細確認',
                    'フィードバック提供'
                ],
                success_criteria: {
                    emotion_analysis_accuracy: 0.85,
                    empathy_rating: 4.0,
                    recommendation_satisfaction: 4.0,
                    overall_experience: 4.0
                }
            },
            {
                id: 'scenario_2', 
                name: '一人参加希望者 - マッチングテスト',
                description: '一人参加不安のマッチング精度・安心感テスト',
                target_user: 'solo_diver',
                test_flow: [
                    'LINE Bot相談開始',
                    '一人参加不安入力',
                    '感情分析・マッチング実行',
                    '一人歓迎店舗推薦確認',
                    '詳細情報・安全性確認',
                    '予約意向・満足度評価'
                ],
                success_criteria: {
                    solo_friendly_match_rate: 0.90,
                    safety_concern_resolution: 4.0,
                    booking_intention: 0.70,
                    recommendation_accuracy: 4.0
                }
            },
            {
                id: 'scenario_3',
                name: '予算重視者 - コスト最適化テスト', 
                description: '予算制約のある利用者向けコスト最適化推薦テスト',
                target_user: 'budget_conscious',
                test_flow: [
                    'Web App直接アクセス',
                    '予算制約入力（"2万円以内"）',
                    'コスト重視マッチング',
                    '価格比較・節約提案確認',
                    '追加費用明確化確認',
                    'コストパフォーマンス評価'
                ],
                success_criteria: {
                    budget_match_accuracy: 0.88,
                    cost_transparency: 4.5,
                    value_perception: 4.0,
                    price_satisfaction: 4.0
                }
            }
        ];
    }

    // ===== ユーザー登録・管理 =====

    async registerTestUser(userData) {
        const userId = userData.user_id || `test_user_${Date.now()}`;
        
        const testUser = {
            user_id: userId,
            name: userData.name || 'Anonymous',
            email: userData.email || '',
            experience_level: userData.experience_level || 'beginner',
            test_scenarios_assigned: userData.scenarios || ['scenario_1'],
            registration_date: new Date().toISOString(),
            test_progress: {},
            feedback_history: [],
            contact_method: userData.contact_method || 'line',
            demographics: {
                age_range: userData.age_range || '',
                gender: userData.gender || '',
                location: userData.location || '',
                diving_frequency: userData.diving_frequency || ''
            },
            status: 'active'
        };

        this.testUsers.set(userId, testUser);
        
        console.log(`👤 Test user registered: ${testUser.name} (${userId})`);
        console.log(`   Scenarios: ${testUser.test_scenarios_assigned.join(', ')}`);
        
        return testUser;
    }

    async getTestUser(userId) {
        return this.testUsers.get(userId) || null;
    }

    async updateTestProgress(userId, scenarioId, stepData) {
        const user = this.testUsers.get(userId);
        if (!user) {
            console.warn(`⚠️ Test user not found: ${userId}`);
            return false;
        }

        if (!user.test_progress[scenarioId]) {
            user.test_progress[scenarioId] = {
                started: new Date().toISOString(),
                steps_completed: [],
                current_step: 0,
                status: 'in_progress'
            };
        }

        const progress = user.test_progress[scenarioId];
        progress.steps_completed.push({
            step: stepData.step,
            timestamp: new Date().toISOString(),
            data: stepData.data || {},
            success: stepData.success !== false
        });
        progress.current_step++;
        progress.last_updated = new Date().toISOString();

        // シナリオ完了チェック
        const scenario = this.testScenarios.find(s => s.id === scenarioId);
        if (scenario && progress.current_step >= scenario.test_flow.length) {
            progress.status = 'completed';
            progress.completed = new Date().toISOString();
            console.log(`✅ Test scenario completed: ${scenario.name} for user ${userId}`);
        }

        return true;
    }

    // ===== フィードバック収集・分析 =====

    async collectFeedback(userId, feedbackData) {
        const feedback = {
            feedback_id: `fb_${userId}_${Date.now()}`,
            user_id: userId,
            timestamp: new Date().toISOString(),
            scenario_id: feedbackData.scenario_id || '',
            category: feedbackData.category || 'general',
            
            // 評価項目
            ratings: {
                overall_satisfaction: feedbackData.overall_satisfaction || 0,
                emotion_analysis_accuracy: feedbackData.emotion_analysis_accuracy || 0,
                recommendation_quality: feedbackData.recommendation_quality || 0,
                user_interface: feedbackData.user_interface || 0,
                jiji_personality: feedbackData.jiji_personality || 0,
                response_time: feedbackData.response_time || 0
            },
            
            // テキストフィードバック
            comments: {
                positive_aspects: feedbackData.positive_aspects || '',
                improvement_suggestions: feedbackData.improvement_suggestions || '',
                bug_reports: feedbackData.bug_reports || '',
                feature_requests: feedbackData.feature_requests || '',
                general_comments: feedbackData.general_comments || ''
            },
            
            // 継続利用意向
            user_intention: {
                continue_using: feedbackData.continue_using || false,
                recommend_to_friends: feedbackData.recommend_to_friends || false,
                booking_intention: feedbackData.booking_intention || false,
                nps_score: feedbackData.nps_score || 0
            },
            
            // 技術的データ
            technical_data: {
                platform: feedbackData.platform || 'unknown',
                user_agent: feedbackData.user_agent || '',
                session_duration: feedbackData.session_duration || 0,
                errors_encountered: feedbackData.errors_encountered || []
            }
        };

        // ユーザーのフィードバック履歴に追加
        const user = this.testUsers.get(userId);
        if (user) {
            user.feedback_history.push(feedback);
        }

        this.feedbackCollection.push(feedback);
        
        console.log(`📝 Feedback collected from user ${userId}`);
        console.log(`   Overall satisfaction: ${feedback.ratings.overall_satisfaction}/5`);
        console.log(`   NPS score: ${feedback.user_intention.nps_score}`);
        
        return feedback;
    }

    // ===== 分析・レポート生成 =====

    async generateTestingReport() {
        const report = {
            report_id: `report_${Date.now()}`,
            generated_at: new Date().toISOString(),
            period: {
                start: this.getEarliestTestDate(),
                end: new Date().toISOString()
            },
            
            // 全体統計
            overall_stats: {
                total_test_users: this.testUsers.size,
                total_feedback_entries: this.feedbackCollection.length,
                active_test_users: this.getActiveUsersCount(),
                completed_scenarios: this.getCompletedScenariosCount()
            },
            
            // シナリオ別成果
            scenario_performance: this.analyzeScenarioPerformance(),
            
            // 満足度分析
            satisfaction_analysis: this.analyzeSatisfactionMetrics(),
            
            // 改善提案
            improvement_recommendations: this.generateImprovementRecommendations(),
            
            // NPS分析
            nps_analysis: this.calculateNPSMetrics(),
            
            // 技術指標
            technical_metrics: this.analyzeTechnicalMetrics()
        };

        console.log('📊 Beta testing report generated');
        console.log(`   Test users: ${report.overall_stats.total_test_users}`);
        console.log(`   Feedback entries: ${report.overall_stats.total_feedback_entries}`);
        console.log(`   Average satisfaction: ${report.satisfaction_analysis.average_overall}/5`);
        
        return report;
    }

    analyzeScenarioPerformance() {
        return this.testScenarios.map(scenario => {
            const scenarioFeedback = this.feedbackCollection.filter(
                fb => fb.scenario_id === scenario.id
            );
            
            const completedTests = Array.from(this.testUsers.values()).filter(user => 
                user.test_progress[scenario.id]?.status === 'completed'
            ).length;

            const avgRatings = this.calculateAverageRatings(scenarioFeedback);
            
            return {
                scenario_id: scenario.id,
                scenario_name: scenario.name,
                tests_completed: completedTests,
                feedback_count: scenarioFeedback.length,
                success_criteria_met: this.checkSuccessCriteria(scenario, avgRatings),
                average_ratings: avgRatings,
                completion_rate: completedTests / this.testUsers.size
            };
        });
    }

    analyzeSatisfactionMetrics() {
        if (this.feedbackCollection.length === 0) {
            return { average_overall: 0, distribution: {} };
        }

        const satisfactionScores = this.feedbackCollection.map(
            fb => fb.ratings.overall_satisfaction
        ).filter(score => score > 0);

        const average = satisfactionScores.reduce((a, b) => a + b, 0) / satisfactionScores.length;
        
        const distribution = {};
        satisfactionScores.forEach(score => {
            distribution[score] = (distribution[score] || 0) + 1;
        });

        return {
            average_overall: Math.round(average * 100) / 100,
            distribution,
            total_responses: satisfactionScores.length
        };
    }

    generateImprovementRecommendations() {
        const recommendations = [];
        
        // 満足度分析に基づく改善提案
        const satisfaction = this.analyzeSatisfactionMetrics();
        if (satisfaction.average_overall < 4.0) {
            recommendations.push({
                priority: 'high',
                category: 'user_experience',
                issue: `Average satisfaction below target (${satisfaction.average_overall}/5)`,
                recommendation: 'Focus on improving core user experience elements',
                specific_actions: [
                    'Review emotion analysis accuracy',
                    'Improve Jiji response quality',
                    'Optimize response times',
                    'Enhance UI/UX design'
                ]
            });
        }

        // フィードバックテキストから共通課題抽出
        const commonIssues = this.extractCommonIssues();
        commonIssues.forEach(issue => {
            recommendations.push({
                priority: issue.frequency > 3 ? 'high' : 'medium',
                category: 'feature_improvement',
                issue: issue.description,
                recommendation: `Address recurring user concern: ${issue.description}`,
                frequency: issue.frequency,
                specific_actions: issue.suggested_actions
            });
        });

        return recommendations;
    }

    calculateNPSMetrics() {
        const npsScores = this.feedbackCollection
            .map(fb => fb.user_intention.nps_score)
            .filter(score => score >= 0 && score <= 10);

        if (npsScores.length === 0) {
            return { nps: 0, promoters: 0, passives: 0, detractors: 0 };
        }

        const promoters = npsScores.filter(score => score >= 9).length;
        const passives = npsScores.filter(score => score >= 7 && score <= 8).length;
        const detractors = npsScores.filter(score => score <= 6).length;
        
        const nps = Math.round(((promoters - detractors) / npsScores.length) * 100);

        return {
            nps,
            promoters: Math.round((promoters / npsScores.length) * 100),
            passives: Math.round((passives / npsScores.length) * 100),
            detractors: Math.round((detractors / npsScores.length) * 100),
            total_responses: npsScores.length
        };
    }

    // ===== ヘルパーメソッド =====

    getEarliestTestDate() {
        const dates = Array.from(this.testUsers.values())
            .map(user => user.registration_date)
            .sort();
        return dates[0] || new Date().toISOString();
    }

    getActiveUsersCount() {
        return Array.from(this.testUsers.values())
            .filter(user => user.status === 'active').length;
    }

    getCompletedScenariosCount() {
        let completed = 0;
        this.testUsers.forEach(user => {
            Object.values(user.test_progress).forEach(progress => {
                if (progress.status === 'completed') completed++;
            });
        });
        return completed;
    }

    calculateAverageRatings(feedbackArray) {
        if (feedbackArray.length === 0) return {};
        
        const ratingKeys = ['overall_satisfaction', 'emotion_analysis_accuracy', 
                          'recommendation_quality', 'user_interface', 'jiji_personality'];
        
        const averages = {};
        ratingKeys.forEach(key => {
            const scores = feedbackArray
                .map(fb => fb.ratings[key])
                .filter(score => score > 0);
            
            averages[key] = scores.length > 0 ? 
                Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100 : 0;
        });
        
        return averages;
    }

    checkSuccessCriteria(scenario, avgRatings) {
        const criteria = scenario.success_criteria;
        const results = {};
        
        Object.keys(criteria).forEach(key => {
            if (avgRatings[key] !== undefined) {
                results[key] = avgRatings[key] >= criteria[key];
            }
        });
        
        return results;
    }

    extractCommonIssues() {
        // 簡単な課題抽出（実際の実装では自然言語処理を使用）
        const issueKeywords = {
            'slow_response': { keywords: ['遅い', 'slow', '重い'], suggested_actions: ['Optimize API response times', 'Improve caching'] },
            'emotion_accuracy': { keywords: ['分析', '間違い', 'wrong'], suggested_actions: ['Improve emotion analysis model', 'Add more training data'] },
            'ui_confusing': { keywords: ['わからない', 'confusing', '使いにくい'], suggested_actions: ['Simplify UI design', 'Add user guidance'] }
        };

        const issues = [];
        Object.keys(issueKeywords).forEach(issueKey => {
            const keywords = issueKeywords[issueKey].keywords;
            let frequency = 0;
            
            this.feedbackCollection.forEach(feedback => {
                const allText = Object.values(feedback.comments).join(' ').toLowerCase();
                if (keywords.some(keyword => allText.includes(keyword))) {
                    frequency++;
                }
            });
            
            if (frequency > 0) {
                issues.push({
                    description: issueKey.replace('_', ' '),
                    frequency,
                    suggested_actions: issueKeywords[issueKey].suggested_actions
                });
            }
        });

        return issues.sort((a, b) => b.frequency - a.frequency);
    }

    analyzeTechnicalMetrics() {
        const errorCounts = {};
        let totalSessionDuration = 0;
        let sessionCount = 0;

        this.feedbackCollection.forEach(feedback => {
            // エラー統計
            feedback.technical_data.errors_encountered.forEach(error => {
                errorCounts[error] = (errorCounts[error] || 0) + 1;
            });
            
            // セッション時間統計
            if (feedback.technical_data.session_duration > 0) {
                totalSessionDuration += feedback.technical_data.session_duration;
                sessionCount++;
            }
        });

        return {
            average_session_duration: sessionCount > 0 ? 
                Math.round(totalSessionDuration / sessionCount) : 0,
            common_errors: Object.keys(errorCounts)
                .sort((a, b) => errorCounts[b] - errorCounts[a])
                .slice(0, 5)
                .map(error => ({ error, count: errorCounts[error] })),
            total_error_count: Object.values(errorCounts).reduce((a, b) => a + b, 0)
        };
    }

    // ===== A/Bテスト強化機能 =====

    createAdvancedABTest(testConfig) {
        const abTest = {
            id: testConfig.id || `ab_test_${Date.now()}`,
            name: testConfig.name,
            description: testConfig.description,
            type: testConfig.type || 'ui_test', // ui_test, content_test, flow_test
            variations: testConfig.variations,
            target_audience: testConfig.target_audience || 'all',
            success_metrics: testConfig.success_metrics || ['conversion_rate'],
            traffic_allocation: testConfig.traffic_allocation || 0.5,
            status: 'active',
            start_date: new Date().toISOString(),
            estimated_duration_days: testConfig.duration_days || 14,
            results: {
                total_participants: 0,
                variation_results: {},
                statistical_significance: 0,
                confidence_level: 0.95
            }
        };

        // バリエーション結果の初期化
        testConfig.variations.forEach(variation => {
            abTest.results.variation_results[variation.id] = {
                participants: 0,
                conversions: 0,
                total_time_spent: 0,
                bounce_rate: 0,
                user_satisfaction: 0,
                completion_rate: 0
            };
        });

        console.log(`🧪 Advanced A/B test created: ${abTest.name}`);
        return abTest;
    }

    recordABTestResult(testId, userId, variationId, metrics) {
        // A/Bテスト結果記録
        const result = {
            test_id: testId,
            user_id: userId,
            variation_id: variationId,
            timestamp: new Date().toISOString(),
            metrics: {
                converted: metrics.converted || false,
                time_spent: metrics.time_spent || 0,
                satisfaction_score: metrics.satisfaction_score || 0,
                completed_flow: metrics.completed_flow || false,
                errors_encountered: metrics.errors_encountered || 0
            }
        };

        console.log(`📊 A/B test result recorded: ${testId} - ${variationId}`);
        return result;
    }

    // ===== 自動フィードバック収集 =====

    setupAutomaticFeedbackCollection() {
        const feedbackTriggers = [
            {
                trigger: 'emotion_analysis_completion',
                timing: 'immediately',
                questions: [
                    '感情分析の結果は理解しやすかったですか？',
                    '推薦されたショップは期待に合っていましたか？'
                ]
            },
            {
                trigger: 'shop_detail_view',
                timing: 'after_30_seconds',
                questions: [
                    '店舗の詳細情報は十分でしたか？',
                    '比較機能は使いやすかったですか？'
                ]
            },
            {
                trigger: 'session_end',
                timing: 'before_exit',
                questions: [
                    '全体的な体験はいかがでしたか？',
                    'Jijiをお友達に推薦したいですか？'
                ]
            }
        ];

        this.feedbackTriggers = feedbackTriggers;
        console.log('🔔 Automatic feedback collection setup completed');
    }

    triggerContextualFeedback(userId, trigger, context = {}) {
        const triggerConfig = this.feedbackTriggers?.find(t => t.trigger === trigger);
        if (!triggerConfig) return null;

        const feedbackRequest = {
            id: `feedback_${userId}_${Date.now()}`,
            user_id: userId,
            trigger,
            timestamp: new Date().toISOString(),
            questions: triggerConfig.questions,
            context,
            status: 'pending_response',
            type: 'contextual'
        };

        console.log(`💬 Contextual feedback triggered: ${trigger} for user ${userId}`);
        return feedbackRequest;
    }

    // ===== ユーザーセグメンテーション強化 =====

    segmentUsers() {
        const segments = {
            complete_beginners: [],
            experienced_beginners: [],
            solo_travelers: [],
            budget_conscious: [],
            safety_focused: [],
            social_divers: []
        };

        this.testUsers.forEach(user => {
            // 経験レベルによるセグメント
            if (user.experience_level === 'complete_beginner') {
                segments.complete_beginners.push(user.user_id);
            } else if (user.experience_level === 'beginner') {
                segments.experienced_beginners.push(user.user_id);
            }

            // 行動パターンによるセグメント
            const feedbacks = user.feedback_history || [];
            feedbacks.forEach(feedback => {
                if (feedback.comments.general_comments) {
                    const comment = feedback.comments.general_comments.toLowerCase();
                    
                    if (comment.includes('一人') || comment.includes('solo')) {
                        segments.solo_travelers.push(user.user_id);
                    }
                    if (comment.includes('予算') || comment.includes('安い') || comment.includes('budget')) {
                        segments.budget_conscious.push(user.user_id);
                    }
                    if (comment.includes('安全') || comment.includes('safety')) {
                        segments.safety_focused.push(user.user_id);
                    }
                    if (comment.includes('友達') || comment.includes('グループ') || comment.includes('social')) {
                        segments.social_divers.push(user.user_id);
                    }
                }
            });
        });

        // 重複除去
        Object.keys(segments).forEach(key => {
            segments[key] = [...new Set(segments[key])];
        });

        return segments;
    }

    // ===== パーソナライズされたテスト体験 =====

    createPersonalizedTestExperience(userId) {
        const user = this.testUsers.get(userId);
        if (!user) return null;

        const experience = {
            user_id: userId,
            personalization: {
                recommended_scenarios: [],
                priority_features: [],
                custom_questions: [],
                expected_completion_time: 30 // minutes
            },
            created_at: new Date().toISOString()
        };

        // 経験レベルに基づく推奨シナリオ
        if (user.experience_level === 'complete_beginner') {
            experience.personalization.recommended_scenarios = ['scenario_1', 'scenario_2'];
            experience.personalization.priority_features = [
                'emotion_analysis_accuracy',
                'jiji_empathy',
                'safety_information'
            ];
        } else if (user.experience_level === 'beginner') {
            experience.personalization.recommended_scenarios = ['scenario_2', 'scenario_3'];
            experience.personalization.priority_features = [
                'recommendation_quality',
                'shop_comparison',
                'value_for_money'
            ];
        }

        // カスタム質問生成
        experience.personalization.custom_questions = [
            `${user.name}さんの体験として、最も価値を感じた機能は何ですか？`,
            `初心者の${user.demographics.age_range}として、どの不安が最も解消されましたか？`,
            'どのような改善があれば、より使いやすくなると思いますか？'
        ];

        return experience;
    }

    // ===== 継続エンゲージメント管理 =====

    manageContinuousEngagement(userId) {
        const user = this.testUsers.get(userId);
        if (!user) return null;

        const engagement = {
            user_id: userId,
            engagement_score: this.calculateEngagementScore(user),
            next_actions: [],
            retention_risk: 'low',
            recommended_interventions: []
        };

        // エンゲージメントスコアに基づく施策
        if (engagement.engagement_score < 30) {
            engagement.retention_risk = 'high';
            engagement.recommended_interventions = [
                'personal_follow_up_message',
                'simplified_onboarding',
                'direct_support_offer'
            ];
        } else if (engagement.engagement_score < 60) {
            engagement.retention_risk = 'medium';
            engagement.recommended_interventions = [
                'feature_tips',
                'success_stories_sharing',
                'community_introduction'
            ];
        } else {
            engagement.retention_risk = 'low';
            engagement.recommended_interventions = [
                'advocate_program_invitation',
                'advanced_features_introduction',
                'referral_program_participation'
            ];
        }

        return engagement;
    }

    calculateEngagementScore(user) {
        let score = 0;
        
        // セッション完了率
        const completedScenarios = Object.values(user.test_progress || {})
            .filter(p => p.status === 'completed').length;
        score += completedScenarios * 20; // 最大60点
        
        // フィードバック提供
        score += Math.min(user.feedback_history?.length || 0, 2) * 15; // 最大30点
        
        // 最新活動（7日以内）
        const lastActivity = new Date(user.test_progress?.last_updated || user.registration_date);
        const daysSinceActivity = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceActivity <= 7) score += 10;
        
        return Math.min(score, 100);
    }

    // ===== 外部インターフェース =====

    async exportTestingData() {
        return {
            test_users: Array.from(this.testUsers.values()),
            feedback_collection: this.feedbackCollection,
            test_scenarios: this.testScenarios,
            user_segments: this.segmentUsers(),
            report: await this.generateTestingReport()
        };
    }

    getTestingStatus() {
        return {
            active_tests: this.getActiveUsersCount(),
            total_users: this.testUsers.size,
            total_feedback: this.feedbackCollection.length,
            latest_activity: this.feedbackCollection.length > 0 ? 
                this.feedbackCollection[this.feedbackCollection.length - 1].timestamp : null
        };
    }
}

module.exports = JijiBetaTestingManager;