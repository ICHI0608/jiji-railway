/**
 * Jiji Marketing Manager
 * Phase 5: ユーザー獲得・マーケティング自動化システム
 * 
 * SNS連携・紹介コード・インフルエンサー管理・SEO強化
 * v2.7計画書準拠実装
 */

class JijiMarketingManager {
    constructor() {
        this.campaigns = new Map(); // campaignId -> campaignData
        this.referralCodes = new Map(); // code -> referralData
        this.userInvitations = new Map(); // userId -> invitationData
        this.influencerPartners = new Map(); // partnerId -> partnerData
        this.contentLibrary = new Map(); // contentId -> contentData
        
        this.initializeMarketingSystem();
        console.log('📈 Marketing Manager initialized - Phase 5');
    }

    // ===== システム初期化 =====

    initializeMarketingSystem() {
        // デフォルトキャンペーン設定
        this.setupDefaultCampaigns();
        
        // コンテンツライブラリ初期化
        this.initializeContentLibrary();
        
        // SNS連携設定
        this.initializeSocialMedia();
        
        console.log('✅ Marketing system initialized');
    }

    setupDefaultCampaigns() {
        // 初回ユーザー獲得キャンペーン
        this.createCampaign({
            id: 'first_user_campaign',
            name: '初回ユーザー獲得キャンペーン',
            type: 'user_acquisition',
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90日間
            target: {
                user_count: 1000,
                conversion_rate: 0.15, // 15%
                engagement_rate: 0.60 // 60%
            },
            incentives: {
                referrer_reward: 'プレミアム機能1週間無料',
                referee_reward: '初回相談で特別推薦',
                shop_bonus: '紹介手数料5%アップ'
            },
            channels: ['line', 'web', 'sns', 'word_of_mouth']
        });

        // βテストユーザー募集キャンペーン
        this.createCampaign({
            id: 'beta_tester_recruitment',
            name: 'βテストユーザー募集',
            type: 'beta_testing',
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30日間
            target: {
                user_count: 100,
                feedback_rate: 0.80, // 80%
                completion_rate: 0.70 // 70%
            },
            incentives: {
                early_access: 'プレミアム機能先行アクセス',
                feedback_reward: 'Amazonギフト券1000円',
                community_access: '限定βテスターコミュニティ参加'
            },
            channels: ['sns', 'diving_communities', 'influencer']
        });
    }

    initializeContentLibrary() {
        // SNS投稿用コンテンツ
        const socialContents = [
            {
                id: 'intro_post_1',
                type: 'sns_post',
                platform: 'twitter',
                title: 'Jiji紹介投稿 - 初心者向け',
                content: `🌊 初心者ダイバーの味方「Jiji」が誕生！

「一人でダイビング始めるの怖い...」
「どのショップが安全？」
「予算内で楽しめる？」

そんな不安、Jijiが全部解決します💪

✨ AI感情分析で最適なショップをマッチング
🏪 沖縄79店舗の詳細データベース
💬 24時間いつでもLINE相談

#沖縄ダイビング #初心者ダイバー #Jiji
https://jiji-bot-production.up.railway.app`,
                tags: ['初心者', '不安解消', '安心', 'AI'],
                engagement_target: 100
            },
            {
                id: 'success_story_1',
                type: 'success_story',
                platform: 'instagram',
                title: 'ユーザー体験談 - 一人参加成功',
                content: `「一人参加でも大丈夫でした！」

Jijiのおかげで、完璧なショップを見つけられました🐠

感情分析で私の不安を理解してくれて、
本当に一人歓迎のショップを推薦。

石垣島で初マンタ遭遇！
人生が変わりました✨

#Jijiダイビング #一人参加 #石垣島 #マンタ`,
                tags: ['体験談', '一人参加', '成功事例'],
                engagement_target: 200
            }
        ];

        socialContents.forEach(content => {
            this.contentLibrary.set(content.id, content);
        });
    }

    initializeSocialMedia() {
        this.socialMediaConfig = {
            twitter: {
                hashtags: ['#沖縄ダイビング', '#初心者ダイバー', '#Jiji', '#感情分析'],
                post_frequency: 'daily',
                engagement_target: 50
            },
            instagram: {
                hashtags: ['#沖縄ダイビング', '#ダイビング初心者', '#Jiji', '#石垣島', '#宮古島'],
                post_frequency: '3_times_weekly',
                engagement_target: 100
            },
            line: {
                broadcast_frequency: 'weekly',
                segment_targeting: true
            }
        };
    }

    // ===== キャンペーン管理 =====

    createCampaign(campaignData) {
        const campaign = {
            ...campaignData,
            created_at: new Date().toISOString(),
            metrics: {
                impressions: 0,
                clicks: 0,
                conversions: 0,
                cost: 0,
                revenue: 0
            },
            performance: {
                ctr: 0, // Click Through Rate
                conversion_rate: 0,
                roi: 0,
                engagement_rate: 0
            }
        };

        this.campaigns.set(campaign.id, campaign);
        console.log(`📈 Campaign created: ${campaign.name}`);
        return campaign;
    }

    updateCampaignMetrics(campaignId, metrics) {
        const campaign = this.campaigns.get(campaignId);
        if (!campaign) return false;

        // メトリクス更新
        Object.keys(metrics).forEach(key => {
            if (campaign.metrics.hasOwnProperty(key)) {
                campaign.metrics[key] += metrics[key];
            }
        });

        // パフォーマンス計算
        this.calculateCampaignPerformance(campaign);
        
        campaign.last_updated = new Date().toISOString();
        return true;
    }

    calculateCampaignPerformance(campaign) {
        const metrics = campaign.metrics;
        
        // CTR計算
        campaign.performance.ctr = metrics.impressions > 0 ? 
            (metrics.clicks / metrics.impressions) * 100 : 0;
        
        // コンバージョン率計算
        campaign.performance.conversion_rate = metrics.clicks > 0 ? 
            (metrics.conversions / metrics.clicks) * 100 : 0;
        
        // ROI計算
        campaign.performance.roi = metrics.cost > 0 ? 
            ((metrics.revenue - metrics.cost) / metrics.cost) * 100 : 0;
        
        // エンゲージメント率（簡単な推定）
        campaign.performance.engagement_rate = metrics.impressions > 0 ? 
            ((metrics.clicks + metrics.conversions) / metrics.impressions) * 100 : 0;
    }

    // ===== 紹介コード・招待システム =====

    generateReferralCode(userId, campaign = 'default') {
        const code = `JIJI${userId.substring(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        
        const referralData = {
            code,
            user_id: userId,
            campaign,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90日有効
            usage_count: 0,
            max_usage: 10,
            rewards: {
                referrer: {
                    type: 'premium_access',
                    duration: 7, // 7日間
                    description: 'プレミアム機能1週間無料'
                },
                referee: {
                    type: 'special_recommendation',
                    value: 'priority_support',
                    description: '初回相談で特別推薦・優先サポート'
                }
            },
            status: 'active'
        };

        this.referralCodes.set(code, referralData);
        console.log(`🔗 Referral code generated: ${code} for user ${userId}`);
        return referralData;
    }

    validateReferralCode(code) {
        const referral = this.referralCodes.get(code);
        if (!referral) return { valid: false, reason: 'code_not_found' };
        
        if (referral.status !== 'active') return { valid: false, reason: 'code_inactive' };
        if (new Date() > new Date(referral.expires_at)) return { valid: false, reason: 'code_expired' };
        if (referral.usage_count >= referral.max_usage) return { valid: false, reason: 'usage_limit_exceeded' };
        
        return { valid: true, referral };
    }

    processReferralSignup(code, newUserId) {
        const validation = this.validateReferralCode(code);
        if (!validation.valid) return { success: false, reason: validation.reason };
        
        const referral = validation.referral;
        
        // 使用回数増加
        referral.usage_count++;
        referral.last_used = new Date().toISOString();
        
        // 紹介実績記録
        if (!referral.successful_referrals) referral.successful_referrals = [];
        referral.successful_referrals.push({
            user_id: newUserId,
            signup_date: new Date().toISOString(),
            status: 'active'
        });

        // キャンペーンメトリクス更新
        this.updateCampaignMetrics(referral.campaign, {
            conversions: 1,
            revenue: 50 // 推定収益
        });

        console.log(`✅ Referral signup processed: ${code} -> ${newUserId}`);
        return {
            success: true,
            referral_data: referral,
            rewards: {
                referrer: referral.rewards.referrer,
                referee: referral.rewards.referee
            }
        };
    }

    // ===== インフルエンサー・パートナー管理 =====

    addInfluencerPartner(partnerData) {
        const partner = {
            ...partnerData,
            id: partnerData.id || `partner_${Date.now()}`,
            joined_date: new Date().toISOString(),
            status: 'active',
            metrics: {
                total_referrals: 0,
                successful_conversions: 0,
                total_revenue: 0,
                content_posts: 0,
                engagement_total: 0
            },
            rewards_earned: {
                cash: 0,
                products: [],
                experiences: []
            },
            commission_rate: partnerData.commission_rate || 0.15 // 15%
        };

        this.influencerPartners.set(partner.id, partner);
        console.log(`🤝 Influencer partner added: ${partner.name}`);
        return partner;
    }

    trackInfluencerActivity(partnerId, activity) {
        const partner = this.influencerPartners.get(partnerId);
        if (!partner) return false;

        switch (activity.type) {
            case 'content_post':
                partner.metrics.content_posts++;
                partner.metrics.engagement_total += activity.engagement || 0;
                break;
            case 'referral':
                partner.metrics.total_referrals++;
                if (activity.converted) {
                    partner.metrics.successful_conversions++;
                    const revenue = activity.revenue || 100;
                    partner.metrics.total_revenue += revenue;
                    
                    // コミッション計算
                    const commission = revenue * partner.commission_rate;
                    partner.rewards_earned.cash += commission;
                }
                break;
        }

        partner.last_activity = new Date().toISOString();
        return true;
    }

    // ===== コンテンツマーケティング =====

    createMarketingContent(contentData) {
        const content = {
            ...contentData,
            id: contentData.id || `content_${Date.now()}`,
            created_at: new Date().toISOString(),
            status: 'draft',
            performance: {
                impressions: 0,
                engagement: 0,
                shares: 0,
                conversions: 0
            },
            seo_data: {
                keywords: contentData.keywords || [],
                meta_description: contentData.meta_description || '',
                target_audience: contentData.target_audience || 'beginner_divers'
            }
        };

        this.contentLibrary.set(content.id, content);
        return content;
    }

    generateSEOContent(topic) {
        const seoTemplates = {
            'beginner_diving_tips': {
                title: '初心者必見！沖縄ダイビング完全ガイド2025',
                keywords: ['沖縄ダイビング', '初心者', 'ダイビングショップ', '石垣島', '宮古島'],
                content: `
                # 初心者必見！沖縄ダイビング完全ガイド2025

                沖縄でダイビングを始めたい初心者の方必見！
                Jijiが厳選した安心・安全なダイビングショップと、
                初心者が知っておくべき情報をお届けします。

                ## 初心者が抱える5つの不安
                1. 安全面への心配
                2. スキルへの不安  
                3. 一人参加の緊張
                4. 予算の心配
                5. ショップ選びの迷い

                これらの不安、Jijiが全て解決します！

                [詳細はJijiのAI感情分析で]
                https://jiji-bot-production.up.railway.app
                `,
                meta_description: '沖縄ダイビング初心者向け完全ガイド。Jijiの感情分析で最適なショップをマッチング。石垣島・宮古島の厳選ショップ79店舗から安心・安全な店舗をご紹介。'
            },
            'shop_selection_guide': {
                title: '失敗しないダイビングショップの選び方 | 沖縄79店舗完全比較',
                keywords: ['ダイビングショップ', '選び方', '沖縄', '比較', 'おすすめ'],
                content: `
                # 失敗しないダイビングショップの選び方

                沖縄のダイビングショップ選びで失敗したくない方へ。
                Jijiが79店舗を徹底調査した結果をお教えします。

                ## 確認すべき重要ポイント
                - 安全管理体制
                - インストラクターの資格
                - 初心者対応実績
                - 料金の透明性

                [AI感情分析で最適なショップを見つける]
                https://jiji-bot-production.up.railway.app
                `
            }
        };

        return seoTemplates[topic] || null;
    }

    // ===== ユーザー行動分析 =====

    trackUserEngagement(userId, action, metadata = {}) {
        const timestamp = new Date().toISOString();
        
        const engagementData = {
            user_id: userId,
            action,
            timestamp,
            metadata,
            source: metadata.source || 'unknown',
            campaign: metadata.campaign || 'organic'
        };

        // エンゲージメントデータを保存
        // 実際の実装では外部データベースに保存
        console.log(`📊 User engagement tracked: ${userId} - ${action}`);
        
        // キャンペーンメトリクス更新
        if (metadata.campaign && this.campaigns.has(metadata.campaign)) {
            const updateMetrics = {};
            
            switch (action) {
                case 'page_view':
                    updateMetrics.impressions = 1;
                    break;
                case 'emotion_analysis':
                case 'shop_search':
                    updateMetrics.clicks = 1;
                    break;
                case 'referral_signup':
                case 'contact_shop':
                    updateMetrics.conversions = 1;
                    break;
            }
            
            if (Object.keys(updateMetrics).length > 0) {
                this.updateCampaignMetrics(metadata.campaign, updateMetrics);
            }
        }

        return engagementData;
    }

    // ===== A/Bテスト機能 =====

    createABTest(testData) {
        const abTest = {
            id: testData.id || `ab_test_${Date.now()}`,
            name: testData.name,
            description: testData.description,
            variations: testData.variations, // [{ id: 'A', content: '...', weight: 0.5 }]
            metrics: testData.metrics || ['conversion_rate', 'engagement'],
            status: 'active',
            start_date: new Date().toISOString(),
            end_date: testData.end_date,
            results: {
                total_participants: 0,
                variation_performance: {}
            }
        };

        // 各バリエーションの結果初期化
        testData.variations.forEach(variation => {
            abTest.results.variation_performance[variation.id] = {
                participants: 0,
                conversions: 0,
                engagement_total: 0,
                conversion_rate: 0,
                avg_engagement: 0
            };
        });

        return abTest;
    }

    getABTestVariation(testId, userId) {
        // ユーザーIDハッシュに基づく一貫したバリエーション選択
        const hash = this.hashString(userId + testId);
        const randomValue = hash % 100 / 100;
        
        // テスト設定取得（実際の実装では保存されたテストから取得）
        const testVariations = [
            { id: 'A', weight: 0.5 },
            { id: 'B', weight: 0.5 }
        ];
        
        let cumulativeWeight = 0;
        for (const variation of testVariations) {
            cumulativeWeight += variation.weight;
            if (randomValue <= cumulativeWeight) {
                return variation.id;
            }
        }
        
        return testVariations[0].id; // フォールバック
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 32bit整数に変換
        }
        return Math.abs(hash);
    }

    // ===== レポート・分析 =====

    generateMarketingReport() {
        const report = {
            report_id: `marketing_report_${Date.now()}`,
            generated_at: new Date().toISOString(),
            period: {
                start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString()
            },
            
            // キャンペーン分析
            campaign_performance: this.analyzeCampaignPerformance(),
            
            // 紹介システム分析
            referral_analysis: this.analyzeReferralSystem(),
            
            // インフルエンサー分析
            influencer_analysis: this.analyzeInfluencerPerformance(),
            
            // コンテンツ分析
            content_analysis: this.analyzeContentPerformance(),
            
            // 推奨改善点
            recommendations: this.generateMarketingRecommendations()
        };

        return report;
    }

    analyzeCampaignPerformance() {
        const campaigns = Array.from(this.campaigns.values());
        
        return {
            total_campaigns: campaigns.length,
            active_campaigns: campaigns.filter(c => c.status === 'active').length,
            total_impressions: campaigns.reduce((sum, c) => sum + c.metrics.impressions, 0),
            total_clicks: campaigns.reduce((sum, c) => sum + c.metrics.clicks, 0),
            total_conversions: campaigns.reduce((sum, c) => sum + c.metrics.conversions, 0),
            average_ctr: campaigns.length > 0 ? 
                campaigns.reduce((sum, c) => sum + c.performance.ctr, 0) / campaigns.length : 0,
            average_conversion_rate: campaigns.length > 0 ?
                campaigns.reduce((sum, c) => sum + c.performance.conversion_rate, 0) / campaigns.length : 0,
            top_performing_campaign: campaigns.reduce((best, current) => 
                (current.performance.roi > (best?.performance?.roi || 0)) ? current : best, null)
        };
    }

    analyzeReferralSystem() {
        const referrals = Array.from(this.referralCodes.values());
        const activeReferrals = referrals.filter(r => r.status === 'active');
        
        return {
            total_codes_generated: referrals.length,
            active_codes: activeReferrals.length,
            total_usage: referrals.reduce((sum, r) => sum + r.usage_count, 0),
            successful_referrals: referrals.reduce((sum, r) => 
                sum + (r.successful_referrals?.length || 0), 0),
            average_usage_per_code: referrals.length > 0 ?
                referrals.reduce((sum, r) => sum + r.usage_count, 0) / referrals.length : 0,
            conversion_rate: referrals.length > 0 ?
                (referrals.reduce((sum, r) => sum + (r.successful_referrals?.length || 0), 0) / 
                 referrals.reduce((sum, r) => sum + r.usage_count, 0)) * 100 : 0
        };
    }

    analyzeInfluencerPerformance() {
        const partners = Array.from(this.influencerPartners.values());
        
        return {
            total_partners: partners.length,
            active_partners: partners.filter(p => p.status === 'active').length,
            total_referrals: partners.reduce((sum, p) => sum + p.metrics.total_referrals, 0),
            total_conversions: partners.reduce((sum, p) => sum + p.metrics.successful_conversions, 0),
            total_revenue_generated: partners.reduce((sum, p) => sum + p.metrics.total_revenue, 0),
            total_commissions_paid: partners.reduce((sum, p) => sum + p.rewards_earned.cash, 0),
            top_performer: partners.reduce((best, current) => 
                (current.metrics.total_revenue > (best?.metrics?.total_revenue || 0)) ? current : best, null)
        };
    }

    analyzeContentPerformance() {
        const contents = Array.from(this.contentLibrary.values());
        
        return {
            total_content_pieces: contents.length,
            published_content: contents.filter(c => c.status === 'published').length,
            total_impressions: contents.reduce((sum, c) => sum + (c.performance?.impressions || 0), 0),
            total_engagement: contents.reduce((sum, c) => sum + (c.performance?.engagement || 0), 0),
            average_engagement_rate: contents.length > 0 ?
                contents.reduce((sum, c) => {
                    const impressions = c.performance?.impressions || 0;
                    const engagement = c.performance?.engagement || 0;
                    return sum + (impressions > 0 ? (engagement / impressions) * 100 : 0);
                }, 0) / contents.length : 0
        };
    }

    generateMarketingRecommendations() {
        const recommendations = [];
        
        // キャンペーン分析に基づく推奨
        const campaignPerf = this.analyzeCampaignPerformance();
        if (campaignPerf.average_ctr < 2) {
            recommendations.push({
                priority: 'high',
                category: 'campaign_optimization',
                issue: `Low CTR: ${campaignPerf.average_ctr.toFixed(2)}%`,
                recommendation: 'Improve ad copy and targeting to increase click-through rates',
                expected_impact: 'CTR improvement: +50-100%'
            });
        }

        // 紹介システム分析に基づく推奨
        const referralPerf = this.analyzeReferralSystem();
        if (referralPerf.conversion_rate < 10) {
            recommendations.push({
                priority: 'medium',
                category: 'referral_optimization',
                issue: `Low referral conversion: ${referralPerf.conversion_rate.toFixed(2)}%`,
                recommendation: 'Enhance referral rewards and simplify signup process',
                expected_impact: 'Conversion rate improvement: +30-50%'
            });
        }

        // コンテンツ分析に基づく推奨
        const contentPerf = this.analyzeContentPerformance();
        if (contentPerf.average_engagement_rate < 5) {
            recommendations.push({
                priority: 'medium',
                category: 'content_strategy',
                issue: `Low content engagement: ${contentPerf.average_engagement_rate.toFixed(2)}%`,
                recommendation: 'Create more interactive and user-focused content',
                expected_impact: 'Engagement rate improvement: +40-70%'
            });
        }

        return recommendations;
    }

    // ===== 外部インターフェース =====

    getMarketingStatus() {
        return {
            active_campaigns: Array.from(this.campaigns.values()).filter(c => c.status === 'active').length,
            total_referral_codes: this.referralCodes.size,
            active_influencers: Array.from(this.influencerPartners.values()).filter(p => p.status === 'active').length,
            content_library_size: this.contentLibrary.size,
            last_updated: new Date().toISOString()
        };
    }
}

module.exports = JijiMarketingManager;