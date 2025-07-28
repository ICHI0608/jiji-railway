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

// LINE Login設定
const LINE_LOGIN_CONFIG = {
    channel_id: process.env.LINE_LOGIN_CHANNEL_ID,
    channel_secret: process.env.LINE_LOGIN_CHANNEL_SECRET,
    callback_url: process.env.LINE_LOGIN_CALLBACK_URL || 'https://dive-buddys.com/auth/line/callback',
    base_url: 'https://access.line.me/oauth2/v2.1/authorize',
    token_url: 'https://api.line.me/oauth2/v2.1/token',
    profile_url: 'https://api.line.me/v2/profile'
};

console.log('🔍 環境変数デバッグ:');
console.log('SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
console.log('SUPABASE_ANON_KEY:', supabaseKey ? `設定済み(${supabaseKey.length}文字)` : '未設定');
console.log('LINE_LOGIN_CHANNEL_ID:', LINE_LOGIN_CONFIG.channel_id ? '設定済み' : '未設定');
console.log('LINE_LOGIN_CHANNEL_SECRET:', LINE_LOGIN_CONFIG.channel_secret ? '設定済み' : '未設定');

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

const app = express();
const PORT = process.env.PORT || 3000;

// 非同期でSupabase初期化（エラー時もサーバー継続）
initializeSupabase().then(result => {
    console.log(`🔗 Supabase状態: ${result.status}`);
}).catch(error => {
    console.error('⚠️ Supabase初期化でエラー（サーバーは継続）:', error.message);
    supabaseStatus = 'initialization_error';
});

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

// Google Maps API設定
const GOOGLE_MAPS_CONFIG = {
    api_key: process.env.GOOGLE_MAPS_API_KEY,
    endpoints: {
        directions: 'https://maps.googleapis.com/maps/api/directions/json',
        places: 'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
        geocoding: 'https://maps.googleapis.com/maps/api/geocode/json',
        distance_matrix: 'https://maps.googleapis.com/maps/api/distancematrix/json'
    }
};

// 沖縄交通データ
const OKINAWA_TRANSPORT_DATA = {
    airports: {
        naha: { name: '那覇空港', lat: 26.1958, lng: 127.6458, code: 'OKA' },
        ishigaki: { name: '新石垣空港', lat: 24.3968, lng: 124.2449, code: 'ISG' },
        miyako: { name: '宮古空港', lat: 24.7828, lng: 125.2950, code: 'MMY' },
        kumejima: { name: '久米島空港', lat: 26.3633, lng: 126.7139, code: 'UEO' }
    },
    
    bus_companies: {
        okinawa_main: [
            { name: '沖縄バス', routes: ['名護・本部・今帰仁方面', '中部・北谷方面'], website: 'https://okinawabus.com/' },
            { name: '琉球バス', routes: ['糸満・豊見城方面', '南城・知念方面'], website: 'https://ryukyubus.jp/' },
            { name: '那覇バス', routes: ['首里・浦添方面', '西原・中城方面'], website: 'https://nahabus.jp/' },
            { name: '東陽バス', routes: ['与那原・南風原方面', '八重瀬方面'], website: 'https://toyobus.jp/' }
        ],
        ishigaki: [
            { name: '東運輸', routes: ['市内循環', '川平・御神崎方面'], website: 'https://azumabus.co.jp/' },
            { name: 'カリー観光', routes: ['空港連絡バス', '観光地周遊'], website: 'https://karrykanko.co.jp/' }
        ],
        miyako: [
            { name: '宮古協栄バス', routes: ['市内路線', '各地区路線'], website: 'https://miyakokyoei-bus.co.jp/' },
            { name: '中央交通', routes: ['空港線', '観光路線'], website: 'https://miyako-kotsu.co.jp/' }
        ]
    },
    
    rental_car_companies: [
        { name: 'オリックスレンタカー', locations: ['那覇空港', '石垣空港', '宮古空港'], price_range: '3000-8000円/日' },
        { name: 'トヨタレンタカー', locations: ['那覇空港', '石垣空港', '宮古空港'], price_range: '3500-9000円/日' },
        { name: 'ニッポンレンタカー', locations: ['那覇空港', '石垣空港', '宮古空港'], price_range: '3200-8500円/日' },
        { name: 'スカイレンタカー', locations: ['那覇空港', '石垣空港', '宮古空港'], price_range: '2500-6000円/日' },
        { name: 'OTSレンタカー', locations: ['沖縄全域'], price_range: '2800-7000円/日', note: '沖縄地元企業' }
    ],
    
    ferry_routes: [
        { name: '泊港⇔座間味島', company: '座間味村営船', duration: '50分', frequency: '1日2-3便', price: '往復4,750円' },
        { name: '泊港⇔渡嘉敷島', company: '渡嘉敷村営船', duration: '35分', frequency: '1日2-3便', price: '往復4,160円' },
        { name: '泊港⇔阿嘉島', company: '座間味村営船', duration: '50分', frequency: '1日1-2便', price: '往復4,750円' },
        { name: '那覇空港⇔久米島空港', company: 'JAC・ANA', duration: '35分', frequency: '1日6-8便', price: '往復15,000-25,000円' },
        { name: '石垣港⇔竹富島', company: '安栄観光・八重山観光', duration: '15分', frequency: '1日20便以上', price: '往復1,540円' },
        { name: '石垣港⇔西表島', company: '安栄観光・八重山観光', duration: '40分', frequency: '1日10便以上', price: '往復2,060円' }
    ],
    
    diving_areas: {
        kerama: { transport: 'ferry', from: '泊港', duration: '35-50分', best_access: 'レンタカー→泊港' },
        kume: { transport: 'plane', from: '那覇空港', duration: '35分', best_access: 'レンタカー→那覇空港' },
        ishigaki_manta: { transport: 'boat', from: '石垣港', duration: '60分', best_access: 'レンタカー→石垣港' },
        miyako_caves: { transport: 'boat', from: '平良港', duration: '30分', best_access: 'レンタカー→平良港' }
    }
};

// 基本設定
app.use(express.json());
app.use(express.static('public'));

// シンプルなセッション管理（本番では express-session 推奨）
app.use((req, res, next) => {
    if (!req.session) {
        req.session = {};
    }
    next();
});

// 全リクエストログ（デバッグ用）
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url} - IP: ${req.ip}`);
    next();
});

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

// 交通ルート検索ページ
app.get('/travel-guide/transport', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/travel-guide/transport.html'));
});

// 費用シミュレーター
app.get('/travel-guide/cost-simulator', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/travel-guide/cost-simulator.html'));
});

// 宿泊施設検索ページ
app.get('/travel-guide/accommodation', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/travel-guide/accommodation.html'));
});

// 旅行費用シミュレーターページ
app.get('/travel-guide/cost-simulator', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/travel-guide/cost-simulator.html'));
});

// ブログメインページ
app.get('/blog', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/blog/index.html'));
});

// ブログ記事詳細ページ
app.get('/blog/:id', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/blog/article.html'));
});

// 会員マイページ
app.get('/member', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/index.html'));
});

// 会員ログインページ
app.get('/member/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/login.html'));
});

// 会員ダッシュボード
app.get('/member/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/dashboard.html'));
});

// 会員プロフィール編集
app.get('/member/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/profile.html'));
});

// 会員登録ページ（本番: https://dive-buddys.com で提供中）

// 口コミ投稿ページ
app.get('/member/review-post', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/review-post.html'));
});

// ショップ向けページ
app.get('/partners', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/partners.html'));
});

// ショップ管理ダッシュボード
app.get('/partners/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/partners/dashboard.html'));
});

// ショップ広告管理ページ
app.get('/partners/advertising', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/partners/advertising.html'));
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
        
        // フォールバック: 20記事の充実したサンプルデータ + メモリデータ
        const sampleArticles = [
            {
                id: 'ishigaki_manta_guide',
                title: '石垣島マンタポイント完全攻略ガイド 2025年版',
                excerpt: '石垣島の川平石崎マンタスクランブル、マンタシティなど主要マンタポイントの詳細情報と遭遇率を高めるコツを地元ガイドが解説します。',
                category: 'diving_spots',
                tags: ['石垣島', 'マンタ', 'ダイビングポイント', '攻略ガイド'],
                status: 'published',
                author: '石垣島ダイビングガイド協会',
                published_at: '2025-07-28T10:00:00Z',
                created_at: '2025-07-28T09:00:00Z',
                updated_at: '2025-07-28T10:00:00Z',
                featured: true,
                views: 2150,
                featured_image: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&q=80'
            },
            {
                id: 'miyako_blue_cave',
                title: '宮古島「青の洞窟」完全ガイド：幻想的な海中世界への招待',
                excerpt: '宮古島の隠れた名所「青の洞窟」の魅力と安全なダイビング方法を詳しく解説。神秘的な青い光の世界を体験しましょう。',
                category: 'diving_spots',
                tags: ['宮古島', '青の洞窟', '地形ダイビング', '洞窟'],
                status: 'published',
                author: '宮古島ダイビング協会',
                published_at: '2025-07-27T14:00:00Z',
                created_at: '2025-07-27T13:00:00Z',
                updated_at: '2025-07-27T14:00:00Z',
                featured: false,
                views: 1680,
                featured_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            },
            {
                id: 'kerama_turtle_diving',
                title: '慶良間諸島でウミガメと泳ぐ：遭遇率90%の秘密スポット',
                excerpt: '慶良間諸島でのウミガメダイビングの魅力と高確率で遭遇できるポイントを現地ガイドが詳しく解説。ウミガメとの正しい接し方も紹介します。',
                category: 'diving_spots',
                tags: ['慶良間諸島', 'ウミガメ', 'ケラマブルー', '座間味島'],
                status: 'published',
                author: '慶良間ダイビングガイド連盟',
                published_at: '2025-07-26T16:00:00Z',
                created_at: '2025-07-26T15:00:00Z',
                updated_at: '2025-07-26T16:00:00Z',
                featured: false,
                views: 1420,
                featured_image: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&q=80'
            },
            {
                id: 'okinawa_beginner_complete',
                title: '沖縄ダイビング初心者完全マニュアル：ライセンス取得から楽しみ方まで',
                excerpt: '沖縄でダイビングを始めたい方必見！ライセンス取得の流れ、必要な装備、おすすめポイント、予算まで初心者が知りたい情報を完全網羅。',
                category: 'beginner_guide',
                tags: ['初心者', 'ライセンス取得', '沖縄', '基礎知識'],
                status: 'published',
                author: '沖縄ダイビング指導員連盟',
                published_at: '2025-07-25T11:00:00Z',
                created_at: '2025-07-25T10:00:00Z',
                updated_at: '2025-07-25T11:00:00Z',
                featured: false,
                views: 1890,
                featured_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            },
            {
                id: 'ishigaki_equipment_guide',
                title: '石垣島ダイビングに最適な器材選び：現地ガイドが教える完璧装備',
                excerpt: '石垣島の海況に最適化された器材選びと、レンタル vs 購入の判断基準を現地ガイドが詳しく解説します。',
                category: 'equipment',
                tags: ['石垣島', '器材', '装備', '選び方'],
                status: 'published',
                author: '石垣島器材専門ガイド',
                published_at: '2025-07-24T09:00:00Z',
                created_at: '2025-07-24T08:00:00Z',
                updated_at: '2025-07-24T09:00:00Z',
                featured: false,
                views: 1340,
                featured_image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80'
            },
            {
                id: 'okinawa_coral_guide',
                title: '沖縄のサンゴ礁完全図鑑：ダイバーが知るべき30種類',
                excerpt: '沖縄の海で出会える美しいサンゴ30種類を写真付きで詳しく解説。サンゴの見分け方と保護の重要性も紹介します。',
                category: 'marine_life',
                tags: ['サンゴ', '海洋生物', '図鑑', '保護'],
                status: 'published',
                author: '沖縄海洋生物研究所',
                published_at: '2025-07-23T15:00:00Z',
                created_at: '2025-07-23T14:00:00Z',
                updated_at: '2025-07-23T15:00:00Z',
                featured: false,
                views: 2240,
                featured_image: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&q=80'
            },
            {
                id: 'okinawa_fish_guide',
                title: '沖縄の熱帯魚図鑑：カクレクマノミから大型魚まで50種',
                excerpt: '沖縄の海で出会える色とりどりの熱帯魚50種類を詳しく解説。魚の見分け方、観察ポイント、撮影のコツも紹介します。',
                category: 'marine_life',
                tags: ['熱帯魚', '魚類', '図鑑', '観察'],
                status: 'published',
                author: '沖縄海洋生物研究所',
                published_at: '2025-07-22T12:00:00Z',
                created_at: '2025-07-22T11:00:00Z',
                updated_at: '2025-07-22T12:00:00Z',
                featured: false,
                views: 1750,
                featured_image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80'
            },
            {
                id: 'winter_diving_okinawa',
                title: '沖縄の冬ダイビング：12月〜3月の海の魅力と注意点',
                excerpt: '冬の沖縄ダイビングの魅力を詳しく解説。透明度抜群の海、ホエールウォッチング、適切な装備選びまで完全ガイド。',
                category: 'beginner_guide',
                tags: ['冬ダイビング', '沖縄', '季節', 'ホエールウォッチング'],
                status: 'published',
                author: '沖縄ダイビングガイド連盟',
                published_at: '2025-07-21T08:00:00Z',
                created_at: '2025-07-21T07:00:00Z',
                updated_at: '2025-07-21T08:00:00Z',
                featured: false,
                views: 980,
                featured_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            },
            {
                id: 'underwater_photography',
                title: '沖縄水中写真完全マスター：カメラ選びから撮影テクニックまで',
                excerpt: '沖縄の美しい海での水中写真撮影を完全マスター。カメラ選び、設定、構図、ライティングまで詳しく解説します。',
                category: 'equipment',
                tags: ['水中写真', 'カメラ', '撮影技術', 'ライティング'],
                status: 'published',
                author: '水中写真家協会',
                published_at: '2025-07-20T13:00:00Z',
                created_at: '2025-07-20T12:00:00Z',
                updated_at: '2025-07-20T13:00:00Z',
                featured: false,
                views: 1560,
                featured_image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80'
            },
            {
                id: 'safety_diving_guide',
                title: 'ダイビング安全マニュアル：事故を防ぐための完全ガイド',
                excerpt: 'ダイビングの安全知識を完全網羅。潜水計画、バディシステム、緊急時対応、機材点検まで安全ダイビングの全てを解説。',
                category: 'safety',
                tags: ['安全', '事故防止', '緊急対応', 'バディシステム'],
                status: 'published',
                author: 'ダイビング安全協会',
                published_at: '2025-07-19T10:00:00Z',
                created_at: '2025-07-19T09:00:00Z',
                updated_at: '2025-07-19T10:00:00Z',
                featured: true,
                views: 2890,
                featured_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            },
            {
                id: 'okinawa_travel_guide',
                title: '沖縄ダイビング旅行完全プランニング：予算から宿泊まで',
                excerpt: '沖縄ダイビング旅行の計画を完全サポート。航空券選び、宿泊施設、ダイビングショップ選択、予算管理まで詳しく解説。',
                category: 'travel_tips',
                tags: ['旅行計画', '予算', '宿泊', '航空券'],
                status: 'published',
                author: '沖縄旅行プランナー',
                published_at: '2025-07-18T14:00:00Z',
                created_at: '2025-07-18T13:00:00Z',
                updated_at: '2025-07-18T14:00:00Z',
                featured: false,
                views: 1230,
                featured_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            },
            {
                id: 'night_diving_okinawa',
                title: '沖縄ナイトダイビング：夜の海で出会える神秘的な生物たち',
                excerpt: '沖縄のナイトダイビングの魅力を詳しく解説。夜行性生物、蛍光サンゴ、安全な潜り方、必要な装備まで完全ガイド。',
                category: 'diving_spots',
                tags: ['ナイトダイビング', '夜行性生物', '蛍光', '沖縄'],
                status: 'published',
                author: 'ナイトダイビング専門ガイド',
                published_at: '2025-07-17T16:00:00Z',
                created_at: '2025-07-17T15:00:00Z',
                updated_at: '2025-07-17T16:00:00Z',
                featured: false,
                views: 1450,
                featured_image: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&q=80'
            },
            {
                id: 'okinawa_beginner_course',
                title: '沖縄ダイビングライセンス取得コース比較：PADI vs NAUI vs SSI',
                excerpt: '沖縄で取得できる主要ダイビングライセンスを徹底比較。PADI、NAUI、SSIの特徴、費用、取得期間を詳しく解説。',
                category: 'beginner_guide',
                tags: ['ライセンス', 'PADI', 'NAUI', 'SSI'],
                status: 'published',
                author: 'ダイビングインストラクター協会',
                published_at: '2025-07-16T11:00:00Z',
                created_at: '2025-07-16T10:00:00Z',
                updated_at: '2025-07-16T11:00:00Z',
                featured: false,
                views: 2100,
                featured_image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80'
            },
            {
                id: 'macro_diving_okinawa',
                title: '沖縄マクロダイビング：小さな生物の大きな魅力',
                excerpt: '沖縄のマクロダイビングスポットと撮影テクニックを詳しく解説。ウミウシ、エビ、カニなど小さな生物の観察方法を紹介。',
                category: 'marine_life',
                tags: ['マクロダイビング', 'ウミウシ', '小型生物', '撮影'],
                status: 'published',
                author: 'マクロ撮影専門家',
                published_at: '2025-07-15T09:00:00Z',
                created_at: '2025-07-15T08:00:00Z',
                updated_at: '2025-07-15T09:00:00Z',
                featured: false,
                views: 870,
                featured_image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=800&q=80'
            },
            {
                id: 'drift_diving_okinawa',
                title: 'ドリフトダイビング入門：沖縄の流れを楽しむ技術',
                excerpt: '沖縄のドリフトダイビングの基本技術と安全知識を詳しく解説。流れに乗った快適なダイビングを楽しむコツを紹介します。',
                category: 'safety',
                tags: ['ドリフトダイビング', '流れ', '技術', '安全'],
                status: 'published',
                author: 'ドリフトダイビング指導員',
                published_at: '2025-07-14T15:00:00Z',
                created_at: '2025-07-14T14:00:00Z',
                updated_at: '2025-07-14T15:00:00Z',
                featured: false,
                views: 690,
                featured_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            },
            {
                id: 'okinawa_budget_diving',
                title: '沖縄格安ダイビング：予算を抑えて楽しむ完全ガイド',
                excerpt: '予算を抑えて沖縄ダイビングを楽しむ方法を詳しく解説。格安ツアー、宿泊、器材レンタルの賢い選び方を紹介します。',
                category: 'travel_tips',
                tags: ['格安', '予算', '節約', 'コスパ'],
                status: 'published',
                author: '格安旅行プランナー',
                published_at: '2025-07-13T12:00:00Z',
                created_at: '2025-07-13T11:00:00Z',
                updated_at: '2025-07-13T12:00:00Z',
                featured: false,
                views: 1680,
                featured_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            },
            {
                id: 'wreck_diving_okinawa',
                title: '沖縄沈船ダイビング：歴史と冒険のアンダーウォーター',
                excerpt: '沖縄周辺の沈船ダイビングスポットを詳しく解説。歴史的背景、安全な探索方法、見どころを紹介します。',
                category: 'diving_spots',
                tags: ['沈船', '歴史', '冒険', '探索'],
                status: 'published',
                author: '沈船ダイビング専門ガイド',
                published_at: '2025-07-12T10:00:00Z',
                created_at: '2025-07-12T09:00:00Z',
                updated_at: '2025-07-12T10:00:00Z',
                featured: false,
                views: 920,
                featured_image: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800&q=80'
            },
            {
                id: 'advanced_diving_skills',
                title: 'ダイビングスキルアップ講座：中級者から上級者への道',
                excerpt: '中級ダイバーが上級者になるためのスキルアップ方法を詳しく解説。浮力コントロール、ナビゲーション、レスキュー技術など。',
                category: 'safety',
                tags: ['スキルアップ', '中級者', '上級者', '技術向上'],
                status: 'published',
                author: 'ダイビング技術指導員',
                published_at: '2025-07-11T14:00:00Z',
                created_at: '2025-07-11T13:00:00Z',
                updated_at: '2025-07-11T14:00:00Z',
                featured: false,
                views: 1120,
                featured_image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80'
            },
            {
                id: 'okinawa_group_diving',
                title: '沖縄グループダイビング：仲間と楽しむ海の思い出作り',
                excerpt: '友人や家族と沖縄でグループダイビングを楽しむための完全ガイド。計画の立て方、ショップ選び、注意点を詳しく解説。',
                category: 'travel_tips',
                tags: ['グループダイビング', '仲間', '家族', '思い出'],
                status: 'published',
                author: 'グループツアープランナー',
                published_at: '2025-07-10T16:00:00Z',
                created_at: '2025-07-10T15:00:00Z',
                updated_at: '2025-07-10T16:00:00Z',
                featured: false,
                views: 750,
                featured_image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            },
            {
                id: 'diving_health_fitness',
                title: 'ダイビングのための体作り：健康管理とフィットネス',
                excerpt: 'ダイビングを安全に楽しむための体作りと健康管理を詳しく解説。適切な体調管理、トレーニング方法、健康チェックなど。',
                category: 'safety',
                tags: ['健康管理', 'フィットネス', '体作り', '安全'],
                status: 'published',
                author: 'ダイビングメディカル協会',
                published_at: '2025-07-09T11:00:00Z',
                created_at: '2025-07-09T10:00:00Z',
                updated_at: '2025-07-09T11:00:00Z',
                featured: false,
                views: 1340,
                featured_image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80'
            },
            {
                id: 'article_001',
                title: '石垣島のマンタポイント完全ガイド',
                excerpt: '石垣島の代表的なダイビングスポット、マンタポイントの攻略法を詳しく解説。',
                category: 'diving_spots',
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

// 記事詳細取得API
app.get('/api/blog/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data: article, error } = await supabase
                    .from('blogs')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (!error && article) {
                    console.log('📄 記事詳細取得成功（Supabase）:', article.id);
                    return res.json({
                        success: true,
                        article: article,
                        source: 'supabase'
                    });
                }
            } catch (supabaseError) {
                console.warn('Supabase記事詳細取得エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: サンプルデータ + メモリデータ
        const allArticles = [
            {
                id: 'article_001',
                title: '石垣島のマンタポイント完全ガイド',
                excerpt: '石垣島の代表的なダイビングスポット、マンタポイントの攻略法を詳しく解説。',
                content: `# 石垣島のマンタポイント完全ガイド

石垣島周辺には世界屈指のマンタポイントが点在しています。この記事では、マンタとの遭遇率を高めるためのポイント選びと、ダイビングのコツを詳しく解説します。

## 主要マンタポイント

### 1. 川平石崎マンタスクランブル
- **遭遇率**: 85%以上
- **ベストシーズン**: 4月〜11月
- **水深**: 15-20m

### 2. マンタシティポイント
- **遭遇率**: 70%
- **特徴**: クリーニングステーション
- **水深**: 10-15m

## マンタとの遭遇のコツ

1. **早朝ダイビング**: マンタは朝の活動が活発
2. **クリーニングステーション**: マンタが掃除される場所
3. **潮回り**: 大潮前後がベスト

## 注意事項

- マンタには触れない
- フラッシュ撮影禁止
- 急な動きは避ける`,
                category: 'diving_spots',
                tags: ['石垣島', 'マンタ', 'ダイビングポイント'],
                status: 'published',
                author: 'Jiji編集部',
                published_at: '2025-07-25T10:00:00Z',
                created_at: '2025-07-25T09:00:00Z',
                updated_at: '2025-07-25T10:00:00Z',
                featured: true,
                views: 1245,
                featured_image: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800'
            },
            {
                id: 'article_002',
                title: '初心者必見！沖縄ダイビングの基礎知識',
                excerpt: 'ダイビング初心者が沖縄で安全に楽しむための基礎知識をまとめました。',
                content: `# 初心者必見！沖縄ダイビングの基礎知識

沖縄でのダイビングを安全に楽しむための基礎知識をご紹介します。

## ダイビングライセンスについて

### 必要なライセンス
- **体験ダイビング**: ライセンス不要
- **ファンダイビング**: オープンウォーター以上

### おすすめ取得コース
1. オープンウォーターダイバー
2. アドバンスオープンウォーター
3. レスキューダイバー

## 沖縄の海の特徴

### 水温
- 夏期: 28-30°C
- 冬期: 22-24°C

### 透明度
- 平均: 25-30m
- 最高: 40m以上

## 必須装備

1. **ウェットスーツ**: 5mm推奨
2. **マスク・フィン**: 自分用を用意
3. **ダイビングコンピューター**: 安全管理必須`,
                category: 'beginner_guide',
                tags: ['初心者', '基礎知識', 'ライセンス'],
                status: 'published',
                author: 'ダイビングインストラクター田中',
                published_at: '2025-07-24T14:00:00Z',
                created_at: '2025-07-24T13:00:00Z',
                updated_at: '2025-07-24T14:00:00Z',
                featured: false,
                views: 856,
                featured_image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800'
            }
        ];
        
        // メモリデータからも検索
        if (global.tempArticles) {
            allArticles.push(...global.tempArticles);
        }
        
        const article = allArticles.find(a => a.id === id);
        
        if (article) {
            console.log('📄 記事詳細取得成功（フォールバック）:', article.id);
            res.json({
                success: true,
                article: article,
                source: 'fallback'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Article not found',
                message: '指定された記事が見つかりません'
            });
        }
        
    } catch (error) {
        console.error('記事詳細取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'サーバーエラーが発生しました'
        });
    }
});

// 記事更新API
app.put('/api/blog/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, excerpt, content, category, tags, status } = req.body;
        
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'タイトルと内容は必須です'
            });
        }
        
        const updateData = {
            title,
            excerpt: excerpt || '',
            content,
            category: category || 'general',
            tags: Array.isArray(tags) ? tags : [],
            status: status || 'draft',
            updated_at: new Date().toISOString()
        };
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data: article, error } = await supabase
                    .from('blogs')
                    .update(updateData)
                    .eq('id', id)
                    .select()
                    .single();
                
                if (!error) {
                    console.log('📝 記事更新成功（Supabase）:', article);
                    return res.json({
                        success: true,
                        message: '記事が正常に更新されました（Supabase）',
                        data: article
                    });
                }
            } catch (supabaseError) {
                console.warn('Supabase更新エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: メモリデータ更新
        if (global.tempArticles) {
            const index = global.tempArticles.findIndex(a => a.id === id);
            if (index !== -1) {
                global.tempArticles[index] = { ...global.tempArticles[index], ...updateData };
                console.log('📝 記事更新成功（ローカル）:', global.tempArticles[index]);
                return res.json({
                    success: true,
                    message: '記事が正常に更新されました（ローカル）',
                    data: global.tempArticles[index]
                });
            }
        }
        
        res.status(404).json({
            success: false,
            error: 'Article not found',
            message: '指定された記事が見つかりません'
        });
        
    } catch (error) {
        console.error('記事更新API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'サーバーエラーが発生しました'
        });
    }
});

// 記事削除API
app.delete('/api/blog/articles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { error } = await supabase
                    .from('blogs')
                    .delete()
                    .eq('id', id);
                
                if (!error) {
                    console.log('🗑️ 記事削除成功（Supabase）:', id);
                    return res.json({
                        success: true,
                        message: '記事が正常に削除されました（Supabase）'
                    });
                }
            } catch (supabaseError) {
                console.warn('Supabase削除エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: メモリデータから削除
        if (global.tempArticles) {
            const index = global.tempArticles.findIndex(a => a.id === id);
            if (index !== -1) {
                global.tempArticles.splice(index, 1);
                console.log('🗑️ 記事削除成功（ローカル）:', id);
                return res.json({
                    success: true,
                    message: '記事が正常に削除されました（ローカル）'
                });
            }
        }
        
        res.status(404).json({
            success: false,
            error: 'Article not found',
            message: '指定された記事が見つかりません'
        });
        
    } catch (error) {
        console.error('記事削除API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'サーバーエラーが発生しました'
        });
    }
});

// カテゴリ一覧API
app.get('/api/blog/categories', async (req, res) => {
    try {
        const categories = [
            {
                id: 'diving_spots',
                name: 'ダイビングスポット',
                slug: 'diving-spots',
                description: '沖縄・離島の人気ダイビングスポット情報',
                count: 15,
                color: '#3B82F6'
            },
            {
                id: 'beginner_guide',
                name: '初心者ガイド',
                slug: 'beginner-guide', 
                description: 'ダイビング初心者向けガイド・基礎知識',
                count: 8,
                color: '#10B981'
            },
            {
                id: 'equipment',
                name: '器材・装備',
                slug: 'equipment',
                description: 'ダイビング器材・装備のレビュー・選び方',
                count: 12,
                color: '#F59E0B'
            },
            {
                id: 'marine_life',
                name: '海洋生物',
                slug: 'marine-life',
                description: '沖縄の海で出会える魚・サンゴ・生物図鑑',
                count: 23,
                color: '#8B5CF6'
            },
            {
                id: 'travel_tips',
                name: '旅行情報',
                slug: 'travel-tips',
                description: '沖縄旅行・ダイビング旅行の役立つ情報',
                count: 9,
                color: '#EF4444'
            },
            {
                id: 'safety',
                name: '安全・スキル',
                slug: 'safety',
                description: 'ダイビング安全知識・スキルアップ情報',
                count: 6,
                color: '#6B7280'
            }
        ];
        
        console.log('📂 カテゴリ一覧取得成功:', categories.length, '件');
        res.json({
            success: true,
            categories: categories,
            count: categories.length
        });
        
    } catch (error) {
        console.error('カテゴリ一覧API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'カテゴリ一覧の取得に失敗しました'
        });
    }
});

// タグ一覧API
app.get('/api/blog/tags', async (req, res) => {
    try {
        const tags = [
            { name: '石垣島', count: 8, color: '#3B82F6' },
            { name: '宮古島', count: 6, color: '#10B981' },
            { name: '慶良間', count: 5, color: '#F59E0B' },
            { name: 'マンタ', count: 4, color: '#8B5CF6' },
            { name: 'ジンベエザメ', count: 3, color: '#EF4444' },
            { name: '初心者', count: 7, color: '#6B7280' },
            { name: 'ライセンス', count: 5, color: '#EC4899' },
            { name: 'ウミガメ', count: 4, color: '#14B8A6' },
            { name: 'サンゴ', count: 6, color: '#F97316' },
            { name: '青の洞窟', count: 3, color: '#6366F1' }
        ];
        
        console.log('🏷️ タグ一覧取得成功:', tags.length, '件');
        res.json({
            success: true,
            tags: tags,
            count: tags.length
        });
        
    } catch (error) {
        console.error('タグ一覧API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'タグ一覧の取得に失敗しました'
        });
    }
});

// ===== ブログ検索・関連記事 高度機能 =====

// 関連度スコアリング関数
function calculateRelevanceScore(article, query) {
    if (!query || !article) return 0;
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 1);
    let score = 0;
    
    // タイトルマッチ（重要度最高）
    const titleLower = (article.title || '').toLowerCase();
    searchTerms.forEach(term => {
        if (titleLower.includes(term)) {
            score += titleLower === term ? 100 : 50; // 完全一致は最高点
        }
    });
    
    // 抜粋マッチ（重要度高）
    const excerptLower = (article.excerpt || '').toLowerCase();
    searchTerms.forEach(term => {
        if (excerptLower.includes(term)) {
            score += 30;
        }
    });
    
    // コンテンツマッチ（重要度中）
    const contentLower = (article.content || '').toLowerCase();
    searchTerms.forEach(term => {
        if (contentLower.includes(term)) {
            const occurrences = (contentLower.match(new RegExp(term, 'g')) || []).length;
            score += Math.min(occurrences * 10, 50); // 最大50点
        }
    });
    
    // タグマッチ（重要度高）
    if (article.tags && Array.isArray(article.tags)) {
        const tagsLower = article.tags.map(tag => tag.toLowerCase());
        searchTerms.forEach(term => {
            if (tagsLower.some(tag => tag.includes(term))) {
                score += 40;
            }
        });
    }
    
    // 人気度ボーナス（閲覧数）
    if (article.views && article.views > 1000) {
        score += Math.min(article.views / 1000, 20); // 最大20点のボーナス
    }
    
    // 新しさボーナス
    const publishDate = new Date(article.published_at || article.created_at);
    const daysSincePublish = (Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSincePublish < 30) {
        score += 10; // 1ヶ月以内は新しさボーナス
    }
    
    return Math.round(score);
}

// 関連記事取得アルゴリズム
function findRelatedArticles(targetArticle, allArticles, maxResults = 6) {
    if (!targetArticle || !allArticles || allArticles.length === 0) return [];
    
    const relatedScores = allArticles
        .filter(article => article.id !== targetArticle.id && article.status === 'published')
        .map(article => {
            let score = 0;
            
            // 同じカテゴリ（重要度最高）
            if (article.category === targetArticle.category) {
                score += 100;
            }
            
            // 共通タグ（重要度高）
            if (targetArticle.tags && article.tags) {
                const commonTags = targetArticle.tags.filter(tag => 
                    article.tags.includes(tag)
                );
                score += commonTags.length * 50;
            }
            
            // タイトルの類似性（重要度中）
            const titleSimilarity = calculateTextSimilarity(
                targetArticle.title || '', 
                article.title || ''
            );
            score += titleSimilarity * 30;
            
            // 内容の類似性（重要度低）
            const contentSimilarity = calculateTextSimilarity(
                targetArticle.excerpt || '', 
                article.excerpt || ''
            );
            score += contentSimilarity * 20;
            
            // 人気度ファクター
            if (article.views && article.views > 500) {
                score += Math.min(article.views / 500, 15);
            }
            
            return {
                ...article,
                relatedScore: Math.round(score)
            };
        })
        .sort((a, b) => b.relatedScore - a.relatedScore)
        .slice(0, maxResults);
    
    return relatedScores;
}

// テキスト類似性計算（簡易版）
function calculateTextSimilarity(text1, text2) {
    if (!text1 || !text2) return 0;
    
    const words1 = text1.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const words2 = text2.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word));
    const similarity = (commonWords.length * 2) / (words1.length + words2.length);
    
    return Math.min(similarity, 1);
}

// 高度検索アルゴリズム
function performAdvancedSearch(articles, query, options = {}) {
    if (!query || !articles) return articles;
    
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 1);
    
    // 部分検索とフレーズ検索の組み合わせ
    const searchResults = articles.filter(article => {
        // すべての検索語が含まれているかチェック
        const titleLower = (article.title || '').toLowerCase();
        const excerptLower = (article.excerpt || '').toLowerCase();
        const contentLower = (article.content || '').toLowerCase();
        const tagsLower = (article.tags || []).join(' ').toLowerCase();
        
        const fullText = `${titleLower} ${excerptLower} ${contentLower} ${tagsLower}`;
        
        if (options.exactPhrase) {
            return fullText.includes(query.toLowerCase());
        } else {
            return searchTerms.every(term => fullText.includes(term));
        }
    });
    
    // 関連度でソート
    return searchResults.map(article => ({
        ...article,
        relevanceScore: calculateRelevanceScore(article, query)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
}

// ブログ検索API
app.get('/api/blog/search', async (req, res) => {
    try {
        const { query, category, tag, status, limit = 10, offset = 0 } = req.query;
        
        console.log('🔍 ブログ検索:', { query, category, tag, status });
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                let supabaseQuery = supabase
                    .from('blogs')
                    .select('*');
                
                if (query) {
                    supabaseQuery = supabaseQuery.or(`title.ilike.%${query}%,content.ilike.%${query}%,excerpt.ilike.%${query}%,tags.cs.{${query}}`);
                }
                
                if (category) {
                    supabaseQuery = supabaseQuery.eq('category', category);
                }
                
                if (status) {
                    supabaseQuery = supabaseQuery.eq('status', status);
                }
                
                supabaseQuery = supabaseQuery
                    .order('created_at', { ascending: false })
                    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
                
                const { data: articles, error } = await supabaseQuery;
                
                if (!error) {
                    // Supabaseでも関連度スコアリングを適用
                    let scoredArticles = articles || [];
                    if (query) {
                        scoredArticles = scoredArticles.map(article => ({
                            ...article,
                            relevanceScore: calculateRelevanceScore(article, query)
                        })).sort((a, b) => b.relevanceScore - a.relevanceScore);
                    }
                    
                    console.log('🔍 ブログ検索成功（Supabase）:', scoredArticles.length, '件');
                    return res.json({
                        success: true,
                        articles: scoredArticles,
                        total: scoredArticles.length,
                        count: scoredArticles.length,
                        source: 'supabase'
                    });
                }
            } catch (supabaseError) {
                console.warn('Supabase検索エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: サンプルデータ + 高度検索
        let allArticles = [
            {
                id: 'article_001',
                title: '石垣島のマンタポイント完全ガイド',
                excerpt: '石垣島の代表的なダイビングスポット、マンタポイントの攻略法を詳しく解説。ベストシーズンや潮の流れ、遭遇確率まで詳細に紹介します。',
                content: '石垣島のマンタポイントは、石垣島の北部に位置する世界的に有名なダイビングスポットです...',
                category: 'diving_spots',
                tags: ['石垣島', 'マンタ', 'ダイビングポイント', '上級者', '大物'],
                status: 'published',
                author: 'Jiji編集部',
                views: 2150,
                featured: true,
                published_at: '2025-07-25T10:00:00Z',
                created_at: '2025-07-25T09:00:00Z'
            },
            {
                id: 'article_002',
                title: '初心者必見！沖縄ダイビングの基礎知識',
                excerpt: 'ダイビング初心者が沖縄で安全に楽しむための基礎知識をまとめました。',
                content: 'ダイビングを始めるには、まず基本的な知識と技術を身につけることが重要です...',
                category: 'beginner_guide',
                tags: ['初心者', '基礎知識', 'ライセンス', '安全', 'PADI'],
                status: 'published',
                author: 'ダイビングインストラクター田中',
                views: 1650,
                published_at: '2025-07-24T14:00:00Z',
                created_at: '2025-07-24T13:00:00Z'
            }
        ];
        
        // 20記事のデータを追加（BLOG-002で作成済み）
        if (global.tempArticles) {
            allArticles.push(...global.tempArticles);
        }
        
        // 基本フィルタリング（カテゴリ、ステータス、タグ）
        let filteredArticles = allArticles;
        
        if (category) {
            filteredArticles = filteredArticles.filter(article => article.category === category);
        }
        
        if (tag) {
            filteredArticles = filteredArticles.filter(article => 
                article.tags && article.tags.includes(tag)
            );
        }
        
        if (status) {
            filteredArticles = filteredArticles.filter(article => article.status === status);
        }
        
        // 高度検索アルゴリズム適用
        if (query) {
            filteredArticles = performAdvancedSearch(filteredArticles, query);
        } else {
            // クエリがない場合は人気度と新しさでソート
            filteredArticles = filteredArticles
                .map(article => ({
                    ...article,
                    relevanceScore: (article.views || 0) / 100 + (article.featured ? 50 : 0)
                }))
                .sort((a, b) => {
                    // 注目記事優先、次に人気度、最後に新しさ
                    if (a.featured && !b.featured) return -1;
                    if (!a.featured && b.featured) return 1;
                    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
                    return new Date(b.published_at || b.created_at) - new Date(a.published_at || a.created_at);
                });
        }
        
        // ページネーション
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        const paginatedArticles = filteredArticles.slice(startIndex, endIndex);
        
        console.log('🔍 ブログ検索成功（フォールバック）:', paginatedArticles.length, '/', filteredArticles.length, '件');
        res.json({
            success: true,
            articles: paginatedArticles,
            count: paginatedArticles.length,
            total: filteredArticles.length,
            source: 'fallback'
        });
        
    } catch (error) {
        console.error('ブログ検索API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'ブログ検索に失敗しました'
        });
    }
});

// 関連記事取得API
app.get('/api/blog/articles/:id/related', async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 6 } = req.query;
        
        console.log('🔗 関連記事取得:', { id, limit });
        
        // まず基準となる記事を取得
        let targetArticle = null;
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data: article, error } = await supabase
                    .from('blogs')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (!error && article) {
                    targetArticle = article;
                    
                    // 全記事を取得して関連記事を計算
                    const { data: allArticles, error: allError } = await supabase
                        .from('blogs')
                        .select('*')
                        .eq('status', 'published');
                    
                    if (!allError && allArticles) {
                        const relatedArticles = findRelatedArticles(targetArticle, allArticles, parseInt(limit));
                        
                        console.log('🔗 関連記事取得成功（Supabase）:', relatedArticles.length, '件');
                        return res.json({
                            success: true,
                            related_articles: relatedArticles,
                            count: relatedArticles.length,
                            source: 'supabase'
                        });
                    }
                }
            } catch (supabaseError) {
                console.warn('Supabase関連記事取得エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: サンプルデータから関連記事を取得
        let allArticles = [
            {
                id: 'article_001',
                title: '石垣島のマンタポイント完全ガイド',
                excerpt: '石垣島の代表的なダイビングスポット、マンタポイントの攻略法を詳しく解説。',
                category: 'diving_spots',
                tags: ['石垣島', 'マンタ', 'ダイビングポイント', '上級者', '大物'],
                status: 'published',
                author: 'Jiji編集部',
                views: 2150,
                featured: true,
                published_at: '2025-07-25T10:00:00Z',
                created_at: '2025-07-25T09:00:00Z'
            },
            {
                id: 'article_002',
                title: '初心者必見！沖縄ダイビングの基礎知識',
                excerpt: 'ダイビング初心者が沖縄で安全に楽しむための基礎知識をまとめました。',
                category: 'beginner_guide',
                tags: ['初心者', '基礎知識', 'ライセンス', '安全', 'PADI'],
                status: 'published',
                author: 'ダイビングインストラクター田中',
                views: 1650,
                published_at: '2025-07-24T14:00:00Z',
                created_at: '2025-07-24T13:00:00Z'
            }
        ];
        
        // 20記事のデータを追加
        if (global.tempArticles) {
            allArticles.push(...global.tempArticles);
        }
        
        // 基準記事を見つける
        targetArticle = allArticles.find(article => article.id === id);
        
        if (!targetArticle) {
            return res.status(404).json({
                success: false,
                error: 'Article not found',
                message: '指定された記事が見つかりません'
            });
        }
        
        // 関連記事を計算
        const relatedArticles = findRelatedArticles(targetArticle, allArticles, parseInt(limit));
        
        console.log('🔗 関連記事取得成功（フォールバック）:', relatedArticles.length, '件');
        res.json({
            success: true,
            related_articles: relatedArticles,
            count: relatedArticles.length,
            source: 'fallback'
        });
        
    } catch (error) {
        console.error('関連記事取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '関連記事の取得に失敗しました'
        });
    }
});

// ===== 宿泊施設検索API =====

// 宿泊施設検索API
app.get('/api/travel/accommodations/search', async (req, res) => {
    try {
        const { 
            location, 
            checkin, 
            checkout, 
            guests = 2, 
            diving_friendly = false,
            price_range = 'all',
            accommodation_type = 'all',
            limit = 20 
        } = req.query;
        
        console.log('🏨 宿泊施設検索:', { location, checkin, checkout, guests, diving_friendly });
        
        // 楽天トラベル API統合試行（実際のAPIキーが必要）
        let accommodations = [];
        
        try {
            // 楽天トラベル API（模擬実装）
            accommodations = await searchRakutenTravel({
                location,
                checkin,
                checkout,
                guests,
                diving_friendly,
                price_range,
                accommodation_type
            });
        } catch (apiError) {
            console.warn('楽天トラベルAPI接続エラー、フォールバックデータ使用:', apiError.message);
            
            // フォールバック: 沖縄ダイビング特化宿泊施設データ
            accommodations = getDivingFriendlyAccommodations({
                location,
                checkin,
                checkout,
                guests,
                diving_friendly,
                price_range,
                accommodation_type,
                limit
            });
        }
        
        console.log('🏨 宿泊施設検索完了:', accommodations.length, '件');
        res.json({
            success: true,
            accommodations: accommodations,
            count: accommodations.length,
            search_params: {
                location,
                checkin,
                checkout,
                guests,
                diving_friendly,
                price_range,
                accommodation_type
            }
        });
        
    } catch (error) {
        console.error('宿泊施設検索API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '宿泊施設の検索に失敗しました'
        });
    }
});

// 宿泊施設詳細取得API
app.get('/api/travel/accommodations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log('🏨 宿泊施設詳細取得:', id);
        
        // フォールバックデータから詳細を取得
        const accommodation = getAccommodationDetails(id);
        
        if (!accommodation) {
            return res.status(404).json({
                success: false,
                error: 'Accommodation not found',
                message: '指定された宿泊施設が見つかりません'
            });
        }
        
        console.log('🏨 宿泊施設詳細取得完了:', accommodation.name);
        res.json({
            success: true,
            accommodation: accommodation
        });
        
    } catch (error) {
        console.error('宿泊施設詳細取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '宿泊施設詳細の取得に失敗しました'
        });
    }
});

// 楽天トラベル API統合関数（模擬実装）
async function searchRakutenTravel(params) {
    // 実際の実装では楽天トラベル APIを呼び出し
    // const RAKUTEN_API_KEY = process.env.RAKUTEN_API_KEY;
    // const RAKUTEN_AFFILIATE_ID = process.env.RAKUTEN_AFFILIATE_ID;
    
    throw new Error('楽天トラベル API未設定（フォールバック使用）');
}

// ダイビング特化宿泊施設データ取得関数
function getDivingFriendlyAccommodations(params) {
    const allAccommodations = [
        {
            id: 'acc_001',
            name: '石垣島ダイバーズホテル',
            type: 'hotel',
            location: '石垣島',
            area: '石垣港周辺',
            rating: 4.5,
            review_count: 127,
            price_per_night: 12000,
            currency: 'JPY',
            diving_friendly: true,
            diving_features: ['器材レンタル', '器材洗い場', 'ボート送迎', 'ダイビングショップ併設'],
            images: [
                'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80',
                'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80'
            ],
            amenities: ['WiFi', 'エアコン', '冷蔵庫', 'バルコニー', '駐車場'],
            description: '石垣島のダイビングスポットまで徒歩5分。ダイバー専用の器材洗い場完備。',
            check_in_time: '15:00',
            check_out_time: '10:00',
            cancellation_policy: 'チェックイン3日前まで無料',
            coordinates: { lat: 24.3364, lng: 124.1564 },
            nearby_dive_sites: ['マンタポイント', '川平石崎', 'ビッグドロップオフ'],
            booking_url: '#',
            phone: '0980-82-1234'
        },
        {
            id: 'acc_002',
            name: '宮古島リゾート＆ダイビング',
            type: 'resort',
            location: '宮古島',
            area: '下地島空港周辺',
            rating: 4.8,
            review_count: 89,
            price_per_night: 18000,
            currency: 'JPY',
            diving_friendly: true,
            diving_features: ['自社ダイビングボート', 'PADI認定ショップ', '器材フルレンタル', 'ナイトダイビング対応'],
            images: [
                'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80',
                'https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80'
            ],
            amenities: ['WiFi', 'プール', 'スパ', 'レストラン', 'バー', '送迎サービス'],
            description: '宮古島の美しい海を一望できるリゾートホテル。自社ダイビングボートで快適なダイビング体験。',
            check_in_time: '14:00',
            check_out_time: '11:00',
            cancellation_policy: 'チェックイン7日前まで無料',
            coordinates: { lat: 24.7831, lng: 125.3701 },
            nearby_dive_sites: ['魔王の宮殿', '八重干瀬', 'アントニオガウディ'],
            booking_url: '#',
            phone: '0980-73-5678'
        },
        {
            id: 'acc_003',
            name: '慶良間ダイビングロッジ',
            type: 'lodge',
            location: '座間味島',
            area: '慶良間諸島',
            rating: 4.3,
            review_count: 156,
            price_per_night: 8500,
            currency: 'JPY',
            diving_friendly: true,
            diving_features: ['ビーチダイビング直結', '少人数制ガイド', '水中写真サービス', 'ナイトロックス対応'],
            images: [
                'https://images.unsplash.com/photo-1586611292717-f828b167408c?w=800&q=80',
                'https://images.unsplash.com/photo-1544725176-7c40e5a71c5e?w=800&q=80'
            ],
            amenities: ['WiFi', 'エアコン', '共有キッチン', 'BBQ設備', '自転車レンタル'],
            description: '慶良間ブルーを満喫できるダイバー専用ロッジ。ビーチから直接エントリー可能。',
            check_in_time: '15:00',
            check_out_time: '10:00',
            cancellation_policy: 'チェックイン2日前まで無料',
            coordinates: { lat: 26.2395, lng: 127.3058 },
            nearby_dive_sites: ['古座間味ビーチ', 'ニシハマ', '男岩・女岩'],
            booking_url: '#',
            phone: '098-987-3456'
        },
        {
            id: 'acc_004',
            name: '那覇シティホテル',
            type: 'hotel',
            location: '那覇市',
            area: '国際通り',
            rating: 4.1,
            review_count: 234,
            price_per_night: 9500,
            currency: 'JPY',
            diving_friendly: false,
            diving_features: [],
            images: [
                'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
                'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80'
            ],
            amenities: ['WiFi', 'エアコン', 'レストラン', 'コンビニ', '駐車場'],
            description: '那覇の中心地に位置するビジネスホテル。ダイビングショップへのアクセス良好。',
            check_in_time: '15:00',
            check_out_time: '11:00',
            cancellation_policy: 'チェックイン1日前まで無料',
            coordinates: { lat: 26.2124, lng: 127.6792 },
            nearby_dive_sites: ['チービシ', '那覇湾内', 'USSエモンズ'],
            booking_url: '#',
            phone: '098-862-7890'
        },
        {
            id: 'acc_005',
            name: '西表島エコロッジ',
            type: 'eco_lodge',
            location: '西表島',
            area: '上原港周辺',
            rating: 4.6,
            review_count: 72,
            price_per_night: 15000,
            currency: 'JPY',
            diving_friendly: true,
            diving_features: ['マングローブダイビング', '貸切ボート', 'エコツアー併設', '星空観察'],
            images: [
                'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80',
                'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80'
            ],
            amenities: ['WiFi', 'エアコン', '天然温泉', 'レストラン', '送迎サービス'],
            description: '西表島の大自然を満喫できるエコロッジ。マングローブダイビングが人気。',
            check_in_time: '14:00',
            check_out_time: '10:00',
            cancellation_policy: 'チェックイン5日前まで無料',
            coordinates: { lat: 24.3964, lng: 123.7661 },
            nearby_dive_sites: ['網取湾', 'バラス島', '鹿川湾'],
            booking_url: '#',
            phone: '0980-85-2345'
        }
    ];
    
    let filtered = allAccommodations;
    
    // 場所フィルター
    if (params.location) {
        filtered = filtered.filter(acc => 
            acc.location.includes(params.location) || 
            acc.area.includes(params.location)
        );
    }
    
    // ダイビング特化フィルター
    if (params.diving_friendly === 'true') {
        filtered = filtered.filter(acc => acc.diving_friendly);
    }
    
    // 価格帯フィルター
    if (params.price_range && params.price_range !== 'all') {
        const ranges = {
            'budget': [0, 10000],
            'mid': [10000, 20000],
            'luxury': [20000, 100000]
        };
        const [min, max] = ranges[params.price_range] || [0, 100000];
        filtered = filtered.filter(acc => acc.price_per_night >= min && acc.price_per_night <= max);
    }
    
    // 宿泊施設タイプフィルター
    if (params.accommodation_type && params.accommodation_type !== 'all') {
        filtered = filtered.filter(acc => acc.type === params.accommodation_type);
    }
    
    // ソート（ダイビング特化 > 評価 > 価格）
    filtered.sort((a, b) => {
        if (a.diving_friendly && !b.diving_friendly) return -1;
        if (!a.diving_friendly && b.diving_friendly) return 1;
        if (b.rating !== a.rating) return b.rating - a.rating;
        return a.price_per_night - b.price_per_night;
    });
    
    return filtered.slice(0, parseInt(params.limit));
}

// 宿泊施設詳細取得関数
function getAccommodationDetails(id) {
    const accommodations = getDivingFriendlyAccommodations({ limit: 100 });
    return accommodations.find(acc => acc.id === id);
}

// ===== 旅行費用シミュレーターAPI =====

// 旅行費用計算API
app.post('/api/travel/cost-simulator', async (req, res) => {
    try {
        const {
            destination,
            duration_days,
            travel_dates,
            participants,
            accommodation_level,
            diving_plan,
            meal_plan,
            transport_type
        } = req.body;
        
        console.log('💰 旅行費用計算:', { destination, duration_days, participants, diving_plan });
        
        // 旅行費用を計算
        const costBreakdown = calculateTravelCosts({
            destination,
            duration_days,
            travel_dates,
            participants,
            accommodation_level,
            diving_plan,
            meal_plan,
            transport_type
        });
        
        // 時期別料金比較
        const seasonalComparison = getSeasonalPricing(destination, travel_dates);
        
        // 節約提案
        const savingTips = generateSavingTips(costBreakdown, {
            destination,
            duration_days,
            participants,
            diving_plan
        });
        
        console.log('💰 旅行費用計算完了:', costBreakdown.total);
        res.json({
            success: true,
            cost_breakdown: costBreakdown,
            seasonal_comparison: seasonalComparison,
            saving_tips: savingTips,
            calculation_date: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('旅行費用計算API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '旅行費用の計算に失敗しました'
        });
    }
});

// 時期別料金比較API
app.get('/api/travel/seasonal-pricing/:destination', async (req, res) => {
    try {
        const { destination } = req.params;
        const { year = new Date().getFullYear() } = req.query;
        
        console.log('📅 時期別料金比較:', { destination, year });
        
        const seasonalData = getYearlySeasonalPricing(destination, parseInt(year));
        
        console.log('📅 時期別料金比較完了');
        res.json({
            success: true,
            destination: destination,
            year: parseInt(year),
            seasonal_data: seasonalData
        });
        
    } catch (error) {
        console.error('時期別料金比較API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '時期別料金の取得に失敗しました'
        });
    }
});

// 旅行費用計算メイン関数
function calculateTravelCosts(params) {
    const {
        destination,
        duration_days,
        travel_dates,
        participants,
        accommodation_level,
        diving_plan,
        meal_plan,
        transport_type
    } = params;
    
    // 基本料金データ
    const basePrices = getBasePrices(destination);
    const seasonMultiplier = getSeasonMultiplier(destination, travel_dates);
    
    // 航空券費用
    const flightCost = calculateFlightCost(destination, participants, travel_dates, transport_type);
    
    // 宿泊費用
    const accommodationCost = calculateAccommodationCost(
        destination, 
        duration_days, 
        participants, 
        accommodation_level,
        seasonMultiplier
    );
    
    // ダイビング費用
    const divingCost = calculateDivingCost(diving_plan, participants, destination);
    
    // 食事費用
    const mealCost = calculateMealCost(meal_plan, duration_days, participants, destination);
    
    // 交通費用（現地）
    const localTransportCost = calculateLocalTransportCost(destination, duration_days, participants);
    
    // その他費用
    const otherCost = calculateOtherCosts(destination, duration_days, participants);
    
    const subtotal = flightCost + accommodationCost + divingCost + mealCost + localTransportCost + otherCost;
    const tax = Math.round(subtotal * 0.1); // 10%税金
    const total = subtotal + tax;
    
    return {
        flight: flightCost,
        accommodation: accommodationCost,
        diving: divingCost,
        meals: mealCost,
        local_transport: localTransportCost,
        other: otherCost,
        subtotal: subtotal,
        tax: tax,
        total: total,
        per_person: Math.round(total / participants),
        currency: 'JPY',
        breakdown_details: {
            flight_details: getFlightCostDetails(destination, participants, travel_dates),
            accommodation_details: getAccommodationCostDetails(accommodation_level, duration_days),
            diving_details: getDivingCostDetails(diving_plan, participants),
            meal_details: getMealCostDetails(meal_plan, duration_days, participants)
        }
    };
}

// 基本料金データ取得
function getBasePrices(destination) {
    const priceData = {
        '石垣島': {
            accommodation_mid: 15000,
            diving_per_dive: 8000,
            meal_per_day: 4000,
            local_transport_per_day: 2000
        },
        '宮古島': {
            accommodation_mid: 18000,
            diving_per_dive: 9000,
            meal_per_day: 4500,
            local_transport_per_day: 2500
        },
        '沖縄本島': {
            accommodation_mid: 12000,
            diving_per_dive: 7000,
            meal_per_day: 3500,
            local_transport_per_day: 1500
        },
        '慶良間諸島': {
            accommodation_mid: 10000,
            diving_per_dive: 8500,
            meal_per_day: 3000,
            local_transport_per_day: 3000
        },
        '西表島': {
            accommodation_mid: 20000,
            diving_per_dive: 10000,
            meal_per_day: 5000,
            local_transport_per_day: 3500
        }
    };
    
    return priceData[destination] || priceData['沖縄本島'];
}

// 季節倍率取得
function getSeasonMultiplier(destination, travel_dates) {
    const month = new Date(travel_dates.start).getMonth() + 1; // 1-12
    
    // 沖縄の季節料金倍率
    const seasonMultipliers = {
        1: 0.8,  // 1月 - オフシーズン
        2: 0.8,  // 2月 - オフシーズン  
        3: 1.0,  // 3月 - 通常
        4: 1.2,  // 4月 - ハイシーズン開始
        5: 1.3,  // 5月 - ハイシーズン
        6: 1.1,  // 6月 - 梅雨
        7: 1.5,  // 7月 - ピークシーズン
        8: 1.6,  // 8月 - ピークシーズン
        9: 1.2,  // 9月 - ハイシーズン
        10: 1.1, // 10月 - 通常
        11: 0.9, // 11月 - オフシーズン
        12: 1.0  // 12月 - 年末年始
    };
    
    return seasonMultipliers[month] || 1.0;
}

// 航空券費用計算
function calculateFlightCost(destination, participants, travel_dates, transport_type) {
    const basePrices = {
        '石垣島': { economy: 45000, business: 85000 },
        '宮古島': { economy: 50000, business: 90000 },
        '沖縄本島': { economy: 35000, business: 70000 },
        '慶良間諸島': { economy: 35000, business: 70000 }, // 那覇経由
        '西表島': { economy: 45000, business: 85000 } // 石垣経由
    };
    
    const seasonMultiplier = getSeasonMultiplier(destination, travel_dates);
    const basePrice = basePrices[destination]?.[transport_type] || basePrices['沖縄本島']['economy'];
    
    return Math.round(basePrice * seasonMultiplier * participants);
}

// 宿泊費用計算
function calculateAccommodationCost(destination, duration_days, participants, level, seasonMultiplier) {
    const basePrices = getBasePrices(destination);
    const levelMultipliers = {
        'budget': 0.6,
        'mid': 1.0,
        'luxury': 2.0
    };
    
    const baseNightlyRate = basePrices.accommodation_mid;
    const adjustedRate = baseNightlyRate * levelMultipliers[level] * seasonMultiplier;
    
    // 2名1室基準、追加人数は50%加算
    const roomRate = participants <= 2 ? adjustedRate : adjustedRate * (1 + (participants - 2) * 0.5);
    
    return Math.round(roomRate * duration_days);
}

// ダイビング費用計算
function calculateDivingCost(diving_plan, participants, destination) {
    const basePrices = getBasePrices(destination);
    const divePrice = basePrices.diving_per_dive;
    
    const planPricing = {
        'none': { dives: 0, equipment: 0 },
        'beginner': { dives: 4, equipment: 3000 },
        'recreational': { dives: 8, equipment: 4000 },
        'advanced': { dives: 12, equipment: 5000 },
        'intensive': { dives: 16, equipment: 6000 }
    };
    
    const plan = planPricing[diving_plan] || planPricing['none'];
    const divingFees = plan.dives * divePrice * participants;
    const equipmentFees = plan.equipment * participants * Math.ceil(plan.dives / 4); // 4ダイブごとに機材代
    
    return divingFees + equipmentFees;
}

// 食事費用計算
function calculateMealCost(meal_plan, duration_days, participants, destination) {
    const basePrices = getBasePrices(destination);
    const baseMealCost = basePrices.meal_per_day;
    
    const planMultipliers = {
        'budget': 0.7,
        'standard': 1.0,
        'premium': 1.8,
        'luxury': 2.5
    };
    
    const dailyCost = baseMealCost * planMultipliers[meal_plan] * participants;
    return Math.round(dailyCost * duration_days);
}

// 現地交通費計算
function calculateLocalTransportCost(destination, duration_days, participants) {
    const basePrices = getBasePrices(destination);
    const dailyTransportCost = basePrices.local_transport_per_day;
    
    // グループ割引
    const groupDiscount = participants > 2 ? 0.8 : 1.0;
    
    return Math.round(dailyTransportCost * duration_days * groupDiscount);
}

// その他費用計算
function calculateOtherCosts(destination, duration_days, participants) {
    // 観光、お土産、雑費など
    const dailyOtherCost = 2000 * participants;
    return dailyOtherCost * duration_days;
}

// 時期別料金データ取得
function getSeasonalPricing(destination, travel_dates) {
    const currentMonth = new Date(travel_dates.start).getMonth() + 1;
    const months = [
        { month: 1, name: '1月', multiplier: 0.8, season: 'オフシーズン' },
        { month: 2, name: '2月', multiplier: 0.8, season: 'オフシーズン' },
        { month: 3, name: '3月', multiplier: 1.0, season: '通常シーズン' },
        { month: 4, name: '4月', multiplier: 1.2, season: 'ハイシーズン' },
        { month: 5, name: '5月', multiplier: 1.3, season: 'ハイシーズン' },
        { month: 6, name: '6月', multiplier: 1.1, season: '梅雨シーズン' },
        { month: 7, name: '7月', multiplier: 1.5, season: 'ピークシーズン' },
        { month: 8, name: '8月', multiplier: 1.6, season: 'ピークシーズン' },
        { month: 9, name: '9月', multiplier: 1.2, season: 'ハイシーズン' },
        { month: 10, name: '10月', multiplier: 1.1, season: '通常シーズン' },
        { month: 11, name: '11月', multiplier: 0.9, season: 'オフシーズン' },
        { month: 12, name: '12月', multiplier: 1.0, season: '年末シーズン' }
    ];
    
    return months.map(month => ({
        ...month,
        is_current: month.month === currentMonth,
        estimated_savings: currentMonth !== month.month ? 
            Math.round((getSeasonMultiplier(destination, travel_dates) - month.multiplier) * 100000) : 0
    }));
}

// 年間時期別料金データ取得
function getYearlySeasonalPricing(destination, year) {
    return getSeasonalPricing(destination, { start: `${year}-06-01` });
}

// 節約提案生成
function generateSavingTips(costBreakdown, params) {
    const tips = [];
    
    // 季節による節約
    const currentMultiplier = getSeasonMultiplier(params.destination, { start: new Date().toISOString().split('T')[0] });
    if (currentMultiplier > 1.2) {
        tips.push({
            category: '時期変更',
            title: 'オフシーズンの利用',
            description: '1-2月や11月の旅行で20-40%節約できます',
            potential_savings: Math.round(costBreakdown.total * 0.3),
            difficulty: 'easy'
        });
    }
    
    // 宿泊費節約
    if (costBreakdown.accommodation > costBreakdown.total * 0.3) {
        tips.push({
            category: '宿泊',
            title: '宿泊グレードの見直し',
            description: 'ダイビング特化ロッジで宿泊費を抑えつつ設備充実',
            potential_savings: Math.round(costBreakdown.accommodation * 0.4),
            difficulty: 'easy'
        });
    }
    
    // グループ割引
    if (params.participants < 4) {
        tips.push({
            category: 'グループ',
            title: 'グループ旅行の検討',
            description: '4名以上のグループで交通費・宿泊費の割引適用',
            potential_savings: Math.round(costBreakdown.total * 0.15),
            difficulty: 'medium'
        });
    }
    
    // ダイビング費用最適化
    if (costBreakdown.diving > costBreakdown.total * 0.4) {
        tips.push({
            category: 'ダイビング',
            title: 'パッケージプランの活用',
            description: '宿泊+ダイビングセットプランで10-20%割引',
            potential_savings: Math.round(costBreakdown.diving * 0.2),
            difficulty: 'easy'
        });
    }
    
    return tips.slice(0, 5); // 上位5つの提案
}

// 詳細情報取得関数群
function getFlightCostDetails(destination, participants, travel_dates) {
    return {
        route: `東京 → ${destination}`,
        airline: '主要航空会社',
        duration: '2-3時間',
        participants: participants,
        season_factor: getSeasonMultiplier(destination, travel_dates)
    };
}

function getAccommodationCostDetails(level, duration_days) {
    const levelNames = {
        'budget': 'エコノミー',
        'mid': 'スタンダード', 
        'luxury': 'プレミアム'
    };
    
    return {
        level: levelNames[level],
        nights: duration_days,
        room_type: '2名1室基準'
    };
}

function getDivingCostDetails(diving_plan, participants) {
    const planDetails = {
        'none': { name: 'ダイビングなし', dives: 0 },
        'beginner': { name: '初心者プラン', dives: 4 },
        'recreational': { name: 'レクリエーション', dives: 8 },
        'advanced': { name: 'アドバンス', dives: 12 },
        'intensive': { name: 'インテンシブ', dives: 16 }
    };
    
    const plan = planDetails[diving_plan] || planDetails['none'];
    return {
        plan_name: plan.name,
        total_dives: plan.dives * participants,
        includes_equipment: diving_plan !== 'none'
    };
}

function getMealCostDetails(meal_plan, duration_days, participants) {
    const planNames = {
        'budget': 'エコノミー',
        'standard': 'スタンダード',
        'premium': 'プレミアム',
        'luxury': 'ラグジュアリー'
    };
    
    return {
        plan_name: planNames[meal_plan],
        total_meals: duration_days * 3 * participants, // 朝昼夕
        includes: meal_plan === 'luxury' ? '高級レストラン' : '地元料理中心'
    };
}

// ===== 会員管理システムAPI =====
// 注意: 本番の会員システムは https://dive-buddys.com で稼働中
// このRailway環境では会員機能は無効化

// 会員登録API（無効化済み - 本番環境のみ）
app.post('/api/members/register', async (req, res) => {
    res.status(501).json({
        success: false,
        error: 'not_implemented',
        message: '会員登録は本番環境（https://dive-buddys.com）でのみ利用可能です',
        redirect_url: 'https://dive-buddys.com/member/register'
    });
});

// ===== LINE Login ヘルパー関数 =====

// ランダム状態生成
function generateRandomState() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ランダムnonce生成
function generateRandomNonce() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// 認証コードをアクセストークンに交換
async function exchangeCodeForToken(code) {
    try {
        const tokenResponse = await axios.post(LINE_LOGIN_CONFIG.token_url, new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: LINE_LOGIN_CONFIG.callback_url,
            client_id: LINE_LOGIN_CONFIG.channel_id,
            client_secret: LINE_LOGIN_CONFIG.channel_secret
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log('🔑 トークン取得成功:', { token_type: tokenResponse.data.token_type });
        return tokenResponse.data;
    } catch (error) {
        console.error('トークン取得エラー:', error.response?.data || error.message);
        return null;
    }
}

// LINEユーザープロフィール取得
async function getLineUserProfile(accessToken) {
    try {
        const profileResponse = await axios.get(LINE_LOGIN_CONFIG.profile_url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
        
        console.log('👤 プロフィール取得成功:', { userId: profileResponse.data.userId, name: profileResponse.data.displayName });
        return profileResponse.data;
    } catch (error) {
        console.error('プロフィール取得エラー:', error.response?.data || error.message);
        return null;
    }
}

// LINEユーザー情報を保存/更新
async function saveOrUpdateLineUser(profile, tokenData) {
    try {
        const userData = {
            line_user_id: profile.userId,
            display_name: profile.displayName,
            picture_url: profile.pictureUrl,
            status_message: profile.statusMessage || null,
            email: null, // LINE Loginでemailスコープが有効な場合のみ取得可能
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token || null,
            token_expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
            last_login: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Supabase保存試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                // 既存ユーザー確認
                const { data: existingUser } = await supabase
                    .from('line_users')
                    .select('*')
                    .eq('line_user_id', profile.userId)
                    .single();
                
                if (existingUser) {
                    // 更新
                    const { data: updatedUser, error } = await supabase
                        .from('line_users')
                        .update({
                            display_name: userData.display_name,
                            picture_url: userData.picture_url,
                            status_message: userData.status_message,
                            access_token: userData.access_token,
                            refresh_token: userData.refresh_token,
                            token_expires_at: userData.token_expires_at,
                            last_login: userData.last_login,
                            updated_at: userData.updated_at
                        })
                        .eq('line_user_id', profile.userId)
                        .select()
                        .single();
                    
                    if (!error) {
                        console.log('✅ LINEユーザー更新成功（Supabase）:', profile.userId);
                        return updatedUser;
                    }
                } else {
                    // 新規作成
                    const { data: newUser, error } = await supabase
                        .from('line_users')
                        .insert([userData])
                        .select()
                        .single();
                    
                    if (!error) {
                        console.log('✅ LINEユーザー作成成功（Supabase）:', profile.userId);
                        return newUser;
                    }
                }
            } catch (supabaseError) {
                console.warn('Supabase LINEユーザー保存エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: メモリベース保存
        if (!global.lineUsers) {
            global.lineUsers = [];
        }
        
        // 既存ユーザー確認
        const existingIndex = global.lineUsers.findIndex(u => u.line_user_id === profile.userId);
        
        if (existingIndex >= 0) {
            // 更新
            global.lineUsers[existingIndex] = { ...global.lineUsers[existingIndex], ...userData };
            console.log('✅ LINEユーザー更新成功（フォールバック）:', profile.userId);
            return global.lineUsers[existingIndex];
        } else {
            // 新規作成
            userData.id = 'line_user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            global.lineUsers.push(userData);
            console.log('✅ LINEユーザー作成成功（フォールバック）:', profile.userId);
            return userData;
        }
        
    } catch (error) {
        console.error('LINEユーザー保存エラー:', error);
        throw error;
    }
}

// ===== 旅行費用シミュレーターAPI =====

// 費用計算API
app.post('/api/travel/cost-simulator', async (req, res) => {
    try {
        const {
            destination,
            duration_days,
            travel_dates,
            participants,
            accommodation_level,
            diving_plan,
            meal_plan,
            transport_type
        } = req.body;

        console.log('💰 費用計算開始:', { destination, duration_days, participants });

        // 基本料金設定
        const basePrices = {
            // 航空券料金（1名あたり・往復）
            flights: {
                石垣島: { economy: 45000, business: 85000 },
                宮古島: { economy: 42000, business: 80000 },
                沖縄本島: { economy: 35000, business: 65000 },
                慶良間諸島: { economy: 35000, business: 65000 },
                西表島: { economy: 50000, business: 90000 }
            },
            
            // 宿泊料金（1名1泊あたり）
            accommodation: {
                budget: 6000,
                mid: 12000,
                luxury: 25000
            },
            
            // ダイビング料金（1名あたり）
            diving: {
                none: 0,
                beginner: 15000,      // 4ダイブ
                recreational: 28000,  // 8ダイブ
                advanced: 40000,      // 12ダイブ
                intensive: 50000      // 16ダイブ
            },
            
            // 食事料金（1名1日あたり）
            meals: {
                budget: 3000,
                standard: 5000,
                premium: 8000,
                luxury: 12000
            },
            
            // 現地交通費（1名あたり）
            local_transport: {
                石垣島: 5000,
                宮古島: 4000,
                沖縄本島: 6000,
                慶良間諸島: 3000,
                西表島: 7000
            }
        };

        // 時期別料金倍率
        const seasonMultipliers = getSeasonMultiplier(travel_dates.start);

        // 費用計算
        const flightCost = (basePrices.flights[destination]?.[transport_type] || 35000) * participants * seasonMultipliers.flight;
        const accommodationCost = basePrices.accommodation[accommodation_level] * participants * duration_days * seasonMultipliers.accommodation;
        const divingCost = basePrices.diving[diving_plan] * participants * seasonMultipliers.diving;
        const mealsCost = basePrices.meals[meal_plan] * participants * duration_days * seasonMultipliers.meals;
        const localTransportCost = (basePrices.local_transport[destination] || 5000) * participants;
        const otherCost = 10000 * participants; // 保険・お土産等

        const totalCost = Math.round(flightCost + accommodationCost + divingCost + mealsCost + localTransportCost + otherCost);
        const perPersonCost = Math.round(totalCost / participants);

        // 時期別比較データ生成
        const seasonalComparison = generateSeasonalComparison(
            destination, duration_days, participants, accommodation_level, 
            diving_plan, meal_plan, transport_type, travel_dates.start
        );

        // 節約提案生成
        const savingTips = generateSavingTips({
            destination, accommodation_level, diving_plan, meal_plan, 
            transport_type, totalCost, participants
        });

        const response = {
            success: true,
            cost_breakdown: {
                total: totalCost,
                per_person: perPersonCost,
                flight: Math.round(flightCost),
                accommodation: Math.round(accommodationCost),
                diving: Math.round(divingCost),
                meals: Math.round(mealsCost),
                local_transport: Math.round(localTransportCost),
                other: Math.round(otherCost)
            },
            seasonal_comparison: seasonalComparison,
            saving_tips: savingTips,
            calculation_details: {
                destination,
                duration_days,
                participants,
                travel_dates,
                season_multipliers: seasonMultipliers
            }
        };

        console.log('✅ 費用計算完了:', { total: totalCost, per_person: perPersonCost });
        res.json(response);

    } catch (error) {
        console.error('費用計算エラー:', error);
        res.status(500).json({
            success: false,
            error: 'calculation_error',
            message: '費用計算に失敗しました'
        });
    }
});

// 時期別料金倍率取得
function getSeasonMultiplier(travelDate) {
    const date = new Date(travelDate);
    const month = date.getMonth() + 1; // 1-12

    // 沖縄の観光シーズン分類
    if (month >= 7 && month <= 9) {
        // 夏季（7-9月）- ハイシーズン
        return {
            flight: 1.4,
            accommodation: 1.5,
            diving: 1.2,
            meals: 1.1,
            season: 'ハイシーズン'
        };
    } else if (month >= 12 || month <= 2) {
        // 冬季（12-2月）- ピークシーズン
        return {
            flight: 1.6,
            accommodation: 1.7,
            diving: 1.0,
            meals: 1.2,
            season: 'ピークシーズン'
        };
    } else if (month >= 3 && month <= 5) {
        // 春季（3-5月）- ベストシーズン
        return {
            flight: 1.3,
            accommodation: 1.4,
            diving: 1.1,
            meals: 1.0,
            season: 'ベストシーズン'
        };
    } else {
        // 秋季（10-11月）- オフシーズン
        return {
            flight: 0.9,
            accommodation: 0.8,
            diving: 0.9,
            meals: 0.9,
            season: 'オフシーズン'
        };
    }
}

// 時期別比較データ生成
function generateSeasonalComparison(destination, duration, participants, accommodation, diving, meals, transport, currentDate) {
    const months = [
        { name: '1月', month: 1 }, { name: '2月', month: 2 }, { name: '3月', month: 3 },
        { name: '4月', month: 4 }, { name: '5月', month: 5 }, { name: '6月', month: 6 },
        { name: '7月', month: 7 }, { name: '8月', month: 8 }, { name: '9月', month: 9 },
        { name: '10月', month: 10 }, { name: '11月', month: 11 }, { name: '12月', month: 12 }
    ];

    const currentMonth = new Date(currentDate).getMonth() + 1;
    const currentMultiplier = getSeasonMultiplier(currentDate);
    
    // 基本費用（倍率なし）
    const baseCost = calculateBaseCost(destination, duration, participants, accommodation, diving, meals, transport);

    return months.map(monthData => {
        const testDate = `2024-${monthData.month.toString().padStart(2, '0')}-15`;
        const multiplier = getSeasonMultiplier(testDate);
        const estimatedCost = Math.round(baseCost * 
            (multiplier.flight * 0.3 + multiplier.accommodation * 0.4 + multiplier.diving * 0.2 + multiplier.meals * 0.1));
        
        const currentCost = Math.round(baseCost * 
            (currentMultiplier.flight * 0.3 + currentMultiplier.accommodation * 0.4 + currentMultiplier.diving * 0.2 + currentMultiplier.meals * 0.1));
        
        return {
            name: monthData.name,
            month: monthData.month,
            season: multiplier.season,
            multiplier: Math.round((multiplier.flight + multiplier.accommodation + multiplier.diving + multiplier.meals) / 4 * 100) / 100,
            estimated_cost: estimatedCost,
            estimated_savings: currentCost - estimatedCost,
            is_current: monthData.month === currentMonth
        };
    });
}

// 基本費用計算（倍率適用前）
function calculateBaseCost(destination, duration, participants, accommodation, diving, meals, transport) {
    const basePrices = {
        flights: { 石垣島: { economy: 45000, business: 85000 }, 宮古島: { economy: 42000, business: 80000 }, 沖縄本島: { economy: 35000, business: 65000 }, 慶良間諸島: { economy: 35000, business: 65000 }, 西表島: { economy: 50000, business: 90000 } },
        accommodation: { budget: 6000, mid: 12000, luxury: 25000 },
        diving: { none: 0, beginner: 15000, recreational: 28000, advanced: 40000, intensive: 50000 },
        meals: { budget: 3000, standard: 5000, premium: 8000, luxury: 12000 },
        local_transport: { 石垣島: 5000, 宮古島: 4000, 沖縄本島: 6000, 慶良間諸島: 3000, 西表島: 7000 }
    };

    const flight = (basePrices.flights[destination]?.[transport] || 35000) * participants;
    const accom = basePrices.accommodation[accommodation] * participants * duration;
    const div = basePrices.diving[diving] * participants;
    const meal = basePrices.meals[meals] * participants * duration;
    const localTrans = (basePrices.local_transport[destination] || 5000) * participants;
    const other = 10000 * participants;

    return flight + accom + div + meal + localTrans + other;
}

// 節約提案生成
function generateSavingTips(params) {
    const tips = [];
    const { accommodation_level, diving_plan, meal_plan, transport_type, totalCost, participants } = params;

    // 宿泊グレード節約提案
    if (accommodation_level === 'luxury') {
        tips.push({
            category: '宿泊',
            title: 'スタンダードクラスに変更',
            description: 'プレミアムからスタンダードクラスに変更することで大幅な節約が可能です。',
            potential_savings: 13000 * participants * 3 // 平均3泊想定
        });
    } else if (accommodation_level === 'mid') {
        tips.push({
            category: '宿泊',
            title: 'エコノミークラスに変更',
            description: 'ビジネスホテルやゲストハウスを利用することでコストを抑えられます。',
            potential_savings: 6000 * participants * 3
        });
    }

    // 航空券節約提案
    if (transport_type === 'business') {
        tips.push({
            category: '航空券',
            title: 'エコノミークラスに変更',
            description: 'ビジネスクラスからエコノミークラスに変更することで大幅節約。',
            potential_savings: 30000 * participants
        });
    }

    // 食事プラン節約提案
    if (meal_plan === 'luxury') {
        tips.push({
            category: '食事',
            title: 'スタンダードプランに変更',
            description: '地元の食堂やカフェを利用することで食費を抑えられます。',
            potential_savings: 7000 * participants * 3
        });
    }

    // 時期変更提案
    tips.push({
        category: '時期',
        title: 'オフシーズンの利用',
        description: '10-11月の旅行で航空券・宿泊費が20-30%安くなります。',
        potential_savings: Math.round(totalCost * 0.25)
    });

    // 早期予約提案
    tips.push({
        category: '予約',
        title: '早期予約割引の活用',
        description: '45日前予約で航空券が10-15%、宿泊が5-10%割引になることがあります。',
        potential_savings: Math.round(totalCost * 0.12)
    });

    return tips.slice(0, 4); // 最大4つの提案
}

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
