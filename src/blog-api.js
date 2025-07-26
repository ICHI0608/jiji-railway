/**
 * ブログシステム基盤構築モジュール (BLOG-001)
 * CMS機能・記事管理システム・カテゴリ・タグ管理
 */

const { supabase } = require('./database');

// ===== ブログシステム・CMS機能 =====

/**
 * ブログAPIサービス
 */
class BlogAPIService {
    constructor() {
        // ブログカテゴリ設定（沖縄ダイビング特化）
        this.categories = {
            diving_spots: {
                id: 'diving_spots',
                name: 'ダイビングスポット',
                description: '沖縄各地のダイビングポイント情報',
                icon: '🐠',
                color: '#0ea5e9'
            },
            marine_life: {
                id: 'marine_life',
                name: '海洋生物',
                description: 'マンタ・ウミガメ・熱帯魚の観察情報',
                icon: '🐢',
                color: '#059669'
            },
            travel_tips: {
                id: 'travel_tips',
                name: '旅行Tips',
                description: '沖縄旅行の実用的なアドバイス',
                icon: '✈️',
                color: '#2563eb'
            },
            equipment: {
                id: 'equipment',
                name: '器材・装備',
                description: 'ダイビング器材とメンテナンス情報',
                icon: '⚙️',
                color: '#7c3aed'
            },
            beginner_guide: {
                id: 'beginner_guide',
                name: '初心者ガイド',
                description: 'ダイビング初心者向けの基礎知識',
                icon: '🔰',
                color: '#dc2626'
            },
            seasonal_info: {
                id: 'seasonal_info',
                name: '季節情報',
                description: '季節別のダイビング・観光情報',
                icon: '🌺',
                color: '#f59e0b'
            },
            shop_review: {
                id: 'shop_review',
                name: 'ショップ情報',
                description: 'ダイビングショップのレビューと情報',
                icon: '🏪',
                color: '#10b981'
            }
        };

        // ブログタグ設定
        this.commonTags = [
            // エリア関連
            '石垣島', '宮古島', '沖縄本島', '久米島', '西表島', '与那国島', '慶良間諸島',
            // ダイビング関連
            '体験ダイビング', 'ファンダイビング', 'ライセンス取得', 'アドバンス',
            // 海洋生物
            'マンタ', 'ウミガメ', 'クマノミ', 'ジンベエザメ', 'ハンマーヘッド',
            // ダイビングスタイル
            'ボートダイビング', 'ビーチダイビング', '洞窟ダイビング', '地形ダイビング',
            // 季節
            '春ダイビング', '夏ダイビング', '秋ダイビング', '冬ダイビング',
            // レベル
            '初心者', '中級者', '上級者', 'インストラクター',
            // その他
            '水中写真', '安全', 'お得情報', '最新情報'
        ];
    }

    /**
     * ブログ記事一覧取得
     * @param {Object} options - 検索・フィルターオプション
     * @returns {Promise<Object>} 記事一覧
     */
    async getArticles(options = {}) {
        try {
            console.log('📰 ブログ記事一覧取得開始:', options);

            const {
                category,
                tags,
                search,
                limit = 20,
                offset = 0,
                sortBy = 'published_at',
                sortOrder = 'desc',
                status = 'published'
            } = options;

            // Supabaseが利用可能な場合はDBから取得
            if (supabase) {
                return await this.getArticlesFromDB(options);
            }

            // サンプルデータを返却
            const sampleArticles = this.generateSampleArticles();
            let filteredArticles = [...sampleArticles];

            // カテゴリフィルター
            if (category) {
                filteredArticles = filteredArticles.filter(article => 
                    article.category === category
                );
            }

            // タグフィルター
            if (tags && tags.length > 0) {
                filteredArticles = filteredArticles.filter(article =>
                    tags.some(tag => article.tags.includes(tag))
                );
            }

            // 検索フィルター
            if (search) {
                const searchLower = search.toLowerCase();
                filteredArticles = filteredArticles.filter(article =>
                    article.title.toLowerCase().includes(searchLower) ||
                    article.content.toLowerCase().includes(searchLower) ||
                    article.excerpt.toLowerCase().includes(searchLower)
                );
            }

            // ソート
            filteredArticles.sort((a, b) => {
                const aVal = a[sortBy];
                const bVal = b[sortBy];
                
                if (sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });

            // ページネーション
            const paginatedArticles = filteredArticles.slice(offset, offset + limit);

            console.log(`✅ ブログ記事一覧取得完了: ${paginatedArticles.length}件`);

            return {
                success: true,
                articles: paginatedArticles,
                total: filteredArticles.length,
                pagination: {
                    limit,
                    offset,
                    hasMore: offset + limit < filteredArticles.length
                },
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ ブログ記事一覧取得エラー:', error);
            throw error;
        }
    }

    /**
     * ブログ記事詳細取得
     * @param {string} articleId - 記事ID
     * @returns {Promise<Object>} 記事詳細
     */
    async getArticle(articleId) {
        try {
            console.log(`📖 ブログ記事詳細取得: ${articleId}`);

            // Supabaseが利用可能な場合はDBから取得
            if (supabase) {
                return await this.getArticleFromDB(articleId);
            }

            // サンプルデータから検索
            const sampleArticles = this.generateSampleArticles();
            const article = sampleArticles.find(a => a.id === articleId);

            if (!article) {
                throw new Error('記事が見つかりません');
            }

            // 関連記事を取得
            const relatedArticles = await this.getRelatedArticles(article);

            console.log(`✅ ブログ記事詳細取得完了: ${articleId}`);

            return {
                success: true,
                article: {
                    ...article,
                    content: this.generateFullContent(article),
                    viewCount: Math.floor(Math.random() * 1000) + 100,
                    lastUpdated: article.published_at
                },
                relatedArticles,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error(`❌ ブログ記事詳細取得エラー (${articleId}):`, error);
            throw error;
        }
    }

    /**
     * カテゴリ別記事統計取得
     * @returns {Promise<Object>} カテゴリ統計
     */
    async getCategoryStats() {
        try {
            console.log('📊 カテゴリ別記事統計取得開始');

            // サンプル統計データ生成
            const stats = {};
            Object.values(this.categories).forEach(category => {
                stats[category.id] = {
                    ...category,
                    articleCount: Math.floor(Math.random() * 50) + 5,
                    totalViews: Math.floor(Math.random() * 10000) + 1000,
                    lastPublished: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
                };
            });

            return {
                success: true,
                categoryStats: stats,
                totalArticles: Object.values(stats).reduce((sum, cat) => sum + cat.articleCount, 0),
                totalViews: Object.values(stats).reduce((sum, cat) => sum + cat.totalViews, 0),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ カテゴリ別記事統計取得エラー:', error);
            throw error;
        }
    }

    /**
     * タグクラウド取得
     * @returns {Promise<Object>} タグ使用統計
     */
    async getTagCloud() {
        try {
            console.log('🏷️ タグクラウド取得開始');

            // サンプルタグ統計生成
            const tagStats = this.commonTags.map(tag => ({
                tag,
                count: Math.floor(Math.random() * 20) + 1,
                weight: Math.random() * 4 + 1 // 1-5の重み
            }));

            // 使用頻度順にソート
            tagStats.sort((a, b) => b.count - a.count);

            return {
                success: true,
                tags: tagStats,
                totalTags: tagStats.length,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ タグクラウド取得エラー:', error);
            throw error;
        }
    }

    /**
     * 人気記事取得
     * @param {number} limit - 取得件数
     * @returns {Promise<Object>} 人気記事一覧
     */
    async getPopularArticles(limit = 10) {
        try {
            console.log(`🔥 人気記事取得開始: ${limit}件`);

            const articles = await this.getArticles({ limit: 50 });
            
            // ビュー数でソート（サンプルデータの場合はランダム）
            const popularArticles = articles.articles
                .map(article => ({
                    ...article,
                    viewCount: Math.floor(Math.random() * 2000) + 500
                }))
                .sort((a, b) => b.viewCount - a.viewCount)
                .slice(0, limit);

            return {
                success: true,
                articles: popularArticles,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ 人気記事取得エラー:', error);
            throw error;
        }
    }

    /**
     * 最新記事取得
     * @param {number} limit - 取得件数
     * @returns {Promise<Object>} 最新記事一覧
     */
    async getLatestArticles(limit = 5) {
        try {
            console.log(`🆕 最新記事取得開始: ${limit}件`);

            const articles = await this.getArticles({ 
                limit,
                sortBy: 'published_at',
                sortOrder: 'desc'
            });

            return {
                success: true,
                articles: articles.articles,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ 最新記事取得エラー:', error);
            throw error;
        }
    }

    // ===== ヘルパー関数 =====

    /**
     * 関連記事取得
     */
    async getRelatedArticles(article, limit = 4) {
        const allArticles = this.generateSampleArticles();
        
        const related = allArticles
            .filter(a => a.id !== article.id)
            .filter(a => 
                a.category === article.category ||
                a.tags.some(tag => article.tags.includes(tag))
            )
            .slice(0, limit);

        return related;
    }

    /**
     * サンプル記事データ生成
     */
    generateSampleArticles() {
        const articles = [
            {
                id: 'article_001',
                title: '石垣島のマンタポイント完全ガイド',
                slug: 'ishigaki-manta-guide',
                excerpt: '石垣島の代表的なダイビングスポット、マンタポイントの攻略法を詳しく解説。遭遇率90%以上の実績あるポイントと最適な時期をご紹介。',
                content: 'マンタとの遭遇は多くのダイバーの夢です...',
                category: 'diving_spots',
                tags: ['石垣島', 'マンタ', 'ボートダイビング', '中級者'],
                author: 'Jiji編集部',
                featured_image: '/images/blog/manta-point.jpg',
                published_at: '2025-07-25T10:00:00Z',
                status: 'published',
                featured: true
            },
            {
                id: 'article_002',
                title: '初心者必見！沖縄ダイビングの基礎知識',
                slug: 'okinawa-diving-basics',
                excerpt: 'ダイビング初心者が沖縄で安全に楽しむための基礎知識をまとめました。ライセンス取得から器材選びまで詳しく解説。',
                content: 'ダイビングを始めるにあたって...',
                category: 'beginner_guide',
                tags: ['初心者', '安全', 'ライセンス取得', '沖縄本島'],
                author: 'ダイビング太郎',
                featured_image: '/images/blog/beginner-guide.jpg',
                published_at: '2025-07-24T14:30:00Z',
                status: 'published',
                featured: false
            },
            {
                id: 'article_003',
                title: '宮古島の地形ダイビング：魔王の宮殿',
                slug: 'miyako-cave-diving',
                excerpt: '宮古島の代表的な地形ダイビングスポット「魔王の宮殿」の魅力と注意点を詳しく解説。',
                content: '宮古島の地形ダイビングは世界的に有名...',
                category: 'diving_spots',
                tags: ['宮古島', '地形ダイビング', '上級者', '洞窟ダイビング'],
                author: '宮古島ガイド',
                featured_image: '/images/blog/cave-diving.jpg',
                published_at: '2025-07-23T09:15:00Z',
                status: 'published',
                featured: true
            },
            {
                id: 'article_004',
                title: '沖縄の海で出会える海洋生物図鑑',
                slug: 'okinawa-marine-life',
                excerpt: '沖縄の海で観察できる代表的な海洋生物を写真付きで紹介。ダイビングで出会いたい生き物をチェック！',
                content: '沖縄の海は生物多様性の宝庫...',
                category: 'marine_life',
                tags: ['海洋生物', 'クマノミ', 'ウミガメ', '水中写真'],
                author: '海洋生物研究家',
                featured_image: '/images/blog/marine-life.jpg',
                published_at: '2025-07-22T16:45:00Z',
                status: 'published',
                featured: false
            },
            {
                id: 'article_005',
                title: '夏の沖縄ダイビング：台風シーズン対策',
                slug: 'summer-diving-typhoon',
                excerpt: '夏の沖縄ダイビングで注意すべき台風情報と対策方法。安全にダイビングを楽しむためのポイント。',
                content: '夏の沖縄は台風シーズンでもあります...',
                category: 'seasonal_info',
                tags: ['夏ダイビング', '台風', '安全', '最新情報'],
                author: 'Jiji編集部',
                featured_image: '/images/blog/summer-diving.jpg',
                published_at: '2025-07-21T11:20:00Z',
                status: 'published',
                featured: false
            },
            {
                id: 'article_006',
                title: 'ダイビング器材のメンテナンス方法',
                slug: 'equipment-maintenance',
                excerpt: 'ダイビング器材を長持ちさせるための正しいメンテナンス方法を解説。塩水処理から保管方法まで。',
                content: '器材のメンテナンスは安全ダイビングの基本...',
                category: 'equipment',
                tags: ['器材', 'メンテナンス', '安全', 'お得情報'],
                author: '器材専門家',
                featured_image: '/images/blog/equipment.jpg',
                published_at: '2025-07-20T13:10:00Z',
                status: 'published',
                featured: false
            }
        ];

        return articles;
    }

    /**
     * 記事の完全なコンテンツ生成
     */
    generateFullContent(article) {
        const baseContent = article.content;
        
        // カテゴリ別にコンテンツを拡張
        switch (article.category) {
            case 'diving_spots':
                return `${baseContent}

## 基本情報
- 深度: 15-30m
- 経験レベル: 中級者以上
- 透明度: 20-30m
- 水温: 26-28°C

## アクセス方法
ボートで約30分。石垣港から出港するダイビングサービスを利用。

## 見どころ
1. マンタの群れ
2. 美しいサンゴ礁
3. 多様な熱帯魚

## 注意事項
- 流れが強い場合があります
- 中性浮力の維持が重要
- インストラクターの指示に従ってください

## 撮影のコツ
マンタは近づきすぎず、ゆっくりと動きましょう。`;

            case 'beginner_guide':
                return `${baseContent}

## ライセンス取得の流れ
1. 学科講習（知識の習得）
2. プール実習（基本スキル）
3. 海洋実習（実践練習）
4. 認定証発行

## 必要な器材
- マスク
- フィン
- スノーケル
- ウェットスーツ
- BCD
- レギュレーター

## 安全に楽しむために
- 健康状態のチェック
- 天候・海況の確認
- バディシステムの徹底
- 無理をしない

## 沖縄でのダイビングの魅力
温暖な気候と美しい海で、一年中ダイビングが楽しめます。`;

            default:
                return `${baseContent}

詳細な情報と最新の状況については、現地のダイビングショップにお問い合わせください。

安全で楽しいダイビングをお楽しみください！`;
        }
    }

    /**
     * データベースから記事一覧取得（将来実装）
     */
    async getArticlesFromDB(options) {
        // 将来的にSupabaseから記事を取得する実装
        console.log('🔄 データベースから記事取得（未実装）');
        // 無限ループを避けるため、直接サンプルデータを使用
        const sampleArticles = this.generateSampleArticles();
        
        return {
            success: true,
            articles: sampleArticles,
            total: sampleArticles.length,
            pagination: {
                limit: options.limit || 20,
                offset: options.offset || 0,
                hasMore: false
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * データベースから記事詳細取得（将来実装）
     */
    async getArticleFromDB(articleId) {
        // 将来的にSupabaseから記事詳細を取得する実装
        console.log('🔄 データベースから記事詳細取得（未実装）');
        // 無限ループを避けるため、直接サンプルデータから検索
        const sampleArticles = this.generateSampleArticles();
        const article = sampleArticles.find(a => a.id === articleId);
        
        if (!article) {
            throw new Error('記事が見つかりません');
        }
        
        return {
            success: true,
            article: {
                ...article,
                content: this.generateFullContent(article),
                viewCount: Math.floor(Math.random() * 1000) + 100,
                lastUpdated: article.published_at
            },
            relatedArticles: sampleArticles.filter(a => a.id !== articleId).slice(0, 4),
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    BlogAPIService
};