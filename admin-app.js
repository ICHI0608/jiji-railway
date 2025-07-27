#!/usr/bin/env node

/**
 * 🎯 管理画面専用アプリ - dive-buddys.com
 * 目的: 管理画面のみ動作する最小構成
 */

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
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

// 気象庁API設定
const JMA_API_CONFIG = {
    forecast_url: 'https://www.jma.go.jp/bosai/forecast/data/forecast/',
    marine_warning_url: 'https://www.jma.go.jp/bosai/seawarning/data/',
    observation_url: 'https://www.jma.go.jp/bosai/observation/data/observation/',
    areas: {
        okinawa_main: '471000',        // 沖縄本島
        ishigaki: '474000',           // 石垣島
        miyakojima: '473000',         // 宮古島  
        kerama: '471010',             // 慶良間
        kume: '471020',               // 久米島
    },
    marine_areas: {
        okinawa_main: 'okinawa_main_sea',
        ishigaki: 'ishigaki_sea', 
        miyakojima: 'miyakojima_sea'
    }
};

// Amadeus API設定
const AMADEUS_CONFIG = {
    base_url: 'https://test.api.amadeus.com', // テスト環境
    auth_url: 'https://test.api.amadeus.com/v1/security/oauth2/token',
    client_id: process.env.AMADEUS_CLIENT_ID,
    client_secret: process.env.AMADEUS_CLIENT_SECRET,
    endpoints: {
        flight_offers: '/v2/shopping/flight-offers',
        flight_inspiration: '/v1/shopping/flight-destinations',
        airport_search: '/v1/reference-data/locations'
    }
};

// Amadeus API認証トークン
let amadeusToken = null;
let tokenExpiryTime = null;

// 主要空港コード（沖縄ダイビング関連）
const AIRPORT_CODES = {
    // 本土主要空港
    haneda: 'HND',
    narita: 'NRT', 
    kansai: 'KIX',
    chubu: 'NGO',
    fukuoka: 'FUK',
    // 沖縄エリア
    naha: 'OKA',       // 那覇
    ishigaki: 'ISG',   // 石垣
    miyako: 'MMY',     // 宮古
    // 離島
    kerama: 'OKA',     // 慶良間（那覇経由）
    kume: 'OKA'        // 久米島（那覇経由）
};

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

// メインページ（トップページ）
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// 航空券検索ページ
app.get('/travel-guide/flights', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/travel-guide/flights.html'));
});

// 会員マイページ
app.get('/member', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/index.html'));
});

// 会員登録ページ
app.get('/member/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/register.html'));
});

// 口コミ投稿ページ
app.get('/member/review-post', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/review-post.html'));
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

// ===== 気象庁API関数 =====

// 気象庁APIリクエスト共通関数
async function fetchJMAData(url, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`🌊 気象庁API取得 (${attempt}/${retries}): ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'User-Agent': 'DiveBuddys/1.0 (https://dive-buddys.com)',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log(`✅ 気象庁API取得成功: ${url}`);
            return { success: true, data };
            
        } catch (error) {
            console.warn(`⚠️ 気象庁API取得失敗 (${attempt}/${retries}): ${error.message}`);
            
            if (attempt === retries) {
                console.error(`❌ 気象庁API取得完全失敗: ${url}`);
                return { 
                    success: false, 
                    error: error.message,
                    url: url 
                };
            }
            
            // 再試行前の待機時間 (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

// エリア別天気予報取得
async function getWeatherForecast(areaCode) {
    const url = `${JMA_API_CONFIG.forecast_url}${areaCode}.json`;
    return await fetchJMAData(url);
}

// 海上警報取得
async function getMarineWarnings(area = 'okinawa') {
    const url = `${JMA_API_CONFIG.marine_warning_url}warning_${area}.json`;
    return await fetchJMAData(url);
}

// 観測データ取得
async function getObservationData(areaCode) {
    const url = `${JMA_API_CONFIG.observation_url}${areaCode}.json`;
    return await fetchJMAData(url);
}

// ダイビング適性判定ロジック
function calculateDivingCondition(weatherData, marineData) {
    try {
        let score = 100; // 100点満点
        let conditions = [];
        let warnings = [];

        // 天気コード判定
        const weatherCode = weatherData?.timeSeries?.[0]?.areas?.[0]?.weatherCodes?.[0];
        if (weatherCode) {
            if (['200', '201', '202', '203', '204'].includes(weatherCode)) {
                score -= 40;
                warnings.push('雷雨予報のため危険');
            } else if (['300', '301', '302', '303', '304'].includes(weatherCode)) {
                score -= 20;
                warnings.push('降雨のため視界不良の可能性');
            }
        }

        // 風速チェック
        const windSpeed = weatherData?.timeSeries?.[1]?.areas?.[0]?.windSpeeds?.[0];
        if (windSpeed) {
            const windValue = parseInt(windSpeed);
            if (windValue >= 10) {
                score -= 30;
                warnings.push(`強風注意 (${windValue}m/s)`);
            } else if (windValue >= 7) {
                score -= 15;
                warnings.push(`やや強風 (${windValue}m/s)`);
            }
        }

        // 海上警報チェック
        if (marineData?.warnings && marineData.warnings.length > 0) {
            score -= 50;
            warnings.push('海上警報発令中');
        }

        // 総合判定
        let suitability;
        if (score >= 80) {
            suitability = 'excellent';
            conditions.push('絶好のダイビング日和');
        } else if (score >= 60) {
            suitability = 'good';
            conditions.push('良好なダイビング条件');
        } else if (score >= 40) {
            suitability = 'fair';
            conditions.push('注意してダイビング可能');
        } else if (score >= 20) {
            suitability = 'poor';
            conditions.push('ダイビング非推奨');
        } else {
            suitability = 'dangerous';
            conditions.push('ダイビング危険');
        }

        return {
            suitability,
            score,
            conditions,
            warnings,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ ダイビング適性判定エラー:', error);
        return {
            suitability: 'unknown',
            score: 0,
            conditions: ['判定不可'],
            warnings: ['データ取得エラー'],
            timestamp: new Date().toISOString()
        };
    }
}

// ===== 気象庁API エンドポイント =====

// 天気予報API
app.get('/api/weather/forecast/:area', async (req, res) => {
    try {
        const { area } = req.params;
        const areaCode = JMA_API_CONFIG.areas[area];
        
        if (!areaCode) {
            return res.status(400).json({
                success: false,
                error: 'Invalid area code',
                message: `エリア '${area}' は対応していません`,
                available_areas: Object.keys(JMA_API_CONFIG.areas)
            });
        }

        console.log(`🌤️ 天気予報取得: ${area} (${areaCode})`);
        const result = await getWeatherForecast(areaCode);
        
        if (result.success) {
            res.json({
                success: true,
                area: area,
                area_code: areaCode,
                data: result.data,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                error: result.error,
                message: '気象データの取得に失敗しました',
                area: area
            });
        }
        
    } catch (error) {
        console.error('❌ 天気予報API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '天気予報の取得に失敗しました'
        });
    }
});

// 海上警報API
app.get('/api/weather/marine/:area?', async (req, res) => {
    try {
        const { area = 'okinawa' } = req.params;
        
        console.log(`🌊 海上警報取得: ${area}`);
        const result = await getMarineWarnings(area);
        
        if (result.success) {
            res.json({
                success: true,
                area: area,
                data: result.data,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                error: result.error,
                message: '海上警報データの取得に失敗しました',
                area: area
            });
        }
        
    } catch (error) {
        console.error('❌ 海上警報API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '海上警報の取得に失敗しました'
        });
    }
});

// ダイビング適性判定API
app.get('/api/weather/diving-condition/:area', async (req, res) => {
    try {
        const { area } = req.params;
        const areaCode = JMA_API_CONFIG.areas[area];
        
        if (!areaCode) {
            return res.status(400).json({
                success: false,
                error: 'Invalid area code',
                message: `エリア '${area}' は対応していません`,
                available_areas: Object.keys(JMA_API_CONFIG.areas)
            });
        }

        console.log(`🤿 ダイビング適性判定: ${area}`);
        
        // 並行して天気予報と海上警報を取得
        const [weatherResult, marineResult] = await Promise.all([
            getWeatherForecast(areaCode),
            getMarineWarnings(area)
        ]);

        const divingCondition = calculateDivingCondition(
            weatherResult.success ? weatherResult.data : null,
            marineResult.success ? marineResult.data : null
        );

        res.json({
            success: true,
            area: area,
            area_code: areaCode,
            diving_condition: divingCondition,
            weather_data_available: weatherResult.success,
            marine_data_available: marineResult.success,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ ダイビング適性判定API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'ダイビング適性判定に失敗しました'
        });
    }
});

// 統計情報API (月別・シーズン別・過去データ)
app.get('/api/weather/statistics/:type?', async (req, res) => {
    try {
        const { type = 'all' } = req.params;
        
        console.log(`📊 統計情報取得: ${type}`);
        
        const statisticsData = generateStatisticsData(type);
        
        res.json({
            success: true,
            type: type,
            data: statisticsData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 統計情報API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '統計情報の取得に失敗しました'
        });
    }
});

// 統計データ生成 (実際の運用では過去データから計算)
function generateStatisticsData(type) {
    const baseData = {
        monthly: [
            { month: '1月', score: 72, features: ['透明度抜群', '人少なめ', '水温低め'] },
            { month: '2月', score: 75, features: ['クジラ遭遇', '安定した天候', '料金安い'] },
            { month: '3月', score: 80, features: ['マンタ開始', '気候良好', 'サンゴ産卵'] },
            { month: '4月', score: 85, features: ['ベストシーズン開始', '透明度最高', '穏やか'] },
            { month: '5月', score: 88, features: ['絶好調', '生物豊富', '台風なし'] },
            { month: '6月', score: 90, features: ['最高シーズン', 'マンタ最盛期', '梅雨明け'] },
            { month: '7月', score: 85, features: ['夏本番', 'ジンベエザメ', '台風注意'] },
            { month: '8月', score: 82, features: ['高水温', '混雑ピーク', '台風シーズン'] },
            { month: '9月', score: 80, features: ['秋マンタ', '台風影響', '透明度回復'] },
            { month: '10月', score: 85, features: ['快適水温', '台風減少', '生物活発'] },
            { month: '11月', score: 88, features: ['秋ベスト', '透明度最高', '人少なめ'] },
            { month: '12月', score: 75, features: ['冬物開始', 'ハンマー期待', '北風注意'] }
        ],
        seasonal: [
            {
                name: '🌸 春シーズン',
                period: '3月-5月',
                icon: '🌸',
                highlights: [
                    { icon: '🌡️', text: '快適な水温（24-26°C）' },
                    { icon: '🌤️', text: '安定した天候' },
                    { icon: '🐠', text: '透明度抜群（30m+）' },
                    { icon: '💰', text: '料金リーズナブル' }
                ],
                average_score: 84,
                best_months: ['4月', '5月'],
                characteristics: ['マンタシーズン開始', 'サンゴ産卵時期', '混雑少なめ']
            },
            {
                name: '☀️ 夏シーズン',
                period: '6月-8月',
                icon: '☀️',
                highlights: [
                    { icon: '🌊', text: '最高水温（28-30°C）' },
                    { icon: '🐢', text: 'ジンベエザメ遭遇' },
                    { icon: '⚠️', text: '台風シーズン要注意' },
                    { icon: '🏖️', text: 'ピークシーズン' }
                ],
                average_score: 86,
                best_months: ['6月', '7月前半'],
                characteristics: ['最高のコンディション', '生物最豊富', '料金最高値']
            },
            {
                name: '🍂 秋シーズン',
                period: '9月-11月',
                icon: '🍂',
                highlights: [
                    { icon: '🌡️', text: '程よい水温（26-28°C）' },
                    { icon: '🌊', text: '穏やかな海況' },
                    { icon: '🐠', text: 'マンタシーズン' },
                    { icon: '👥', text: '観光客減少' }
                ],
                average_score: 84,
                best_months: ['10月', '11月'],
                characteristics: ['透明度最高', '秋マンタ活発', '快適な気候']
            },
            {
                name: '❄️ 冬シーズン',
                period: '12月-2月',
                icon: '❄️',
                highlights: [
                    { icon: '🌡️', text: '水温やや低め（22-24°C）' },
                    { icon: '🌊', text: '透明度最高（35m+）' },
                    { icon: '🐋', text: 'ホエールウォッチング' },
                    { icon: '🦈', text: 'ハンマーヘッド期待' }
                ],
                average_score: 74,
                best_months: ['2月', '3月初旬'],
                characteristics: ['特別な生物', '料金最安', '北風要注意']
            }
        ],
        historical: {
            best_month: '5月',
            best_score: 92,
            worst_month: '1月',
            worst_score: 68,
            average_score: 81,
            typhoon_average: 3.2,
            peak_season: '4月-11月',
            off_season: '12月-3月',
            trends: {
                temperature_rising: true,
                typhoon_increasing: false,
                visibility_stable: true
            }
        },
        current_month: {
            month: new Date().toLocaleDateString('ja-JP', { month: 'long' }),
            score: calculateCurrentMonthScore(),
            ranking: '年間2位',
            recommendation: '絶好のダイビングコンディション'
        }
    };

    if (type === 'monthly') return { monthly: baseData.monthly };
    if (type === 'seasonal') return { seasonal: baseData.seasonal };
    if (type === 'historical') return { historical: baseData.historical };
    
    return baseData; // type === 'all'
}

// 現在月のスコア計算
function calculateCurrentMonthScore() {
    const currentMonth = new Date().getMonth(); // 0-11
    const seasonScores = [72, 75, 80, 85, 88, 90, 85, 82, 80, 85, 88, 75];
    return seasonScores[currentMonth];
}

// 台風・緊急アラートAPI
app.get('/api/weather/alerts/:type?', async (req, res) => {
    try {
        const { type = 'all' } = req.params;
        
        console.log(`⚠️ 気象アラート取得: ${type}`);
        
        // 並行して複数の警報データを取得
        const [typhoonData, marineWarnings, weatherWarnings] = await Promise.all([
            getTyphoonData(),
            getMarineWarningsData(),
            getWeatherWarningsData()
        ]);

        const alerts = processAlertsData(typhoonData, marineWarnings, weatherWarnings, type);
        
        res.json({
            success: true,
            type: type,
            alerts: alerts,
            count: alerts.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ アラートAPI エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'アラート情報の取得に失敗しました'
        });
    }
});

// 台風データ取得
async function getTyphoonData() {
    try {
        // 実際の運用では気象庁の台風情報APIを使用
        // 現在はモックデータで台風シーズン判定
        const now = new Date();
        const month = now.getMonth() + 1;
        const isTyphoonSeason = month >= 5 && month <= 11;
        
        if (isTyphoonSeason && Math.random() < 0.15) { // 15%の確率で台風情報
            return {
                active: true,
                typhoons: [{
                    id: 'TY2025' + String(Math.floor(Math.random() * 20) + 1).padStart(2, '0'),
                    name: ['アンピル', 'ウーコン', 'トクスリ', 'ハンスン'][Math.floor(Math.random() * 4)],
                    status: 'approaching',
                    location: {
                        lat: 24.5 + Math.random() * 2,
                        lon: 124.0 + Math.random() * 3
                    },
                    intensity: ['熱帯低気圧', '台風', '強い台風', '非常に強い台風'][Math.floor(Math.random() * 4)],
                    maxWind: 25 + Math.floor(Math.random() * 40),
                    pressure: 980 - Math.floor(Math.random() * 30),
                    movement: ['北北東', '北東', '東北東'][Math.floor(Math.random() * 3)],
                    speed: 15 + Math.floor(Math.random() * 15),
                    forecast: generateTyphoonForecast(),
                    impact: assessTyphoonImpact(),
                    lastUpdate: new Date().toISOString()
                }]
            };
        }
        
        return { active: false, typhoons: [] };
    } catch (error) {
        console.error('台風データ取得エラー:', error);
        return { active: false, typhoons: [] };
    }
}

// 台風予報生成
function generateTyphoonForecast() {
    const forecasts = [];
    const baseDate = new Date();
    
    for (let i = 0; i < 5; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        
        forecasts.push({
            datetime: date.toISOString(),
            location: {
                lat: 24.5 + i * 0.8,
                lon: 124.0 + i * 1.2
            },
            intensity: ['台風', '強い台風', '非常に強い台風'][Math.floor(Math.random() * 3)],
            maxWind: 30 + i * 5 + Math.floor(Math.random() * 10),
            radius: 150 + i * 20
        });
    }
    
    return forecasts;
}

// 台風影響評価
function assessTyphoonImpact() {
    return {
        okinawa_main: {
            risk_level: ['low', 'medium', 'high', 'extreme'][Math.floor(Math.random() * 4)],
            expected_impact: '強風・大雨による交通機関への影響',
            diving_impact: 'full_stop',
            arrival_time: '24-48時間以内',
            recommendations: [
                '全てのダイビング活動を中止',
                '屋内での安全確保',
                '交通機関の運行状況確認',
                '緊急時の連絡先確認'
            ]
        },
        ishigaki: {
            risk_level: ['medium', 'high', 'extreme'][Math.floor(Math.random() * 3)],
            expected_impact: '暴風域の影響が予想される',
            diving_impact: 'full_stop',
            arrival_time: '12-24時間以内',
            recommendations: [
                '即座にダイビング中止',
                '安全な場所への避難',
                '非常用品の準備確認'
            ]
        },
        miyakojima: {
            risk_level: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)],
            expected_impact: '風雨の影響、高波注意',
            diving_impact: 'restricted',
            arrival_time: '36-48時間以内',
            recommendations: [
                'ボートダイビング中止',
                '海岸付近の活動自粛',
                '最新情報の継続監視'
            ]
        }
    };
}

// 海上警報データ取得
async function getMarineWarningsData() {
    try {
        const warnings = [];
        
        // ランダムで海上警報を生成（実際は気象庁APIから取得）
        if (Math.random() < 0.1) { // 10%の確率
            warnings.push({
                type: 'marine_warning',
                title: '海上強風警報',
                content: '沖縄地方の沿岸の海域では、強風のため波が高くなっています。',
                areas: ['okinawa_main', 'ishigaki', 'miyakojima'],
                severity: 'warning',
                issued_at: new Date().toISOString(),
                valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        if (Math.random() < 0.05) { // 5%の確率
            warnings.push({
                type: 'marine_warning',
                title: '海上濃霧注意報',
                content: '海上では濃霧により視程が悪くなる見込みです。',
                areas: ['okinawa_main'],
                severity: 'advisory',
                issued_at: new Date().toISOString(),
                valid_until: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
            });
        }
        
        return warnings;
    } catch (error) {
        console.error('海上警報データ取得エラー:', error);
        return [];
    }
}

// 気象警報データ取得
async function getWeatherWarningsData() {
    try {
        const warnings = [];
        
        // 現在の季節に応じた警報を生成
        const month = new Date().getMonth() + 1;
        
        if (month >= 6 && month <= 9 && Math.random() < 0.08) { // 夏季の大雨警報
            warnings.push({
                type: 'weather_warning',
                title: '大雨警報',
                content: '活発な前線の影響により、大雨となる見込みです。',
                areas: ['okinawa_main'],
                severity: 'warning',
                issued_at: new Date().toISOString(),
                valid_until: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString()
            });
        }
        
        if (month >= 11 || month <= 3 && Math.random() < 0.12) { // 冬季の強風注意報
            warnings.push({
                type: 'weather_warning',
                title: '強風注意報',
                content: '北東の風が強く、海上では波が高くなる見込みです。',
                areas: ['okinawa_main', 'ishigaki', 'miyakojima'],
                severity: 'advisory',
                issued_at: new Date().toISOString(),
                valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        return warnings;
    } catch (error) {
        console.error('気象警報データ取得エラー:', error);
        return [];
    }
}

// アラートデータ処理
function processAlertsData(typhoonData, marineWarnings, weatherWarnings, type) {
    const alerts = [];
    
    // 台風アラート処理
    if (typhoonData.active && typhoonData.typhoons.length > 0) {
        typhoonData.typhoons.forEach(typhoon => {
            alerts.push({
                id: `typhoon_${typhoon.id}`,
                type: 'typhoon',
                priority: 'critical',
                title: `台風${typhoon.id}号 (${typhoon.name}) ${typhoon.intensity}`,
                message: `台風が沖縄地方に接近中です。現在の位置: 北緯${typhoon.location.lat.toFixed(1)}度、東経${typhoon.location.lon.toFixed(1)}度`,
                details: {
                    intensity: typhoon.intensity,
                    maxWind: typhoon.maxWind,
                    pressure: typhoon.pressure,
                    movement: `${typhoon.movement} ${typhoon.speed}km/h`,
                    forecast: typhoon.forecast,
                    impact: typhoon.impact
                },
                diving_impact: {
                    status: 'critical_stop',
                    message: '全海域でダイビング活動完全停止',
                    recommendations: [
                        '屋内での安全確保',
                        '交通機関運行状況の確認',
                        'ダイビング予約の変更・キャンセル',
                        '緊急連絡先の確認'
                    ]
                },
                areas: ['okinawa_main', 'ishigaki', 'miyakojima'],
                issued_at: typhoon.lastUpdate,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            });
        });
    }
    
    // 海上警報処理
    marineWarnings.forEach(warning => {
        alerts.push({
            id: `marine_${Date.now()}`,
            type: 'marine_warning',
            priority: warning.severity === 'warning' ? 'high' : 'medium',
            title: warning.title,
            message: warning.content,
            areas: warning.areas,
            diving_impact: {
                status: warning.severity === 'warning' ? 'restricted' : 'caution',
                message: warning.severity === 'warning' ? 
                    'ボートダイビング中止、ビーチダイビング要注意' :
                    'ダイビング時の安全確認強化',
                recommendations: warning.severity === 'warning' ? [
                    'ボートダイビングの中止',
                    'ビーチダイビングでの安全確認強化',
                    '最新の海況情報の継続監視'
                ] : [
                    '海況の継続監視',
                    'ダイビング前の安全確認',
                    '緊急時の対応準備'
                ]
            },
            issued_at: warning.issued_at,
            expires_at: warning.valid_until
        });
    });
    
    // 気象警報処理
    weatherWarnings.forEach(warning => {
        alerts.push({
            id: `weather_${Date.now()}`,
            type: 'weather_warning',
            priority: warning.severity === 'warning' ? 'high' : 'medium',
            title: warning.title,
            message: warning.content,
            areas: warning.areas,
            diving_impact: {
                status: warning.severity === 'warning' ? 'restricted' : 'caution',
                message: warning.severity === 'warning' ? 
                    'ダイビング活動の制限' :
                    'ダイビング時の注意強化'
            },
            issued_at: warning.issued_at,
            expires_at: warning.valid_until
        });
    });
    
    // タイプフィルタリング
    if (type !== 'all') {
        return alerts.filter(alert => alert.type === type);
    }
    
    // 優先度でソート
    return alerts.sort((a, b) => {
        const priorities = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
        return priorities[b.priority] - priorities[a.priority];
    });
}

// テスト用アラートAPI（必ずアラートを生成）
app.get('/api/weather/alerts/test/:severity?', async (req, res) => {
    try {
        const { severity = 'all' } = req.params;
        
        console.log(`🧪 テスト用アラート生成: ${severity}`);
        
        const testAlerts = [];
        
        // 台風アラート（severe度が 'critical' または 'all'）
        if (severity === 'critical' || severity === 'all') {
            testAlerts.push({
                id: 'test_typhoon_01',
                type: 'typhoon',
                priority: 'critical',
                title: '台風TY202512号 (テスト) 非常に強い台風',
                message: '【テストデータ】台風が沖縄地方に接近中です。現在の位置: 北緯25.2度、東経125.8度',
                details: {
                    intensity: '非常に強い台風',
                    maxWind: 55,
                    pressure: 945,
                    movement: '北北東 25km/h',
                    forecast: [
                        {
                            datetime: new Date().toISOString(),
                            location: { lat: 25.2, lon: 125.8 },
                            intensity: '非常に強い台風',
                            maxWind: 55,
                            radius: 200
                        },
                        {
                            datetime: new Date(Date.now() + 24*60*60*1000).toISOString(),
                            location: { lat: 26.0, lon: 127.0 },
                            intensity: '強い台風',
                            maxWind: 45,
                            radius: 180
                        }
                    ],
                    impact: {
                        okinawa_main: {
                            risk_level: 'extreme',
                            expected_impact: '【テスト】暴風・大雨による甚大な影響',
                            diving_impact: 'full_stop',
                            arrival_time: '6-12時間以内',
                            recommendations: [
                                '【テストデータ】全ダイビング活動即座に中止',
                                '安全な場所への緊急避難',
                                '食料・水・非常用品の確保',
                                '通信手段の確保'
                            ]
                        },
                        ishigaki: {
                            risk_level: 'high',
                            expected_impact: '【テスト】強風・高波の影響',
                            diving_impact: 'full_stop',
                            arrival_time: '12-18時間以内',
                            recommendations: [
                                '【テストデータ】ダイビング完全中止',
                                '屋内での安全確保',
                                '最新情報の継続監視'
                            ]
                        },
                        miyakojima: {
                            risk_level: 'medium',
                            expected_impact: '【テスト】風雨の影響、要警戒',
                            diving_impact: 'restricted',
                            arrival_time: '18-24時間以内',
                            recommendations: [
                                '【テストデータ】海上活動の中止',
                                '台風進路の継続監視',
                                '安全対策の準備'
                            ]
                        }
                    }
                },
                diving_impact: {
                    status: 'critical_stop',
                    message: '【テストデータ】全海域でダイビング活動完全停止',
                    recommendations: [
                        '屋内での安全確保',
                        '交通機関運行状況の確認',
                        'ダイビング予約の変更・キャンセル',
                        '緊急連絡先の確認'
                    ]
                },
                areas: ['okinawa_main', 'ishigaki', 'miyakojima'],
                issued_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
            });
        }
        
        // 海上警報（severity が 'high' または 'all'）
        if (severity === 'high' || severity === 'all') {
            testAlerts.push({
                id: 'test_marine_01',
                type: 'marine_warning',
                priority: 'high',
                title: '【テスト】海上強風警報',
                message: '【テストデータ】沖縄地方の沿岸の海域では、強風のため波が非常に高くなっています。',
                areas: ['okinawa_main', 'ishigaki'],
                diving_impact: {
                    status: 'restricted',
                    message: '【テストデータ】ボートダイビング中止、ビーチダイビング要注意',
                    recommendations: [
                        'ボートダイビングの中止',
                        'ビーチダイビングでの安全確認強化',
                        '最新の海況情報の継続監視'
                    ]
                },
                issued_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString()
            });
        }
        
        // 気象警報（severity が 'medium' または 'all'）
        if (severity === 'medium' || severity === 'all') {
            testAlerts.push({
                id: 'test_weather_01',
                type: 'weather_warning',
                priority: 'medium',
                title: '【テスト】大雨注意報',
                message: '【テストデータ】前線の影響により、大雨となる見込みです。',
                areas: ['okinawa_main'],
                diving_impact: {
                    status: 'caution',
                    message: '【テストデータ】ダイビング時の注意強化',
                    recommendations: [
                        '気象状況の継続監視',
                        'ダイビング前の安全確認',
                        '緊急時の対応準備'
                    ]
                },
                issued_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
            });
        }
        
        res.json({
            success: true,
            type: 'test',
            severity: severity,
            alerts: testAlerts,
            count: testAlerts.length,
            message: 'これはテスト用のアラートデータです',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ テストアラートAPI エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'テストアラートの生成に失敗しました'
        });
    }
});

// ===== Amadeus API関数 =====

// Amadeus API認証取得
async function getAmadeusToken() {
    const currentTime = Date.now();
    
    // トークンが有効な場合は再利用
    if (amadeusToken && tokenExpiryTime && currentTime < tokenExpiryTime) {
        return amadeusToken;
    }
    
    try {
        console.log('🔐 Amadeus API認証中...');
        
        const response = await axios.post(AMADEUS_CONFIG.auth_url, 
            'grant_type=client_credentials&client_id=' + AMADEUS_CONFIG.client_id + '&client_secret=' + AMADEUS_CONFIG.client_secret,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        amadeusToken = response.data.access_token;
        // トークンの有効期限を設定（1時間 - 余裕をもって50分）
        tokenExpiryTime = currentTime + (50 * 60 * 1000);
        
        console.log('✅ Amadeus API認証成功');
        return amadeusToken;
        
    } catch (error) {
        console.error('❌ Amadeus API認証失敗:', error.response?.data || error.message);
        throw new Error('Amadeus API認証に失敗しました');
    }
}

// 航空券検索（基本検索）
async function searchFlights(origin, destination, departureDate, returnDate = null, adults = 1) {
    try {
        const token = await getAmadeusToken();
        
        const params = {
            originLocationCode: origin,
            destinationLocationCode: destination, 
            departureDate: departureDate,
            adults: adults,
            max: 20  // 最大20件の結果
        };
        
        // 往復の場合
        if (returnDate) {
            params.returnDate = returnDate;
        }
        
        console.log(`✈️ フライト検索: ${origin} → ${destination} (${departureDate})`);
        
        const response = await axios.get(
            AMADEUS_CONFIG.base_url + AMADEUS_CONFIG.endpoints.flight_offers,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                params: params
            }
        );
        
        return {
            success: true,
            data: response.data,
            count: response.data.data?.length || 0
        };
        
    } catch (error) {
        console.error('❌ フライト検索エラー:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.errors || error.message,
            message: 'フライト検索に失敗しました'
        };
    }
}

// 人気目的地検索（ダイビング向け）
async function getFlightInspiration(origin) {
    try {
        const token = await getAmadeusToken();
        
        console.log(`🌴 人気目的地検索: ${origin}から`);
        
        const response = await axios.get(
            AMADEUS_CONFIG.base_url + AMADEUS_CONFIG.endpoints.flight_inspiration,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    origin: origin,
                    maxPrice: 100000  // 最大料金10万円
                }
            }
        );
        
        return {
            success: true,
            data: response.data,
            count: response.data.data?.length || 0
        };
        
    } catch (error) {
        console.error('❌ 人気目的地検索エラー:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.errors || error.message,
            message: '人気目的地検索に失敗しました'
        };
    }
}

// ===== 航空券API エンドポイント =====

// フライト検索API
app.get('/api/flights/search', async (req, res) => {
    try {
        const { origin, destination, departure, return: returnDate, adults = 1 } = req.query;
        
        // 必須パラメータチェック
        if (!origin || !destination || !departure) {
            return res.status(400).json({
                success: false,
                error: 'missing_parameters',
                message: '出発地、目的地、出発日が必要です',
                required: ['origin', 'destination', 'departure']
            });
        }
        
        console.log(`🛫 航空券検索API: ${origin} → ${destination}`);
        
        // 空港コード変換（日本語対応）
        const originCode = AIRPORT_CODES[origin.toLowerCase()] || origin.toUpperCase();
        const destinationCode = AIRPORT_CODES[destination.toLowerCase()] || destination.toUpperCase();
        
        const result = await searchFlights(originCode, destinationCode, departure, returnDate, parseInt(adults));
        
        if (result.success) {
            res.json({
                success: true,
                search_params: {
                    origin: originCode,
                    destination: destinationCode,
                    departure: departure,
                    return: returnDate,
                    adults: adults
                },
                flights: result.data.data || [],
                count: result.count,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('❌ フライト検索APIエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'フライト検索でエラーが発生しました'
        });
    }
});

// 沖縄エリア特化フライト検索
app.get('/api/flights/okinawa/:area', async (req, res) => {
    try {
        const { area } = req.params;
        const { origin = 'haneda', departure, return: returnDate, adults = 1 } = req.query;
        
        // エリア別目的地設定
        const destinations = {
            naha: 'OKA',
            ishigaki: 'ISG', 
            miyako: 'MMY',
            kerama: 'OKA',  // 慶良間は那覇経由
            kume: 'OKA'     // 久米島は那覇経由
        };
        
        const destinationCode = destinations[area.toLowerCase()];
        if (!destinationCode) {
            return res.status(400).json({
                success: false,
                error: 'invalid_area',
                message: '対応していないエリアです',
                available_areas: Object.keys(destinations)
            });
        }
        
        if (!departure) {
            return res.status(400).json({
                success: false,
                error: 'missing_departure',
                message: '出発日が必要です'
            });
        }
        
        console.log(`🏝️ 沖縄${area}エリア フライト検索`);
        
        const originCode = AIRPORT_CODES[origin.toLowerCase()] || origin.toUpperCase();
        const result = await searchFlights(originCode, destinationCode, departure, returnDate, parseInt(adults));
        
        if (result.success) {
            res.json({
                success: true,
                area: area,
                search_params: {
                    origin: originCode,
                    destination: destinationCode,
                    departure: departure,
                    return: returnDate,
                    adults: adults
                },
                flights: result.data.data || [],
                count: result.count,
                diving_info: getDivingAreaInfo(area),
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('❌ 沖縄フライト検索APIエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '沖縄フライト検索でエラーが発生しました'
        });
    }
});

// 人気目的地API
app.get('/api/flights/destinations/:origin', async (req, res) => {
    try {
        const { origin } = req.params;
        
        console.log(`🌴 人気目的地API: ${origin}から`);
        
        const originCode = AIRPORT_CODES[origin.toLowerCase()] || origin.toUpperCase();
        const result = await getFlightInspiration(originCode);
        
        if (result.success) {
            res.json({
                success: true,
                origin: originCode,
                destinations: result.data.data || [],
                count: result.count,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('❌ 人気目的地APIエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '人気目的地検索でエラーが発生しました'
        });
    }
});

// ダイビングエリア情報取得
function getDivingAreaInfo(area) {
    const areaInfo = {
        naha: {
            name: '那覇・本島南部',
            diving_sites: ['慶良間諸島', 'チービシ', 'ナガンヌ島'],
            season: '通年',
            level: '初心者〜上級者',
            access: '那覇空港から車で30分〜1時間'
        },
        ishigaki: {
            name: '石垣島',
            diving_sites: ['川平石崎', 'マンタシティ', '大崎ハナゴイリーフ'],
            season: '通年（3-10月がベスト）',
            level: '中級者〜上級者',
            access: '石垣空港から車で30分〜1時間'
        },
        miyako: {
            name: '宮古島',
            diving_sites: ['魔王の宮殿', '通り池', '伊良部大橋下'],
            season: '3-11月',
            level: '中級者〜上級者',
            access: '宮古空港から車で20分〜40分'
        },
        kerama: {
            name: '慶良間諸島',
            diving_sites: ['座間味島', '阿嘉島', '渡嘉敷島'],
            season: '通年',
            level: '初心者〜上級者',
            access: '那覇空港→泊港→フェリー（35分〜1時間）'
        },
        kume: {
            name: '久米島',
            diving_sites: ['ハテの浜', 'トンバラ', 'イマズニ'],
            season: '通年',
            level: '初心者〜上級者',
            access: '那覇空港→久米島空港（35分）'
        }
    };
    
    return areaInfo[area.toLowerCase()] || null;
}

// ===== 404ハンドリング =====
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: '管理画面専用モードです',
        available_endpoints: [
            '/',
            '/admin/dashboard',
            '/admin/blog-editor', 
            '/admin/blog-list',
            '/shops-database',
            '/travel-guide/flights',
            '/member',
            '/member/register',
            '/member/review-post',
            '/api/shops',
            '/api/weather/forecast/:area',
            '/api/weather/marine/:area',
            '/api/weather/diving-condition/:area',
            '/api/weather/statistics/:type',
            '/api/weather/alerts/:type',
            '/api/flights/search',
            '/api/flights/okinawa/:area',
            '/api/flights/destinations/:origin',
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