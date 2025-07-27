#!/usr/bin/env node

/**
 * 🎯 管理画面専用アプリ - dive-buddys.com
 * 目的: 管理画面のみ動作する最小構成
 */

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase設定 + API key検証
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;
let supabaseStatus = 'checking';

console.log('🔍 環境変数デバッグ:');
console.log('SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? `設定済み(${supabaseKey.length}文字)` : '未設定');

async function initializeSupabase() {
    if (supabaseUrl && supabaseKey) {
        try {
            // Supabase接続とAPI key検証
            supabase = createClient(supabaseUrl, supabaseKey);
            
            // 実際にAPIコールして検証
            const { data, error } = await supabase.auth.getSession();
            
            if (error && error.message.includes('Invalid API key')) {
                console.error('❌ Supabase API key検証失敗:', error.message);
                supabase = null;
                supabaseStatus = 'invalid_key';
            } else {
                console.log('✅ Supabase初期化・検証完了');
                supabaseStatus = 'connected';
            }
        } catch (validationError) {
            console.error('❌ Supabase初期化エラー:', validationError.message);
            supabase = null;
            supabaseStatus = 'connection_failed';
        }
    } else {
        console.warn('⚠️ Supabase設定が見つかりません（フォールバックモードで動作）');
        console.log('URL:', supabaseUrl || 'undefined');
        console.log('Key:', supabaseKey ? supabaseKey.substring(0, 50) + '...' : 'undefined');
        supabaseStatus = 'not_configured';
    }
    
    return { supabase, status: supabaseStatus };
}

// 非同期でSupabase初期化
initializeSupabase().then(result => {
    console.log(`🔗 Supabase状態: ${result.status}`);
});

const app = express();
const PORT = process.env.PORT || 3000;

// 基本設定
app.use(express.json());
app.use(express.static('public'));

// ===== ヘルスチェック =====
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mode: 'admin_only',
        timestamp: new Date().toISOString() 
    });
});

app.get('/api/health', async (req, res) => {
    res.json({
        status: 'healthy',
        server: 'running',
        database: supabaseStatus,
        admin_panel: 'available',
        supabase_configured: !!supabase,
        supabase_status: supabaseStatus,
        mode: supabase ? 'supabase' : 'fallback',
        timestamp: new Date().toISOString()
    });
});

// ===== 管理画面ページルーティング =====

// 管理ダッシュボード
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/dashboard.html'));
});

// 記事作成ページ
app.get('/admin/blog-editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/blog-editor.html'));
});

// 記事管理ページ
app.get('/admin/blog-list', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/blog-list.html'));
});

// ショップデータベースページ
app.get('/shops-database', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/shops-database/index.html'));
});

app.get('/shops-database/details.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/shops-database/details.html'));
});

// ===== 管理画面用API（基本のみ） =====

// ショップデータベースAPI
const fs = require('fs');
const mockShopsData = require('./mock-shops-data.json');

// ショップ一覧API（検索・フィルタリング対応）
app.get('/api/shops', async (req, res) => {
    try {
        const {
            keyword, area, minPrice, maxPrice, grade, beginnerFriendly,
            soloOk, femaleInstructor, englishSupport, pickupService,
            photoService, privateGuide, licenseCoursesAvailable, sortBy
        } = req.query;
        
        let shops = [...mockShopsData];
        
        // キーワード検索
        if (keyword) {
            const searchTerm = keyword.toLowerCase();
            shops = shops.filter(shop => 
                shop.shop_name.toLowerCase().includes(searchTerm) ||
                shop.area.toLowerCase().includes(searchTerm) ||
                shop.speciality_areas?.toLowerCase().includes(searchTerm)
            );
        }
        
        // エリアフィルター（英語→日本語マッピング）
        if (area && area !== 'all') {
            const areaMapping = {
                'ishigaki': '石垣島',
                'miyako': '宮古島', 
                'okinawa': '沖縄本島',
                'other': 'その他'
            };
            const mappedArea = areaMapping[area] || area;
            shops = shops.filter(shop => shop.area === mappedArea);
        }
        
        // 価格範囲フィルター
        if (minPrice) {
            shops = shops.filter(shop => 
                shop.trial_dive_price_beach >= parseInt(minPrice)
            );
        }
        if (maxPrice) {
            shops = shops.filter(shop => 
                shop.trial_dive_price_beach <= parseInt(maxPrice)
            );
        }
        
        // グレードフィルター
        if (grade) {
            shops = shops.filter(shop => shop.jiji_grade === grade);
        }
        
        // Boolean フィルター
        if (beginnerFriendly === 'true') {
            shops = shops.filter(shop => shop.beginner_friendly === true);
        }
        if (soloOk === 'true') {
            shops = shops.filter(shop => shop.solo_welcome === true);
        }
        if (femaleInstructor === 'true') {
            shops = shops.filter(shop => shop.female_instructor === true);
        }
        if (englishSupport === 'true') {
            shops = shops.filter(shop => shop.english_support === true);
        }
        if (pickupService === 'true') {
            shops = shops.filter(shop => shop.pickup_service === true);
        }
        if (photoService === 'true') {
            shops = shops.filter(shop => shop.photo_service === true);
        }
        if (privateGuide === 'true') {
            shops = shops.filter(shop => shop.private_guide_available === true);
        }
        if (licenseCoursesAvailable === 'true') {
            shops = shops.filter(shop => shop.license_course_available === true);
        }
        
        // ソート
        if (sortBy) {
            switch (sortBy) {
                case 'price':
                    shops.sort((a, b) => a.trial_dive_price_beach - b.trial_dive_price_beach);
                    break;
                case 'rating':
                    shops.sort((a, b) => b.customer_rating - a.customer_rating);
                    break;
                case 'reviews':
                    shops.sort((a, b) => b.review_count - a.review_count);
                    break;
                case 'grade':
                default:
                    const gradeOrder = { 'premium': 3, 'standard': 2, 'basic': 1, 'S级': 4 };
                    shops.sort((a, b) => (gradeOrder[b.jiji_grade] || 0) - (gradeOrder[a.jiji_grade] || 0));
                    break;
            }
        }
        
        console.log(`🏪 ショップ検索結果: ${shops.length}件 (クエリ: ${JSON.stringify(req.query)})`);
        
        res.json({
            success: true,
            data: shops,
            count: shops.length,
            total: mockShopsData.length,
            filters: req.query
        });
        
    } catch (error) {
        console.error('❌ ショップAPI エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'ショップデータの取得に失敗しました'
        });
    }
});

// Jiji AI推薦API
app.get('/api/shops/recommendations', async (req, res) => {
    try {
        const { 
            isBeginners, isSolo, preferFemaleInstructor, 
            preferredArea, maxBudget 
        } = req.query;
        
        let shops = [...mockShopsData];
        let recommendations = [];
        
        // AI推薦ロジック
        shops.forEach(shop => {
            let score = 0;
            let reasons = [];
            
            // 基本スコア（評価・レビュー数）
            score += (shop.customer_rating || 0) * 20;
            score += Math.min((shop.review_count || 0) / 10, 10);
            
            // 初心者向け
            if (isBeginners === 'true' && shop.beginner_friendly) {
                score += 25;
                reasons.push('初心者歓迎');
            }
            
            // 一人参加
            if (isSolo === 'true' && shop.solo_welcome) {
                score += 20;
                reasons.push('一人参加歓迎');
            }
            
            // 女性インストラクター
            if (preferFemaleInstructor === 'true' && shop.female_instructor) {
                score += 15;
                reasons.push('女性インストラクター在籍');
            }
            
            // エリア優先
            if (preferredArea && shop.area === preferredArea) {
                score += 10;
                reasons.push(`${preferredArea}エリア`);
            }
            
            // 予算内
            if (maxBudget && shop.trial_dive_price_beach <= parseInt(maxBudget)) {
                score += 15;
                reasons.push('予算内');
            }
            
            // グレード加点
            const gradeBonus = { 'premium': 20, 'S级': 25, 'standard': 10, 'basic': 5 };
            score += gradeBonus[shop.jiji_grade] || 0;
            
            if (score > 50) {
                recommendations.push({
                    ...shop,
                    jiji_match_score: Math.min(Math.round(score), 100),
                    recommendation_reason: reasons.join('・')
                });
            }
        });
        
        // スコア順でソート、上位10件
        recommendations.sort((a, b) => b.jiji_match_score - a.jiji_match_score);
        recommendations = recommendations.slice(0, 10);
        
        console.log(`🤖 Jiji推薦生成完了: ${recommendations.length}件`);
        
        res.json({
            success: true,
            data: recommendations,
            count: recommendations.length,
            criteria: req.query
        });
        
    } catch (error) {
        console.error('❌ Jiji推薦API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ショップ統計API
app.get('/api/shops/statistics', async (req, res) => {
    try {
        const shops = mockShopsData;
        
        // エリア別統計
        const byArea = shops.reduce((acc, shop) => {
            acc[shop.area] = (acc[shop.area] || 0) + 1;
            return acc;
        }, {});
        
        // グレード別統計
        const byGrade = shops.reduce((acc, shop) => {
            acc[shop.jiji_grade] = (acc[shop.jiji_grade] || 0) + 1;
            return acc;
        }, {});
        
        // 価格統計
        const prices = shops.map(shop => shop.trial_dive_price_beach).filter(Boolean);
        const avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        
        const stats = {
            total_shops: shops.length,
            by_area: byArea,
            by_grade: byGrade,
            price_stats: {
                average: avgPrice,
                min: minPrice,
                max: maxPrice
            },
            features: {
                beginner_friendly: shops.filter(s => s.beginner_friendly).length,
                solo_welcome: shops.filter(s => s.solo_welcome).length,
                female_instructor: shops.filter(s => s.female_instructor).length,
                english_support: shops.filter(s => s.english_support).length,
                pickup_service: shops.filter(s => s.pickup_service).length,
                photo_service: shops.filter(s => s.photo_service).length
            }
        };
        
        console.log('📊 ショップ統計データ生成完了');
        
        res.json({
            success: true,
            data: stats
        });
        
    } catch (error) {
        console.error('❌ ショップ統計API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 個別ショップ詳細API
app.get('/api/shops/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        
        const shop = mockShopsData.find(s => s.shop_id === shopId);
        
        if (!shop) {
            return res.status(404).json({
                success: false,
                error: 'Shop not found',
                message: '指定されたショップが見つかりません'
            });
        }
        
        console.log(`🏪 ショップ詳細取得: ${shop.shop_name} (${shopId})`);
        
        res.json({
            success: true,
            data: shop
        });
        
    } catch (error) {
        console.error('❌ ショップ詳細API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 記事一覧API（Supabase連携 + フォールバック）
app.get('/api/blog/articles', async (req, res) => {
    try {
        // Supabase接続試行（スキップして直接フォールバック）
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data: articles, error } = await supabase
                    .from('blogs')
                    .select('*')
                    .order('created_at', { ascending: false });
                
                if (!error) {
                    console.log('📄 記事一覧取得成功（Supabase）:', articles?.length || 0, '件');
                    return res.json({
                        success: true,
                        articles: articles || [],
                        count: articles?.length || 0,
                        source: 'supabase'
                    });
                } else {
                    console.warn('Supabase記事取得エラー、フォールバックへ:', error.message);
                }
            } catch (supabaseError) {
                console.warn('Supabase接続エラー、フォールバックへ:', supabaseError.message);
            }
        } else {
            console.log('🔄 Supabaseステータス:', supabaseStatus, '- フォールバックモード使用');
        }
        
        // フォールバック: サンプルデータ + メモリデータ
        const sampleArticles = [
            {
                id: 'article_001',
                title: '石垣島のマンタポイント完全ガイド',
                excerpt: '石垣島の代表的なダイビングスポット、マンタポイントの攻略法を詳しく解説。',
                category: 'diving_spots',
                status: 'published',
                author: 'Jiji編集部',
                published_at: '2025-07-25T10:00:00Z',
                created_at: '2025-07-25T09:00:00Z',
                updated_at: '2025-07-25T10:00:00Z',
                featured: true
            },
            {
                id: 'article_002',
                title: '初心者必見！沖縄ダイビングの基礎知識',
                excerpt: 'ダイビング初心者が沖縄で安全に楽しむための基礎知識をまとめました。',
                category: 'beginner_guide',
                status: 'published',
                author: 'ダイビング太郎',
                published_at: '2025-07-24T14:30:00Z',
                created_at: '2025-07-24T13:30:00Z',
                updated_at: '2025-07-24T14:30:00Z',
                featured: false
            }
        ];
        
        // メモリに保存された記事があれば追加
        const tempArticles = global.tempArticles || [];
        const allArticles = [...sampleArticles, ...tempArticles];
        
        console.log('📄 記事一覧取得成功（フォールバック）:', allArticles.length, '件');
        res.json({
            success: true,
            articles: allArticles,
            count: allArticles.length,
            source: 'fallback',
            message: 'フォールバックモードで動作中'
        });
        
    } catch (error) {
        console.error('記事一覧API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'サーバーエラーが発生しました'
        });
    }
});

// 記事作成API（Supabase連携 + フォールバック）
app.post('/api/blog/articles', async (req, res) => {
    try {
        const { title, excerpt, content, category, tags } = req.body;
        
        // 必須フィールドチェック
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'タイトルと内容は必須です'
            });
        }
        
        const articleData = {
            id: `article_${Date.now()}`,
            title,
            excerpt: excerpt || '',
            content,
            category: category || 'general',
            tags: Array.isArray(tags) ? tags : [],
            status: 'draft',
            author: 'Admin',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Supabase接続試行（API key有効な場合のみ）
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data: article, error } = await supabase
                    .from('blogs')
                    .insert([articleData])
                    .select()
                    .single();
                
                if (!error) {
                    console.log('📝 記事作成成功（Supabase）:', article);
                    return res.json({
                        success: true,
                        message: '記事が正常に作成されました（Supabase）',
                        data: article
                    });
                } else {
                    console.warn('Supabase保存エラー、メモリ保存へ:', error.message);
                }
            } catch (supabaseError) {
                console.warn('Supabase接続エラー、メモリ保存へ:', supabaseError.message);
            }
        } else {
            console.log('🔄 Supabaseステータス:', supabaseStatus, '- メモリ保存モード使用');
        }
        
        // フォールバック: ローカルストレージ（サーバー側では不要）
        // const savedArticles = JSON.parse(localStorage?.getItem?.('blog_articles') || '[]');
        // savedArticles.push(articleData);
        
        // サーバー側の代替保存（メモリ）
        if (!global.tempArticles) global.tempArticles = [];
        global.tempArticles.push(articleData);
        
        console.log('📝 記事作成成功（ローカル）:', articleData);
        res.json({
            success: true,
            message: '記事が正常に作成されました（ローカル保存）',
            data: articleData,
            mode: 'fallback'
        });
        
    } catch (error) {
        console.error('記事作成API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'サーバーエラーが発生しました'
        });
    }
});

// ===== メインページリダイレクト =====
app.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

// ===== 404ハンドリング =====
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: '管理画面専用モードです',
        available_endpoints: [
            '/admin/dashboard',
            '/admin/blog-editor', 
            '/admin/blog-list',
            '/shops-database',
            '/api/shops',
            '/api/health',
            '/health'
        ]
    });
});

// ===== サーバー起動 =====
app.listen(PORT, () => {
    console.log('\n🎉=====================================');
    console.log('🎯 管理画面専用サーバー起動完了！');
    console.log('🌊 Dive Buddy\'s Admin Panel');
    console.log('=====================================');
    console.log(`📡 サーバー: https://dive-buddys.com`);
    console.log(`🎯 管理画面: https://dive-buddys.com/admin/dashboard`);
    console.log(`📝 記事作成: https://dive-buddys.com/admin/blog-editor`);
    console.log(`📋 記事管理: https://dive-buddys.com/admin/blog-list`);
    console.log('=====================================🎉\n');
});