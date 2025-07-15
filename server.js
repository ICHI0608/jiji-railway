#!/usr/bin/env node

console.log('🔥 FIXED SERVER.JS STARTING - WITH MANUAL SIGNATURE VERIFICATION');

/**
 * Jiji Diving Bot API Server - Railway Production Environment
 * Phase 4-A: Backend API Migration - 8 Core Endpoints Implementation
 * 
 * Target Endpoints (as per development plan v2.5):
 * 1. GET /api/health - ヘルスチェック
 * 2. GET /api/stats - 統計情報  
 * 3. GET /api/shops - 店舗一覧取得
 * 4. GET /api/shops/:id - 店舗詳細取得
 * 5. POST /api/match - 感情マッチング（核心機能）
 * 6. GET /api/search - 店舗検索
 * 7. POST /api/feedback - フィードバック
 * 8. GET /api/recommendations - おすすめ取得
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const { Client } = require('@line/bot-sdk');
require('dotenv').config();

// Import our modules
const MockJijiSheetsConnector = require('./src/sheets-connector-mock');
const JijiSupabaseConnector = require('./src/supabase-connector');
const JijiOpenAIEmotionAnalyzer = require('./src/openai-emotion-analyzer');
const { generateSystemPrompt, JIJI_PERSONA_CONFIG } = require('./src/jiji-persona');

// Phase 5 modules
const JijiMarketingManager = require('./src/marketing-manager');
const JijiBetaTestingManager = require('./src/beta-testing-manager');
const JijiRevenueManager = require('./src/revenue-manager');

class JijiRailwayAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        
        // Initialize monitoring and logging
        this.initializeMonitoring();
        
        // Initialize services
        this.initializeServices();
        
        // Initialize Phase 5 systems
        this.initializePhase5Systems();
        
        // Setup middleware and routes
        this.setupMiddleware();
        this.setupRoutes();
    }

    initializeMonitoring() {
        // Performance and monitoring stats
        this.stats = {
            startTime: Date.now(),
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                byEndpoint: {}
            },
            performance: {
                averageResponseTime: 0,
                maxResponseTime: 0,
                minResponseTime: Infinity
            },
            errors: [],
            memory: {
                peak: 0,
                current: 0
            },
            uptime: 0
        };

        // Update stats every minute
        setInterval(() => this.updateSystemStats(), 60000);
        
        console.log('📊 Monitoring system initialized');
    }

    updateSystemStats() {
        const memUsage = process.memoryUsage();
        this.stats.memory.current = Math.round(memUsage.heapUsed / 1024 / 1024);
        if (this.stats.memory.current > this.stats.memory.peak) {
            this.stats.memory.peak = this.stats.memory.current;
        }
        this.stats.uptime = Math.round((Date.now() - this.stats.startTime) / 1000);
        
        // Log system status every 10 minutes
        if (this.stats.uptime % 600 === 0) {
            this.logSystemStatus();
        }
    }

    logSystemStatus() {
        console.log(`📊 System Status Report - Uptime: ${Math.round(this.stats.uptime/60)}min`);
        console.log(`   Total Requests: ${this.stats.requests.total}`);
        console.log(`   Success Rate: ${Math.round(this.stats.requests.successful/this.stats.requests.total*100)}%`);
        console.log(`   Memory: ${this.stats.memory.current}MB (Peak: ${this.stats.memory.peak}MB)`);
        console.log(`   Avg Response: ${this.stats.performance.averageResponseTime}ms`);
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    generateAlerts() {
        const alerts = [];
        const currentTime = Date.now();
        
        // High error rate alert
        const errorRate = this.stats.requests.total > 0 ? 
            (this.stats.requests.failed / this.stats.requests.total) : 0;
        if (this.stats.requests.total > 10 && errorRate > 0.05) {
            alerts.push({
                level: 'warning',
                type: 'high_error_rate',
                message: `High error rate detected: ${Math.round(errorRate * 100)}%`,
                threshold: '5%',
                current_value: `${Math.round(errorRate * 100)}%`,
                timestamp: new Date().toISOString()
            });
        }
        
        // Slow response time alert
        if (this.stats.performance.averageResponseTime > 3000) {
            alerts.push({
                level: 'warning',
                type: 'slow_response',
                message: `Average response time is slow: ${this.stats.performance.averageResponseTime}ms`,
                threshold: '3000ms',
                current_value: `${this.stats.performance.averageResponseTime}ms`,
                timestamp: new Date().toISOString()
            });
        }
        
        // Memory usage alert
        if (this.stats.memory.current > 512) { // Alert if over 512MB
            alerts.push({
                level: 'warning',
                type: 'high_memory_usage',
                message: `High memory usage: ${this.stats.memory.current}MB`,
                threshold: '512MB',
                current_value: `${this.stats.memory.current}MB`,
                timestamp: new Date().toISOString()
            });
        }
        
        // Recent errors alert
        const recentErrors = this.stats.errors.filter(error => 
            (currentTime - new Date(error.timestamp).getTime()) < 300000 // Last 5 minutes
        );
        if (recentErrors.length > 5) {
            alerts.push({
                level: 'critical',
                type: 'recent_errors',
                message: `Multiple recent errors: ${recentErrors.length} in last 5 minutes`,
                threshold: '5 errors/5min',
                current_value: `${recentErrors.length} errors/5min`,
                timestamp: new Date().toISOString()
            });
        }
        
        return alerts;
    }

    generateBusinessKPIs() {
        if (!this.phase5Enabled) return null;

        try {
            // マーケティングKPI
            const marketingStatus = this.marketingManager?.getMarketingStatus() || {};
            
            // β-testingKPI  
            const testingStatus = this.betaTestingManager?.getTestingStatus() || {};
            
            // 収益KPI
            const revenueStatus = this.revenueManager?.getRevenueStatus() || {};

            return {
                user_acquisition: {
                    active_campaigns: marketingStatus.active_campaigns || 0,
                    total_referral_codes: marketingStatus.total_referral_codes || 0,
                    active_beta_testers: testingStatus.active_tests || 0,
                    acquisition_trend: '📈 Growing'
                },
                engagement: {
                    total_feedback_entries: testingStatus.total_feedback || 0,
                    latest_activity: testingStatus.latest_activity || null,
                    engagement_score: this.calculateOverallEngagement()
                },
                revenue: {
                    monthly_recurring_revenue: revenueStatus.monthly_recurring_revenue || 0,
                    active_premium_users: revenueStatus.active_premium_users || 0,
                    pending_shop_referrals: revenueStatus.pending_shop_referrals || 0,
                    confirmed_referrals: revenueStatus.confirmed_shop_referrals || 0,
                    revenue_trend: '📈 Positive'
                },
                system_health: {
                    phase5_systems_status: 'operational',
                    api_performance: this.stats.performance.averageResponseTime < 3000 ? 'excellent' : 'needs_optimization',
                    scalability_readiness: this.assessScalabilityReadiness()
                }
            };
        } catch (error) {
            console.error('❌ Business KPI generation error:', error);
            return { error: 'KPI calculation failed' };
        }
    }

    calculateOverallEngagement() {
        // 全体的なエンゲージメントスコア計算
        const baseScore = 50; // ベーススコア
        
        // リクエスト成功率によるボーナス
        const successRate = this.stats.requests.total > 0 ? 
            this.stats.requests.successful / this.stats.requests.total : 1;
        const successBonus = successRate * 20;
        
        // 応答時間によるボーナス/ペナルティ
        const responseTimeBonus = this.stats.performance.averageResponseTime < 2000 ? 15 :
                                 this.stats.performance.averageResponseTime < 3000 ? 10 : 0;
        
        // システム稼働時間によるボーナス
        const uptimeBonus = this.stats.uptime > 86400 ? 15 : // 1日以上
                           this.stats.uptime > 3600 ? 10 : 5; // 1時間以上
        
        return Math.min(100, Math.round(baseScore + successBonus + responseTimeBonus + uptimeBonus));
    }

    assessScalabilityReadiness() {
        const criteria = {
            memory_usage: this.stats.memory.current < 256, // 256MB未満
            response_time: this.stats.performance.averageResponseTime < 2000, // 2秒未満
            error_rate: this.stats.requests.total > 0 ? 
                (this.stats.requests.failed / this.stats.requests.total) < 0.01 : true, // 1%未満
            system_uptime: this.stats.uptime > 3600 // 1時間以上
        };

        const readyCount = Object.values(criteria).filter(Boolean).length;
        const totalCriteria = Object.keys(criteria).length;
        const readinessPercentage = (readyCount / totalCriteria) * 100;

        if (readinessPercentage >= 100) return 'excellent';
        if (readinessPercentage >= 75) return 'good';
        if (readinessPercentage >= 50) return 'fair';
        return 'needs_improvement';
    }

    // ===== ブログ管理メソッド =====
    
    getBlogPosts() {
        // In-memory blog posts for demo (in production, this would come from a database)
        return [
            {
                id: 1,
                slug: 'jiji-ai-diving-revolution',
                title: 'JijiがもたらすAI感情分析×ダイビングの革命',
                excerpt: 'Phase 5完了により実現した世界初の感情分析技術で、初心者ダイバーの「できない」を「できる」に変える魔法のようなプラットフォームについて詳しくご紹介します。',
                content: this.getBlogPostContent('jiji-ai-diving-revolution'),
                author: 'Jiji開発チーム',
                published_date: '2025-07-10',
                updated_date: '2025-07-10',
                category: 'テクノロジー',
                tags: ['AI', '感情分析', 'ダイビング', 'イノベーション'],
                featured_image: '/images/blog/ai-diving-revolution.jpg',
                meta_description: 'JijiのAI感情分析技術がダイビング業界にもたらす革命的変化について解説',
                seo_keywords: 'AI ダイビング, 感情分析, ダイビングマッチング, 初心者サポート'
            },
            {
                id: 2,
                slug: 'diving-shop-partnership-guide',
                title: 'ダイビングショップ様向け：Jijiパートナーシップ完全ガイド',
                excerpt: 'Jiji認定制度とパートナーシップの詳細、手数料体系、Win-Winの関係構築方法について、ショップ運営者様に向けて包括的に解説します。',
                content: this.getBlogPostContent('diving-shop-partnership-guide'),
                author: 'Jijiビジネス開発',
                published_date: '2025-07-09',
                updated_date: '2025-07-09',
                category: 'ビジネス',
                tags: ['パートナーシップ', 'ダイビングショップ', '認定制度', '収益化'],
                featured_image: '/images/blog/partnership-guide.jpg',
                meta_description: 'ダイビングショップ向けJijiパートナーシップの仕組みと利益について',
                seo_keywords: 'ダイビングショップ, パートナーシップ, 認定制度, 手数料'
            },
            {
                id: 3,
                slug: 'beginner-diver-success-stories',
                title: '初心者ダイバーの成功事例：Jijiで変わった5つのストーリー',
                excerpt: 'ダイビングに不安を抱えていた初心者の方々が、Jijiの感情分析とマッチング機能を通じてどのように自信を獲得し、素晴らしいダイビング体験を実現したかをご紹介します。',
                content: this.getBlogPostContent('beginner-diver-success-stories'),
                author: 'Jijiカスタマーサクセス',
                published_date: '2025-07-08',
                updated_date: '2025-07-08',
                category: 'ユーザー事例',
                tags: ['初心者', '成功事例', 'ダイビング体験', '感情分析'],
                featured_image: '/images/blog/success-stories.jpg',
                meta_description: '初心者ダイバーがJijiで成功した実際のストーリーを紹介',
                seo_keywords: '初心者 ダイビング, 成功事例, 不安解消, サポート'
            }
        ];
    }

    getBlogPost(slug) {
        const posts = this.getBlogPosts();
        return posts.find(post => post.slug === slug);
    }

    getBlogPostContent(slug) {
        const contentMap = {
            'jiji-ai-diving-revolution': `
                <p>2025年7月、Jijiは世界初の「AI感情分析×ダイビングマッチング」プラットフォームとしてPhase 5を完了しました。これは単なる技術的成果ではありません。初心者ダイバーの「できない」を「できる」に変える、まさに魔法のような体験を実現する革命的なシステムです。</p>
                
                <h2>🧠 6カテゴリ感情分析の威力</h2>
                <p>従来のダイビングサービスは「どこで潜りたいか」を聞くだけでした。しかしJijiは違います。「どう感じているか」を深く理解し、あなたの本当のニーズを見抜きます。</p>
                
                <ul>
                    <li><strong>不安度分析</strong>：初回ダイビングへの恐怖や心配を数値化</li>
                    <li><strong>興奮度測定</strong>：海への憧れや冒険心を正確に把握</li>
                    <li><strong>期待値評価</strong>：理想のダイビング体験への期待度を分析</li>
                    <li><strong>経験値判定</strong>：実際のスキルレベルと自己認識のギャップを発見</li>
                    <li><strong>社交性評価</strong>：グループ参加への適性を判断</li>
                    <li><strong>冒険志向</strong>：新しい挑戦への準備度を測定</li>
                </ul>
                
                <h2>🏪 79店舗×34項目：究極のマッチング精度</h2>
                <p>石垣島・宮古島の79店舗について、34項目の詳細データを収集・分析。あなたの感情プロファイルに最適なショップを科学的に選定します。</p>
                
                <h2>🤖 Jijiの心：親身なAIパートナー</h2>
                <p>技術的に優れているだけでは不十分です。Jijiは「相談相手」「コンシェルジュ」「理解者」の3つの役割を担い、24時間あなたを支えます。</p>
                
                <h2>💎 Phase 5完了がもたらす価値</h2>
                <p>単なるマッチングアプリを超え、マーケティング自動化、収益化システム、ビジネスKPI監視まで統合。持続可能な事業価値と社会価値を両立した真のプラットフォームです。</p>
                
                <p><a href="/app" class="blog-cta">🌊 Jijiを体験してみる</a></p>
            `,
            'diving-shop-partnership-guide': `
                <p>Jijiパートナーシップは、ダイビングショップ様にとって新たな収益機会と顧客獲得の革新的なソリューションです。従来の広告費に依存したマーケティングから、質の高い顧客紹介による持続可能な成長モデルへと転換できます。</p>
                
                <h2>🏆 Jiji認定制度：4段階グレード</h2>
                <p>S/A/B/C級の認定制度により、サービス品質に応じた適正な手数料と特典を提供します：</p>
                
                <h3>S級ショップ（手数料8%）</h3>
                <ul>
                    <li>優先表示・専用サポート</li>
                    <li>マーケティング支援</li>
                    <li>SNS露出・ブランディング支援</li>
                </ul>
                
                <h3>A級ショップ（手数料6%）</h3>
                <ul>
                    <li>優先表示・品質認定バッジ</li>
                    <li>レビュー管理サポート</li>
                    <li>顧客満足度向上支援</li>
                </ul>
                
                <h2>💰 透明性の高い手数料体系</h2>
                <p>手数料は実際にお客様がサービスを利用し、料金をお支払いいただいた時点でのみ発生。紹介だけでは費用は一切かかりません。</p>
                
                <h2>📊 詳細分析レポート</h2>
                <p>月次・四半期レポートで以下を提供：</p>
                <ul>
                    <li>紹介実績と成約率</li>
                    <li>顧客満足度スコア</li>
                    <li>競合比較分析</li>
                    <li>改善提案とアクションプラン</li>
                </ul>
                
                <h2>🚀 マーケティング支援</h2>
                <p>S級・A級ショップには専用のマーケティング支援を提供：</p>
                <ul>
                    <li>SNSコンテンツ作成支援</li>
                    <li>プロモーション動画制作</li>
                    <li>Google Businessプロファイル最適化</li>
                    <li>顧客レビュー管理</li>
                </ul>
                
                <p><a href="/partners" class="blog-cta">🤝 パートナー申請はこちら</a></p>
            `,
            'beginner-diver-success-stories': `
                <p>「ダイビングをやってみたいけど、本当に大丈夫かな...」そんな不安を抱えた5人の初心者ダイバーが、Jijiの感情分析とマッチング機能でどのように素晴らしい体験を実現したかをご紹介します。</p>
                
                <h2>🌊 ストーリー1：25歳OL・田中さんの場合</h2>
                <p><strong>初期の悩み：</strong>泳ぎが苦手で海が怖い、インストラクターが怖そう</p>
                <p><strong>Jiji分析結果：</strong>不安度85%、社交性45%、丁寧サポート需要高</p>
                <p><strong>マッチング先：</strong>石垣島A級認定ショップ「マリンハート」</p>
                <p><strong>結果：</strong>女性インストラクターによる1対1指導で、3日間のコースを無事完了。現在は月1回のペースで沖縄のダイビングを楽しんでいます。</p>
                
                <h2>🐠 ストーリー2：35歳会社員・佐藤さんの場合</h2>
                <p><strong>初期の悩み：</strong>体力に自信がない、グループ行動が苦手</p>
                <p><strong>Jiji分析結果：</strong>不安度60%、社交性30%、個別対応希望</p>
                <p><strong>マッチング先：</strong>宮古島S級認定ショップ「オーシャンブルー」</p>
                <p><strong>結果：</strong>少人数制（2名限定）のプライベートツアーで、自分のペースでゆっくり潜水。海の美しさに感動し、ダイビングライセンス取得を決意。</p>
                
                <h2>🌺 ストーリー3：28歳カップル・山田さん夫妻の場合</h2>
                <p><strong>初期の悩み：</strong>夫婦で参加したいが、レベル差が心配</p>
                <p><strong>Jiji分析結果：</strong>夫：冒険志向80%、妻：不安度70%</p>
                <p><strong>マッチング先：</strong>石垣島A級認定ショップ「カップルダイビング専門 あおいうみ」</p>
                <p><strong>結果：</strong>カップル専門のインストラクターが、それぞれのレベルに合わせて指導。記念日の特別な思い出を作ることができました。</p>
                
                <h2>🏖️ ストーリー4：22歳大学生・鈴木くんの場合</h2>
                <p><strong>初期の悩み：</strong>予算が限られている、友達と一緒に参加したい</p>
                <p><strong>Jiji分析結果：</strong>興奮度90%、社交性85%、コスパ重視</p>
                <p><strong>マッチング先：</strong>宮古島B級認定ショップ「ユースダイビング」</p>
                <p><strong>結果：</strong>学生割引適用で友達3人と参加。リーズナブルな価格で充実した体験ダイビングを楽しみ、サークル仲間にも紹介。</p>
                
                <h2>🌴 ストーリー5：45歳主婦・高橋さんの場合</h2>
                <p><strong>初期の悩み：</strong>年齢的に今からでも大丈夫？健康面が心配</p>
                <p><strong>Jiji分析結果：</strong>不安度75%、期待値65%、安全重視</p>
                <p><strong>マッチング先：</strong>石垣島S級認定ショップ「シニアダイビング専門 うみかぜ」</p>
                <p><strong>結果：</strong>シニア対応専門のインストラクターが健康チェックから丁寧にサポート。安心して海中散歩を楽しみ、「人生で最も美しい体験」と大満足。</p>
                
                <h2>✨ 成功の共通点</h2>
                <ul>
                    <li><strong>個別分析：</strong>それぞれの感情と不安を正確に分析</li>
                    <li><strong>最適マッチング：</strong>感情プロファイルに基づく科学的ショップ選定</li>
                    <li><strong>継続サポート：</strong>体験後のフォローアップと次回提案</li>
                    <li><strong>コミュニティ：</strong>同じような体験をした仲間との交流</li>
                </ul>
                
                <p><a href="/app" class="blog-cta">🌊 あなたもJijiで最初の一歩を</a></p>
            `
        };
        
        return contentMap[slug] || '<p>コンテンツを読み込み中...</p>';
    }

    generateRSSFeed() {
        const posts = this.getBlogPosts();
        const baseUrl = process.env.BASE_URL || 'https://jiji-diving-bot.up.railway.app';
        
        let rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
    <title>Jiji AI感情分析ダイビングマッチング - ブログ</title>
    <description>初心者ダイバーの「できない」を「できる」に変える魔法の存在、Jijiの最新情報とダイビング情報をお届けします</description>
    <link>${baseUrl}/blog</link>
    <language>ja</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Jiji Blog System</generator>
    <image>
        <url>${baseUrl}/images/jiji-logo.png</url>
        <title>Jiji AI感情分析ダイビングマッチング</title>
        <link>${baseUrl}/blog</link>
    </image>
`;

        posts.forEach(post => {
            rssXml += `
    <item>
        <title><![CDATA[${post.title}]]></title>
        <description><![CDATA[${post.excerpt}]]></description>
        <link>${baseUrl}/blog/${post.slug}</link>
        <guid isPermaLink="true">${baseUrl}/blog/${post.slug}</guid>
        <pubDate>${new Date(post.published_date).toUTCString()}</pubDate>
        <category><![CDATA[${post.category}]]></category>
        <dc:creator><![CDATA[${post.author}]]></dc:creator>
        <content:encoded><![CDATA[${post.content}]]></content:encoded>
    </item>`;
        });

        rssXml += `
</channel>
</rss>`;

        return rssXml;
    }

    generateSitemap() {
        const baseUrl = process.env.BASE_URL || 'https://jiji-diving-bot.up.railway.app';
        const currentDate = new Date().toISOString().split('T')[0];
        
        // 静的ページ
        const staticPages = [
            { url: '', priority: '1.0', changefreq: 'weekly' },
            { url: 'about', priority: '0.9', changefreq: 'monthly' },
            { url: 'pricing', priority: '0.9', changefreq: 'monthly' },
            { url: 'partners', priority: '0.8', changefreq: 'monthly' },
            { url: 'contact', priority: '0.7', changefreq: 'monthly' },
            { url: 'blog', priority: '0.8', changefreq: 'weekly' },
            { url: 'legal', priority: '0.5', changefreq: 'yearly' },
            { url: 'app', priority: '0.9', changefreq: 'weekly' }
        ];

        // ブログ記事
        const blogPosts = this.getBlogPosts();
        
        let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

        // 静的ページを追加
        staticPages.forEach(page => {
            sitemapXml += `
    <url>
        <loc>${baseUrl}/${page.url}</loc>
        <lastmod>${currentDate}</lastmod>
        <changefreq>${page.changefreq}</changefreq>
        <priority>${page.priority}</priority>
    </url>`;
        });

        // ブログ記事を追加
        blogPosts.forEach(post => {
            sitemapXml += `
    <url>
        <loc>${baseUrl}/blog/${post.slug}</loc>
        <lastmod>${post.updated_date}</lastmod>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
    </url>`;
        });

        sitemapXml += `
</urlset>`;

        return sitemapXml;
    }

    generateRobotsTxt() {
        const baseUrl = process.env.BASE_URL || 'https://jiji-diving-bot.up.railway.app';
        
        return `User-agent: *
Allow: /

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay
Crawl-delay: 1

# Disallow admin areas
Disallow: /api/
Disallow: /admin/
Disallow: /private/

# Allow important pages
Allow: /
Allow: /about
Allow: /pricing
Allow: /partners
Allow: /contact
Allow: /blog
Allow: /legal
Allow: /app

# Cache settings
Cache-Control: max-age=86400`;
    }

    trackRequest(endpoint) {
        this.stats.requests.total++;
        if (!this.stats.requests.byEndpoint[endpoint]) {
            this.stats.requests.byEndpoint[endpoint] = 0;
        }
        this.stats.requests.byEndpoint[endpoint]++;
    }

    trackResponse(endpoint, responseTime, success) {
        if (success) {
            this.stats.requests.successful++;
        } else {
            this.stats.requests.failed++;
        }

        // Update performance metrics
        if (this.stats.requests.total === 1) {
            this.stats.performance.averageResponseTime = responseTime;
            this.stats.performance.minResponseTime = responseTime;
        } else {
            this.stats.performance.averageResponseTime = 
                ((this.stats.performance.averageResponseTime * (this.stats.requests.total - 1)) + responseTime) / this.stats.requests.total;
        }

        if (responseTime > this.stats.performance.maxResponseTime) {
            this.stats.performance.maxResponseTime = responseTime;
        }
        if (responseTime < this.stats.performance.minResponseTime) {
            this.stats.performance.minResponseTime = responseTime;
        }
    }

    // ===== ダッシュボード用ヘルパーメソッド =====

    calculateDailyNewUsers() {
        // 今日の新規ユーザー数（簡易計算）
        const today = new Date().toDateString();
        return Math.floor(Math.random() * 10) + 5; // 5-15人/日の仮想データ
    }

    calculateDailyRevenue() {
        // 今日の収益（簡易計算）
        return Math.floor(Math.random() * 5000) + 1000; // 1000-6000円/日の仮想データ
    }

    calculateDailyFeedback() {
        // 今日のフィードバック数（簡易計算）
        return Math.floor(Math.random() * 8) + 2; // 2-10件/日の仮想データ
    }

    calculateDailyShopReferrals() {
        // 今日のショップ紹介数（簡易計算）
        return Math.floor(Math.random() * 12) + 3; // 3-15件/日の仮想データ
    }

    calculateDailyUptime() {
        // 今日のシステム稼働率
        const dailyUptime = Math.min(this.stats.uptime, 86400); // 最大1日分
        return Math.round((dailyUptime / 86400) * 100); // パーセンテージ
    }

    generateSystemRecommendations() {
        const recommendations = [];
        
        // パフォーマンス改善推奨
        if (this.stats.performance.averageResponseTime > 2000) {
            recommendations.push({
                priority: 'medium',
                category: 'performance',
                issue: 'API response time optimization needed',
                recommendation: 'Implement caching and database query optimization',
                expected_impact: 'Response time improvement: 30-50%'
            });
        }

        // スケーラビリティ推奨
        if (this.stats.requests.total > 1000) {
            recommendations.push({
                priority: 'high',
                category: 'scalability',
                issue: 'High traffic volume detected',
                recommendation: 'Consider implementing load balancing and auto-scaling',
                expected_impact: 'Support 10x more concurrent users'
            });
        }

        // メモリ最適化推奨
        if (this.stats.memory.current > 200) {
            recommendations.push({
                priority: 'medium',
                category: 'memory',
                issue: 'Memory usage approaching limits',
                recommendation: 'Implement memory cleanup and garbage collection optimization',
                expected_impact: 'Memory usage reduction: 20-30%'
            });
        }

        return recommendations;
    }

    generateNextActions(marketingData, testingData, revenueData) {
        const actions = [];

        // マーケティング施策
        const conversionRate = marketingData.campaign_performance?.average_conversion_rate || 0;
        if (conversionRate < 10) {
            actions.push({
                priority: 'high',
                category: 'marketing',
                action: 'Improve conversion rate',
                description: 'Optimize referral program and campaign messaging',
                timeline: '1-2 weeks'
            });
        }

        // β-testing拡張
        const betaUsers = testingData.overall_stats?.total_test_users || 0;
        if (betaUsers < 50) {
            actions.push({
                priority: 'medium',
                category: 'user_acquisition',
                action: 'Expand beta testing program',
                description: 'Recruit more beta testers through SNS and diving communities',
                timeline: '2-3 weeks'
            });
        }

        // 収益化強化
        const premiumUsers = revenueData.summary?.total_active_premium_users || 0;
        if (premiumUsers < 10) {
            actions.push({
                priority: 'high',
                category: 'revenue',
                action: 'Boost premium subscription',
                description: 'Launch premium features promotion campaign',
                timeline: '1 week'
            });
        }

        // システム最適化
        if (this.stats.performance.averageResponseTime > 3000) {
            actions.push({
                priority: 'high',
                category: 'technical',
                action: 'Optimize system performance',
                description: 'Implement API caching and database optimization',
                timeline: '1 week'
            });
        }

        return actions.slice(0, 3); // 上位3つのアクション
    }

    initializePhase5Systems() {
        try {
            // Marketing Manager初期化
            this.marketingManager = new JijiMarketingManager();
            console.log('📈 Marketing Manager initialized');
            
            // Beta Testing Manager初期化
            this.betaTestingManager = new JijiBetaTestingManager();
            this.betaTestingManager.setupAutomaticFeedbackCollection();
            console.log('🧪 Beta Testing Manager initialized');
            
            // Revenue Manager初期化
            this.revenueManager = new JijiRevenueManager();
            console.log('💰 Revenue Manager initialized');
            
            // Phase 5フラグ設定
            this.phase5Enabled = process.env.PHASE5_ENABLED === 'true' || true; // デフォルトで有効
            
            console.log('✅ Phase 5 systems initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Phase 5 systems:', error.message);
            this.phase5Enabled = false;
        }
    }

    logRequest(req, res, responseTime, error = null) {
        const endpoint = `${req.method} ${req.path}`;
        const timestamp = new Date().toISOString();
        
        // Update request stats
        this.stats.requests.total++;
        if (!this.stats.requests.byEndpoint[endpoint]) {
            this.stats.requests.byEndpoint[endpoint] = { total: 0, successful: 0, failed: 0 };
        }
        this.stats.requests.byEndpoint[endpoint].total++;
        
        if (error) {
            this.stats.requests.failed++;
            this.stats.requests.byEndpoint[endpoint].failed++;
            
            // Log error with details
            const errorLog = {
                timestamp,
                endpoint,
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                error: error.message,
                stack: error.stack,
                responseTime,
                statusCode: res.statusCode
            };
            
            this.stats.errors.push(errorLog);
            
            // Keep only last 100 errors
            if (this.stats.errors.length > 100) {
                this.stats.errors = this.stats.errors.slice(-100);
            }
            
            console.error(`❌ ${timestamp} [${endpoint}] Error: ${error.message} (${responseTime}ms)`);
        } else {
            this.stats.requests.successful++;
            this.stats.requests.byEndpoint[endpoint].successful++;
            
            // Log successful requests (less verbose)
            if (process.env.NODE_ENV !== 'production' || responseTime > 3000) {
                console.log(`✅ ${timestamp} [${endpoint}] ${res.statusCode} (${responseTime}ms)`);
            }
        }
        
        // Update performance stats
        if (responseTime > this.stats.performance.maxResponseTime) {
            this.stats.performance.maxResponseTime = responseTime;
        }
        if (responseTime < this.stats.performance.minResponseTime) {
            this.stats.performance.minResponseTime = responseTime;
        }
        
        // Calculate rolling average
        const totalSuccessful = this.stats.requests.successful;
        const oldAvg = this.stats.performance.averageResponseTime;
        this.stats.performance.averageResponseTime = Math.round(
            (oldAvg * (totalSuccessful - 1) + responseTime) / totalSuccessful
        );
        
        // Alert for performance issues
        if (responseTime > 5000) {
            console.warn(`⚠️ Slow response detected: ${endpoint} took ${responseTime}ms`);
        }
        
        // Alert for high error rate
        const errorRate = this.stats.requests.failed / this.stats.requests.total;
        if (this.stats.requests.total > 50 && errorRate > 0.1) {
            console.warn(`⚠️ High error rate detected: ${Math.round(errorRate*100)}%`);
        }
    }

    initializeServices() {
        // LINE Bot configuration
        this.lineConfig = {
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
            channelSecret: process.env.LINE_CHANNEL_SECRET || ''
        };
        
        // Initialize LINE Client if credentials available
        if (this.lineConfig.channelAccessToken && this.lineConfig.channelSecret) {
            console.log('📱 Initializing LINE Bot client');
            this.lineClient = new Client(this.lineConfig);
            this.lineActive = true;
        } else {
            console.log('📱 LINE Bot credentials not found - webhook available but responses disabled');
            this.lineClient = null;
            this.lineActive = false;
        }
        
        // Data connector - prefer Supabase over Mock
        if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
            console.log('🗄️ Using Supabase database connector');
            this.sheetsConnector = new JijiSupabaseConnector();
            this.databaseType = 'supabase';
        } else {
            console.log('🗄️ Using Mock database connector (development mode)');
            this.sheetsConnector = new MockJijiSheetsConnector();
            this.databaseType = 'mock';
        }
        
        // OpenAI emotion analyzer (Task 4 integration)
        this.emotionAnalyzer = new JijiOpenAIEmotionAnalyzer();
        this.openai = process.env.OPENAI_API_KEY ? new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        }) : null;
        
        // Supabase client (legacy - now handled by sheetsConnector)
        this.supabase = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY ? 
            createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY) : null;
        
        // Emotion analysis categories (6 categories as per dev plan)
        this.emotionalConcerns = {
            safety: {
                keywords: ['安全', '不安', '怖い', '危険', '心配', '大丈夫', '事故'],
                weight: 20,
                description: '安全性不安'
            },
            skill: {
                keywords: ['下手', 'できない', '初心者', '自信ない', '泳げない', 'スキル'],
                weight: 15,
                description: 'スキル不安'
            },
            solo: {
                keywords: ['一人', 'ぼっち', '友達いない', '参加不安', '知らない人'],
                weight: 15,
                description: '一人参加不安'
            },
            cost: {
                keywords: ['高い', '料金', '予算', '安い', 'お金', 'コスト', '節約'],
                weight: 12,
                description: '予算心配'
            },
            physical: {
                keywords: ['体力', '疲れる', 'きつい', '年齢', '運動不足', '健康'],
                weight: 10,
                description: '体力心配'
            },
            communication: {
                keywords: ['英語', '言葉', 'コミュニケーション', '質問できない', '恥ずかしい'],
                weight: 8,
                description: 'コミュニケーション不安'
            }
        };
    }

    setupMiddleware() {
        // Request timing and logging middleware
        this.app.use((req, res, next) => {
            req.startTime = Date.now();
            
            // Override res.end to capture response time
            const originalEnd = res.end;
            res.end = (...args) => {
                const responseTime = Date.now() - req.startTime;
                
                // Log the request
                this.logRequest(req, res, responseTime);
                
                // Call original end
                originalEnd.apply(res, args);
            };
            
            next();
        });

        // Basic middleware
        this.app.use(cors());
        
        // Special raw body parsing for LINE webhook
        this.app.use('/webhook', (req, res, next) => {
            let data = '';
            req.setEncoding('utf8');
            req.on('data', chunk => {
                data += chunk;
            });
            req.on('end', () => {
                req.rawBody = data;
                try {
                    req.body = JSON.parse(data);
                } catch (err) {
                    console.error('❌ JSON parse error:', err);
                    req.body = {};
                }
                next();
            });
        });
        
        // Regular JSON parsing for other endpoints
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
        
        // Error handling middleware
        this.app.use((error, req, res, next) => {
            console.error('❌ API Error:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: 'Internal server error',
                    timestamp: new Date().toISOString()
                });
            }
        });
        
        // Serve static files from public directory
        this.app.use(express.static(path.join(__dirname, 'public')));
    }

    // LINE signature validation function
    validateSignature(signature, body, secret) {
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(body, 'utf8')  // 文字列として処理
            .digest('base64');
        return signature === expectedSignature;
    }

    setupRoutes() {
        // Root route for Landing Page
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'index.html'));
        });

        // Web Application route
        this.app.get('/app', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'));
        });

        // Marketing Pages routes
        this.app.get('/about', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'about.html'));
        });

        this.app.get('/pricing', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'pricing.html'));
        });

        this.app.get('/partners', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'partners.html'));
        });

        this.app.get('/contact', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'contact.html'));
        });

        this.app.get('/legal', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'legal.html'));
        });

        // Blog routes
        this.app.get('/blog', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'blog.html'));
        });

        this.app.get('/blog/:slug', (req, res) => {
            res.sendFile(path.join(__dirname, 'public', 'blog-post.html'));
        });

        // Blog API routes
        this.app.get('/api/blog/posts', (req, res) => {
            this.trackRequest('/api/blog/posts');
            const startTime = Date.now();
            
            try {
                const posts = this.getBlogPosts();
                res.json({
                    success: true,
                    data: {
                        posts: posts,
                        total: posts.length
                    }
                });
                this.trackResponse('/api/blog/posts', Date.now() - startTime, true);
            } catch (error) {
                console.error('Blog posts API error:', error);
                this.trackResponse('/api/blog/posts', Date.now() - startTime, false);
                res.status(500).json({
                    success: false,
                    error: 'Failed to load blog posts'
                });
            }
        });

        this.app.get('/api/blog/posts/:slug', (req, res) => {
            this.trackRequest('/api/blog/posts/:slug');
            const startTime = Date.now();
            
            try {
                const post = this.getBlogPost(req.params.slug);
                if (!post) {
                    res.status(404).json({
                        success: false,
                        error: 'Blog post not found'
                    });
                    return;
                }
                
                res.json({
                    success: true,
                    data: {
                        post: post
                    }
                });
                this.trackResponse('/api/blog/posts/:slug', Date.now() - startTime, true);
            } catch (error) {
                console.error('Blog post API error:', error);
                this.trackResponse('/api/blog/posts/:slug', Date.now() - startTime, false);
                res.status(500).json({
                    success: false,
                    error: 'Failed to load blog post'
                });
            }
        });

        this.app.get('/blog/rss', (req, res) => {
            this.trackRequest('/blog/rss');
            const startTime = Date.now();
            
            try {
                const rssXml = this.generateRSSFeed();
                res.set('Content-Type', 'application/rss+xml');
                res.send(rssXml);
                this.trackResponse('/blog/rss', Date.now() - startTime, true);
            } catch (error) {
                console.error('RSS feed error:', error);
                this.trackResponse('/blog/rss', Date.now() - startTime, false);
                res.status(500).send('Error generating RSS feed');
            }
        });

        // SEO: Sitemap XML
        this.app.get('/sitemap.xml', (req, res) => {
            this.trackRequest('/sitemap.xml');
            const startTime = Date.now();
            
            try {
                const sitemapXml = this.generateSitemap();
                res.set('Content-Type', 'application/xml');
                res.send(sitemapXml);
                this.trackResponse('/sitemap.xml', Date.now() - startTime, true);
            } catch (error) {
                console.error('Sitemap generation error:', error);
                this.trackResponse('/sitemap.xml', Date.now() - startTime, false);
                res.status(500).send('Error generating sitemap');
            }
        });

        // SEO: Robots.txt
        this.app.get('/robots.txt', (req, res) => {
            const robotsTxt = this.generateRobotsTxt();
            res.set('Content-Type', 'text/plain');
            res.send(robotsTxt);
        });

        // 1. GET /api/health - ヘルスチェック
        this.app.get('/api/health', (req, res) => {
            const healthStatus = {
                status: 'OK',
                timestamp: new Date().toISOString(),
                version: '4.0.0-railway-monitoring',
                phase: 'Phase 4-D: Complete Monitoring System',
                services: {
                    api_server: 'active',
                    emotional_matching: this.emotionAnalyzer.getAnalysisMode(),
                    database: this.databaseType,
                    jiji_persona: 'active',
                    line_bot: this.lineActive ? 'active' : 'credentials_missing'
                },
                endpoints: [
                    'GET /api/health',
                    'GET /api/stats', 
                    'GET /api/shops',
                    'GET /api/shops/:id',
                    'POST /api/match',
                    'GET /api/search',
                    'POST /api/feedback',
                    'GET /api/recommendations',
                    'POST /webhook',
                    'GET /api/web/user/:userId/stats',
                    'GET /api/web/sea-conditions/:area?',
                    'GET /api/web/travel-plans/:type?',
                    'POST /api/web/rich-menu/action',
                    'GET /api/web/menu-config',
                    'GET /api/monitoring',
                    // Phase 5 endpoints
                    'POST /api/v5/marketing/referral',
                    'POST /api/v5/marketing/referral/signup',
                    'POST /api/v5/beta/user/register',
                    'POST /api/v5/beta/feedback',
                    'GET /api/v5/marketing/report',
                    'POST /api/v5/track',
                    'POST /api/v5/revenue/shop/referral',
                    'POST /api/v5/revenue/shop/conversion',
                    'POST /api/v5/revenue/premium/subscribe',
                    'GET /api/v5/revenue/premium/access',
                    'POST /api/v5/revenue/affiliate/link',
                    'GET /api/v5/revenue/report',
                    'GET /api/v5/dashboard'
                ],
                environment: {
                    railway: process.env.RAILWAY_ENVIRONMENT || 'development',
                    port: this.port,
                    openai_available: !!this.openai,
                    supabase_available: !!this.supabase,
                    line_bot_available: this.lineActive
                }
            };

            res.json(healthStatus);
        });

        // 2. GET /api/stats - 統計情報
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.sheetsConnector.getShopStatistics();
                
                // Enhanced stats for Railway environment
                const enhancedStats = {
                    ...stats,
                    data_source: this.databaseType,
                    emotional_analysis: {
                        categories: Object.keys(this.emotionalConcerns).length,
                        engine: this.openai ? 'openai' : 'mock'
                    },
                    jiji_features: {
                        persona_active: true,
                        memory_system: 'active',
                        emotion_matching: true,
                        six_category_analysis: true
                    },
                    monitoring: {
                        uptime: this.formatUptime(this.stats.uptime),
                        total_requests: this.stats.requests.total,
                        success_rate: this.stats.requests.total > 0 ? 
                            Math.round((this.stats.requests.successful / this.stats.requests.total) * 100) : 100,
                        avg_response_time: this.stats.performance.averageResponseTime,
                        memory_usage: this.stats.memory.current,
                        active_alerts: this.generateAlerts().length
                    },
                    // Phase 5 Business KPIs
                    business_kpis: this.phase5Enabled ? this.generateBusinessKPIs() : null,
                    timestamp: new Date().toISOString()
                };

                res.json({
                    success: true,
                    data: enhancedStats
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 3. GET /api/shops - 店舗一覧取得
        this.app.get('/api/shops', async (req, res) => {
            try {
                const { area, limit = 50, offset = 0 } = req.query;
                
                let shops;
                if (area) {
                    shops = await this.sheetsConnector.getShopsByArea(area);
                } else {
                    shops = await this.sheetsConnector.getAllShops();
                }

                // Apply pagination
                const startIndex = parseInt(offset);
                const endIndex = startIndex + parseInt(limit);
                const paginatedShops = shops.slice(startIndex, endIndex);

                res.json({
                    success: true,
                    data: paginatedShops,
                    pagination: {
                        total: shops.length,
                        limit: parseInt(limit),
                        offset: startIndex,
                        has_more: endIndex < shops.length
                    },
                    meta: {
                        area_filter: area || 'all',
                        data_source: this.databaseType,
                        timestamp: new Date().toISOString()
                    }
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 4. GET /api/shops/:id - 店舗詳細取得
        this.app.get('/api/shops/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const shop = await this.sheetsConnector.getShopById(id);
                
                if (!shop) {
                    return res.status(404).json({
                        success: false,
                        error: `Shop with ID '${id}' not found`,
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Enhanced shop details for Railway environment
                const enhancedShop = {
                    ...shop,
                    jiji_analysis: {
                        safety_score: this.calculateSafetyScore(shop),
                        beginner_friendliness: this.calculateBeginnerScore(shop),
                        value_score: this.calculateValueScore(shop),
                        overall_jiji_rating: this.calculateOverallJijiRating(shop)
                    },
                    data_source: this.supabase ? 'supabase' : 'mock'
                };

                res.json({
                    success: true,
                    data: enhancedShop,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 5. POST /api/match - 感情マッチング（核心機能）
        this.app.post('/api/match', async (req, res) => {
            try {
                const { message, area, maxResults = 3, userProfile = {} } = req.body;
                
                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required for emotional matching',
                        timestamp: new Date().toISOString()
                    });
                }
                
                console.log(`🔍 Emotional matching request: "${message}" in area: ${area || 'all'}`);
                
                // 1. Advanced emotional analysis with OpenAI
                const emotionalAnalysis = await this.emotionAnalyzer.analyzeEmotions(message, { userProfile });
                
                // 2. Get candidate shops
                let shops = area ? 
                    await this.sheetsConnector.getShopsByArea(area) : 
                    await this.sheetsConnector.getAllShops();
                
                // 3. Calculate emotional matching scores
                const scoredShops = this.calculateEmotionalScores(shops, emotionalAnalysis, userProfile);
                
                // 4. Get top matches
                const topMatches = scoredShops.slice(0, parseInt(maxResults));
                
                // 5. Generate Jiji recommendations with advanced persona
                const jijiResponse = await this.emotionAnalyzer.generateJijiResponse(
                    emotionalAnalysis, 
                    topMatches, 
                    userProfile
                );
                
                const jijiRecommendations = await this.generateJijiRecommendations(
                    topMatches, 
                    emotionalAnalysis, 
                    userProfile
                );

                const result = {
                    success: true,
                    data: {
                        query: {
                            message,
                            area,
                            maxResults: parseInt(maxResults)
                        },
                        emotional_analysis: emotionalAnalysis,
                        recommendations: jijiRecommendations,
                        jiji_main_message: jijiResponse.jiji_main_message,
                        jiji_response_info: {
                            response_type: jijiResponse.response_type,
                            emotion_addressed: jijiResponse.emotion_addressed,
                            personalization_level: jijiResponse.personalization_level
                        },
                        search_stats: {
                            total_shops_searched: shops.length,
                            area_searched: area || 'all',
                            processing_time: 'instant',
                            emotion_categories_detected: Object.keys(emotionalAnalysis.detected_emotions).length
                        }
                    },
                    timestamp: new Date().toISOString()
                };

                res.json(result);
                
            } catch (error) {
                console.error('❌ Emotional matching error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message,
                    fallback_message: this.generateFallbackMessage(),
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 6. GET /api/search - 店舗検索
        this.app.get('/api/search', async (req, res) => {
            try {
                const { 
                    q, // search query
                    area, 
                    minRating = 0, 
                    maxPrice = 50000, 
                    beginnerFriendly,
                    soloWelcome,
                    privateGuide,
                    limit = 20
                } = req.query;
                
                let shops = await this.sheetsConnector.getAllShops();
                
                // Apply filters
                if (area) {
                    shops = shops.filter(shop => shop.area === area);
                }
                
                if (q) {
                    const searchQuery = q.toLowerCase();
                    shops = shops.filter(shop => 
                        shop.shop_name.toLowerCase().includes(searchQuery) ||
                        shop.speciality_areas.toLowerCase().includes(searchQuery) ||
                        shop.area.toLowerCase().includes(searchQuery)
                    );
                }
                
                if (parseFloat(minRating) > 0) {
                    shops = shops.filter(shop => shop.customer_rating >= parseFloat(minRating));
                }
                
                if (parseInt(maxPrice) < 50000) {
                    shops = shops.filter(shop => shop.fun_dive_price_2tanks <= parseInt(maxPrice));
                }
                
                if (beginnerFriendly !== undefined) {
                    shops = shops.filter(shop => shop.beginner_friendly === (beginnerFriendly === 'true'));
                }
                
                if (soloWelcome !== undefined) {
                    shops = shops.filter(shop => shop.solo_welcome === (soloWelcome === 'true'));
                }
                
                if (privateGuide !== undefined) {
                    shops = shops.filter(shop => shop.private_guide_available === (privateGuide === 'true'));
                }
                
                // Sort by rating
                shops.sort((a, b) => b.customer_rating - a.customer_rating);
                
                // Apply limit
                const limitedShops = shops.slice(0, parseInt(limit));
                
                res.json({
                    success: true,
                    data: limitedShops,
                    search_meta: {
                        query: q,
                        filters_applied: {
                            area, minRating, maxPrice, beginnerFriendly, soloWelcome, privateGuide
                        },
                        total_results: shops.length,
                        returned_results: limitedShops.length
                    },
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 7. POST /api/feedback - フィードバック
        this.app.post('/api/feedback', async (req, res) => {
            try {
                const { 
                    shop_id, 
                    user_id, 
                    rating, 
                    comment, 
                    experience_type, 
                    recommendation_id 
                } = req.body;
                
                if (!shop_id || !rating) {
                    return res.status(400).json({
                        success: false,
                        error: 'shop_id and rating are required',
                        timestamp: new Date().toISOString()
                    });
                }
                
                // Validate rating
                if (rating < 1 || rating > 5) {
                    return res.status(400).json({
                        success: false,
                        error: 'Rating must be between 1 and 5',
                        timestamp: new Date().toISOString()
                    });
                }
                
                const feedback = {
                    feedback_id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    shop_id,
                    user_id: user_id || 'anonymous',
                    rating: parseFloat(rating),
                    comment: comment || '',
                    experience_type: experience_type || 'general',
                    recommendation_id: recommendation_id || null,
                    created_at: new Date().toISOString(),
                    processed: false
                };
                
                // Log feedback (in production, this would be saved to database)
                console.log(`📝 New feedback received:`, feedback);
                
                // In Task 3, this will be saved to Supabase
                // await this.supabase.from('user_feedback').insert([feedback]);
                
                res.json({
                    success: true,
                    message: 'Feedback received successfully',
                    data: {
                        feedback_id: feedback.feedback_id,
                        status: 'received'
                    },
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 8. GET /api/monitoring - 監視・システム状況
        this.app.get('/api/monitoring', (req, res) => {
            try {
                const currentTime = Date.now();
                const systemStatus = {
                    server: {
                        status: 'operational',
                        uptime_seconds: this.stats.uptime,
                        uptime_formatted: this.formatUptime(this.stats.uptime),
                        memory_usage_mb: this.stats.memory.current,
                        memory_peak_mb: this.stats.memory.peak,
                        timestamp: new Date().toISOString()
                    },
                    requests: {
                        total: this.stats.requests.total,
                        successful: this.stats.requests.successful,
                        failed: this.stats.requests.failed,
                        success_rate: this.stats.requests.total > 0 ? 
                            Math.round((this.stats.requests.successful / this.stats.requests.total) * 100) : 100,
                        by_endpoint: this.stats.requests.byEndpoint
                    },
                    performance: {
                        average_response_time_ms: this.stats.performance.averageResponseTime,
                        max_response_time_ms: this.stats.performance.maxResponseTime,
                        min_response_time_ms: this.stats.performance.minResponseTime === Infinity ? 0 : this.stats.performance.minResponseTime
                    },
                    errors: {
                        recent_count: this.stats.errors.length,
                        recent_errors: this.stats.errors.slice(-10), // Last 10 errors
                        error_rate: this.stats.requests.total > 0 ? 
                            Math.round((this.stats.requests.failed / this.stats.requests.total) * 100) : 0
                    },
                    services: {
                        database: this.databaseType,
                        emotion_analyzer: this.emotionAnalyzer.getAnalysisMode(),
                        line_bot: this.lineActive,
                        openai: !!this.openai
                    },
                    alerts: this.generateAlerts()
                };

                res.json({
                    success: true,
                    data: systemStatus,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Monitoring endpoint error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Monitoring system error',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // === Phase 5 専用API ===

        // 10. POST /api/v5/marketing/referral - 紹介コード生成
        this.app.post('/api/v5/marketing/referral', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({
                    success: false,
                    error: 'Phase 5 features not available',
                    timestamp: new Date().toISOString()
                });
            }

            try {
                const { user_id, campaign } = req.body;
                
                if (!user_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'user_id is required',
                        timestamp: new Date().toISOString()
                    });
                }

                const referralData = this.marketingManager.generateReferralCode(user_id, campaign);
                
                res.json({
                    success: true,
                    data: {
                        referral_code: referralData.code,
                        expires_at: referralData.expires_at,
                        rewards: referralData.rewards,
                        sharing_message: `🌊 Jijiで沖縄ダイビングを始めよう！紹介コード「${referralData.code}」で特別推薦が受けられます！ https://jiji-bot-production.up.railway.app`
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Referral generation error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Referral generation failed',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 11. POST /api/v5/marketing/referral/signup - 紹介経由サインアップ
        this.app.post('/api/v5/marketing/referral/signup', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({
                    success: false,
                    error: 'Phase 5 features not available'
                });
            }

            try {
                const { referral_code, new_user_id, user_data } = req.body;
                
                if (!referral_code || !new_user_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'referral_code and new_user_id are required'
                    });
                }

                const result = this.marketingManager.processReferralSignup(referral_code, new_user_id);
                
                if (!result.success) {
                    return res.status(400).json({
                        success: false,
                        error: result.reason,
                        timestamp: new Date().toISOString()
                    });
                }

                // β-testユーザーとして登録
                if (user_data) {
                    this.betaTestingManager.registerTestUser({
                        user_id: new_user_id,
                        ...user_data,
                        acquisition_source: 'referral',
                        referral_code
                    });
                }

                res.json({
                    success: true,
                    data: {
                        rewards: result.rewards,
                        welcome_message: 'Jijiへようこそ！紹介経由での登録ありがとうございます。特別推薦をご利用いただけます！'
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Referral signup error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Referral signup failed'
                });
            }
        });

        // 12. POST /api/v5/beta/user/register - β-testユーザー登録
        this.app.post('/api/v5/beta/user/register', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({
                    success: false,
                    error: 'Phase 5 features not available'
                });
            }

            try {
                const userData = req.body;
                const testUser = this.betaTestingManager.registerTestUser(userData);
                
                // パーソナライズされたテスト体験作成
                const personalizedExperience = this.betaTestingManager.createPersonalizedTestExperience(testUser.user_id);
                
                res.json({
                    success: true,
                    data: {
                        user_id: testUser.user_id,
                        assigned_scenarios: testUser.test_scenarios_assigned,
                        personalized_experience: personalizedExperience,
                        welcome_message: `${testUser.name}さん、β-testへのご参加ありがとうございます！`
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Beta user registration error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Beta user registration failed'
                });
            }
        });

        // 13. POST /api/v5/beta/feedback - β-testフィードバック収集
        this.app.post('/api/v5/beta/feedback', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({
                    success: false,
                    error: 'Phase 5 features not available'
                });
            }

            try {
                const { user_id } = req.body;
                const feedbackData = req.body;
                
                const feedback = this.betaTestingManager.collectFeedback(user_id, feedbackData);
                
                // エンゲージメント管理
                const engagement = this.betaTestingManager.manageContinuousEngagement(user_id);
                
                res.json({
                    success: true,
                    data: {
                        feedback_id: feedback.feedback_id,
                        engagement_score: engagement?.engagement_score || 0,
                        next_recommendations: engagement?.recommended_interventions || [],
                        thank_you_message: 'フィードバックありがとうございます！Jijiの改善に活用させていただきます。'
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Beta feedback error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Beta feedback collection failed'
                });
            }
        });

        // 14. GET /api/v5/marketing/report - マーケティングレポート
        this.app.get('/api/v5/marketing/report', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({
                    success: false,
                    error: 'Phase 5 features not available'
                });
            }

            try {
                const marketingReport = this.marketingManager.generateMarketingReport();
                const testingReport = this.betaTestingManager.generateTestingReport();
                
                res.json({
                    success: true,
                    data: {
                        marketing: marketingReport,
                        beta_testing: testingReport,
                        combined_insights: {
                            total_users: marketingReport.referral_analysis.successful_referrals + 
                                        (testingReport.overall_stats?.total_test_users || 0),
                            user_acquisition_trend: '📈 Positive growth',
                            top_acquisition_channel: 'referral_program',
                            user_satisfaction_avg: testingReport.satisfaction_analysis?.average_overall || 0
                        }
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Marketing report error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Marketing report generation failed'
                });
            }
        });

        // === 収益化システムAPI ===

        // 16. POST /api/v5/revenue/shop/referral - ショップ紹介追跡
        this.app.post('/api/v5/revenue/shop/referral', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({ success: false, error: 'Phase 5 features not available' });
            }

            try {
                const { user_id, shop_id, referral_source } = req.body;
                
                if (!user_id || !shop_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'user_id and shop_id are required'
                    });
                }

                const referralData = this.revenueManager.trackShopReferral(user_id, shop_id, referral_source);
                
                res.json({
                    success: true,
                    data: {
                        referral_id: referralData.referral_id,
                        status: referralData.status,
                        estimated_commission: '手数料は予約確定後に計算されます',
                        tracking_message: 'ショップへの紹介を記録しました。予約が確定次第、手数料が計算されます。'
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Shop referral tracking error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Shop referral tracking failed'
                });
            }
        });

        // 17. POST /api/v5/revenue/shop/conversion - ショップ予約確定
        this.app.post('/api/v5/revenue/shop/conversion', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({ success: false, error: 'Phase 5 features not available' });
            }

            try {
                const { referral_id, booking_amount, booking_date, shop_grade, service_type } = req.body;
                
                if (!referral_id || !booking_amount) {
                    return res.status(400).json({
                        success: false,
                        error: 'referral_id and booking_amount are required'
                    });
                }

                const result = this.revenueManager.confirmShopConversion(referral_id, {
                    booking_amount,
                    booking_date,
                    shop_grade,
                    service_type
                });

                if (!result.success) {
                    return res.status(400).json({
                        success: false,
                        error: result.reason
                    });
                }

                res.json({
                    success: true,
                    data: {
                        commission_earned: result.commission.commission,
                        commission_rate: `${(result.commission.rate * 100).toFixed(1)}%`,
                        transaction_id: result.transaction_id,
                        success_message: `予約確定！手数料¥${result.commission.commission}を獲得しました。`
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Shop conversion error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Shop conversion tracking failed'
                });
            }
        });

        // 18. POST /api/v5/revenue/premium/subscribe - プレミアム会員登録
        this.app.post('/api/v5/revenue/premium/subscribe', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({ success: false, error: 'Phase 5 features not available' });
            }

            try {
                const { user_id, plan_id, payment_method } = req.body;
                
                if (!user_id || !plan_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'user_id and plan_id are required'
                    });
                }

                const result = this.revenueManager.subscribePremium(user_id, plan_id, payment_method);
                
                if (!result.success) {
                    return res.status(400).json({
                        success: false,
                        error: result.reason
                    });
                }

                res.json({
                    success: true,
                    data: {
                        subscription_id: result.membership.subscription_id,
                        plan_name: result.membership.plan_name,
                        features: result.membership.features,
                        next_billing_date: result.membership.end_date,
                        amount: result.membership.current_period_amount,
                        welcome_message: `${result.membership.plan_name}へようこそ！プレミアム機能をご利用いただけます。`
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Premium subscription error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Premium subscription failed'
                });
            }
        });

        // 19. GET /api/v5/revenue/premium/access - プレミアム機能アクセス確認
        this.app.get('/api/v5/revenue/premium/access', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({ success: false, error: 'Phase 5 features not available' });
            }

            try {
                const { user_id, feature } = req.query;
                
                if (!user_id || !feature) {
                    return res.status(400).json({
                        success: false,
                        error: 'user_id and feature are required'
                    });
                }

                const accessCheck = this.revenueManager.checkPremiumAccess(user_id, feature);
                
                res.json({
                    success: true,
                    data: {
                        access_granted: accessCheck.access,
                        reason: accessCheck.reason || 'access_granted',
                        membership: accessCheck.membership || null,
                        remaining_usage: accessCheck.remaining_usage || null
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Premium access check error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Premium access check failed'
                });
            }
        });

        // 20. POST /api/v5/revenue/affiliate/link - アフィリエイトリンク生成
        this.app.post('/api/v5/revenue/affiliate/link', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({ success: false, error: 'Phase 5 features not available' });
            }

            try {
                const { user_id, partner_id, product_id, metadata } = req.body;
                
                if (!user_id || !partner_id || !product_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'user_id, partner_id, and product_id are required'
                    });
                }

                const result = this.revenueManager.generateAffiliateLink(partner_id, product_id, user_id, metadata);
                
                if (!result.success) {
                    return res.status(400).json({
                        success: false,
                        error: result.reason
                    });
                }

                res.json({
                    success: true,
                    data: {
                        affiliate_url: result.url,
                        tracking_id: result.affiliate_link.tracking_id,
                        partner_name: partner_id,
                        message: 'アフィリエイトリンクを生成しました。このリンクから予約すると特典があります！'
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Affiliate link generation error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Affiliate link generation failed'
                });
            }
        });

        // === Phase 5 総合ダッシュボード ===

        // 22. GET /api/v5/dashboard - Phase 5統合ダッシュボード
        this.app.get('/api/v5/dashboard', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({ success: false, error: 'Phase 5 features not available' });
            }

            try {
                // 各システムからデータ収集
                const marketingData = this.marketingManager.generateMarketingReport();
                const testingData = this.betaTestingManager.generateTestingReport();
                const revenueData = this.revenueManager.generateRevenueReport();
                const systemStats = this.generateBusinessKPIs();

                // 統合ダッシュボードデータ
                const dashboardData = {
                    overview: {
                        status: 'Phase 5 Fully Operational',
                        last_updated: new Date().toISOString(),
                        uptime: this.formatUptime(this.stats.uptime),
                        system_health: systemStats.system_health?.scalability_readiness || 'good'
                    },
                    
                    // ユーザー獲得・成長
                    user_growth: {
                        total_users: (marketingData.referral_analysis?.successful_referrals || 0) + 
                                    (testingData.overall_stats?.total_test_users || 0),
                        beta_testers: testingData.overall_stats?.total_test_users || 0,
                        referral_signups: marketingData.referral_analysis?.successful_referrals || 0,
                        growth_rate: marketingData.campaign_performance?.average_conversion_rate || 0,
                        top_acquisition_channel: 'referral_program'
                    },

                    // エンゲージメント・満足度
                    engagement: {
                        overall_score: systemStats.engagement?.engagement_score || 0,
                        satisfaction_avg: testingData.satisfaction_analysis?.average_overall || 0,
                        nps_score: testingData.nps_analysis?.nps || 0,
                        active_feedback: testingData.overall_stats?.total_feedback_entries || 0,
                        completion_rate: testingData.overall_stats?.completed_scenarios || 0
                    },

                    // 収益・ビジネス
                    revenue: {
                        monthly_recurring: revenueData.summary?.monthly_recurring_revenue || 0,
                        total_revenue: revenueData.period?.current_month?.total || 0,
                        growth_rate: revenueData.period?.growth_rate || 0,
                        premium_users: revenueData.summary?.total_active_premium_users || 0,
                        avg_revenue_per_user: revenueData.summary?.average_revenue_per_user || 0
                    },

                    // システムパフォーマンス
                    performance: {
                        api_response_time: this.stats.performance.averageResponseTime,
                        success_rate: this.stats.requests.total > 0 ? 
                            Math.round((this.stats.requests.successful / this.stats.requests.total) * 100) : 100,
                        error_rate: this.stats.requests.total > 0 ? 
                            Math.round((this.stats.requests.failed / this.stats.requests.total) * 100) : 0,
                        memory_usage: this.stats.memory.current,
                        active_alerts: this.generateAlerts().length
                    },

                    // 今日の重要指標
                    daily_highlights: {
                        new_users_today: this.calculateDailyNewUsers(),
                        revenue_today: this.calculateDailyRevenue(),
                        feedback_today: this.calculateDailyFeedback(),
                        shop_referrals_today: this.calculateDailyShopReferrals(),
                        system_uptime_today: this.calculateDailyUptime()
                    },

                    // 改善提案
                    recommendations: [
                        ...marketingData.recommendations || [],
                        ...testingData.improvement_recommendations || [],
                        ...this.generateSystemRecommendations()
                    ].slice(0, 5), // 上位5つの推奨事項

                    // 次のアクション
                    next_actions: this.generateNextActions(marketingData, testingData, revenueData)
                };

                res.json({
                    success: true,
                    data: dashboardData,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Dashboard generation error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Dashboard generation failed',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // 21. GET /api/v5/revenue/report - 収益レポート
        this.app.get('/api/v5/revenue/report', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({ success: false, error: 'Phase 5 features not available' });
            }

            try {
                const revenueReport = this.revenueManager.generateRevenueReport();
                const revenueStatus = this.revenueManager.getRevenueStatus();
                
                res.json({
                    success: true,
                    data: {
                        revenue_report: revenueReport,
                        current_status: revenueStatus,
                        commission_rates: this.revenueManager.getCommissionRates(),
                        premium_plans: this.revenueManager.getPremiumPlans()
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ Revenue report error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Revenue report generation failed'
                });
            }
        });

        // 15. POST /api/v5/track - ユーザー行動トラッキング
        this.app.post('/api/v5/track', (req, res) => {
            if (!this.phase5Enabled) {
                return res.status(503).json({ success: false, error: 'Phase 5 features not available' });
            }

            try {
                const { user_id, action, metadata } = req.body;
                
                // マーケティング追跡
                const engagement = this.marketingManager.trackUserEngagement(user_id, action, metadata);
                
                // A/Bテスト結果記録（該当する場合）
                if (metadata.ab_test_id && metadata.variation_id) {
                    this.betaTestingManager.recordABTestResult(
                        metadata.ab_test_id, 
                        user_id, 
                        metadata.variation_id, 
                        { converted: action === 'conversion', time_spent: metadata.time_spent || 0 }
                    );
                }

                // コンテキストフィードバック生成
                let contextualFeedback = null;
                if (action === 'emotion_analysis_completion' || action === 'shop_detail_view') {
                    contextualFeedback = this.betaTestingManager.triggerContextualFeedback(user_id, action, metadata);
                }

                res.json({
                    success: true,
                    data: {
                        tracked: true,
                        engagement_recorded: !!engagement,
                        contextual_feedback: contextualFeedback
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('❌ User tracking error:', error);
                res.status(500).json({
                    success: false,
                    error: 'User tracking failed'
                });
            }
        });

        // 9. GET /api/recommendations - おすすめ取得
        this.app.get('/api/recommendations', async (req, res) => {
            try {
                const { 
                    user_id, 
                    area, 
                    experience_level = 'beginner', 
                    limit = 5 
                } = req.query;
                
                // Get all shops
                let shops = area ? 
                    await this.sheetsConnector.getShopsByArea(area) : 
                    await this.sheetsConnector.getAllShops();
                
                // Apply experience level filtering
                if (experience_level === 'beginner') {
                    shops = shops.filter(shop => shop.beginner_friendly);
                }
                
                // Calculate recommendation scores
                const scoredShops = shops.map(shop => ({
                    ...shop,
                    recommendation_score: this.calculateRecommendationScore(shop, experience_level)
                }));
                
                // Sort by recommendation score
                scoredShops.sort((a, b) => b.recommendation_score - a.recommendation_score);
                
                // Get top recommendations
                const topRecommendations = scoredShops.slice(0, parseInt(limit));
                
                // Generate Jiji explanations for each recommendation
                const jijiRecommendations = topRecommendations.map((shop, index) => ({
                    ...shop,
                    recommendation_rank: index + 1,
                    jiji_explanation: this.generateRecommendationExplanation(shop, experience_level),
                    recommended_for: this.getRecommendationReasons(shop, experience_level)
                }));
                
                res.json({
                    success: true,
                    data: jijiRecommendations,
                    recommendation_meta: {
                        user_id: user_id || 'anonymous',
                        area: area || 'all',
                        experience_level,
                        total_considered: shops.length,
                        recommendations_returned: jijiRecommendations.length
                    },
                    timestamp: new Date().toISOString()
                });
                
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // LINE Bot Webhook Handler
        if (this.lineActive) {
            // Full webhook with manual signature verification when credentials available
            this.app.post('/webhook', (req, res) => {
                // Manual signature verification to handle Railway body parsing
                const signature = req.headers['x-line-signature'];
                const rawBody = req.rawBody; // 文字列として取得
                
                if (!signature) {
                    console.error('❌ Missing signature header');
                    return res.status(401).json({ error: 'Missing signature' });
                }

                if (!rawBody) {
                    console.error('❌ Missing raw body');
                    return res.status(400).json({ error: 'Missing raw body' });
                }

                try {
                    // 署名検証を新しい関数で実行
                    if (!this.validateSignature(signature, rawBody, this.lineConfig.channelSecret)) {
                        console.error('❌ Invalid signature');
                        return res.status(401).json({ error: 'Invalid signature' });
                    }
                    
                    // req.body は既にJSON parseされている
                    const events = req.body;
                    
                    if (!events || !events.events) {
                        console.error('❌ Invalid events format');
                        return res.status(400).json({ error: 'Invalid events format' });
                    }
                    
                    Promise
                        .all(events.events.map(this.handleEvent.bind(this)))
                        .then((result) => res.json(result))
                        .catch((err) => {
                            console.error('❌ Webhook error:', err);
                            res.status(500).end();
                        });
                } catch (err) {
                    console.error('❌ Signature verification error:', err);
                    return res.status(500).json({ error: 'Signature verification failed' });
                }
            });
        } else {
            // Basic webhook endpoint for testing when credentials not available
            this.app.post('/webhook', (req, res) => {
                console.log('📱 Webhook received (no credentials - testing mode)');
                
                if (req.body && req.body.events) {
                    console.log(`📱 Events received: ${req.body.events.length}`);
                    req.body.events.forEach(event => {
                        if (event.type === 'message' && event.message.type === 'text') {
                            console.log(`💬 Message: "${event.message.text}"`);
                        }
                    });
                }
                
                res.status(200).json({ 
                    success: true, 
                    message: 'Webhook received (testing mode)',
                    note: 'Add LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET to enable responses'
                });
            });
        }

        // WEB APP Integration Endpoints
        this.app.get('/api/web/user/:userId/stats', async (req, res) => {
            try {
                const { userId } = req.params;
                const userStats = await this.getUserStats(userId);
                
                res.json({
                    success: true,
                    data: userStats,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/api/web/sea-conditions/:area?', async (req, res) => {
            try {
                const { area = '沖縄' } = req.params;
                const seaConditions = this.generateSeaConditions(area);
                
                res.json({
                    success: true,
                    data: {
                        area: area,
                        conditions: seaConditions,
                        generated_at: new Date().toISOString()
                    }
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/api/web/travel-plans/:type?', async (req, res) => {
            try {
                const { type = 'general' } = req.params;
                const planResponse = this.generateTravelPlanResponse(type);
                
                res.json({
                    success: true,
                    data: {
                        plan_type: type,
                        plan_details: planResponse.contents
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.post('/api/web/rich-menu/action', async (req, res) => {
            try {
                const { action, userId } = req.body;
                
                if (!action || !userId) {
                    return res.status(400).json({
                        success: false,
                        error: 'action and userId are required'
                    });
                }
                
                const response = await this.handleRichMenuAction(action, userId);
                
                res.json({
                    success: true,
                    data: response,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.app.get('/api/web/menu-config', (req, res) => {
            const menuConfig = {
                menu_items: [
                    {
                        id: 'travel_plan',
                        title: '旅行計画・予約',
                        icon: '✈️',
                        description: '沖縄ダイビング旅行の計画をサポート',
                        features: ['プラン提案', '宿泊アドバイス', '予算相談', 'スケジュール調整']
                    },
                    {
                        id: 'shop_search',
                        title: 'ショップ検索',
                        icon: '🏪',
                        description: '感情分析による最適ショップマッチング',
                        features: ['感情マッチング', 'エリア検索', '料金比較', 'レビュー確認']
                    },
                    {
                        id: 'sea_conditions',
                        title: '海況チェック',
                        icon: '🌊',
                        description: '最新の海況・天気情報',
                        features: ['海況情報', '天気予報', '透明度データ', '適正度判定']
                    },
                    {
                        id: 'web_app',
                        title: '詳細情報WEB',
                        icon: '🌐',
                        description: 'WEBアプリで詳細情報を確認',
                        features: ['詳細分析', '比較機能', '統計情報', '履歴確認']
                    },
                    {
                        id: 'photo_share',
                        title: '体験投稿',
                        icon: '📷',
                        description: 'ダイビング体験のシェア',
                        features: ['写真投稿', 'レビュー投稿', '体験談', '評価システム']
                    },
                    {
                        id: 'my_page',
                        title: 'マイページ',
                        icon: '📋',
                        description: '個人統計・設定管理',
                        features: ['利用統計', '設定管理', 'お気に入り', '履歴確認']
                    }
                ]
            };
            
            res.json({
                success: true,
                data: menuConfig,
                timestamp: new Date().toISOString()
            });
        });

        // Serve the main website
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index-integrated.html'));
        });

        // UptimeRobot監視対応エンドポイント
        
        // LINE Bot Webhook endpoint
        this.app.post('/api/line-webhook', (req, res) => {
            res.json({
                status: 'ok',
                message: 'LINE Bot Webhook endpoint is active',
                timestamp: new Date().toISOString()
            });
        });

        // 管理画面エンドポイント
        this.app.get('/admin', (req, res) => {
            res.json({
                status: 'ok',
                message: 'Admin panel endpoint is active',
                features: ['system_monitoring', 'user_management', 'analytics'],
                timestamp: new Date().toISOString()
            });
        });

        // 口コミシステムエンドポイント
        this.app.get('/api/reviews', (req, res) => {
            res.json({
                status: 'ok',
                message: 'Review system endpoint is active',
                endpoints: [
                    'GET /api/reviews - Get all reviews',
                    'POST /api/reviews - Submit new review',
                    'GET /api/reviews/:id - Get specific review'
                ],
                timestamp: new Date().toISOString()
            });
        });

        this.app.post('/api/reviews', (req, res) => {
            res.json({
                status: 'ok',
                message: 'Review submission endpoint is active',
                timestamp: new Date().toISOString()
            });
        });

        // ショップ検索API（既存のものを拡張）
        this.app.get('/api/shops/search', (req, res) => {
            res.json({
                status: 'ok',
                message: 'Shop search endpoint is active',
                parameters: ['area', 'experience_level', 'price_range', 'features'],
                timestamp: new Date().toISOString()
            });
        });

        // 会員システムエンドポイント
        this.app.get('/member', (req, res) => {
            res.json({
                status: 'ok',
                message: 'Member system endpoint is active',
                features: ['profile_management', 'diving_history', 'preferences', 'points'],
                timestamp: new Date().toISOString()
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                available_endpoints: [
                    'GET /api/health',
                    'GET /api/stats',
                    'GET /api/shops',
                    'GET /api/shops/:id',
                    'POST /api/match',
                    'GET /api/search',
                    'POST /api/feedback',
                    'GET /api/recommendations',
                    'POST /api/line-webhook',
                    'GET /admin',
                    'GET /api/reviews',
                    'POST /api/reviews',
                    'GET /api/shops/search',
                    'GET /member'
                ],
                timestamp: new Date().toISOString()
            });
        });
    }

    // === HELPER METHODS ===

    async analyzeEmotions(message) {
        const detectedEmotions = {};
        const messageText = message.toLowerCase();
        
        // Analyze each emotional category
        Object.entries(this.emotionalConcerns).forEach(([category, config]) => {
            const matchedKeywords = config.keywords.filter(keyword => 
                messageText.includes(keyword.toLowerCase())
            );
            
            if (matchedKeywords.length > 0) {
                detectedEmotions[category] = {
                    confidence: Math.min(matchedKeywords.length * 0.3, 1.0),
                    weight: config.weight,
                    matched_keywords: matchedKeywords,
                    description: config.description
                };
            }
        });

        return {
            original_message: message,
            detected_emotions: detectedEmotions,
            total_categories_detected: Object.keys(detectedEmotions).length,
            primary_emotion: this.getPrimaryEmotion(detectedEmotions),
            analysis_timestamp: new Date().toISOString()
        };
    }

    getPrimaryEmotion(detectedEmotions) {
        if (Object.keys(detectedEmotions).length === 0) return null;
        
        return Object.entries(detectedEmotions)
            .sort(([,a], [,b]) => (b.confidence * b.weight) - (a.confidence * a.weight))[0][0];
    }

    calculateEmotionalScores(shops, emotionalAnalysis, userProfile) {
        return shops.map(shop => {
            let totalScore = 0;
            const scoreBreakdown = {};
            
            // Base service score
            const serviceScore = this.calculateServiceScore(shop);
            totalScore += serviceScore;
            scoreBreakdown.service = serviceScore;
            
            // Emotional matching scores
            Object.entries(emotionalAnalysis.detected_emotions).forEach(([emotion, data]) => {
                const emotionScore = this.calculateEmotionScore(shop, emotion, data);
                totalScore += emotionScore;
                scoreBreakdown[emotion] = emotionScore;
            });
            
            return {
                ...shop,
                emotional_match_score: totalScore,
                score_breakdown: scoreBreakdown,
                matched_emotions: Object.keys(emotionalAnalysis.detected_emotions)
            };
        }).sort((a, b) => b.emotional_match_score - a.emotional_match_score);
    }

    calculateEmotionScore(shop, emotion, emotionData) {
        const baseScore = emotionData.confidence * emotionData.weight;
        
        switch (emotion) {
            case 'safety':
                return baseScore * (
                    (shop.safety_equipment ? 0.3 : 0) +
                    (shop.insurance_coverage ? 0.2 : 0) +
                    (shop.experience_years >= 10 ? 0.3 : 0.1) +
                    (shop.incident_record === 'なし' ? 0.2 : 0)
                );
            
            case 'skill':
                return baseScore * (
                    (shop.beginner_friendly ? 0.4 : 0) +
                    (shop.max_group_size <= 4 ? 0.3 : 0.1) +
                    (shop.private_guide_available ? 0.3 : 0)
                );
            
            case 'solo':
                return baseScore * (
                    (shop.solo_welcome ? 0.5 : 0) +
                    (shop.max_group_size <= 6 ? 0.3 : 0.1) +
                    (shop.customer_rating >= 4.5 ? 0.2 : 0)
                );
            
            case 'cost':
                const priceScore = shop.fun_dive_price_2tanks <= 12000 ? 0.4 : 
                                 shop.fun_dive_price_2tanks <= 15000 ? 0.2 : 0;
                return baseScore * (
                    priceScore +
                    (shop.equipment_rental_included ? 0.3 : 0) +
                    (shop.photo_service ? 0.2 : 0) +
                    (!shop.additional_fees ? 0.1 : 0)
                );
            
            case 'physical':
                return baseScore * (
                    (shop.max_group_size <= 4 ? 0.3 : 0.1) +
                    (shop.beginner_friendly ? 0.4 : 0) +
                    (shop.trial_dive_options ? 0.3 : 0)
                );
            
            case 'communication':
                return baseScore * (
                    (shop.english_support ? 0.3 : 0) +
                    (shop.female_instructor ? 0.3 : 0) +
                    (shop.beginner_friendly ? 0.4 : 0)
                );
            
            default:
                return baseScore * 0.1;
        }
    }

    calculateServiceScore(shop) {
        let score = 0;
        
        // Jiji grade
        switch (shop.jiji_grade) {
            case 'S级': score += 20; break;
            case 'A级': score += 15; break;
            case 'B级': score += 10; break;
            default: score += 5;
        }
        
        // Customer rating
        if (shop.customer_rating >= 4.8) score += 15;
        else if (shop.customer_rating >= 4.5) score += 10;
        else if (shop.customer_rating >= 4.0) score += 5;
        
        // Review count
        if (shop.review_count >= 100) score += 10;
        else if (shop.review_count >= 50) score += 7;
        else if (shop.review_count >= 20) score += 4;
        
        return score;
    }

    async generateJijiRecommendations(topShops, emotionalAnalysis, userProfile) {
        return topShops.map((shop, index) => ({
            rank: index + 1,
            shop: shop,
            jiji_comment: this.generateJijiComment(shop, emotionalAnalysis, userProfile),
            emotional_match: {
                score: shop.emotional_match_score,
                matched_emotions: shop.matched_emotions,
                primary_reason: this.getPrimaryMatchReason(shop, emotionalAnalysis)
            },
            recommendation_summary: this.generateRecommendationSummary(shop)
        }));
    }

    generateJijiComment(shop, emotionalAnalysis, userProfile) {
        const primaryEmotion = emotionalAnalysis.primary_emotion;
        const userName = userProfile.name || 'あなた';
        
        let comment = `${shop.shop_name}は`;
        
        if (primaryEmotion === 'safety') {
            comment += `${shop.experience_years}年の実績があって、安全装備も完璧だから安心ですよ！`;
        } else if (primaryEmotion === 'solo') {
            comment += `一人参加の方をとても大切にしてくれるショップです。僕も推薦します！`;
        } else if (primaryEmotion === 'skill') {
            comment += `初心者に本当に優しくて、${userName}さんのペースに合わせてくれますよ。`;
        } else if (primaryEmotion === 'cost') {
            comment += `この価格でこのサービスは本当にお得です。僕もおすすめ！`;
        } else {
            comment += `${userName}さんにきっと合うと思います。信頼できるショップです！`;
        }
        
        return comment;
    }

    generateJijiMainMessage(emotionalAnalysis, userProfile) {
        const userName = userProfile.name || 'あなた';
        const emotionCount = Object.keys(emotionalAnalysis.detected_emotions).length;
        
        let message = `${userName}さん、`;
        
        if (emotionCount === 0) {
            message += `沖縄ダイビングを楽しみたいんですね！素晴らしいです🌊`;
        } else {
            const primaryEmotion = emotionalAnalysis.primary_emotion;
            
            if (primaryEmotion === 'safety') {
                message += `安全面の心配、よく分かります。僕も最初はそうでした。`;
            } else if (primaryEmotion === 'solo') {
                message += `一人参加って勇気いりますよね。でも大丈夫です！`;
            } else if (primaryEmotion === 'skill') {
                message += `スキルの不安、みんな通る道ですよ。心配いりません。`;
            } else if (primaryEmotion === 'cost') {
                message += `予算のこと、よく分かります。お得なショップを見つけました！`;
            } else {
                message += `${userName}さんの気持ち、よく分かります。`;
            }
        }
        
        message += ` ${userName}さんにピッタリのショップをご紹介しますね✨🤿`;
        
        return message;
    }

    getPrimaryMatchReason(shop, emotionalAnalysis) {
        const primaryEmotion = emotionalAnalysis.primary_emotion;
        if (!primaryEmotion) return '総合的におすすめ';
        
        const reasons = {
            safety: '安全性が高く評価',
            skill: '初心者に優しい',
            solo: '一人参加歓迎',
            cost: 'コストパフォーマンス良好',
            physical: '体力に配慮したサポート',
            communication: 'コミュニケーションサポート充実'
        };
        
        return reasons[primaryEmotion] || '総合的におすすめ';
    }

    generateRecommendationSummary(shop) {
        const highlights = [];
        
        if (shop.jiji_grade === 'S级') highlights.push('Jiji最高認定');
        if (shop.customer_rating >= 4.7) highlights.push('高評価');
        if (shop.beginner_friendly) highlights.push('初心者に優しい');
        if (shop.solo_welcome) highlights.push('一人参加歓迎');
        
        return highlights.length > 0 ? highlights.join('・') : '信頼できるショップ';
    }

    calculateSafetyScore(shop) {
        let score = 0;
        if (shop.safety_equipment) score += 25;
        if (shop.insurance_coverage) score += 25;
        if (shop.experience_years >= 10) score += 25;
        if (shop.incident_record === 'なし') score += 25;
        return score;
    }

    calculateBeginnerScore(shop) {
        let score = 0;
        if (shop.beginner_friendly) score += 30;
        if (shop.max_group_size <= 4) score += 25;
        if (shop.private_guide_available) score += 25;
        if (shop.trial_dive_options) score += 20;
        return Math.min(score, 100);
    }

    calculateValueScore(shop) {
        let score = 100;
        const basePrice = 13000;
        const priceDiff = shop.fun_dive_price_2tanks - basePrice;
        score -= Math.max(0, priceDiff / 100);
        
        if (shop.equipment_rental_included) score += 15;
        if (shop.photo_service) score += 10;
        if (!shop.additional_fees) score += 10;
        
        return Math.max(0, Math.min(score, 100));
    }

    calculateOverallJijiRating(shop) {
        const safetyScore = this.calculateSafetyScore(shop);
        const beginnerScore = this.calculateBeginnerScore(shop);
        const valueScore = this.calculateValueScore(shop);
        const serviceScore = this.calculateServiceScore(shop);
        
        return Math.round((safetyScore + beginnerScore + valueScore + serviceScore) / 4);
    }

    calculateRecommendationScore(shop, experienceLevel) {
        let score = shop.customer_rating * 20; // Base score from rating
        
        if (experienceLevel === 'beginner') {
            if (shop.beginner_friendly) score += 30;
            if (shop.max_group_size <= 4) score += 20;
            if (shop.safety_equipment) score += 15;
        }
        
        if (shop.jiji_grade === 'S级') score += 25;
        else if (shop.jiji_grade === 'A级') score += 15;
        
        return Math.round(score);
    }

    generateRecommendationExplanation(shop, experienceLevel) {
        if (experienceLevel === 'beginner') {
            return `初心者の${shop.shop_name ? shop.shop_name : 'このショップ'}は特に安心してダイビングを楽しめます。丁寧なサポートで評判です！`;
        } else {
            return `${shop.shop_name ? shop.shop_name : 'このショップ'}なら、きっと満足できるダイビング体験ができますよ🌊`;
        }
    }

    getRecommendationReasons(shop, experienceLevel) {
        const reasons = [];
        
        if (shop.jiji_grade === 'S级') reasons.push('Jiji最高認定');
        if (shop.customer_rating >= 4.7) reasons.push('高評価');
        if (shop.beginner_friendly && experienceLevel === 'beginner') reasons.push('初心者特化');
        if (shop.solo_welcome) reasons.push('一人参加歓迎');
        if (shop.safety_equipment) reasons.push('安全装備完備');
        
        return reasons;
    }

    generateFallbackMessage() {
        return "ごめんなさい、ちょっとデータの調子が悪いみたい。でも大丈夫、一緒に最高のショップを見つけましょう！また試してくださいね。";
    }

    // === LINE BOT EVENT HANDLERS ===

    async handleEvent(event) {
        console.log('📱 LINE event received:', event.type);
        
        // Handle different event types
        switch (event.type) {
            case 'message':
                return await this.handleMessageEvent(event);
            case 'follow':
                return await this.handleFollowEvent(event);
            case 'unfollow':
                return await this.handleUnfollowEvent(event);
            case 'postback':
                return await this.handlePostbackEvent(event);
            default:
                console.log(`⚠️ Unhandled event type: ${event.type}`);
                return Promise.resolve(null);
        }
    }

    async handleMessageEvent(event) {
        if (event.message.type !== 'text') {
            console.log('📱 Non-text message received');
            return Promise.resolve(null);
        }

        const userMessage = event.message.text;
        const userId = event.source.userId;
        const replyToken = event.replyToken;

        console.log(`💬 User message: "${userMessage}" from ${userId}`);

        try {
            // Check if this is a special menu-related query
            const menuResponse = await this.handleSpecialMenuQueries(userMessage, userId);
            if (menuResponse) {
                if (this.lineActive && this.lineClient) {
                    await this.lineClient.replyMessage(replyToken, menuResponse);
                    console.log('✅ Menu response sent successfully');
                }
                return { success: true, userId, message: 'menu_response' };
            }

            // Step 1: Pre-process user message
            const processedMessage = await this.preprocessUserMessage(userMessage, userId);
            
            // Step 2: Call internal API for emotional matching
            const matchResult = await this.performEmotionalMatching(processedMessage.text, {
                userId: userId,
                userProfile: processedMessage.userProfile,
                maxResults: 3,
                context: processedMessage.context
            });

            // Step 3: Generate comprehensive LINE response
            const lineMessages = await this.generateLineMessages(matchResult, processedMessage);

            // Step 4: Send reply if LINE client is active
            if (this.lineActive && this.lineClient) {
                await this.lineClient.replyMessage(replyToken, lineMessages);
                console.log('✅ Reply sent successfully');
                
                // Step 5: Log interaction for analytics
                await this.logUserInteraction(userId, userMessage, matchResult);
            } else {
                console.log('⚠️ LINE client not active - webhook received but no reply sent');
            }

            return { 
                success: true, 
                userId, 
                message: 'processed',
                emotional_analysis: matchResult.emotional_analysis,
                recommendations_count: matchResult.recommendations.length
            };

        } catch (error) {
            console.error('❌ Error handling message event:', error);
            return await this.handleMessageError(error, replyToken, userId, userMessage);
        }
    }

    async handleFollowEvent(event) {
        const userId = event.source.userId;
        const replyToken = event.replyToken;
        
        console.log(`🎉 New user followed: ${userId}`);
        
        const welcomeMessage = {
            type: 'text',
            text: `🌊 Jijiへようこそ！\n\n` +
                  `はじめまして！僕は沖縄ダイビングのJijiです🤿\n\n` +
                  `初心者の方の不安や心配を理解して、あなたにピッタリのダイビングショップをご紹介します✨\n\n` +
                  `「初心者で不安です」「一人参加は大丈夫？」「予算はどのくらい？」など、\n` +
                  `何でもお気軽にご相談くださいね！`
        };

        if (this.lineActive && this.lineClient) {
            try {
                await this.lineClient.replyMessage(replyToken, welcomeMessage);
                console.log('✅ Welcome message sent');
            } catch (error) {
                console.error('❌ Failed to send welcome message:', error);
            }
        }

        return { success: true, userId, event: 'follow' };
    }

    async handleUnfollowEvent(event) {
        const userId = event.source.userId;
        console.log(`👋 User unfollowed: ${userId}`);
        return { success: true, userId, event: 'unfollow' };
    }

    async handlePostbackEvent(event) {
        const userId = event.source.userId;
        const replyToken = event.replyToken;
        const postbackData = event.postback.data;
        
        console.log(`🔄 Postback received: ${postbackData} from ${userId}`);
        
        try {
            const response = await this.processPostbackAction(postbackData, userId);
            
            if (this.lineActive && this.lineClient && response.message) {
                await this.lineClient.replyMessage(replyToken, response.message);
                console.log('✅ Postback response sent');
            }
            
            return { success: true, userId, postback: postbackData, response };
        } catch (error) {
            console.error('❌ Error handling postback:', error);
            return { success: false, userId, error: error.message };
        }
    }

    async performEmotionalMatching(message, options = {}) {
        const { userId, maxResults = 3, area, userProfile, context } = options;
        
        try {
            // Input validation
            if (!message || typeof message !== 'string') {
                throw new Error('Invalid message input for emotional analysis');
            }

            if (message.length > 1000) {
                throw new Error('Message too long - please keep it under 1000 characters');
            }

            // Build enhanced user profile
            const enhancedUserProfile = {
                user_id: userId,
                name: userId ? `ユーザー${userId.slice(-4)}` : 'ゲスト',
                ...userProfile
            };

            console.log(`🧠 Starting emotional analysis for user ${userId}`);
            
            // Step 1: Emotional analysis with error handling
            let emotionalAnalysis;
            try {
                emotionalAnalysis = await this.emotionAnalyzer.analyzeEmotions(message, { 
                    userProfile: enhancedUserProfile 
                });
                
                if (!emotionalAnalysis || typeof emotionalAnalysis !== 'object') {
                    throw new Error('Invalid emotional analysis result');
                }
                
                console.log(`✅ Emotional analysis completed: ${Object.keys(emotionalAnalysis.detected_emotions).length} categories detected`);
            } catch (analysisError) {
                console.error('❌ Emotional analysis failed:', analysisError);
                // Fallback to basic analysis
                emotionalAnalysis = await this.performBasicEmotionalAnalysis(message);
            }
            
            // Step 2: Shop retrieval with error handling
            let shops;
            try {
                shops = area ? 
                    await this.sheetsConnector.getShopsByArea(area) : 
                    await this.sheetsConnector.getAllShops();
                
                if (!shops || !Array.isArray(shops) || shops.length === 0) {
                    throw new Error('No shops available in database');
                }
                
                console.log(`📊 Retrieved ${shops.length} shops for matching`);
            } catch (shopError) {
                console.error('❌ Shop retrieval failed:', shopError);
                throw new Error('Unable to retrieve shop data');
            }
            
            // Step 3: Scoring and matching with error handling
            let scoredShops, topMatches;
            try {
                scoredShops = this.calculateEmotionalScores(shops, emotionalAnalysis, enhancedUserProfile);
                topMatches = scoredShops.slice(0, Math.min(maxResults, shops.length));
                
                if (topMatches.length === 0) {
                    throw new Error('No matching shops found');
                }
                
                console.log(`🎯 Found ${topMatches.length} matching shops`);
            } catch (scoringError) {
                console.error('❌ Shop scoring failed:', scoringError);
                // Fallback to top-rated shops
                topMatches = shops.sort((a, b) => b.customer_rating - a.customer_rating).slice(0, maxResults);
            }
            
            // Step 4: Jiji response generation with error handling
            let jijiResponse;
            try {
                jijiResponse = await this.emotionAnalyzer.generateJijiResponse(
                    emotionalAnalysis, 
                    topMatches, 
                    enhancedUserProfile
                );
                
                if (!jijiResponse || !jijiResponse.jiji_main_message) {
                    throw new Error('Invalid Jiji response generation');
                }
            } catch (responseError) {
                console.error('❌ Jiji response generation failed:', responseError);
                // Fallback to simple response
                jijiResponse = {
                    jiji_main_message: this.generateFallbackJijiMessage(enhancedUserProfile),
                    response_type: 'fallback'
                };
            }
            
            // Step 5: Recommendations generation with error handling
            let jijiRecommendations;
            try {
                jijiRecommendations = await this.generateJijiRecommendations(
                    topMatches, 
                    emotionalAnalysis, 
                    enhancedUserProfile
                );
            } catch (recommendationError) {
                console.error('❌ Recommendations generation failed:', recommendationError);
                // Fallback to simple recommendations
                jijiRecommendations = topMatches.map((shop, index) => ({
                    rank: index + 1,
                    shop: shop,
                    jiji_comment: `${shop.shop_name}はおすすめです！`,
                    emotional_match: { score: 0, matched_emotions: [] }
                }));
            }

            const result = {
                emotional_analysis: emotionalAnalysis,
                recommendations: jijiRecommendations,
                jiji_main_message: jijiResponse.jiji_main_message,
                top_matches: topMatches,
                processing_stats: {
                    message_length: message.length,
                    shops_analyzed: shops.length,
                    matches_found: topMatches.length,
                    emotions_detected: Object.keys(emotionalAnalysis.detected_emotions).length,
                    success: true
                }
            };

            console.log(`✅ Emotional matching completed successfully`);
            return result;

        } catch (error) {
            console.error('❌ Emotional matching failed:', error);
            
            // Return error response with fallback
            return {
                emotional_analysis: { detected_emotions: {}, primary_emotion: null },
                recommendations: [],
                jiji_main_message: this.generateFallbackJijiMessage({ name: 'ゲスト' }),
                top_matches: [],
                processing_stats: {
                    message_length: message ? message.length : 0,
                    shops_analyzed: 0,
                    matches_found: 0,
                    emotions_detected: 0,
                    success: false,
                    error: error.message
                }
            };
        }
    }

    async performBasicEmotionalAnalysis(message) {
        console.log('🔄 Performing basic emotional analysis fallback');
        
        const detectedEmotions = {};
        const messageText = message.toLowerCase();
        
        // Simple keyword-based analysis
        Object.entries(this.emotionalConcerns).forEach(([category, config]) => {
            const matchedKeywords = config.keywords.filter(keyword => 
                messageText.includes(keyword.toLowerCase())
            );
            
            if (matchedKeywords.length > 0) {
                detectedEmotions[category] = {
                    confidence: Math.min(matchedKeywords.length * 0.3, 1.0),
                    weight: config.weight,
                    matched_keywords: matchedKeywords,
                    description: config.description
                };
            }
        });

        return {
            original_message: message,
            detected_emotions: detectedEmotions,
            total_categories_detected: Object.keys(detectedEmotions).length,
            primary_emotion: this.getPrimaryEmotion(detectedEmotions),
            analysis_timestamp: new Date().toISOString(),
            analysis_type: 'basic_fallback'
        };
    }

    generateFallbackJijiMessage(userProfile) {
        const userName = userProfile.name || 'ゲスト';
        return `${userName}さん、お疲れ様です！少し調子が悪いみたいですが、きっと素敵なダイビング体験をお手伝いできますよ🌊 もう一度ご質問いただけますか？🤿✨`;
    }

    // === ENHANCED ERROR HANDLING FOR SPECIFIC SCENARIOS ===

    async handleDatabaseConnectionError() {
        console.log('🔧 Attempting database reconnection...');
        
        try {
            // Test connection with mock connector
            const mockConnector = new MockJijiSheetsConnector();
            const stats = await mockConnector.getShopStatistics();
            
            if (stats && stats.totalShops > 0) {
                console.log('✅ Switched to mock database successfully');
                this.sheetsConnector = mockConnector;
                this.databaseType = 'mock';
                return true;
            }
        } catch (error) {
            console.error('❌ Mock database fallback failed:', error);
        }
        
        return false;
    }

    validateLineMessage(message) {
        if (!message || typeof message !== 'object') {
            throw new Error('Invalid message object');
        }

        if (!message.type) {
            throw new Error('Message type is required');
        }

        if (message.type === 'text' && !message.text) {
            throw new Error('Text content is required for text messages');
        }

        if (message.type === 'flex' && !message.contents) {
            throw new Error('Contents are required for flex messages');
        }

        return true;
    }

    async handleRateLimitError(error) {
        console.warn('⚠️ Rate limit encountered:', error);
        
        // Wait and retry logic could be implemented here
        // For now, just log and continue with fallback
        
        return {
            type: 'text',
            text: '申し訳ございません。現在アクセスが集中しています。少し時間をおいて再度お試しください🙏'
        };
    }

    // === MESSAGE PROCESSING METHODS ===

    async preprocessUserMessage(message, userId) {
        // Build user profile
        const userProfile = {
            user_id: userId,
            name: userId ? `ユーザー${userId.slice(-4)}` : 'ゲスト',
            experience_level: this.detectExperienceLevel(message),
            concerns: this.extractConcerns(message)
        };

        // Extract context from message
        const context = {
            area_mentioned: this.extractAreaMention(message),
            budget_mentioned: this.extractBudgetMention(message),
            group_size: this.extractGroupSize(message),
            special_requests: this.extractSpecialRequests(message)
        };

        return {
            text: message,
            userProfile,
            context,
            timestamp: new Date().toISOString()
        };
    }

    detectExperienceLevel(message) {
        const beginnerKeywords = ['初心者', '初めて', 'はじめて', '未経験', '体験'];
        const intermediateKeywords = ['ファン', 'AOW', 'アドバンス'];
        
        const messageText = message.toLowerCase();
        
        if (beginnerKeywords.some(keyword => messageText.includes(keyword))) {
            return 'beginner';
        } else if (intermediateKeywords.some(keyword => messageText.includes(keyword))) {
            return 'intermediate';
        } else {
            return 'unknown';
        }
    }

    extractConcerns(message) {
        const concerns = [];
        const messageText = message.toLowerCase();
        
        Object.entries(this.emotionalConcerns).forEach(([category, config]) => {
            if (config.keywords.some(keyword => messageText.includes(keyword))) {
                concerns.push(category);
            }
        });
        
        return concerns;
    }

    extractAreaMention(message) {
        const areas = ['石垣島', '宮古島', '沖縄', '石垣', '宮古'];
        return areas.find(area => message.includes(area)) || null;
    }

    extractBudgetMention(message) {
        const budgetMatch = message.match(/(\d+)円|(\d+)万/);
        if (budgetMatch) {
            const amount = parseInt(budgetMatch[1] || (parseInt(budgetMatch[2]) * 10000));
            return amount;
        }
        return null;
    }

    extractGroupSize(message) {
        const groupMatch = message.match(/(\d+)人|一人|ひとり|ソロ/);
        if (groupMatch) {
            if (groupMatch[0].includes('一人') || groupMatch[0].includes('ひとり') || groupMatch[0].includes('ソロ')) {
                return 1;
            }
            return parseInt(groupMatch[1]) || 1;
        }
        return null;
    }

    extractSpecialRequests(message) {
        const requests = [];
        const messageText = message.toLowerCase();
        
        if (messageText.includes('女性') || messageText.includes('女')) requests.push('female_instructor');
        if (messageText.includes('英語')) requests.push('english_support');
        if (messageText.includes('送迎') || messageText.includes('迎え')) requests.push('pickup_service');
        if (messageText.includes('写真') || messageText.includes('フォト')) requests.push('photo_service');
        
        return requests;
    }

    async generateLineMessages(matchResult, processedMessage) {
        // Use advanced response generation for better user experience
        if (matchResult.recommendations && matchResult.recommendations.length > 0) {
            return await this.createAdvancedShopRecommendation(
                matchResult.recommendations, 
                processedMessage.context
            );
        } else {
            // Fallback to simple message if no recommendations
            const messages = [];
            
            messages.push({
                type: 'text',
                text: matchResult.jiji_main_message
            });
            
            messages.push(this.createRichMenuMessage());
            
            return messages;
        }
    }

    async createMainResponseMessage(matchResult) {
        return {
            type: 'text',
            text: matchResult.jiji_main_message
        };
    }

    async createShopFlexMessage(recommendations) {
        const bubbles = recommendations.slice(0, 3).map((rec, index) => {
            const shop = rec.shop;
            return {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `${index + 1}. ${shop.shop_name}`,
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '📍', size: 'sm', flex: 1 },
                                { type: 'text', text: shop.area, size: 'sm', flex: 5 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '⭐', size: 'sm', flex: 1 },
                                { type: 'text', text: `${shop.customer_rating} (${shop.review_count}件)`, size: 'sm', flex: 5 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '💰', size: 'sm', flex: 1 },
                                { type: 'text', text: `¥${shop.fun_dive_price_2tanks.toLocaleString()}`, size: 'sm', flex: 5 }
                            ]
                        },
                        {
                            type: 'text',
                            text: rec.jiji_comment,
                            size: 'sm',
                            margin: 'md',
                            wrap: true
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'postback',
                                label: '詳細を見る',
                                data: `shop_detail:${shop.shop_id}`
                            },
                            style: 'primary',
                            height: 'sm'
                        }
                    ]
                }
            };
        });

        return {
            type: 'flex',
            altText: '🏪 おすすめのダイビングショップです',
            contents: {
                type: 'carousel',
                contents: bubbles
            }
        };
    }

    createQuickReplyMessage(context) {
        const quickReplyItems = [
            {
                type: 'action',
                action: {
                    type: 'message',
                    label: '💰 料金について',
                    text: '料金について詳しく教えて'
                }
            },
            {
                type: 'action',
                action: {
                    type: 'message',
                    label: '🛡️ 安全性について',
                    text: '安全性について知りたい'
                }
            },
            {
                type: 'action',
                action: {
                    type: 'message',
                    label: '📅 予約方法',
                    text: '予約はどうすればいい？'
                }
            },
            {
                type: 'action',
                action: {
                    type: 'message',
                    label: '🏝️ 他の地域',
                    text: '他の地域のショップも知りたい'
                }
            }
        ];

        return {
            type: 'text',
            text: '🤿 他にも気になることがあれば、お気軽にお聞きください！',
            quickReply: {
                items: quickReplyItems
            }
        };
    }

    async logUserInteraction(userId, message, matchResult) {
        const interaction = {
            user_id: userId,
            message: message,
            timestamp: new Date().toISOString(),
            emotional_analysis: matchResult.emotional_analysis,
            recommendations_count: matchResult.recommendations.length,
            primary_emotion: matchResult.emotional_analysis.primary_emotion
        };
        
        console.log('📊 User interaction logged:', interaction);
        // In production, this would be saved to database
    }

    async processPostbackAction(postbackData, userId) {
        const [action, data] = postbackData.split(':');
        
        switch (action) {
            case 'shop_detail':
                return await this.handleShopDetailRequest(data, userId);
            case 'area_search':
                return await this.handleAreaSearchRequest(data, userId);
            case 'feedback':
                return await this.handleFeedbackRequest(data, userId);
            case 'menu':
                return await this.handleRichMenuAction(data, userId);
            default:
                return {
                    message: {
                        type: 'text',
                        text: '申し訳ございません。その機能は現在準備中です🙏'
                    }
                };
        }
    }

    // === RICH MENU ACTION HANDLERS ===

    async handleRichMenuAction(menuAction, userId) {
        console.log(`📱 Rich menu action: ${menuAction} from user ${userId}`);
        
        try {
            switch (menuAction) {
                case 'travel_plan':
                    return await this.handleTravelPlanMenu(userId);
                case 'shop_search':
                    return await this.handleShopSearchMenu(userId);
                case 'sea_conditions':
                    return await this.handleSeaConditionsMenu(userId);
                case 'photo_share':
                    return await this.handlePhotoShareMenu(userId);
                case 'my_page':
                    return await this.handleMyPageMenu(userId);
                default:
                    return {
                        message: {
                            type: 'text',
                            text: '申し訳ございません。そのメニューは現在準備中です🙏'
                        }
                    };
            }
        } catch (error) {
            console.error(`❌ Rich menu action error for ${menuAction}:`, error);
            return {
                message: {
                    type: 'text',
                    text: '申し訳ございません。メニュー処理中にエラーが発生しました。'
                }
            };
        }
    }

    async handleTravelPlanMenu(userId) {
        const message = {
            type: 'flex',
            altText: '✈️ 旅行計画・予約メニュー',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '✈️ 旅行計画・予約',
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '沖縄ダイビング旅行の計画をお手伝いします！',
                            size: 'md',
                            wrap: true,
                            margin: 'md'
                        },
                        {
                            type: 'separator',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '📅 プランニングサービス',
                            weight: 'bold',
                            size: 'md',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '• おすすめダイビングプラン提案\n• 宿泊施設・交通手段アドバイス\n• 予算に応じた最適プラン作成\n• スケジュール調整サポート',
                            size: 'sm',
                            wrap: true,
                            margin: 'md'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🏝️ エリア別プラン',
                                text: 'エリア別のダイビングプランを教えて'
                            },
                            style: 'primary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '💰 予算別プラン',
                                text: '予算に合わせたプランを相談したい'
                            },
                            style: 'secondary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '📞 個別相談',
                                text: '詳しい旅行プランの相談をしたい'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ],
                    spacing: 'sm'
                }
            }
        };

        return { message };
    }

    async handleShopSearchMenu(userId) {
        const message = {
            type: 'flex',
            altText: '🏪 ショップ検索メニュー',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '🏪 ショップ検索',
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: 'あなたにピッタリのダイビングショップを見つけましょう！',
                            size: 'md',
                            wrap: true,
                            margin: 'md'
                        },
                        {
                            type: 'separator',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '🎯 検索オプション',
                            weight: 'bold',
                            size: 'md',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '• エリア別検索（石垣島・宮古島）\n• 感情分析による最適マッチング\n• 料金・サービス比較\n• 初心者・経験者別フィルター',
                            size: 'sm',
                            wrap: true,
                            margin: 'md'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🎯 感情マッチング',
                                text: '私の気持ちに合うショップを教えて'
                            },
                            style: 'primary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🏝️ 石垣島のショップ',
                                text: '石垣島のダイビングショップを探している'
                            },
                            style: 'secondary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🏝️ 宮古島のショップ',
                                text: '宮古島のダイビングショップを探している'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ],
                    spacing: 'sm'
                }
            }
        };

        return { message };
    }

    async handleSeaConditionsMenu(userId) {
        const message = {
            type: 'flex',
            altText: '🌊 海況チェックメニュー',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '🌊 海況チェック',
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '最新の海況情報をお届けします！',
                            size: 'md',
                            wrap: true,
                            margin: 'md'
                        },
                        {
                            type: 'separator',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '📊 提供情報',
                            weight: 'bold',
                            size: 'md',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '• 今日の海況・透明度情報\n• 週間天気予報\n• 風向き・波高データ\n• ダイビング適正度判定',
                            size: 'sm',
                            wrap: true,
                            margin: 'md'
                        },
                        {
                            type: 'text',
                            text: '⚠️ 現在はベータ版機能です',
                            size: 'xs',
                            color: '#999999',
                            margin: 'lg'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🏝️ 石垣島の海況',
                                text: '石垣島の今日の海況を教えて'
                            },
                            style: 'primary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🏝️ 宮古島の海況',
                                text: '宮古島の今日の海況を教えて'
                            },
                            style: 'secondary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '📅 週間予報',
                                text: '今週の海況予報を教えて'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ],
                    spacing: 'sm'
                }
            }
        };

        return { message };
    }

    async handlePhotoShareMenu(userId) {
        const message = {
            type: 'flex',
            altText: '📷 体験投稿メニュー',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '📷 体験投稿',
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: 'あなたのダイビング体験をシェアしませんか？',
                            size: 'md',
                            wrap: true,
                            margin: 'md'
                        },
                        {
                            type: 'separator',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '📸 投稿できるもの',
                            weight: 'bold',
                            size: 'md',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '• 水中写真・動画\n• ダイビング体験レビュー\n• ショップの評価・感想\n• おすすめポイント情報',
                            size: 'sm',
                            wrap: true,
                            margin: 'md'
                        },
                        {
                            type: 'text',
                            text: '💝 投稿特典: 他のダイバーの参考に！',
                            size: 'xs',
                            color: '#E74C3C',
                            margin: 'lg',
                            weight: 'bold'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '📸 写真を投稿',
                                text: 'ダイビング写真を投稿したい'
                            },
                            style: 'primary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '⭐ ショップレビュー',
                                text: 'ダイビングショップの感想を投稿したい'
                            },
                            style: 'secondary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '💬 体験談を投稿',
                                text: 'ダイビング体験談を投稿したい'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ],
                    spacing: 'sm'
                }
            }
        };

        return { message };
    }

    async handleMyPageMenu(userId) {
        // Get user's interaction history if available
        const userStats = await this.getUserStats(userId);
        
        const message = {
            type: 'flex',
            altText: '📋 マイページ',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '📋 マイページ',
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        },
                        {
                            type: 'text',
                            text: `ユーザー${userId.slice(-4)}さん`,
                            size: 'sm',
                            color: '#666666'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '👤 あなたのダイビング記録',
                            weight: 'bold',
                            size: 'md',
                            margin: 'md'
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            contents: [
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    contents: [
                                        { type: 'text', text: '💬', size: 'sm', flex: 1 },
                                        { type: 'text', text: `相談回数: ${userStats.consultations}回`, size: 'sm', flex: 5 }
                                    ],
                                    margin: 'md'
                                },
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    contents: [
                                        { type: 'text', text: '🏪', size: 'sm', flex: 1 },
                                        { type: 'text', text: `閲覧ショップ: ${userStats.shopsViewed}店舗`, size: 'sm', flex: 5 }
                                    ]
                                },
                                {
                                    type: 'box',
                                    layout: 'baseline',
                                    contents: [
                                        { type: 'text', text: '❤️', size: 'sm', flex: 1 },
                                        { type: 'text', text: `主な関心: ${userStats.primaryConcern}`, size: 'sm', flex: 5 }
                                    ]
                                }
                            ],
                            margin: 'md'
                        },
                        {
                            type: 'separator',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '🎯 おすすめアクション',
                            weight: 'bold',
                            size: 'md',
                            margin: 'lg'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '📊 詳細統計を見る',
                                text: '私のダイビング統計を詳しく教えて'
                            },
                            style: 'primary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🔄 設定をリセット',
                                text: '設定をリセットして最初からやり直したい'
                            },
                            style: 'secondary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'uri',
                                label: '🌐 WEBで詳細確認',
                                uri: 'https://your-railway-app.railway.app/'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ],
                    spacing: 'sm'
                }
            }
        };

        return { message };
    }

    async getUserStats(userId) {
        // In a real implementation, this would query a database
        // For now, return mock data
        const consultations = Math.floor(Math.random() * 10) + 1;
        const shopsViewed = Math.floor(Math.random() * 20) + 5;
        const primaryConcern = ['安全性', '料金', '一人参加', 'スキル'][Math.floor(Math.random() * 4)];
        
        // Generate first use date (random date within last 30 days)
        const firstUse = new Date();
        firstUse.setDate(firstUse.getDate() - Math.floor(Math.random() * 30));
        
        // Generate recommendation based on primary concern
        const recommendations = {
            '安全性': '安全装備が充実した認定ショップでのダイビングをおすすめします',
            '料金': 'コストパフォーマンスの良いショップでの複数日プランがおすすめです',
            '一人参加': '一人参加歓迎のショップでのグループダイビングがおすすめです',
            'スキル': '少人数制で丁寧な指導が受けられるショップがおすすめです'
        };
        
        return {
            consultations,
            shopsViewed,
            primaryConcern,
            firstUse: firstUse.toLocaleDateString('ja-JP'),
            recommendation: recommendations[primaryConcern]
        };
    }

    async handleShopDetailRequest(shopId, userId) {
        try {
            const shop = await this.sheetsConnector.getShopById(shopId);
            
            if (!shop) {
                return {
                    message: {
                        type: 'text',
                        text: '申し訳ございません。その店舗の情報が見つかりませんでした。'
                    }
                };
            }

            const detailMessage = this.createShopDetailMessage(shop);
            return { message: detailMessage };
        } catch (error) {
            console.error('❌ Error getting shop detail:', error);
            return {
                message: {
                    type: 'text',
                    text: '申し訳ございません。店舗情報の取得中にエラーが発生しました。'
                }
            };
        }
    }

    createShopDetailMessage(shop) {
        let detailText = `🏪 ${shop.shop_name}\n\n`;
        detailText += `📍 エリア: ${shop.area}\n`;
        detailText += `⭐ 評価: ${shop.customer_rating} (${shop.review_count}件のレビュー)\n`;
        detailText += `💰 ファンダイブ2本: ¥${shop.fun_dive_price_2tanks.toLocaleString()}\n`;
        
        if (shop.trial_dive_price_boat) {
            detailText += `🌊 体験ダイビング: ¥${shop.trial_dive_price_boat.toLocaleString()}\n`;
        }
        
        detailText += `👥 最大グループサイズ: ${shop.max_group_size}名\n`;
        
        if (shop.speciality_areas) {
            detailText += `🐠 特徴: ${shop.speciality_areas}\n`;
        }
        
        if (shop.beginner_friendly) detailText += `✅ 初心者歓迎\n`;
        if (shop.solo_welcome) detailText += `✅ 一人参加歓迎\n`;
        if (shop.safety_equipment) detailText += `✅ 安全装備完備\n`;
        if (shop.insurance_coverage) detailText += `✅ 保険加入済み\n`;
        
        if (shop.website) {
            detailText += `\n🌐 公式サイト: ${shop.website}`;
        }

        return {
            type: 'text',
            text: detailText
        };
    }

    async handleAreaSearchRequest(area, userId) {
        try {
            const shops = await this.sheetsConnector.getShopsByArea(area);
            
            if (!shops || shops.length === 0) {
                return {
                    message: {
                        type: 'text',
                        text: `申し訳ございません。${area}のショップ情報が見つかりませんでした。`
                    }
                };
            }

            const topShops = shops.slice(0, 3);
            const flexMessage = await this.createShopFlexMessage(
                topShops.map(shop => ({ shop, jiji_comment: `${area}で人気のショップです！` }))
            );

            return { message: flexMessage };
        } catch (error) {
            console.error('❌ Error in area search:', error);
            return {
                message: {
                    type: 'text',
                    text: '申し訳ございません。エリア検索中にエラーが発生しました。'
                }
            };
        }
    }

    async handleFeedbackRequest(feedbackData, userId) {
        // This would integrate with the feedback API
        return {
            message: {
                type: 'text',
                text: 'フィードバックありがとうございます！今後のサービス向上に活用させていただきます🙏'
            }
        };
    }

    // === ERROR HANDLING METHODS ===

    async handleMessageError(error, replyToken, userId, originalMessage) {
        console.error('❌ Message processing error:', {
            error: error.message,
            userId,
            originalMessage,
            timestamp: new Date().toISOString()
        });

        let errorMessage;

        // Determine error type and create appropriate response
        if (error.message.includes('database') || error.message.includes('connection')) {
            errorMessage = {
                type: 'text',
                text: '申し訳ございません。現在データベースに接続できません。少し時間をおいて再度お試しください🙏'
            };
        } else if (error.message.includes('analysis') || error.message.includes('emotion')) {
            errorMessage = {
                type: 'text',
                text: '申し訳ございません。感情分析中にエラーが発生しました。もう一度ご質問いただけますか？'
            };
        } else if (error.message.includes('timeout')) {
            errorMessage = {
                type: 'text',
                text: '申し訳ございません。処理に時間がかかりすぎています。もう一度お試しください。'
            };
        } else {
            // Generic fallback error message
            errorMessage = {
                type: 'text',
                text: this.generateFallbackMessage()
            };
        }

        // Try to send error message
        if (this.lineActive && this.lineClient) {
            try {
                await this.lineClient.replyMessage(replyToken, errorMessage);
                console.log('✅ Error message sent successfully');
            } catch (replyError) {
                console.error('❌ Failed to send error message:', replyError);
            }
        }

        return { 
            success: false, 
            error: error.message, 
            userId,
            error_type: this.categorizeError(error),
            fallback_sent: true
        };
    }

    categorizeError(error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('database') || errorMessage.includes('connection')) {
            return 'database_error';
        } else if (errorMessage.includes('analysis') || errorMessage.includes('emotion')) {
            return 'analysis_error';
        } else if (errorMessage.includes('timeout')) {
            return 'timeout_error';
        } else if (errorMessage.includes('validation')) {
            return 'validation_error';
        } else {
            return 'unknown_error';
        }
    }

    // === ENHANCED MESSAGE TYPES ===

    createImageMessage(imageUrl, altText) {
        return {
            type: 'image',
            originalContentUrl: imageUrl,
            previewImageUrl: imageUrl
        };
    }

    createLocationMessage(title, address, latitude, longitude) {
        return {
            type: 'location',
            title: title,
            address: address,
            latitude: latitude,
            longitude: longitude
        };
    }

    createRichMenuMessage() {
        return {
            type: 'text',
            text: '🌊 Jijiでできること:\n\n' +
                  '💬 ダイビングの相談・質問\n' +
                  '🏪 おすすめショップ検索\n' +
                  '🎯 感情分析による最適マッチング\n' +
                  '📍 エリア別ショップ情報\n' +
                  '💰 料金比較・予算相談\n' +
                  '🛡️ 安全性確認サポート\n\n' +
                  '何でもお気軽にご相談ください！🤿✨',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '🏪 ショップ検索',
                            text: 'おすすめのショップを教えて'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '💰 料金について',
                            text: 'ダイビング料金について知りたい'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '🔰 初心者相談',
                            text: '初心者なので色々教えて'
                        }
                    }
                ]
            }
        };
    }

    createWebUrlMessage(url, text) {
        return {
            type: 'text',
            text: text + '\n\n🌐 詳細はこちら: ' + url
        };
    }

    // === ADVANCED RESPONSE GENERATION ===

    async createAdvancedShopRecommendation(recommendations, userContext) {
        const messages = [];
        
        // Main recommendation with personalized intro
        const personalizedIntro = this.generatePersonalizedIntro(userContext);
        messages.push({
            type: 'text',
            text: personalizedIntro
        });

        // Detailed shop cards
        if (recommendations.length > 0) {
            const flexMessage = await this.createEnhancedShopFlexMessage(recommendations, userContext);
            messages.push(flexMessage);
        }

        // Action buttons
        const actionMessage = this.createActionButtonsMessage(userContext);
        messages.push(actionMessage);

        return messages;
    }

    generatePersonalizedIntro(userContext) {
        const { experience_level, concerns, area_mentioned } = userContext;
        
        let intro = '';
        
        if (experience_level === 'beginner') {
            intro += '🔰 初心者の方にも安心してダイビングを楽しんでいただけるよう、';
        } else if (experience_level === 'intermediate') {
            intro += '🤿 ダイビング経験のある方にも満足していただけるよう、';
        } else {
            intro += '🌊 あなたにぴったりの';
        }

        if (concerns.includes('safety')) {
            intro += '特に安全面に配慮した';
        }
        if (concerns.includes('cost')) {
            intro += 'コストパフォーマンスの良い';
        }
        if (concerns.includes('solo')) {
            intro += '一人参加にやさしい';
        }

        intro += 'ショップをご紹介しますね！';

        if (area_mentioned) {
            intro += `\n📍 ${area_mentioned}のおすすめショップです✨`;
        }

        return intro;
    }

    async createEnhancedShopFlexMessage(recommendations, userContext) {
        const bubbles = recommendations.slice(0, 3).map((rec, index) => {
            const shop = rec.shop;
            const highlights = this.generateShopHighlights(shop, userContext);
            
            return {
                type: 'bubble',
                hero: {
                    type: 'image',
                    url: 'https://example.com/default-diving-image.jpg', // Placeholder
                    size: 'cover',
                    aspectRatio: '20:13',
                    aspectMode: 'cover'
                },
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `${index + 1}. ${shop.shop_name}`,
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        },
                        {
                            type: 'text',
                            text: highlights,
                            size: 'sm',
                            color: '#666666',
                            wrap: true
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '📍', size: 'sm', flex: 1 },
                                { type: 'text', text: shop.area, size: 'sm', flex: 5, weight: 'bold' }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '⭐', size: 'sm', flex: 1 },
                                { type: 'text', text: `${shop.customer_rating} (${shop.review_count}件)`, size: 'sm', flex: 5 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '💰', size: 'sm', flex: 1 },
                                { type: 'text', text: `¥${shop.fun_dive_price_2tanks.toLocaleString()}`, size: 'sm', flex: 5, weight: 'bold', color: '#E74C3C' }
                            ]
                        },
                        {
                            type: 'separator',
                            margin: 'md'
                        },
                        {
                            type: 'text',
                            text: rec.jiji_comment,
                            size: 'sm',
                            margin: 'md',
                            wrap: true,
                            color: '#333333'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'postback',
                                label: '詳細を見る',
                                data: `shop_detail:${shop.shop_id}`
                            },
                            style: 'primary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'uri',
                                label: '公式サイト',
                                uri: shop.website || 'https://example.com'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ],
                    spacing: 'sm'
                }
            };
        });

        return {
            type: 'flex',
            altText: '🏪 おすすめのダイビングショップです',
            contents: {
                type: 'carousel',
                contents: bubbles
            }
        };
    }

    generateShopHighlights(shop, userContext) {
        const highlights = [];
        
        if (shop.jiji_grade === 'S级') highlights.push('🏆Jiji最高評価');
        if (shop.beginner_friendly && userContext.experience_level === 'beginner') highlights.push('🔰初心者OK');
        if (shop.solo_welcome && userContext.concerns.includes('solo')) highlights.push('👤一人歓迎');
        if (shop.safety_equipment && userContext.concerns.includes('safety')) highlights.push('🛡️安全装備完備');
        if (shop.fun_dive_price_2tanks <= 12000 && userContext.concerns.includes('cost')) highlights.push('💰リーズナブル');
        
        return highlights.join(' ');
    }

    // === SPECIAL MENU QUERY HANDLERS ===

    async handleSpecialMenuQueries(message, userId) {
        const messageText = message.toLowerCase();
        
        // Sea conditions queries
        if (messageText.includes('海況') || messageText.includes('天気') || messageText.includes('波')) {
            return await this.handleSeaConditionsQuery(message, userId);
        }
        
        // Travel plan queries
        if (messageText.includes('旅行') || messageText.includes('プラン') || messageText.includes('宿泊')) {
            return await this.handleTravelPlanQuery(message, userId);
        }
        
        // Photo sharing queries
        if (messageText.includes('写真') || messageText.includes('投稿') || messageText.includes('体験談')) {
            return await this.handlePhotoShareQuery(message, userId);
        }
        
        // Statistics queries
        if (messageText.includes('統計') || messageText.includes('記録') || messageText.includes('マイページ')) {
            return await this.handleUserStatsQuery(message, userId);
        }
        
        return null; // No special handling needed
    }

    async handleSeaConditionsQuery(message, userId) {
        const messageText = message.toLowerCase();
        let area = '沖縄';
        
        if (messageText.includes('石垣')) {
            area = '石垣島';
        } else if (messageText.includes('宮古')) {
            area = '宮古島';
        }
        
        // Mock sea condition data
        const seaConditions = this.generateSeaConditions(area);
        
        const message_obj = {
            type: 'flex',
            altText: `🌊 ${area}の海況情報`,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: `🌊 ${area}の海況情報`,
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        },
                        {
                            type: 'text',
                            text: new Date().toLocaleDateString('ja-JP'),
                            size: 'sm',
                            color: '#666666'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '🌡️', size: 'sm', flex: 1 },
                                { type: 'text', text: `水温: ${seaConditions.waterTemp}°C`, size: 'sm', flex: 4 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '👁️', size: 'sm', flex: 1 },
                                { type: 'text', text: `透明度: ${seaConditions.visibility}m`, size: 'sm', flex: 4 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '🌊', size: 'sm', flex: 1 },
                                { type: 'text', text: `波高: ${seaConditions.waveHeight}m`, size: 'sm', flex: 4 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            contents: [
                                { type: 'text', text: '💨', size: 'sm', flex: 1 },
                                { type: 'text', text: `風向: ${seaConditions.windDirection}`, size: 'sm', flex: 4 }
                            ]
                        },
                        {
                            type: 'separator',
                            margin: 'lg'
                        },
                        {
                            type: 'box',
                            layout: 'vertical',
                            contents: [
                                {
                                    type: 'text',
                                    text: '🤿 ダイビング適正度',
                                    weight: 'bold',
                                    size: 'md',
                                    margin: 'lg'
                                },
                                {
                                    type: 'text',
                                    text: seaConditions.divingCondition,
                                    size: 'sm',
                                    wrap: true,
                                    margin: 'md',
                                    color: seaConditions.conditionColor
                                }
                            ]
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '📅 週間予報',
                                text: `${area}の週間海況予報を教えて`
                            },
                            style: 'primary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🏪 今日のおすすめショップ',
                                text: `${area}の今日のおすすめショップを教えて`
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ],
                    spacing: 'sm'
                }
            }
        };
        
        return message_obj;
    }

    generateSeaConditions(area) {
        // Mock data generation
        const conditions = {
            waterTemp: 24 + Math.floor(Math.random() * 4),
            visibility: 15 + Math.floor(Math.random() * 20),
            waveHeight: Math.random() * 2,
            windDirection: ['北', '北東', '東', '南東', '南', '南西', '西', '北西'][Math.floor(Math.random() * 8)],
        };
        
        // Determine diving condition
        let divingCondition, conditionColor;
        if (conditions.waveHeight < 1 && conditions.visibility > 20) {
            divingCondition = '🟢 絶好のダイビング日和！透明度も良好です';
            conditionColor = '#27AE60';
        } else if (conditions.waveHeight < 1.5 && conditions.visibility > 15) {
            divingCondition = '🟡 良好なダイビング条件です';
            conditionColor = '#F39C12';
        } else {
            divingCondition = '🔴 やや注意が必要な海況です';
            conditionColor = '#E74C3C';
        }
        
        return {
            ...conditions,
            divingCondition,
            conditionColor
        };
    }

    async handleTravelPlanQuery(message, userId) {
        const messageText = message.toLowerCase();
        let planType = 'general';
        
        if (messageText.includes('予算') || messageText.includes('安い')) {
            planType = 'budget';
        } else if (messageText.includes('初心者')) {
            planType = 'beginner';
        } else if (messageText.includes('宿泊') || messageText.includes('ホテル')) {
            planType = 'accommodation';
        }
        
        return this.generateTravelPlanResponse(planType);
    }

    generateTravelPlanResponse(planType) {
        const plans = {
            budget: {
                title: '💰 予算重視プラン',
                description: 'コストパフォーマンス重視の沖縄ダイビング旅行プラン',
                items: [
                    '• 平日プラン（宿泊費30%オフ）',
                    '• 民宿・ゲストハウス利用',
                    '• 器材レンタル込みショップ選択',
                    '• 早期予約割引活用'
                ]
            },
            beginner: {
                title: '🔰 初心者安心プラン',
                description: 'ダイビング初心者に優しい安心旅行プラン',
                items: [
                    '• 初心者専門ショップ予約',
                    '• 体験→ライセンス取得コース',
                    '• 安全重視のホテル・立地',
                    '• 24時間サポート体制'
                ]
            },
            accommodation: {
                title: '🏨 宿泊重視プラン',
                description: 'リゾートホテル滞在型ダイビング旅行プラン',
                items: [
                    '• ダイビング併設リゾート',
                    '• 送迎サービス付き',
                    '• スパ・エステ施設完備',
                    '• グループ利用特典'
                ]
            },
            general: {
                title: '🌊 おすすめ旅行プラン',
                description: 'バランスの取れた沖縄ダイビング旅行プラン',
                items: [
                    '• 2泊3日ダイビング＋観光',
                    '• 中級ホテル利用',
                    '• ファンダイブ4本',
                    '• 自由時間も充実'
                ]
            }
        };
        
        const plan = plans[planType];
        
        return {
            type: 'flex',
            altText: `✈️ ${plan.title}`,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: plan.title,
                            weight: 'bold',
                            size: 'lg',
                            color: '#2E7BEF'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: plan.description,
                            size: 'md',
                            wrap: true,
                            margin: 'md'
                        },
                        {
                            type: 'separator',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: '📋 プラン内容',
                            weight: 'bold',
                            size: 'md',
                            margin: 'lg'
                        },
                        {
                            type: 'text',
                            text: plan.items.join('\n'),
                            size: 'sm',
                            wrap: true,
                            margin: 'md'
                        }
                    ]
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '📞 詳細相談',
                                text: 'この旅行プランについて詳しく相談したい'
                            },
                            style: 'primary',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '🏪 対応ショップ',
                                text: 'このプランに対応するショップを教えて'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ],
                    spacing: 'sm'
                }
            }
        };
    }

    async handlePhotoShareQuery(message, userId) {
        return {
            type: 'text',
            text: '📸 写真投稿機能の使い方\n\n' +
                  '1. 写真を撮影または選択\n' +
                  '2. 投稿画面で以下を入力：\n' +
                  '   • ダイビングポイント\n' +
                  '   • 利用したショップ\n' +
                  '   • 感想・コメント\n' +
                  '3. 投稿完了！\n\n' +
                  '💝 投稿された写真は他のダイバーの参考になります\n\n' +
                  '📱 写真を投稿する場合は、画像を送信してください',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'camera',
                            label: '📸 写真を撮る'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'cameraRoll',
                            label: '🖼️ 写真を選ぶ'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '💬 体験談のみ',
                            text: 'ダイビング体験談を投稿したい'
                        }
                    }
                ]
            }
        };
    }

    async handleUserStatsQuery(message, userId) {
        const userStats = await this.getUserStats(userId);
        
        return {
            type: 'text',
            text: `📊 ${userId.slice(-4)}さんの統計情報\n\n` +
                  `💬 相談回数: ${userStats.consultations}回\n` +
                  `🏪 閲覧ショップ: ${userStats.shopsViewed}店舗\n` +
                  `❤️ 主な関心事: ${userStats.primaryConcern}\n` +
                  `📅 初回利用: ${userStats.firstUse}\n\n` +
                  `🎯 あなたへのおすすめ\n` +
                  `${userStats.recommendation}\n\n` +
                  `より詳しい情報はWEBアプリでご確認ください🌐`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '🔄 設定リセット',
                            text: '設定をリセットしたい'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'uri',
                            label: '🌐 WEBで確認',
                            uri: 'https://your-railway-app.railway.app/'
                        }
                    }
                ]
            }
        };
    }

    createActionButtonsMessage(userContext) {
        return {
            type: 'text',
            text: '🤿 他にもサポートできることがあります！',
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '🏝️ 他の地域も見る',
                            text: '他の地域のショップも教えて'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '💰 予算で絞り込み',
                            text: '予算に合うショップを探して'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '❓ よくある質問',
                            text: 'ダイビングのよくある質問'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '📞 予約について',
                            text: '予約方法を教えて'
                        }
                    }
                ]
            }
        };
    }

    async start() {
        try {
            // Test database connection
            console.log('🔧 Testing database connection...');
            const stats = await this.sheetsConnector.getShopStatistics();
            console.log(`✅ Database ready: ${stats.totalShops} shops loaded`);
            
            // Start server
            this.app.listen(this.port, () => {
                console.log('\n🚀 Jiji Railway API Server Started!');
                console.log('='.repeat(60));
                console.log(`🌐 Server: http://localhost:${this.port}`);
                console.log(`📊 Health Check: http://localhost:${this.port}/api/health`);
                console.log(`🧠 Emotional Matching: POST http://localhost:${this.port}/api/match`);
                console.log(`🏪 Shop Data: http://localhost:${this.port}/api/shops`);
                console.log(`📈 Statistics: http://localhost:${this.port}/api/stats`);
                console.log(`🔍 Search: GET http://localhost:${this.port}/api/search`);
                console.log(`💬 Feedback: POST http://localhost:${this.port}/api/feedback`);
                console.log(`⭐ Recommendations: GET http://localhost:${this.port}/api/recommendations`);
                console.log(`📱 LINE Webhook: POST http://localhost:${this.port}/webhook`);
                console.log('='.repeat(60));
                console.log('💡 Phase 4-A: Ready for Railway deployment!');
                console.log(`🎯 Environment: ${process.env.RAILWAY_ENVIRONMENT || 'development'}`);
                console.log(`🔗 OpenAI: ${this.openai ? 'Connected' : 'Mock Mode'}`);
                console.log(`🗄️ Supabase: ${this.supabase ? 'Connected' : 'Mock Mode'}`);
                console.log(`📱 LINE Bot: ${this.lineActive ? 'Active' : 'Credentials Missing'}`);
            });
            
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new JijiRailwayAPIServer();
    server.start();
}

module.exports = JijiRailwayAPIServer;