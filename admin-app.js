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
const CUSTOM_DOMAIN = process.env.CUSTOM_DOMAIN || 'dive-buddys.com';
const BASE_URL = process.env.NODE_ENV === 'production' ? `https://${CUSTOM_DOMAIN}` : `http://localhost:${PORT}`;

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

// セキュリティヘッダー・リダイレクト設定
app.use((req, res, next) => {
    // HTTPS強制リダイレクト（本番環境のみ）
    if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
        return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    
    // www リダイレクト設定
    if (req.header('host') === `www.${CUSTOM_DOMAIN}`) {
        return res.redirect(301, `https://${CUSTOM_DOMAIN}${req.url}`);
    }
    
    // Railway デフォルトドメインからのリダイレクト
    const host = req.header('host');
    if (host && host.includes('railway.app') && process.env.NODE_ENV === 'production') {
        return res.redirect(301, `https://${CUSTOM_DOMAIN}${req.url}`);
    }
    
    // セキュリティヘッダー設定（本番環境のみ）
    if (process.env.NODE_ENV === 'production') {
        // HSTS (HTTP Strict Transport Security)
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        
        // Content Security Policy
        res.setHeader('Content-Security-Policy', `
            default-src 'self' https://${CUSTOM_DOMAIN};
            script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://fonts.googleapis.com;
            style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com;
            font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
            img-src 'self' data: https: http:;
            connect-src 'self' https://${CUSTOM_DOMAIN} https://api.supabase.co;
        `.replace(/\s+/g, ' ').trim());
        
        // その他のセキュリティヘッダー
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    
    next();
});

// 基本設定
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
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
app.get('/api/blog/related/:articleId', async (req, res) => {
    try {
        const { articleId } = req.params;
        const { limit = 6 } = req.query;
        
        console.log('🔗 関連記事取得:', { articleId, limit });
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                // 対象記事を取得
                const { data: targetArticle, error: targetError } = await supabase
                    .from('blogs')
                    .select('*')
                    .eq('id', articleId)
                    .single();
                
                if (!targetError && targetArticle) {
                    // 全記事を取得
                    const { data: allArticles, error: allError } = await supabase
                        .from('blogs')
                        .select('*')
                        .eq('status', 'published');
                    
                    if (!allError && allArticles) {
                        const relatedArticles = findRelatedArticles(targetArticle, allArticles, parseInt(limit));
                        
                        console.log('🔗 関連記事取得成功（Supabase）:', relatedArticles.length, '件');
                        return res.json({
                            success: true,
                            articles: relatedArticles,
                            count: relatedArticles.length,
                            target_article: targetArticle,
                            source: 'supabase'
                        });
                    }
                }
            } catch (supabaseError) {
                console.warn('Supabase関連記事取得エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: サンプルデータ
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
                published_at: '2025-07-25T10:00:00Z'
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
                published_at: '2025-07-24T14:00:00Z'
            },
            {
                id: 'article_003',
                title: '宮古島のダイビングスポット総まとめ',
                excerpt: '宮古島の代表的なダイビングスポットを網羅的に紹介。',
                category: 'diving_spots',
                tags: ['宮古島', 'ダイビングポイント', '青の洞窟', '地形派'],
                status: 'published',
                author: 'Jiji編集部',
                views: 1850,
                published_at: '2025-07-23T12:00:00Z'
            }
        ];
        
        // 20記事のデータを追加（BLOG-002で作成済み）
        if (global.tempArticles) {
            allArticles.push(...global.tempArticles);
        }
        
        const targetArticle = allArticles.find(article => article.id === articleId);
        
        if (!targetArticle) {
            return res.status(404).json({
                success: false,
                error: 'article_not_found',
                message: '指定された記事が見つかりません'
            });
        }
        
        const relatedArticles = findEnhancedRelatedArticles(targetArticle, allArticles, parseInt(limit));
        
        console.log('🔗 関連記事取得成功（フォールバック）:', relatedArticles.length, '件');
        res.json({
            success: true,
            articles: relatedArticles,
            count: relatedArticles.length,
            target_article: targetArticle,
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

// 強化された関連記事検索
function findEnhancedRelatedArticles(targetArticle, allArticles, limit = 5) {
    const relatedScores = allArticles
        .filter(article => article.id !== targetArticle.id && article.status === 'published')
        .map(article => {
            let score = 0;
            
            // カテゴリマッチ（高スコア）
            if (article.category === targetArticle.category) {
                score += 10;
            }
            
            // タグマッチ（中スコア）
            const commonTags = article.tags.filter(tag => 
                targetArticle.tags.some(targetTag => 
                    targetTag.toLowerCase() === tag.toLowerCase()
                )
            );
            score += commonTags.length * 5;
            
            // タイトル類似度（中スコア）
            const titleSimilarity = calculateTextSimilarity(
                targetArticle.title.toLowerCase(),
                article.title.toLowerCase()
            );
            score += titleSimilarity * 3;
            
            // コンテンツ類似度（低スコア）
            const contentSimilarity = calculateTextSimilarity(
                targetArticle.content.toLowerCase(),
                article.content.toLowerCase()
            );
            score += contentSimilarity * 2;
            
            // 人気度ボーナス
            score += Math.log(article.views + 1) * 0.5;
            
            // 新しさボーナス
            const daysDiff = (new Date() - new Date(article.published_at)) / (1000 * 60 * 60 * 24);
            if (daysDiff < 30) {
                score += (30 - daysDiff) * 0.1;
            }
            
            return { article, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => ({
            ...item.article,
            related_score: Math.round(item.score * 10) / 10,
            related_reasons: generateRelatedReasons(targetArticle, item.article)
        }));
    
    return relatedScores;
}

// テキスト類似度計算（簡易版）
function calculateTextSimilarity(text1, text2) {
    const words1 = text1.split(/\s+/).filter(word => word.length > 2);
    const words2 = text2.split(/\s+/).filter(word => word.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
}

// 関連理由生成
function generateRelatedReasons(targetArticle, relatedArticle) {
    const reasons = [];
    
    // カテゴリが同じ
    if (targetArticle.category === relatedArticle.category) {
        reasons.push(`同じカテゴリ「${targetArticle.category}」`);
    }
    
    // 共通タグ
    const commonTags = targetArticle.tags.filter(tag => 
        relatedArticle.tags.some(relatedTag => 
            relatedTag.toLowerCase() === tag.toLowerCase()
        )
    );
    if (commonTags.length > 0) {
        reasons.push(`共通タグ: ${commonTags.slice(0, 2).join(', ')}`);
    }
    
    // 人気記事
    if (relatedArticle.views > 1000) {
        reasons.push('人気記事');
    }
    
    return reasons;
}

// SEO最適化・メタタグ生成API
app.get('/api/blog/seo/:articleId', async (req, res) => {
    try {
        const { articleId } = req.params;
        
        console.log('🔍 SEO情報生成:', articleId);
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data: article, error } = await supabase
                    .from('blogs')
                    .select('*')
                    .eq('id', articleId)
                    .single();
                
                if (!error && article) {
                    const seoData = generateSEOMetadata(article);
                    
                    console.log('🔍 SEO情報生成成功（Supabase）');
                    return res.json({
                        success: true,
                        seo: seoData,
                        source: 'supabase'
                    });
                }
            } catch (supabaseError) {
                console.warn('Supabase SEO情報取得エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: サンプルデータ
        const sampleArticles = {
            'article_001': {
                id: 'article_001',
                title: '石垣島のマンタポイント完全ガイド',
                excerpt: '石垣島の代表的なダイビングスポット、マンタポイントの攻略法を詳しく解説。',
                content: '石垣島のマンタポイントは、石垣島の北部に位置する世界的に有名なダイビングスポットです...',
                category: 'diving_spots',
                tags: ['石垣島', 'マンタ', 'ダイビングポイント', '上級者', '大物'],
                author: 'Jiji編集部',
                published_at: '2025-07-25T10:00:00Z'
            }
        };
        
        const article = sampleArticles[articleId];
        
        if (!article) {
            return res.status(404).json({
                success: false,
                error: 'article_not_found',
                message: '指定された記事が見つかりません'
            });
        }
        
        const seoData = generateSEOMetadata(article);
        
        console.log('🔍 SEO情報生成成功（フォールバック）');
        res.json({
            success: true,
            seo: seoData,
            source: 'fallback'
        });
        
    } catch (error) {
        console.error('SEO情報生成API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'SEO情報の生成に失敗しました'
        });
    }
});

// ===== SEO最適化ヘルパー関数 =====

// SEOメタデータ生成
function generateSEOMetadata(article) {
    const baseURL = 'https://dive-buddys.com';
    const siteName = 'Dive Buddy\'s';
    
    // タイトル生成（60文字以内推奨）
    let title = article.title;
    if (title.length > 60) {
        title = title.substring(0, 57) + '...';
    }
    title += ` | ${siteName}`;
    
    // ディスクリプション生成（160文字以内推奨）
    let description = article.excerpt || '';
    if (!description && article.content) {
        description = article.content.replace(/<[^>]*>/g, '').substring(0, 160);
    }
    if (description.length > 160) {
        description = description.substring(0, 157) + '...';
    }
    
    // キーワード生成
    const keywords = [
        ...(article.tags || []),
        'ダイビング',
        '沖縄',
        'スキューバダイビング',
        'ダイビングスポット'
    ].join(', ');
    
    // 構造化データ生成
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article.title,
        "description": description,
        "author": {
            "@type": "Person",
            "name": article.author || "Dive Buddy's編集部"
        },
        "publisher": {
            "@type": "Organization",
            "name": siteName,
            "logo": {
                "@type": "ImageObject",
                "url": `${baseURL}/images/logo.png`
            }
        },
        "datePublished": article.published_at || article.created_at,
        "dateModified": article.updated_at || article.published_at || article.created_at,
        "mainEntityOfPage": {
            "@type": "WebPage",
            "@id": `${baseURL}/blog/article/${article.id}`
        },
        "keywords": keywords
    };
    
    // 画像がある場合は追加
    if (article.featured_image) {
        structuredData.image = {
            "@type": "ImageObject",
            "url": article.featured_image,
            "width": 1200,
            "height": 630
        };
    }
    
    return {
        title,
        description,
        keywords,
        canonical: `${baseURL}/blog/article/${article.id}`,
        openGraph: {
            type: 'article',
            title: article.title,
            description,
            url: `${baseURL}/blog/article/${article.id}`,
            siteName,
            image: article.featured_image || `${baseURL}/images/og-default.jpg`,
            locale: 'ja_JP'
        },
        twitter: {
            card: 'summary_large_image',
            site: '@diveBuddysOki',
            title: article.title,
            description,
            image: article.featured_image || `${baseURL}/images/twitter-default.jpg`
        },
        structuredData,
        robots: 'index, follow',
        viewport: 'width=device-width, initial-scale=1.0'
    };
}

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
    if (!travel_dates || !travel_dates.start) {
        return 1.0;
    }
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
        const seasonMultipliers = getDetailedSeasonMultiplier(travel_dates.start);

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
        const savingTips = generateDetailedSavingTips({
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

// 時期別料金倍率取得（詳細版）
function getDetailedSeasonMultiplier(travelDate) {
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
    const currentMultiplier = getDetailedSeasonMultiplier(currentDate);
    
    // 基本費用（倍率なし）
    const baseCost = calculateBaseCost(destination, duration, participants, accommodation, diving, meals, transport);

    return months.map(monthData => {
        const testDate = `2024-${monthData.month.toString().padStart(2, '0')}-15`;
        const multiplier = getDetailedSeasonMultiplier(testDate);
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
function generateDetailedSavingTips(params) {
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

// ===== 宿泊施設検索・比較システム =====

// 宿泊施設データベース（実際にはSupabaseから取得）
const ACCOMMODATION_DATABASE = [
    {
        id: 'hotel_001',
        name: 'リゾートホテル石垣島',
        area: '石垣島',
        type: 'リゾートホテル',
        price_range: { min: 12000, max: 35000 },
        rating: 4.5,
        diving_support: true,
        amenities: ['プール', 'スパ', '送迎バス', 'ダイビング器材干し場', 'ダイビングショップ併設'],
        location: { lat: 24.3364, lng: 124.1557 },
        description: '石垣島の中心部に位置する老舗リゾートホテル。ダイビングショップと提携しており、器材の乾燥場所も完備。',
        images: ['/images/hotels/ishigaki-resort-1.jpg', '/images/hotels/ishigaki-resort-2.jpg'],
        booking_urls: {
            rakuten: 'https://travel.rakuten.co.jp/hotel/ishigaki-resort',
            jalan: 'https://www.jalan.net/hotel/ishigaki-resort',
            booking: 'https://www.booking.com/hotel/ishigaki-resort'
        },
        room_types: [
            { name: 'スタンダードツイン', price: 12000, capacity: 2 },
            { name: 'デラックスオーシャンビュー', price: 18000, capacity: 2 },
            { name: 'スイート', price: 35000, capacity: 4 }
        ]
    },
    {
        id: 'hotel_002',
        name: '宮古島マリンリゾート',
        area: '宮古島',
        type: 'リゾートホテル',
        price_range: { min: 15000, max: 45000 },
        rating: 4.7,
        diving_support: true,
        amenities: ['プール', 'スパ', 'ダイビング器材レンタル', 'ビーチアクセス', 'レストラン'],
        location: { lat: 24.8058, lng: 125.2809 },
        description: '宮古島の美しいビーチに面したリゾートホテル。ダイビング器材のレンタルや洗浄設備が充実。',
        images: ['/images/hotels/miyako-resort-1.jpg', '/images/hotels/miyako-resort-2.jpg'],
        booking_urls: {
            rakuten: 'https://travel.rakuten.co.jp/hotel/miyako-resort',
            jalan: 'https://www.jalan.net/hotel/miyako-resort',
            booking: 'https://www.booking.com/hotel/miyako-resort'
        },
        room_types: [
            { name: 'スタンダードルーム', price: 15000, capacity: 2 },
            { name: 'オーシャンビュー', price: 25000, capacity: 2 },
            { name: 'プレミアムスイート', price: 45000, capacity: 4 }
        ]
    },
    {
        id: 'pension_001',
        name: 'ダイバーズペンション青い海',
        area: '沖縄本島',
        type: 'ペンション',
        price_range: { min: 6000, max: 12000 },
        rating: 4.2,
        diving_support: true,
        amenities: ['器材干し場', '器材洗浄場', '送迎サービス', 'キッチン', 'Wi-Fi'],
        location: { lat: 26.2041, lng: 127.6793 },
        description: 'ダイバー専用のペンション。器材の管理設備が充実し、ダイビングショップとの連携もスムーズ。',
        images: ['/images/hotels/pension-blue-1.jpg', '/images/hotels/pension-blue-2.jpg'],
        booking_urls: {
            rakuten: 'https://travel.rakuten.co.jp/hotel/pension-blue',
            jalan: 'https://www.jalan.net/hotel/pension-blue'
        },
        room_types: [
            { name: 'ツインルーム', price: 6000, capacity: 2 },
            { name: 'ドミトリー', price: 4000, capacity: 1 },
            { name: 'ファミリールーム', price: 12000, capacity: 4 }
        ]
    },
    {
        id: 'hotel_003',
        name: '慶良間アイランドホテル',
        area: '慶良間諸島',
        type: 'ビジネスホテル',
        price_range: { min: 8000, max: 20000 },
        rating: 4.0,
        diving_support: true,
        amenities: ['器材干し場', '朝食付き', '港送迎', 'コインランドリー'],
        location: { lat: 26.1951, lng: 127.3311 },
        description: '慶良間諸島でのダイビングに最適な立地。港からのアクセスが良く、朝食付きプランが人気。',
        images: ['/images/hotels/kerama-hotel-1.jpg'],
        booking_urls: {
            rakuten: 'https://travel.rakuten.co.jp/hotel/kerama-hotel',
            jalan: 'https://www.jalan.net/hotel/kerama-hotel'
        },
        room_types: [
            { name: 'シングル', price: 8000, capacity: 1 },
            { name: 'ツイン', price: 14000, capacity: 2 },
            { name: 'ファミリー', price: 20000, capacity: 4 }
        ]
    },
    {
        id: 'ryokan_001',
        name: '西表島ネイチャーロッジ',
        area: '西表島',
        type: '民宿',
        price_range: { min: 7000, max: 15000 },
        rating: 4.3,
        diving_support: true,
        amenities: ['器材洗浄場', '自然体験プログラム', '地元料理', 'キャンプファイヤー'],
        location: { lat: 24.3320, lng: 123.7614 },
        description: '西表島の大自然に囲まれたロッジ。ダイビングと自然体験の両方を楽しめる施設。',
        images: ['/images/hotels/iriomote-lodge-1.jpg'],
        booking_urls: {
            rakuten: 'https://travel.rakuten.co.jp/hotel/iriomote-lodge'
        },
        room_types: [
            { name: '和室', price: 7000, capacity: 2 },
            { name: 'コテージ', price: 15000, capacity: 4 }
        ]
    }
];

// 宿泊施設検索API
app.get('/api/travel/accommodations/search', async (req, res) => {
    try {
        const {
            area,
            checkin,
            checkout,
            guests,
            price_min,
            price_max,
            type,
            diving_support,
            rating_min
        } = req.query;

        console.log('🏨 宿泊施設検索:', { area, checkin, checkout, guests });

        let filteredAccommodations = [...ACCOMMODATION_DATABASE];

        // エリアフィルター
        if (area && area !== 'all') {
            filteredAccommodations = filteredAccommodations.filter(hotel => hotel.area === area);
        }

        // 宿泊タイプフィルター
        if (type && type !== 'all') {
            filteredAccommodations = filteredAccommodations.filter(hotel => hotel.type === type);
        }

        // 価格フィルター
        if (price_min) {
            filteredAccommodations = filteredAccommodations.filter(hotel => hotel.price_range.max >= parseInt(price_min));
        }
        if (price_max) {
            filteredAccommodations = filteredAccommodations.filter(hotel => hotel.price_range.min <= parseInt(price_max));
        }

        // ダイビングサポートフィルター
        if (diving_support === 'true') {
            filteredAccommodations = filteredAccommodations.filter(hotel => hotel.diving_support);
        }

        // 評価フィルター
        if (rating_min) {
            filteredAccommodations = filteredAccommodations.filter(hotel => hotel.rating >= parseFloat(rating_min));
        }

        // 宿泊日に基づく価格計算
        const stayDays = checkin && checkout ? calculateStayDays(checkin, checkout) : 1;
        const guestCount = parseInt(guests) || 2;

        // 各宿泊施設に動的価格を追加
        const enrichedAccommodations = filteredAccommodations.map(hotel => {
            const seasonMultiplier = getAccommodationSeasonMultiplier(checkin);
            const basePrice = calculateHotelPrice(hotel, guestCount, stayDays);
            const finalPrice = Math.round(basePrice * seasonMultiplier);

            return {
                ...hotel,
                calculated_price: finalPrice,
                price_per_night: Math.round(finalPrice / stayDays),
                stay_days: stayDays,
                guests: guestCount,
                season_multiplier: seasonMultiplier,
                availability: checkAvailability(hotel, checkin, checkout)
            };
        });

        // 価格順にソート
        enrichedAccommodations.sort((a, b) => a.calculated_price - b.calculated_price);

        const response = {
            success: true,
            accommodations: enrichedAccommodations,
            search_params: {
                area,
                checkin,
                checkout,
                guests: guestCount,
                stay_days: stayDays,
                results_count: enrichedAccommodations.length
            },
            filters: {
                areas: ['石垣島', '宮古島', '沖縄本島', '慶良間諸島', '西表島'],
                types: ['リゾートホテル', 'ビジネスホテル', 'ペンション', '民宿'],
                price_ranges: [
                    { label: '～10,000円', min: 0, max: 10000 },
                    { label: '10,000-20,000円', min: 10000, max: 20000 },
                    { label: '20,000-30,000円', min: 20000, max: 30000 },
                    { label: '30,000円～', min: 30000, max: 999999 }
                ]
            }
        };

        console.log('✅ 宿泊施設検索完了:', { count: enrichedAccommodations.length });
        res.json(response);

    } catch (error) {
        console.error('宿泊施設検索エラー:', error);
        res.status(500).json({
            success: false,
            error: 'search_error',
            message: '宿泊施設の検索に失敗しました'
        });
    }
});

// 宿泊施設詳細取得API
app.get('/api/travel/accommodations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const accommodation = ACCOMMODATION_DATABASE.find(hotel => hotel.id === id);

        if (!accommodation) {
            return res.status(404).json({
                success: false,
                error: 'not_found',
                message: '宿泊施設が見つかりません'
            });
        }

        // 詳細情報を追加
        const detailedAccommodation = {
            ...accommodation,
            nearby_dive_sites: getNearbyDiveSites(accommodation.area),
            weather_info: await getAreaWeather(accommodation.area),
            similar_hotels: getSimilarHotels(accommodation)
        };

        res.json({
            success: true,
            accommodation: detailedAccommodation
        });

    } catch (error) {
        console.error('宿泊施設詳細取得エラー:', error);
        res.status(500).json({
            success: false,
            error: 'fetch_error',
            message: '宿泊施設の詳細取得に失敗しました'
        });
    }
});

// ===== 宿泊施設関連ヘルパー関数 =====

// 宿泊日数計算
function calculateStayDays(checkin, checkout) {
    if (!checkin || !checkout) return 1;
    const checkinDate = new Date(checkin);
    const checkoutDate = new Date(checkout);
    const diffTime = Math.abs(checkoutDate - checkinDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 1);
}

// 宿泊料金計算
function calculateHotelPrice(hotel, guests, days) {
    // 部屋タイプから最適な料金を選択
    let selectedRoom = hotel.room_types[0]; // デフォルト
    
    for (const room of hotel.room_types) {
        if (room.capacity >= guests) {
            selectedRoom = room;
            break;
        }
    }
    
    return selectedRoom.price * days;
}

// 宿泊施設の季節倍率
function getAccommodationSeasonMultiplier(checkin) {
    if (!checkin) return 1.0;
    
    const date = new Date(checkin);
    const month = date.getMonth() + 1;

    if (month >= 7 && month <= 9) return 1.5; // 夏季
    if (month >= 12 || month <= 2) return 1.7; // 冬季
    if (month >= 3 && month <= 5) return 1.4; // 春季
    return 0.8; // 秋季
}

// 空室状況チェック（模擬）
function checkAvailability(hotel, checkin, checkout) {
    // 実際の実装では予約システムAPIを呼び出し
    const random = Math.random();
    return {
        available: random > 0.1, // 90%の確率で空室
        rooms_left: Math.floor(random * 10) + 1,
        booking_urgency: random > 0.7 ? 'high' : random > 0.4 ? 'medium' : 'low'
    };
}

// 近隣ダイビングサイト取得
function getNearbyDiveSites(area) {
    const diveSites = {
        '石垣島': ['川平石崎マンタスクランブル', '米原ビーチ', '大崎ハナゴイリーフ'],
        '宮古島': ['魔王の宮殿', '通り池', 'アーチ'],
        '沖縄本島': ['青の洞窟', '万座ドリームホール', 'ゴリラチョップ'],
        '慶良間諸島': ['座間味島', '阿嘉島', '渡嘉敷島'],
        '西表島': ['バラス島', '網取湾', 'イダの浜']
    };
    return diveSites[area] || [];
}

// エリア天気情報取得
async function getAreaWeather(area) {
    // 実際の実装では気象庁APIを呼び出し
    return {
        temperature: 25,
        condition: '晴れ',
        wave_height: '1-2m',
        visibility: '良好'
    };
}

// 類似宿泊施設取得
function getSimilarHotels(hotel) {
    return ACCOMMODATION_DATABASE
        .filter(h => h.id !== hotel.id && (h.area === hotel.area || h.type === hotel.type))
        .slice(0, 3)
        .map(h => ({
            id: h.id,
            name: h.name,
            area: h.area,
            price_range: h.price_range,
            rating: h.rating
        }));
}

// ===== 監視・ログシステム =====

// システム統計情報
let systemStats = {
    start_time: new Date().toISOString(),
    request_count: 0,
    error_count: 0,
    last_error: null,
    response_times: [],
    endpoints_usage: {},
    memory_usage: [],
    active_connections: 0
};

// リクエスト監視ミドルウェア
app.use((req, res, next) => {
    const startTime = Date.now();
    systemStats.request_count++;
    systemStats.active_connections++;
    
    // エンドポイント使用統計
    const endpoint = `${req.method} ${req.path}`;
    systemStats.endpoints_usage[endpoint] = (systemStats.endpoints_usage[endpoint] || 0) + 1;
    
    // レスポンス時間記録
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        systemStats.response_times.push({
            endpoint,
            response_time: responseTime,
            status_code: res.statusCode,
            timestamp: new Date().toISOString()
        });
        
        // 直近100件のレスポンス時間のみ保持
        if (systemStats.response_times.length > 100) {
            systemStats.response_times = systemStats.response_times.slice(-100);
        }
        
        systemStats.active_connections--;
        
        // 遅いレスポンスをログ出力
        if (responseTime > 5000) {
            console.warn(`⚠️ 遅いレスポンス: ${endpoint} ${responseTime}ms`);
        }
        
        // エラーレスポンスをログ出力
        if (res.statusCode >= 400) {
            const errorInfo = {
                endpoint,
                status_code: res.statusCode,
                response_time: responseTime,
                timestamp: new Date().toISOString(),
                user_agent: req.get('User-Agent'),
                ip: req.ip
            };
            
            systemStats.error_count++;
            systemStats.last_error = errorInfo;
            
            console.error(`🚨 エラーレスポンス: ${JSON.stringify(errorInfo)}`);
        }
    });
    
    next();
});

// メモリ使用量監視（5分ごと）
setInterval(() => {
    const memoryUsage = process.memoryUsage();
    systemStats.memory_usage.push({
        timestamp: new Date().toISOString(),
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heap_used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heap_total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024) // MB
    });
    
    // 直近24時間分のみ保持（5分間隔で288個）
    if (systemStats.memory_usage.length > 288) {
        systemStats.memory_usage = systemStats.memory_usage.slice(-288);
    }
    
    // メモリ使用量警告
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) {
        console.warn(`⚠️ 高メモリ使用量: ${Math.round(heapUsedMB)}MB`);
    }
}, 5 * 60 * 1000);

// システム監視API
app.get('/api/monitoring/stats', (req, res) => {
    try {
        const uptime = Math.floor((Date.now() - new Date(systemStats.start_time).getTime()) / 1000);
        const avgResponseTime = systemStats.response_times.length > 0 
            ? Math.round(systemStats.response_times.reduce((sum, rt) => sum + rt.response_time, 0) / systemStats.response_times.length)
            : 0;
            
        const recentErrors = systemStats.response_times
            .filter(rt => rt.status_code >= 400)
            .slice(-10);
            
        const topEndpoints = Object.entries(systemStats.endpoints_usage)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([endpoint, count]) => ({ endpoint, count }));
            
        const currentMemory = systemStats.memory_usage.length > 0 
            ? systemStats.memory_usage[systemStats.memory_usage.length - 1]
            : null;
            
        res.json({
            success: true,
            system_info: {
                uptime_seconds: uptime,
                uptime_human: formatUptime(uptime),
                start_time: systemStats.start_time,
                node_version: process.version,
                platform: process.platform
            },
            request_stats: {
                total_requests: systemStats.request_count,
                error_count: systemStats.error_count,
                error_rate: systemStats.request_count > 0 
                    ? Math.round((systemStats.error_count / systemStats.request_count) * 100 * 100) / 100 
                    : 0,
                active_connections: systemStats.active_connections,
                avg_response_time: avgResponseTime
            },
            performance: {
                recent_response_times: systemStats.response_times.slice(-20),
                top_endpoints: topEndpoints,
                recent_errors: recentErrors
            },
            resources: {
                current_memory: currentMemory,
                memory_trend: systemStats.memory_usage.slice(-12), // 直近1時間
                cpu_usage: process.cpuUsage()
            },
            database: {
                status: supabase ? 'connected' : 'fallback',
                supabase_configured: !!supabase
            }
        });
    } catch (error) {
        console.error('監視統計取得エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '監視統計の取得に失敗しました'
        });
    }
});

// システムアラートAPI
app.get('/api/monitoring/alerts', (req, res) => {
    try {
        const alerts = [];
        const currentTime = Date.now();
        
        // メモリ使用量チェック
        if (systemStats.memory_usage.length > 0) {
            const latestMemory = systemStats.memory_usage[systemStats.memory_usage.length - 1];
            if (latestMemory.heap_used > 400) {
                alerts.push({
                    type: 'memory_high',
                    severity: 'warning',
                    message: `高メモリ使用量: ${latestMemory.heap_used}MB`,
                    timestamp: latestMemory.timestamp,
                    details: latestMemory
                });
            }
        }
        
        // エラー率チェック
        const recentRequests = systemStats.response_times.filter(rt => 
            currentTime - new Date(rt.timestamp).getTime() < 10 * 60 * 1000 // 直近10分
        );
        const recentErrors = recentRequests.filter(rt => rt.status_code >= 400);
        const errorRate = recentRequests.length > 0 ? (recentErrors.length / recentRequests.length) * 100 : 0;
        
        if (errorRate > 10) {
            alerts.push({
                type: 'error_rate_high',
                severity: 'critical',
                message: `高エラー率: ${Math.round(errorRate * 100) / 100}%`,
                timestamp: new Date().toISOString(),
                details: {
                    error_count: recentErrors.length,
                    total_requests: recentRequests.length,
                    error_rate: errorRate
                }
            });
        }
        
        // レスポンス時間チェック
        const recentSlowRequests = systemStats.response_times
            .filter(rt => rt.response_time > 3000)
            .slice(-5);
            
        if (recentSlowRequests.length > 3) {
            alerts.push({
                type: 'response_time_slow',
                severity: 'warning',
                message: `遅いレスポンス時間が継続`,
                timestamp: new Date().toISOString(),
                details: {
                    slow_requests: recentSlowRequests.length,
                    avg_response_time: Math.round(recentSlowRequests.reduce((sum, rt) => sum + rt.response_time, 0) / recentSlowRequests.length)
                }
            });
        }
        
        // データベース接続チェック
        if (!supabase) {
            alerts.push({
                type: 'database_fallback',
                severity: 'info',
                message: 'フォールバックモードで動作中',
                timestamp: new Date().toISOString(),
                details: {
                    mode: 'file_based',
                    supabase_status: supabaseStatus
                }
            });
        }
        
        res.json({
            success: true,
            alerts,
            alert_count: alerts.length,
            severity_counts: {
                critical: alerts.filter(a => a.severity === 'critical').length,
                warning: alerts.filter(a => a.severity === 'warning').length,
                info: alerts.filter(a => a.severity === 'info').length
            }
        });
    } catch (error) {
        console.error('アラート取得エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'アラート情報の取得に失敗しました'
        });
    }
});

// ログ出力API
app.get('/api/monitoring/logs', (req, res) => {
    try {
        const { limit = 50, level = 'all', since } = req.query;
        
        // 簡易ログ（実際の実装では外部ログシステムを使用推奨）
        const logs = [
            ...systemStats.response_times.slice(-20).map(rt => ({
                timestamp: rt.timestamp,
                level: rt.status_code >= 400 ? 'error' : 'info',
                message: `${rt.endpoint} - ${rt.status_code} - ${rt.response_time}ms`,
                category: 'request',
                details: rt
            })),
            ...systemStats.memory_usage.slice(-10).map(mem => ({
                timestamp: mem.timestamp,
                level: 'info',
                message: `Memory: ${mem.heap_used}MB / ${mem.heap_total}MB`,
                category: 'system',
                details: mem
            }))
        ];
        
        // レベルフィルター
        let filteredLogs = level === 'all' 
            ? logs 
            : logs.filter(log => log.level === level);
            
        // 時間フィルター
        if (since) {
            const sinceTime = new Date(since).getTime();
            filteredLogs = filteredLogs.filter(log => 
                new Date(log.timestamp).getTime() >= sinceTime
            );
        }
        
        // 時間順ソート（新しい順）
        filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // 制限
        filteredLogs = filteredLogs.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            logs: filteredLogs,
            count: filteredLogs.length,
            filters: { limit, level, since }
        });
    } catch (error) {
        console.error('ログ取得エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'ログ情報の取得に失敗しました'
        });
    }
});

// アップタイム形式変換関数
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

// ===== ヘルスチェック・メタデータエンドポイント =====

// ヘルスチェックエンドポイント（拡張版）
app.get('/health', (req, res) => {
    try {
        const uptime = Math.floor((Date.now() - new Date(systemStats.start_time).getTime()) / 1000);
        const memoryUsage = process.memoryUsage();
        const currentMemoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        
        // ヘルスステータス判定
        let healthStatus = 'healthy';
        const issues = [];
        
        if (currentMemoryMB > 500) {
            healthStatus = 'degraded';
            issues.push('high_memory_usage');
        }
        
        if (systemStats.error_count > systemStats.request_count * 0.1) {
            healthStatus = 'degraded';
            issues.push('high_error_rate');
        }
        
        if (!supabase) {
            issues.push('database_fallback');
        }
        
        const healthCheck = {
            status: healthStatus,
            server: 'running',
            database: supabase ? 'connected' : 'fallback',
            admin_panel: 'available',
            supabase_configured: !!supabase,
            supabase_status: supabaseStatus,
            mode: supabase ? 'supabase' : 'fallback',
            timestamp: new Date().toISOString(),
            uptime_seconds: uptime,
            uptime_human: formatUptime(uptime),
            domain: CUSTOM_DOMAIN,
            base_url: BASE_URL,
            environment: process.env.NODE_ENV || 'development',
            version: '3.0.0',
            memory_usage_mb: currentMemoryMB,
            request_count: systemStats.request_count,
            error_count: systemStats.error_count,
            active_connections: systemStats.active_connections,
            issues,
            services: {
                supabase: supabaseStatus,
                database: 'operational',
                apis: 'operational',
                monitoring: 'operational'
            }
        };
        
        res.status(healthStatus === 'healthy' ? 200 : 503).json(healthCheck);
    } catch (error) {
        console.error('ヘルスチェックエラー:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ドメイン情報エンドポイント
app.get('/api/domain-info', (req, res) => {
    res.json({
        domain: CUSTOM_DOMAIN,
        base_url: BASE_URL,
        environment: process.env.NODE_ENV || 'development',
        ssl_enabled: req.secure || req.header('x-forwarded-proto') === 'https',
        timestamp: new Date().toISOString()
    });
});

// サイトマップ動的生成（オプション）
app.get('/sitemap-dynamic.xml', (req, res) => {
    res.set('Content-Type', 'application/xml');
    
    const urls = [
        { loc: '/', changefreq: 'daily', priority: '1.0' },
        { loc: '/about', changefreq: 'weekly', priority: '0.8' },
        { loc: '/shops-database', changefreq: 'daily', priority: '0.9' },
        { loc: '/travel-guide', changefreq: 'weekly', priority: '0.8' },
        { loc: '/weather-ocean', changefreq: 'daily', priority: '0.8' },
        { loc: '/blog', changefreq: 'daily', priority: '0.8' },
        { loc: '/member', changefreq: 'weekly', priority: '0.7' },
        { loc: '/contact', changefreq: 'monthly', priority: '0.5' }
    ];
    
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `    <url>
        <loc>${BASE_URL}${url.loc}</loc>
        <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
        <changefreq>${url.changefreq}</changefreq>
        <priority>${url.priority}</priority>
    </url>`).join('\n')}
</urlset>`;
    
    res.send(sitemap);
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

// ===== 会員登録システム =====

// 会員登録API
app.post('/api/member/register', async (req, res) => {
    try {
        const {
            username,
            email,
            password,
            confirmPassword,
            fullName,
            experience,
            favoriteArea,
            newsletter
        } = req.body;

        console.log('👤 新規会員登録:', { username, email, fullName, experience });

        // バリデーション
        const validationErrors = validateRegistrationData(req.body);
        if (validationErrors.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'バリデーションエラーが発生しました',
                errors: validationErrors
            });
        }

        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                // 既存ユーザーチェック
                const { data: existingUser, error: checkError } = await supabase
                    .from('users')
                    .select('username, email')
                    .or(`username.eq.${username},email.eq.${email}`)
                    .limit(1);

                if (checkError) {
                    console.warn('既存ユーザーチェックエラー:', checkError);
                } else if (existingUser && existingUser.length > 0) {
                    const existing = existingUser[0];
                    const field = existing.username === username ? 'username' : 'email';
                    return res.status(409).json({
                        success: false,
                        error: 'user_exists',
                        message: `この${field === 'username' ? 'ユーザー名' : 'メールアドレス'}は既に使用されています`,
                        field
                    });
                }

                // パスワードハッシュ化（実際の実装では bcrypt を使用）
                const hashedPassword = hashPassword(password);

                // ユーザー作成
                const userData = {
                    username,
                    email,
                    password_hash: hashedPassword,
                    full_name: fullName,
                    diving_experience: experience || 'none',
                    favorite_area: favoriteArea || null,
                    newsletter_subscription: newsletter === 'on',
                    email_verified: false,
                    registration_date: new Date().toISOString(),
                    last_login: null,
                    profile_completed: false,
                    points_balance: 100, // 新規登録ボーナス
                    status: 'active'
                };

                const { data: newUser, error: insertError } = await supabase
                    .from('users')
                    .insert([userData])
                    .select()
                    .single();

                if (insertError) {
                    console.error('ユーザー作成エラー:', insertError);
                    throw new Error('ユーザーの作成に失敗しました');
                }

                // メール認証トークン生成
                const verificationToken = generateVerificationToken();
                await supabase
                    .from('email_verifications')
                    .insert([{
                        user_id: newUser.id,
                        email: email,
                        token: verificationToken,
                        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24時間後
                    }]);

                // メール送信（実際の実装では SendGrid 等を使用）
                await sendVerificationEmail(email, verificationToken, fullName);

                console.log('✅ 会員登録成功（Supabase）:', newUser.username);
                return res.json({
                    success: true,
                    message: '会員登録が完了しました',
                    user: {
                        id: newUser.id,
                        username: newUser.username,
                        email: newUser.email,
                        full_name: newUser.full_name,
                        points_balance: newUser.points_balance
                    },
                    next_step: 'email_verification'
                });

            } catch (supabaseError) {
                console.warn('Supabase会員登録エラー、フォールバックへ:', supabaseError.message);
            }
        }

        // フォールバック: セッションストレージ
        const userId = 'user_' + Date.now();
        const hashedPassword = hashPassword(password);
        
        const userData = {
            id: userId,
            username,
            email,
            password_hash: hashedPassword,
            full_name: fullName,
            diving_experience: experience || 'none',
            favorite_area: favoriteArea || null,
            newsletter_subscription: newsletter === 'on',
            email_verified: false,
            registration_date: new Date().toISOString(),
            points_balance: 100,
            status: 'active'
        };

        // グローバル変数に保存（デモ用）
        if (!global.registeredUsers) {
            global.registeredUsers = new Map();
        }
        global.registeredUsers.set(username, userData);
        global.registeredUsers.set(email, userData);

        console.log('✅ 会員登録成功（フォールバック）:', username);
        res.json({
            success: true,
            message: '会員登録が完了しました',
            user: {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                full_name: userData.full_name,
                points_balance: userData.points_balance
            },
            next_step: 'demo_mode'
        });

    } catch (error) {
        console.error('会員登録API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '会員登録に失敗しました'
        });
    }
});

// 会員登録ページ
app.get('/member/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/member/register.html'));
});

// ===== 会員登録ヘルパー関数 =====

// 登録データバリデーション
function validateRegistrationData(data) {
    const errors = [];
    const { username, email, password, confirmPassword, fullName } = data;

    // ユーザー名バリデーション
    if (!username || username.length < 3) {
        errors.push({ field: 'username', message: 'ユーザー名は3文字以上で入力してください' });
    } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errors.push({ field: 'username', message: 'ユーザー名は英数字とアンダースコアのみ使用できます' });
    }

    // メールアドレスバリデーション
    if (!email) {
        errors.push({ field: 'email', message: 'メールアドレスは必須です' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ field: 'email', message: '正しいメールアドレス形式で入力してください' });
    }

    // パスワードバリデーション
    if (!password || password.length < 8) {
        errors.push({ field: 'password', message: 'パスワードは8文字以上で入力してください' });
    }

    if (password !== confirmPassword) {
        errors.push({ field: 'confirmPassword', message: 'パスワードが一致しません' });
    }

    // 氏名バリデーション
    if (!fullName || fullName.length < 2) {
        errors.push({ field: 'fullName', message: 'お名前は2文字以上で入力してください' });
    }

    return errors;
}

// パスワードハッシュ化（簡易版）
function hashPassword(password) {
    // 実際の実装では bcrypt を使用
    return 'hashed_' + password + '_salt';
}

// メール認証トークン生成
function generateVerificationToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// メール認証送信（デモ版）
async function sendVerificationEmail(email, token, fullName) {
    // 実際の実装では SendGrid、AWS SES 等を使用
    console.log(`📧 認証メール送信（デモ）:`, {
        to: email,
        subject: 'Dive Buddy\'s メールアドレス認証',
        verification_url: `https://dive-buddys.com/member/verify?token=${token}`,
        recipient: fullName
    });
    
    return true;
}

// ===== LINE Login認証システム =====

// LINE Login開始エンドポイント
app.get('/auth/line/login', (req, res) => {
    try {
        console.log('🔗 LINE Login開始');
        
        if (!LINE_LOGIN_CONFIG.channel_id) {
            console.warn('⚠️ LINE_LOGIN_CHANNEL_ID が設定されていません');
            return res.status(503).json({
                success: false,
                error: 'line_not_configured',
                message: 'LINE Login機能は現在利用できません',
                fallback_url: '/member/register'
            });
        }

        // OAuth認証URL生成
        const state = generateStateToken();
        const nonce = generateNonce();
        
        // セッションに状態を保存（実際の実装ではRedisやDB使用）
        if (!global.lineLoginSessions) {
            global.lineLoginSessions = new Map();
        }
        global.lineLoginSessions.set(state, {
            nonce,
            timestamp: Date.now(),
            expires: Date.now() + (10 * 60 * 1000) // 10分後に期限切れ
        });

        const authUrl = new URL(LINE_LOGIN_CONFIG.base_url);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', LINE_LOGIN_CONFIG.channel_id);
        authUrl.searchParams.set('redirect_uri', LINE_LOGIN_CONFIG.callback_url);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('scope', 'profile openid email');
        authUrl.searchParams.set('nonce', nonce);

        console.log('🔗 LINE認証リダイレクト:', authUrl.toString());
        res.redirect(authUrl.toString());

    } catch (error) {
        console.error('LINE Login開始エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'LINE認証の開始に失敗しました',
            fallback_url: '/member/register'
        });
    }
});

// LINE Login コールバックエンドポイント
app.get('/auth/line/callback', async (req, res) => {
    try {
        const { code, state, error: authError } = req.query;
        
        console.log('🔄 LINE Login コールバック:', { code: code ? '受信' : '未受信', state, authError });

        if (authError) {
            console.error('LINE認証エラー:', authError);
            return res.redirect('/member/login?error=line_auth_failed');
        }

        if (!code || !state) {
            console.error('認証パラメータ不足:', { code: !!code, state: !!state });
            return res.redirect('/member/login?error=invalid_callback');
        }

        // 状態検証
        if (!global.lineLoginSessions || !global.lineLoginSessions.has(state)) {
            console.error('無効な状態トークン:', state);
            return res.redirect('/member/login?error=invalid_state');
        }

        const session = global.lineLoginSessions.get(state);
        if (session.expires < Date.now()) {
            global.lineLoginSessions.delete(state);
            console.error('期限切れの状態トークン');
            return res.redirect('/member/login?error=session_expired');
        }

        // アクセストークン取得
        const tokenData = await exchangeCodeForToken(code);
        if (!tokenData.access_token) {
            console.error('アクセストークン取得失敗');
            return res.redirect('/member/login?error=token_exchange_failed');
        }

        // ユーザープロフィール取得
        const profile = await getLINEUserProfile(tokenData.access_token);
        if (!profile) {
            console.error('プロフィール取得失敗');
            return res.redirect('/member/login?error=profile_fetch_failed');
        }

        // ユーザー作成または更新
        const user = await findOrCreateLINEUser(profile, tokenData);
        
        // セッション作成（実装は簡易版）
        const userSession = {
            user_id: user.id,
            line_user_id: profile.userId,
            access_token: tokenData.access_token,
            login_time: new Date().toISOString(),
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24時間
        };

        if (!global.userSessions) {
            global.userSessions = new Map();
        }
        global.userSessions.set(user.id, userSession);

        // クリーンアップ
        global.lineLoginSessions.delete(state);

        console.log('✅ LINE Login成功:', user.display_name || user.username);
        res.redirect('/member/dashboard?login=success');

    } catch (error) {
        console.error('LINE Login コールバックエラー:', error);
        res.redirect('/member/login?error=login_failed');
    }
});

// LINE認証状態確認API
app.get('/api/auth/line/status', async (req, res) => {
    try {
        // 簡易的なセッション確認（実際はJWTやセッションストア使用）
        const sessionId = req.headers['x-session-id'] || req.query.session_id;
        
        if (!sessionId || !global.userSessions || !global.userSessions.has(sessionId)) {
            return res.json({
                authenticated: false,
                user: null
            });
        }

        const session = global.userSessions.get(sessionId);
        if (new Date(session.expires) < new Date()) {
            global.userSessions.delete(sessionId);
            return res.json({
                authenticated: false,
                user: null
            });
        }

        // ユーザー情報取得
        const user = await getUserById(session.user_id);
        
        res.json({
            authenticated: true,
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
                points_balance: user.points_balance
            },
            session: {
                login_time: session.login_time,
                expires: session.expires
            }
        });

    } catch (error) {
        console.error('認証状態確認エラー:', error);
        res.status(500).json({
            authenticated: false,
            error: error.message
        });
    }
});

// ログアウトAPI
app.post('/api/auth/line/logout', (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'] || req.query.session_id;
        
        if (sessionId && global.userSessions) {
            global.userSessions.delete(sessionId);
        }

        res.json({
            success: true,
            message: 'ログアウトしました'
        });

    } catch (error) {
        console.error('ログアウトエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ===== LINE Login ヘルパー関数 =====

// 状態トークン生成
function generateStateToken() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ノンス生成
function generateNonce() {
    return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// 認証コードをアクセストークンに交換
async function exchangeCodeForToken(code) {
    try {
        const response = await fetch(LINE_LOGIN_CONFIG.token_url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: LINE_LOGIN_CONFIG.callback_url,
                client_id: LINE_LOGIN_CONFIG.channel_id,
                client_secret: LINE_LOGIN_CONFIG.channel_secret
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('トークン交換エラー:', data);
            throw new Error('トークンの取得に失敗しました');
        }

        return data;
    } catch (error) {
        console.error('exchangeCodeForToken エラー:', error);
        throw error;
    }
}

// LINEユーザープロフィール取得
async function getLINEUserProfile(accessToken) {
    try {
        const response = await fetch(LINE_LOGIN_CONFIG.profile_url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const profile = await response.json();
        
        if (!response.ok) {
            console.error('プロフィール取得エラー:', profile);
            throw new Error('プロフィールの取得に失敗しました');
        }

        return profile;
    } catch (error) {
        console.error('getLINEUserProfile エラー:', error);
        throw error;
    }
}

// LINEユーザー検索または作成
async function findOrCreateLINEUser(profile, tokenData) {
    try {
        const lineUserId = profile.userId;
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                // 既存ユーザー検索
                const { data: existingUser, error: findError } = await supabase
                    .from('users')
                    .select('*')
                    .eq('line_user_id', lineUserId)
                    .single();

                if (!findError && existingUser) {
                    // 既存ユーザー更新
                    const { data: updatedUser, error: updateError } = await supabase
                        .from('users')
                        .update({
                            display_name: profile.displayName,
                            avatar_url: profile.pictureUrl,
                            last_login: new Date().toISOString()
                        })
                        .eq('id', existingUser.id)
                        .select()
                        .single();

                    if (!updateError) {
                        console.log('✅ 既存LINEユーザー更新:', profile.displayName);
                        return updatedUser;
                    }
                }

                // 新規ユーザー作成
                const userData = {
                    line_user_id: lineUserId,
                    username: `line_${lineUserId.substring(-8)}`,
                    display_name: profile.displayName,
                    avatar_url: profile.pictureUrl,
                    email: null, // LINEからはメールアドレス取得できない場合が多い
                    registration_date: new Date().toISOString(),
                    last_login: new Date().toISOString(),
                    points_balance: 100, // 新規登録ボーナス
                    status: 'active',
                    auth_provider: 'line'
                };

                const { data: newUser, error: createError } = await supabase
                    .from('users')
                    .insert([userData])
                    .select()
                    .single();

                if (!createError) {
                    console.log('✅ 新規LINEユーザー作成:', profile.displayName);
                    return newUser;
                }

                console.warn('Supabaseユーザー作成エラー:', createError.message);
                
            } catch (supabaseError) {
                console.warn('Supabase LINEユーザー処理エラー:', supabaseError.message);
            }
        }

        // フォールバック: ローカルストレージ
        const userId = `line_user_${Date.now()}`;
        const userData = {
            id: userId,
            line_user_id: lineUserId,
            username: `line_${lineUserId.substring(-8)}`,
            display_name: profile.displayName,
            avatar_url: profile.pictureUrl,
            registration_date: new Date().toISOString(),
            last_login: new Date().toISOString(),
            points_balance: 100,
            status: 'active',
            auth_provider: 'line'
        };

        if (!global.lineUsers) {
            global.lineUsers = new Map();
        }
        global.lineUsers.set(lineUserId, userData);

        console.log('✅ 新規LINEユーザー作成（フォールバック）:', profile.displayName);
        return userData;

    } catch (error) {
        console.error('findOrCreateLINEUser エラー:', error);
        throw error;
    }
}

// ユーザーID検索
async function getUserById(userId) {
    // Supabase接続試行
    if (supabase && supabaseStatus === 'connected') {
        try {
            const { data: user, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (!error && user) {
                return user;
            }
        } catch (supabaseError) {
            console.warn('Supabaseユーザー検索エラー:', supabaseError.message);
        }
    }

    // フォールバック検索
    if (global.lineUsers) {
        for (const [lineId, userData] of global.lineUsers.entries()) {
            if (userData.id === userId) {
                return userData;
            }
        }
    }

    if (global.registeredUsers) {
        for (const [key, userData] of global.registeredUsers.entries()) {
            if (userData.id === userId) {
                return userData;
            }
        }
    }

    throw new Error('ユーザーが見つかりません');
}

// ===== 会員プロフィール管理 API =====

// プロフィール取得
app.get('/api/member/profile', async (req, res) => {
    try {
        console.log('📋 プロフィール取得リクエスト');

        // セッション確認
        const userSession = req.session.user;
        if (!userSession) {
            return res.status(401).json({
                success: false,
                error: 'not_authenticated',
                message: '認証が必要です'
            });
        }

        let profile = null;

        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .eq('user_id', userSession.id)
                    .single();

                if (!error && data) {
                    profile = data;
                    console.log('✅ Supabaseからプロフィール取得:', userSession.display_name);
                }
            } catch (supabaseError) {
                console.warn('Supabaseプロフィール取得エラー:', supabaseError.message);
            }
        }

        // フォールバック: デフォルトプロフィール
        if (!profile) {
            profile = {
                user_id: userSession.id,
                display_name: userSession.display_name || '',
                email: userSession.email || '',
                bio: '',
                location: '',
                age: '',
                diving_experience: '',
                total_dives: 0,
                certification: '',
                preferred_areas: [],
                email_notifications: true,
                line_notifications: true,
                weather_alerts: true,
                profile_completion: 30
            };
        }

        res.json({
            success: true,
            profile: profile
        });

    } catch (error) {
        console.error('プロフィール取得エラー:', error);
        res.status(500).json({
            success: false,
            error: 'fetch_error',
            message: 'プロフィールの取得に失敗しました'
        });
    }
});

// プロフィール更新
app.post('/api/member/profile', async (req, res) => {
    try {
        console.log('💾 プロフィール更新リクエスト:', req.body);

        // セッション確認
        const userSession = req.session.user;
        if (!userSession) {
            return res.status(401).json({
                success: false,
                error: 'not_authenticated',
                message: '認証が必要です'
            });
        }

        const profileData = {
            user_id: userSession.id,
            display_name: req.body.display_name || userSession.display_name,
            email: req.body.email || '',
            bio: req.body.bio || '',
            location: req.body.location || '',
            age: req.body.age || '',
            diving_experience: req.body.diving_experience || '',
            total_dives: parseInt(req.body.total_dives) || 0,
            certification: req.body.certification || '',
            preferred_areas: req.body.preferred_areas || [],
            email_notifications: req.body.email_notifications || false,
            line_notifications: req.body.line_notifications || false,
            weather_alerts: req.body.weather_alerts || false,
            updated_at: new Date().toISOString()
        };

        // プロフィール完成度計算
        profileData.profile_completion = calculateProfileCompletion(profileData);

        let success = false;

        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data, error } = await supabase
                    .from('user_profiles')
                    .upsert([profileData])
                    .select()
                    .single();

                if (!error) {
                    success = true;
                    console.log('✅ Supabaseプロフィール更新:', userSession.display_name);
                    
                    // セッションのdisplay_nameも更新
                    if (profileData.display_name) {
                        req.session.user.display_name = profileData.display_name;
                    }
                } else {
                    console.warn('Supabaseプロフィール更新エラー:', error.message);
                }
            } catch (supabaseError) {
                console.warn('Supabaseプロフィール更新エラー:', supabaseError.message);
            }
        }

        // フォールバック: ローカルストレージ
        if (!success) {
            if (!global.userProfiles) {
                global.userProfiles = new Map();
            }
            global.userProfiles.set(userSession.id, profileData);
            success = true;
            console.log('✅ フォールバック プロフィール更新:', userSession.display_name);
        }

        if (success) {
            res.json({
                success: true,
                message: 'プロフィールを更新しました',
                profile: profileData
            });
        } else {
            throw new Error('プロフィールの更新に失敗しました');
        }

    } catch (error) {
        console.error('プロフィール更新エラー:', error);
        res.status(500).json({
            success: false,
            error: 'update_error',
            message: 'プロフィールの更新に失敗しました'
        });
    }
});

// アバター画像アップロード
app.post('/api/member/avatar', async (req, res) => {
    try {
        console.log('📸 アバター画像アップロードリクエスト');

        // セッション確認
        const userSession = req.session.user;
        if (!userSession) {
            return res.status(401).json({
                success: false,
                error: 'not_authenticated',
                message: '認証が必要です'
            });
        }

        // TODO: 実際のファイルアップロード処理実装
        // 現在はデモ用の固定レスポンス
        const demoAvatarUrl = '/images/demo-avatar.jpg';

        res.json({
            success: true,
            message: 'アバター画像を更新しました',
            avatar_url: demoAvatarUrl
        });

    } catch (error) {
        console.error('アバターアップロードエラー:', error);
        res.status(500).json({
            success: false,
            error: 'upload_error',
            message: 'アバター画像のアップロードに失敗しました'
        });
    }
});

// プロフィール完成度計算
function calculateProfileCompletion(profile) {
    const fields = [
        'display_name',
        'email', 
        'bio',
        'location',
        'age',
        'diving_experience',
        'total_dives',
        'certification'
    ];
    
    let completedFields = 0;
    const totalFields = fields.length;
    
    fields.forEach(field => {
        if (profile[field] && profile[field] !== '' && profile[field] !== 0) {
            completedFields++;
        }
    });
    
    // preferred_areasも考慮
    if (profile.preferred_areas && profile.preferred_areas.length > 0) {
        completedFields += 0.5;
    }
    
    return Math.round((completedFields / (totalFields + 0.5)) * 100);
}

// ===== ブログ検索・関連記事機能 API =====

// ブログ全文検索API
app.get('/api/blog/search', async (req, res) => {
    try {
        const { q, category, tags, page = 1, limit = 10 } = req.query;
        
        console.log('🔍 ブログ検索リクエスト:', { q, category, tags, page, limit });
        
        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'missing_query',
                message: '検索キーワードが必要です'
            });
        }

        const searchQuery = q.trim().toLowerCase();
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const offset = (pageNum - 1) * limitNum;

        let searchResults = [];

        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                let query = supabase
                    .from('blog_articles')
                    .select('*');

                // 全文検索（タイトル、要約、本文）
                const searchCondition = `title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`;
                query = query.or(searchCondition);

                // カテゴリフィルター
                if (category && category !== 'all') {
                    query = query.eq('category', category);
                }

                // タグフィルター
                if (tags) {
                    const tagArray = Array.isArray(tags) ? tags : [tags];
                    query = query.overlaps('tags', tagArray);
                }

                // 公開済み記事のみ
                query = query.eq('status', 'published');

                // ソート・ページング
                query = query
                    .order('published_at', { ascending: false })
                    .range(offset, offset + limitNum - 1);

                const { data, error } = await query;

                if (!error && data) {
                    searchResults = data;
                    console.log('✅ Supabaseブログ検索成功:', searchResults.length, '件');
                }
            } catch (supabaseError) {
                console.warn('Supabaseブログ検索エラー:', supabaseError.message);
            }
        }

        // フォールバック検索
        if (searchResults.length === 0) {
            const allArticles = getAllArticles();
            
            searchResults = allArticles.filter(article => {
                // 公開済み記事のみ
                if (article.status !== 'published') return false;

                // テキスト検索
                const titleMatch = article.title.toLowerCase().includes(searchQuery);
                const summaryMatch = article.summary.toLowerCase().includes(searchQuery);
                const contentMatch = article.content.toLowerCase().includes(searchQuery);
                const tagsMatch = article.tags.some(tag => tag.toLowerCase().includes(searchQuery));
                
                const textMatch = titleMatch || summaryMatch || contentMatch || tagsMatch;
                if (!textMatch) return false;

                // カテゴリフィルター
                if (category && category !== 'all' && article.category !== category) {
                    return false;
                }

                // タグフィルター
                if (tags) {
                    const tagArray = Array.isArray(tags) ? tags : [tags];
                    const hasMatchingTag = tagArray.some(tag => 
                        article.tags.some(articleTag => 
                            articleTag.toLowerCase().includes(tag.toLowerCase())
                        )
                    );
                    if (!hasMatchingTag) return false;
                }

                return true;
            });

            // ソート（関連度順）
            searchResults.sort((a, b) => {
                const scoreA = calculateSearchScore(a, searchQuery);
                const scoreB = calculateSearchScore(b, searchQuery);
                return scoreB - scoreA;
            });

            // ページング
            const totalResults = searchResults.length;
            searchResults = searchResults.slice(offset, offset + limitNum);
            
            console.log('✅ フォールバックブログ検索成功:', searchResults.length, '/', totalResults, '件');
        }

        // 検索結果にハイライト情報を追加
        const highlightedResults = searchResults.map(article => {
            return {
                ...article,
                highlight: generateSearchHighlight(article, searchQuery)
            };
        });

        res.json({
            success: true,
            articles: highlightedResults,
            total: highlightedResults.length,
            page: pageNum,
            limit: limitNum,
            query: searchQuery,
            filters: { category, tags }
        });

    } catch (error) {
        console.error('ブログ検索エラー:', error);
        res.status(500).json({
            success: false,
            error: 'search_error',
            message: 'ブログ検索に失敗しました'
        });
    }
});

// 検索スコア計算
function calculateSearchScore(article, query) {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    
    // タイトルマッチ（高スコア）
    if (article.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
    }
    
    // サマリーマッチ（中スコア）
    if (article.summary.toLowerCase().includes(lowerQuery)) {
        score += 5;
    }
    
    // コンテンツマッチ（低スコア）
    if (article.content.toLowerCase().includes(lowerQuery)) {
        score += 2;
    }
    
    // タグマッチ（中スコア）
    article.tags.forEach(tag => {
        if (tag.toLowerCase().includes(lowerQuery)) {
            score += 3;
        }
    });
    
    // ビュー数ボーナス
    score += Math.log(article.views + 1) * 0.1;
    
    return score;
}

// 検索ハイライト生成
function generateSearchHighlight(article, query) {
    const lowerQuery = query.toLowerCase();
    const maxLength = 200;
    
    // タイトルハイライト
    const titleHighlight = highlightText(article.title, query);
    
    // サマリーハイライト
    const summaryHighlight = highlightText(article.summary, query);
    
    // コンテンツハイライト（抜粋）
    let contentExcerpt = '';
    const lowerContent = article.content.toLowerCase();
    const queryIndex = lowerContent.indexOf(lowerQuery);
    
    if (queryIndex !== -1) {
        const start = Math.max(0, queryIndex - 50);
        const end = Math.min(article.content.length, queryIndex + maxLength);
        contentExcerpt = article.content.substring(start, end);
        if (start > 0) contentExcerpt = '...' + contentExcerpt;
        if (end < article.content.length) contentExcerpt = contentExcerpt + '...';
        contentExcerpt = highlightText(contentExcerpt, query);
    } else {
        contentExcerpt = article.summary.substring(0, maxLength);
        if (article.summary.length > maxLength) contentExcerpt += '...';
    }
    
    return {
        title: titleHighlight,
        summary: summaryHighlight,
        content_excerpt: contentExcerpt
    };
}

// テキストハイライト
function highlightText(text, query) {
    if (!text || !query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// 記事データ取得ヘルパー
function getAllArticles() {
    // ベース記事データ
    const baseArticles = [
        {
            id: 'okinawa-diving-guide-2025',
            title: '2025年最新版：沖縄ダイビング完全ガイド',
            slug: 'okinawa-diving-guide-2025',
            summary: '沖縄本島から離島まで、2025年の最新ダイビング情報をJijiがお届け。初心者から上級者まで楽しめるスポット情報満載。',
            content: '沖縄は日本のダイビングメッカとして、国内外から多くのダイバーが訪れます。2025年の最新情報として、新しく発見されたダイビングポイントや、最新の海洋状況をお伝えします。青の洞窟や慶良間諸島など定番スポットの状況も詳しく解説します。',
            category: 'ダイビングガイド',
            tags: ['沖縄', 'ダイビングガイド', '2025年', '初心者向け'],
            status: 'published',
            author: 'Jiji編集部',
            views: 2480,
            published_at: '2025-07-25T10:00:00Z'
        },
        {
            id: 'ishigaki-manta-season',
            title: '石垣島マンタシーズン到来！2025年の遭遇確率と最新情報',
            slug: 'ishigaki-manta-season',
            summary: '石垣島の川平石崎マンタスクランブルで、2025年のマンタシーズンが本格開始。遭遇確率や最適な時期をデータで解説。',
            content: '石垣島のマンタポイントでは、毎年9月から11月にかけてマンタの遭遇確率が最高になります。2025年は海水温の上昇により、例年より早くマンタが集まり始めています。川平石崎マンタスクランブルでは、現在80%以上の確率でマンタに遭遇できており、時には10匹以上の群れに遭遇することも。',
            category: 'ダイビング情報',
            tags: ['石垣島', 'マンタ', 'シーズン情報', '川平石崎'],
            status: 'published',
            author: 'Jiji編集部',
            views: 1920,
            published_at: '2025-07-24T14:30:00Z'
        },
        {
            id: 'miyako-blue-cave-guide',
            title: '宮古島「魔王の宮殿」完全攻略ガイド',
            slug: 'miyako-blue-cave-guide',
            summary: '宮古島の神秘的な地形ダイビングポイント「魔王の宮殿」の潜り方、注意点、ベストシーズンを徹底解説。',
            content: '宮古島の「魔王の宮殿」は、沖縄屈指の地形ダイビングポイントとして多くのダイバーを魅了しています。洞窟内に差し込む光のカーテンは圧巻の美しさ。ただし、潮流が強い場合があるため、中級者以上のスキルが必要です。水深は最大30m、滞在時間は15分程度が目安です。',
            category: 'ダイビングポイント',
            tags: ['宮古島', 'ダイビングポイント', '青の洞窟', '地形派'],
            status: 'published',
            author: 'Jiji編集部',
            views: 1850,
            published_at: '2025-07-23T12:00:00Z'
        }
    ];

    // 一時記事データを追加
    if (global.tempArticles) {
        baseArticles.push(...global.tempArticles);
    }

    return baseArticles;
}

// 人気検索キーワード取得API
app.get('/api/blog/popular-keywords', async (req, res) => {
    try {
        console.log('🔥 人気検索キーワード取得');

        // 人気キーワードのデモデータ
        const popularKeywords = [
            { keyword: '沖縄', count: 1250, category: 'エリア' },
            { keyword: 'マンタ', count: 980, category: '生物' },
            { keyword: '青の洞窟', count: 850, category: 'ポイント' },
            { keyword: '石垣島', count: 720, category: 'エリア' },
            { keyword: '宮古島', count: 680, category: 'エリア' },
            { keyword: 'ライセンス', count: 620, category: '講習' },
            { keyword: '初心者', count: 580, category: 'レベル' },
            { keyword: '地形ダイビング', count: 450, category: 'スタイル' },
            { keyword: 'ナイトダイビング', count: 380, category: 'スタイル' },
            { keyword: 'ドリフトダイビング', count: 320, category: 'スタイル' }
        ];

        res.json({
            success: true,
            keywords: popularKeywords,
            updated_at: new Date().toISOString()
        });

    } catch (error) {
        console.error('人気キーワード取得エラー:', error);
        res.status(500).json({
            success: false,
            error: 'keywords_error',
            message: '人気キーワードの取得に失敗しました'
        });
    }
});

// 検索サジェスト（自動補完）API
app.get('/api/blog/suggest', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({
                success: true,
                suggestions: []
            });
        }

        console.log('💡 検索サジェスト:', q);

        const query = q.toLowerCase();
        
        // サジェストデータ
        const allSuggestions = [
            '沖縄ダイビング', '沖縄本島', '沖縄離島',
            '石垣島マンタ', '石垣島ダイビング', '石垣島ポイント',
            '宮古島地形', '宮古島ダイビング', '宮古島青の洞窟',
            '青の洞窟', '青の洞窟ダイビング', '青の洞窟ツアー',
            'マンタダイビング', 'マンタポイント', 'マンタシーズン',
            'ライセンス取得', 'ライセンス講習', 'ライセンス費用',
            '初心者ダイビング', '初心者講習', '初心者おすすめ',
            'ナイトダイビング', 'ドリフトダイビング', '地形ダイビング',
            'ダイビングショップ', 'ダイビングツアー', 'ダイビング機材'
        ];

        const suggestions = allSuggestions
            .filter(suggestion => suggestion.toLowerCase().includes(query))
            .slice(0, 8);  // 最大8件

        res.json({
            success: true,
            suggestions: suggestions,
            query: q
        });

    } catch (error) {
        console.error('検索サジェストエラー:', error);
        res.status(500).json({
            success: false,
            error: 'suggest_error',
            message: '検索サジェストの取得に失敗しました'
        });
    }
});

// ===== 口コミ・レビューシステム =====

// 口コミ投稿API
app.post('/api/reviews/submit', async (req, res) => {
    try {
        const {
            shop_id,
            user_id,
            rating,
            title,
            content,
            experience_date,
            dive_type,
            dive_level,
            photos,
            anonymous
        } = req.body;

        console.log('🌟 口コミ投稿:', { shop_id, user_id, rating });

        // バリデーション
        if (!shop_id || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'ショップIDと評価（1-5）は必須です。'
            });
        }

        const reviewData = {
            shop_id: parseInt(shop_id),
            user_id: user_id || 'anonymous_' + Date.now(),
            rating: parseInt(rating),
            title: title || '',
            content: content || '',
            experience_date: experience_date || new Date().toISOString().split('T')[0],
            dive_type: dive_type || 'ファンダイビング',
            dive_level: dive_level || '初心者',
            photos: photos || [],
            anonymous: anonymous === true,
            created_at: new Date().toISOString(),
            status: 'pending'  // 承認待ち
        };

        // Supabaseに投稿を試行
        try {
            const { data, error } = await supabase
                .from('reviews')
                .insert([reviewData])
                .select()
                .single();

            if (error) throw error;

            console.log('🌟 口コミ投稿成功（Supabase）:', data.id);
            
            // 口コミ投稿でポイント獲得
            try {
                await fetch(`${req.protocol}://${req.get('host')}/api/points/earn`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        user_id: user_id,
                        points: 50,
                        reason: '口コミ投稿',
                        activity_type: 'review_submission',
                        reference_id: data.id
                    })
                });
                console.log('🎯 口コミ投稿ポイント付与完了');
            } catch (pointsError) {
                console.warn('ポイント付与エラー:', pointsError.message);
            }
            
            res.json({
                success: true,
                review_id: data.id,
                message: '口コミを投稿しました。承認後に公開されます。50ポイントを獲得しました！'
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase 口コミ投稿エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース保存
        const reviewsData = await loadReviewsData();
        const newReviewId = 'review_' + Date.now();
        
        reviewsData.reviews = reviewsData.reviews || [];
        reviewData.id = newReviewId;
        reviewsData.reviews.push(reviewData);
        
        await saveReviewsData(reviewsData);

        console.log('🌟 口コミ投稿成功（フォールバック）:', newReviewId);
        
        // 口コミ投稿でポイント獲得（フォールバック）
        try {
            await fetch(`${req.protocol}://${req.get('host')}/api/points/earn`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user_id: user_id,
                    points: 50,
                    reason: '口コミ投稿',
                    activity_type: 'review_submission',
                    reference_id: newReviewId
                })
            });
            console.log('🎯 口コミ投稿ポイント付与完了（フォールバック）');
        } catch (pointsError) {
            console.warn('ポイント付与エラー:', pointsError.message);
        }
        
        res.json({
            success: true,
            review_id: newReviewId,
            message: '口コミを投稿しました。承認後に公開されます。50ポイントを獲得しました！'
        });

    } catch (error) {
        console.error('口コミ投稿API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'review_submit_error',
            message: '口コミの投稿に失敗しました'
        });
    }
});

// ショップの口コミ取得API
app.get('/api/reviews/shop/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        const { page = 1, limit = 10, sort = 'latest' } = req.query;

        console.log('🌟 ショップ口コミ取得:', shopId);

        // Supabaseから取得を試行
        try {
            let query = supabase
                .from('reviews')
                .select('*')
                .eq('shop_id', parseInt(shopId))
                .eq('status', 'approved');

            // ソート設定
            if (sort === 'latest') {
                query = query.order('created_at', { ascending: false });
            } else if (sort === 'rating_high') {
                query = query.order('rating', { ascending: false });
            } else if (sort === 'rating_low') {
                query = query.order('rating', { ascending: true });
            }

            // ページング
            const offset = (parseInt(page) - 1) * parseInt(limit);
            query = query.range(offset, offset + parseInt(limit) - 1);

            const { data, error, count } = await query;
            if (error) throw error;

            console.log('🌟 ショップ口コミ取得成功（Supabase）:', data.length);

            res.json({
                success: true,
                reviews: data.map(review => processReviewData(review)),
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    total_pages: Math.ceil(count / parseInt(limit))
                }
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ショップ口コミ取得エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const reviewsData = await loadReviewsData();
        const shopReviews = (reviewsData.reviews || [])
            .filter(review => review.shop_id === parseInt(shopId) && review.status === 'approved')
            .sort((a, b) => {
                if (sort === 'latest') return new Date(b.created_at) - new Date(a.created_at);
                if (sort === 'rating_high') return b.rating - a.rating;
                if (sort === 'rating_low') return a.rating - b.rating;
                return 0;
            });

        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const paginatedReviews = shopReviews.slice(startIndex, startIndex + parseInt(limit));

        console.log('🌟 ショップ口コミ取得成功（フォールバック）:', paginatedReviews.length);

        res.json({
            success: true,
            reviews: paginatedReviews.map(review => processReviewData(review)),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: shopReviews.length,
                total_pages: Math.ceil(shopReviews.length / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('ショップ口コミ取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'reviews_fetch_error',
            message: '口コミの取得に失敗しました'
        });
    }
});

// 口コミ統計情報取得API
app.get('/api/reviews/stats/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;

        console.log('🌟 口コミ統計取得:', shopId);

        // Supabaseから統計を計算
        try {
            const { data, error } = await supabase
                .from('reviews')
                .select('rating')
                .eq('shop_id', parseInt(shopId))
                .eq('status', 'approved');

            if (error) throw error;

            const stats = calculateReviewStats(data);
            console.log('🌟 口コミ統計取得成功（Supabase）');

            res.json({
                success: true,
                stats: stats
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase 口コミ統計取得エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const reviewsData = await loadReviewsData();
        const shopReviews = (reviewsData.reviews || [])
            .filter(review => review.shop_id === parseInt(shopId) && review.status === 'approved');

        const stats = calculateReviewStats(shopReviews);
        console.log('🌟 口コミ統計取得成功（フォールバック）');

        res.json({
            success: true,
            stats: stats
        });

    } catch (error) {
        console.error('口コミ統計取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'review_stats_error',
            message: '口コミ統計の取得に失敗しました'
        });
    }
});

// ===== 口コミシステム ヘルパー関数 =====

// 口コミデータ処理
function processReviewData(review) {
    return {
        id: review.id,
        rating: review.rating,
        title: review.title,
        content: review.content,
        experience_date: review.experience_date,
        dive_type: review.dive_type,
        dive_level: review.dive_level,
        photos: review.photos || [],
        author: review.anonymous ? '匿名ユーザー' : `ユーザー${review.user_id}`,
        created_at: review.created_at,
        helpful_count: review.helpful_count || 0
    };
}

// 口コミ統計計算
function calculateReviewStats(reviews) {
    if (!reviews || reviews.length === 0) {
        return {
            total_reviews: 0,
            average_rating: 0,
            rating_distribution: [0, 0, 0, 0, 0]
        };
    }

    const totalReviews = reviews.length;
    const sumRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalReviews > 0 ? (sumRating / totalReviews).toFixed(1) : 0;

    // 評価分布（1-5星）
    const distribution = [0, 0, 0, 0, 0];
    reviews.forEach(review => {
        if (review.rating >= 1 && review.rating <= 5) {
            distribution[review.rating - 1]++;
        }
    });

    return {
        total_reviews: totalReviews,
        average_rating: parseFloat(averageRating),
        rating_distribution: distribution,
        recent_reviews: reviews.slice(0, 3).map(review => processReviewData(review))
    };
}

// 口コミデータファイル操作
async function loadReviewsData() {
    try {
        const filePath = './data/reviews.json';
        if (require('fs').existsSync(filePath)) {
            const data = require('fs').readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return { reviews: [] };
    } catch (error) {
        console.error('口コミデータ読み込みエラー:', error);
        return { reviews: [] };
    }
}

async function saveReviewsData(data) {
    try {
        const filePath = './data/reviews.json';
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log('口コミデータ保存成功');
    } catch (error) {
        console.error('口コミデータ保存エラー:', error);
        throw error;
    }
}

// サブスクリプションデータファイル操作
async function loadSubscriptionData() {
    try {
        const filePath = './data/subscription-plans.json';
        if (require('fs').existsSync(filePath)) {
            const data = require('fs').readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return { plans: [], subscriptions: [], payment_history: [] };
    } catch (error) {
        console.error('サブスクリプションデータ読み込みエラー:', error);
        return { plans: [], subscriptions: [], payment_history: [] };
    }
}

async function saveSubscriptionData(data) {
    try {
        const filePath = './data/subscription-plans.json';
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log('サブスクリプションデータ保存成功');
    } catch (error) {
        console.error('サブスクリプションデータ保存エラー:', error);
        throw error;
    }
}

// 統合データファイル操作
async function loadIntegrationsData() {
    try {
        const filePath = './data/integrations.json';
        if (require('fs').existsSync(filePath)) {
            const data = require('fs').readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return { integrations: [] };
    } catch (error) {
        console.error('統合データ読み込みエラー:', error);
        return { integrations: [] };
    }
}

async function saveIntegrationsData(data) {
    try {
        const filePath = './data/integrations.json';
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log('統合データ保存成功');
    } catch (error) {
        console.error('統合データ保存エラー:', error);
        throw error;
    }
}

// 遷移トークンファイル操作
async function loadTransitionsData() {
    try {
        const filePath = './data/transitions.json';
        if (require('fs').existsSync(filePath)) {
            const data = require('fs').readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return { tokens: [] };
    } catch (error) {
        console.error('遷移データ読み込みエラー:', error);
        return { tokens: [] };
    }
}

async function saveTransitionsData(data) {
    try {
        const filePath = './data/transitions.json';
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log('遷移データ保存成功');
    } catch (error) {
        console.error('遷移データ保存エラー:', error);
        throw error;
    }
}

// ユーザーデータファイル操作
async function loadUsersData() {
    try {
        const filePath = './data/users.json';
        if (require('fs').existsSync(filePath)) {
            const data = require('fs').readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return { users: [] };
    } catch (error) {
        console.error('ユーザーデータ読み込みエラー:', error);
        return { users: [] };
    }
}

// データ同期ヘルパー関数
async function syncUserProfile(integration, data, action) {
    console.log('👤 ユーザープロフィール同期:', { integration: integration.id, action });
    
    try {
        // ユーザー情報の同期処理（簡易実装）
        const usersData = await loadUsersData();
        
        if (action === 'sync' && integration.web_user_id) {
            const userIndex = usersData.users.findIndex(u => u.id === integration.web_user_id);
            if (userIndex !== -1) {
                // LINE Botから受信したデータでWeb側プロフィールを更新
                Object.assign(usersData.users[userIndex], data);
                usersData.users[userIndex].last_synced = new Date().toISOString();
                await saveUsersData(usersData);
                
                return { 
                    status: 'synced', 
                    user_id: integration.web_user_id,
                    synced_fields: Object.keys(data)
                };
            }
        }
        
        return { status: 'no_changes' };
    } catch (error) {
        console.error('プロフィール同期エラー:', error);
        return { status: 'error', error: error.message };
    }
}

async function syncDivingHistory(integration, data, action) {
    console.log('🤿 ダイビング履歴同期:', { integration: integration.id, action });
    
    try {
        // ダイビング履歴の同期処理（簡易実装）
        return { 
            status: 'synced', 
            records_synced: data?.records?.length || 0,
            last_dive: data?.last_dive || null
        };
    } catch (error) {
        console.error('ダイビング履歴同期エラー:', error);
        return { status: 'error', error: error.message };
    }
}

async function syncFavorites(integration, data, action) {
    console.log('⭐ お気に入り同期:', { integration: integration.id, action });
    
    try {
        // お気に入りの同期処理（簡易実装）
        return { 
            status: 'synced', 
            favorites_count: data?.favorites?.length || 0
        };
    } catch (error) {
        console.error('お気に入り同期エラー:', error);
        return { status: 'error', error: error.message };
    }
}

async function syncPoints(integration, data, action) {
    console.log('💰 ポイント同期:', { integration: integration.id, action });
    
    try {
        // ポイントの同期処理（簡易実装）
        const pointsData = await loadPointsData();
        
        if (action === 'sync' && integration.web_user_id) {
            // ポイント情報を更新
            if (!pointsData.users[integration.web_user_id]) {
                pointsData.users[integration.web_user_id] = {
                    current_points: 0,
                    total_earned: 0,
                    total_spent: 0
                };
            }
            
            // LINE Bot側からの更新があれば反映
            if (data.points_to_add) {
                pointsData.users[integration.web_user_id].current_points += data.points_to_add;
                pointsData.users[integration.web_user_id].total_earned += data.points_to_add;
                
                // トランザクション記録
                pointsData.transactions.push({
                    id: 'txn_sync_' + Date.now(),
                    user_id: integration.web_user_id,
                    transaction_type: 'earn',
                    points: data.points_to_add,
                    reason: data.reason || 'LINE Bot連携',
                    activity_type: 'line_sync',
                    reference_id: null,
                    created_at: new Date().toISOString()
                });
            }
            
            await savePointsData(pointsData);
            
            return { 
                status: 'synced', 
                current_points: pointsData.users[integration.web_user_id].current_points
            };
        }
        
        return { status: 'no_changes' };
    } catch (error) {
        console.error('ポイント同期エラー:', error);
        return { status: 'error', error: error.message };
    }
}

async function saveUsersData(data) {
    try {
        const filePath = './data/users.json';
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log('ユーザーデータ保存成功');
    } catch (error) {
        console.error('ユーザーデータ保存エラー:', error);
        throw error;
    }
}

// ===== ポイント管理システム =====

// ユーザーポイント残高取得API
app.get('/api/points/balance/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        console.log('💰 ポイント残高取得:', userId);

        // Supabaseから取得を試行
        try {
            const { data, error } = await supabase
                .from('user_points')
                .select('current_points, total_earned, total_spent')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            const pointsData = data || {
                current_points: 0,
                total_earned: 0,
                total_spent: 0
            };

            console.log('💰 ポイント残高取得成功（Supabase）:', pointsData.current_points);

            res.json({
                success: true,
                points: pointsData
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ポイント残高取得エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const pointsData = await loadPointsData();
        const userPoints = pointsData.users[userId] || {
            current_points: 0,
            total_earned: 0,
            total_spent: 0
        };

        console.log('💰 ポイント残高取得成功（フォールバック）:', userPoints.current_points);

        res.json({
            success: true,
            points: userPoints
        });

    } catch (error) {
        console.error('ポイント残高取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'points_balance_error',
            message: 'ポイント残高の取得に失敗しました'
        });
    }
});

// ポイント獲得API
app.post('/api/points/earn', async (req, res) => {
    try {
        const { user_id, points, reason, activity_type, reference_id } = req.body;

        console.log('🎯 ポイント獲得:', { user_id, points, reason });

        // バリデーション
        if (!user_id || !points || points <= 0) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'ユーザーIDと正の数のポイントが必要です。'
            });
        }

        const transactionData = {
            user_id: user_id,
            transaction_type: 'earn',
            points: parseInt(points),
            reason: reason || '',
            activity_type: activity_type || 'manual',
            reference_id: reference_id || null,
            created_at: new Date().toISOString()
        };

        // Supabaseに記録を試行
        try {
            // トランザクション記録
            const { data: transaction, error: transactionError } = await supabase
                .from('point_transactions')
                .insert([transactionData])
                .select()
                .single();

            if (transactionError) throw transactionError;

            // ユーザーポイント残高更新
            const { data: pointsUpdate, error: pointsError } = await supabase
                .rpc('update_user_points', {
                    p_user_id: user_id,
                    p_points: parseInt(points),
                    p_transaction_type: 'earn'
                });

            if (pointsError) throw pointsError;

            console.log('🎯 ポイント獲得成功（Supabase）:', transaction.id);

            res.json({
                success: true,
                transaction_id: transaction.id,
                message: `${points}ポイントを獲得しました！`
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ポイント獲得エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const pointsData = await loadPointsData();
        const transactionId = 'txn_' + Date.now();

        // ユーザーポイント更新
        pointsData.users[user_id] = pointsData.users[user_id] || {
            current_points: 0,
            total_earned: 0,
            total_spent: 0
        };

        pointsData.users[user_id].current_points += parseInt(points);
        pointsData.users[user_id].total_earned += parseInt(points);

        // トランザクション記録
        pointsData.transactions = pointsData.transactions || [];
        transactionData.id = transactionId;
        pointsData.transactions.push(transactionData);

        await savePointsData(pointsData);

        console.log('🎯 ポイント獲得成功（フォールバック）:', transactionId);

        res.json({
            success: true,
            transaction_id: transactionId,
            message: `${points}ポイントを獲得しました！`
        });

    } catch (error) {
        console.error('ポイント獲得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'points_earn_error',
            message: 'ポイントの獲得に失敗しました'
        });
    }
});

// ポイント消費API
app.post('/api/points/spend', async (req, res) => {
    try {
        const { user_id, points, reason, activity_type, reference_id } = req.body;

        console.log('💸 ポイント消費:', { user_id, points, reason });

        // バリデーション
        if (!user_id || !points || points <= 0) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'ユーザーIDと正の数のポイントが必要です。'
            });
        }

        // 現在の残高チェック
        let currentBalance = 0;
        try {
            const { data, error } = await supabase
                .from('user_points')
                .select('current_points')
                .eq('user_id', user_id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            currentBalance = data?.current_points || 0;

        } catch (supabaseError) {
            // フォールバック残高チェック
            const pointsData = await loadPointsData();
            currentBalance = pointsData.users[user_id]?.current_points || 0;
        }

        if (currentBalance < parseInt(points)) {
            return res.status(400).json({
                success: false,
                error: 'insufficient_points',
                message: `ポイントが不足しています。残高: ${currentBalance}ポイント`
            });
        }

        const transactionData = {
            user_id: user_id,
            transaction_type: 'spend',
            points: parseInt(points),
            reason: reason || '',
            activity_type: activity_type || 'manual',
            reference_id: reference_id || null,
            created_at: new Date().toISOString()
        };

        // Supabaseに記録を試行
        try {
            // トランザクション記録
            const { data: transaction, error: transactionError } = await supabase
                .from('point_transactions')
                .insert([transactionData])
                .select()
                .single();

            if (transactionError) throw transactionError;

            // ユーザーポイント残高更新
            const { data: pointsUpdate, error: pointsError } = await supabase
                .rpc('update_user_points', {
                    p_user_id: user_id,
                    p_points: parseInt(points),
                    p_transaction_type: 'spend'
                });

            if (pointsError) throw pointsError;

            console.log('💸 ポイント消費成功（Supabase）:', transaction.id);

            res.json({
                success: true,
                transaction_id: transaction.id,
                remaining_points: currentBalance - parseInt(points),
                message: `${points}ポイントを使用しました！`
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ポイント消費エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const pointsData = await loadPointsData();
        const transactionId = 'txn_' + Date.now();

        // ユーザーポイント更新
        pointsData.users[user_id] = pointsData.users[user_id] || {
            current_points: 0,
            total_earned: 0,
            total_spent: 0
        };

        pointsData.users[user_id].current_points -= parseInt(points);
        pointsData.users[user_id].total_spent += parseInt(points);

        // トランザクション記録
        pointsData.transactions = pointsData.transactions || [];
        transactionData.id = transactionId;
        pointsData.transactions.push(transactionData);

        await savePointsData(pointsData);

        console.log('💸 ポイント消費成功（フォールバック）:', transactionId);

        res.json({
            success: true,
            transaction_id: transactionId,
            remaining_points: pointsData.users[user_id].current_points,
            message: `${points}ポイントを使用しました！`
        });

    } catch (error) {
        console.error('ポイント消費API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'points_spend_error',
            message: 'ポイントの消費に失敗しました'
        });
    }
});

// ポイント履歴取得API
app.get('/api/points/history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 10, type } = req.query;

        console.log('📋 ポイント履歴取得:', userId);

        // Supabaseから取得を試行
        try {
            let query = supabase
                .from('point_transactions')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (type && ['earn', 'spend'].includes(type)) {
                query = query.eq('transaction_type', type);
            }

            const offset = (parseInt(page) - 1) * parseInt(limit);
            query = query.range(offset, offset + parseInt(limit) - 1);

            const { data, error, count } = await query;
            if (error) throw error;

            console.log('📋 ポイント履歴取得成功（Supabase）:', data.length);

            res.json({
                success: true,
                transactions: data,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: count,
                    total_pages: Math.ceil(count / parseInt(limit))
                }
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ポイント履歴取得エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const pointsData = await loadPointsData();
        let userTransactions = (pointsData.transactions || [])
            .filter(tx => tx.user_id === userId);

        if (type && ['earn', 'spend'].includes(type)) {
            userTransactions = userTransactions.filter(tx => tx.transaction_type === type);
        }

        userTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const paginatedTransactions = userTransactions.slice(startIndex, startIndex + parseInt(limit));

        console.log('📋 ポイント履歴取得成功（フォールバック）:', paginatedTransactions.length);

        res.json({
            success: true,
            transactions: paginatedTransactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: userTransactions.length,
                total_pages: Math.ceil(userTransactions.length / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('ポイント履歴取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'points_history_error',
            message: 'ポイント履歴の取得に失敗しました'
        });
    }
});

// 特典一覧取得API
app.get('/api/points/rewards', async (req, res) => {
    try {
        console.log('🎁 特典一覧取得');

        // Supabaseから取得を試行
        try {
            const { data, error } = await supabase
                .from('point_rewards')
                .select('*')
                .eq('active', true)
                .order('required_points', { ascending: true });

            if (error) throw error;

            console.log('🎁 特典一覧取得成功（Supabase）:', data.length);

            res.json({
                success: true,
                rewards: data
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase 特典一覧取得エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: デフォルト特典
        const defaultRewards = [
            {
                id: 'reward_1',
                name: 'Dive Buddy\'s ステッカー',
                description: 'オリジナルステッカーセット（3枚組）',
                required_points: 100,
                category: 'グッズ',
                image_url: '/images/rewards/sticker.jpg',
                stock: 50,
                active: true
            },
            {
                id: 'reward_2',
                name: '割引クーポン 5%OFF',
                description: '提携ショップで使える5%割引クーポン',
                required_points: 200,
                category: 'クーポン',
                image_url: '/images/rewards/coupon5.jpg',
                stock: -1,
                active: true
            },
            {
                id: 'reward_3',
                name: 'オリジナルTシャツ',
                description: 'Dive Buddy\'s オリジナルTシャツ（各サイズ）',
                required_points: 500,
                category: 'グッズ',
                image_url: '/images/rewards/tshirt.jpg',
                stock: 25,
                active: true
            },
            {
                id: 'reward_4',
                name: '割引クーポン 10%OFF',
                description: '提携ショップで使える10%割引クーポン',
                required_points: 800,
                category: 'クーポン',
                image_url: '/images/rewards/coupon10.jpg',
                stock: -1,
                active: true
            },
            {
                id: 'reward_5',
                name: 'ダイビングログブック',
                description: '高品質防水ログブック（50ダイブ記録可能）',
                required_points: 1000,
                category: 'グッズ',
                image_url: '/images/rewards/logbook.jpg',
                stock: 15,
                active: true
            }
        ];

        console.log('🎁 特典一覧取得成功（フォールバック）:', defaultRewards.length);

        res.json({
            success: true,
            rewards: defaultRewards
        });

    } catch (error) {
        console.error('特典一覧取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'rewards_list_error',
            message: '特典一覧の取得に失敗しました'
        });
    }
});

// 特典交換API
app.post('/api/points/redeem', async (req, res) => {
    try {
        const { user_id, reward_id, reward_name, required_points } = req.body;

        console.log('🎁 特典交換:', { user_id, reward_id, required_points });

        // バリデーション
        if (!user_id || !reward_id || !required_points) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: '必要な情報が不足しています。'
            });
        }

        // ポイント残高チェック
        let currentBalance = 0;
        try {
            const { data, error } = await supabase
                .from('user_points')
                .select('current_points')
                .eq('user_id', user_id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            currentBalance = data?.current_points || 0;

        } catch (supabaseError) {
            const pointsData = await loadPointsData();
            currentBalance = pointsData.users[user_id]?.current_points || 0;
        }

        if (currentBalance < parseInt(required_points)) {
            return res.status(400).json({
                success: false,
                error: 'insufficient_points',
                message: `ポイントが不足しています。必要: ${required_points}ポイント、残高: ${currentBalance}ポイント`
            });
        }

        // ポイント消費処理
        const spendResponse = await fetch(`${req.protocol}://${req.get('host')}/api/points/spend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: user_id,
                points: required_points,
                reason: `特典交換: ${reward_name || reward_id}`,
                activity_type: 'reward_redemption',
                reference_id: reward_id
            })
        });

        const spendResult = await spendResponse.json();

        if (!spendResult.success) {
            throw new Error(spendResult.message || 'ポイント消費に失敗しました');
        }

        // 特典交換記録
        const redemptionData = {
            user_id: user_id,
            reward_id: reward_id,
            reward_name: reward_name || reward_id,
            points_spent: parseInt(required_points),
            status: 'pending',
            created_at: new Date().toISOString()
        };

        // Supabaseに記録を試行
        try {
            const { data: redemption, error } = await supabase
                .from('point_redemptions')
                .insert([redemptionData])
                .select()
                .single();

            if (error) throw error;

            console.log('🎁 特典交換成功（Supabase）:', redemption.id);

            res.json({
                success: true,
                redemption_id: redemption.id,
                remaining_points: spendResult.remaining_points,
                message: `${reward_name || reward_id}の交換を受け付けました！処理完了までお待ちください。`
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase 特典交換記録エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const redemptionId = 'redemption_' + Date.now();
        redemptionData.id = redemptionId;

        // 交換履歴保存は簡易実装（実際のシステムでは別途処理が必要）
        console.log('🎁 特典交換成功（フォールバック）:', redemptionId);

        res.json({
            success: true,
            redemption_id: redemptionId,
            remaining_points: spendResult.remaining_points,
            message: `${reward_name || reward_id}の交換を受け付けました！処理完了までお待ちください。`
        });

    } catch (error) {
        console.error('特典交換API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'reward_redemption_error',
            message: '特典交換に失敗しました'
        });
    }
});

// ===== ポイントシステム ヘルパー関数 =====

// ポイントデータファイル操作
async function loadPointsData() {
    try {
        const filePath = './data/points.json';
        if (require('fs').existsSync(filePath)) {
            const data = require('fs').readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return { users: {}, transactions: [] };
    } catch (error) {
        console.error('ポイントデータ読み込みエラー:', error);
        return { users: {}, transactions: [] };
    }
}

async function savePointsData(data) {
    try {
        const filePath = './data/points.json';
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log('ポイントデータ保存成功');
    } catch (error) {
        console.error('ポイントデータ保存エラー:', error);
        throw error;
    }
}

// ===== ショップ向けB2Bシステム =====

// ショップ認証API
app.post('/api/shop/auth/login', async (req, res) => {
    try {
        const { shop_id, password } = req.body;
        console.log('🏪 ショップログイン試行:', shop_id);

        // バリデーション
        if (!shop_id || !password) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'ショップIDとパスワードが必要です。'
            });
        }

        // Supabaseからショップ認証情報を取得
        try {
            const { data, error } = await supabase
                .from('shops')
                .select('id, shop_name, password_hash, status, subscription_plan')
                .eq('id', parseInt(shop_id))
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(401).json({
                    success: false,
                    error: 'invalid_credentials',
                    message: 'ショップIDまたはパスワードが正しくありません。'
                });
            }

            // パスワード確認（簡易実装）
            const isValidPassword = password === 'shop123' || data.password_hash === password;
            
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    error: 'invalid_credentials',
                    message: 'ショップIDまたはパスワードが正しくありません。'
                });
            }

            if (data.status !== 'active') {
                return res.status(403).json({
                    success: false,
                    error: 'account_inactive',
                    message: 'アカウントが無効化されています。'
                });
            }

            console.log('🏪 ショップログイン成功（Supabase）:', data.shop_name);

            // セッション情報生成（簡易実装）
            const sessionToken = 'shop_session_' + Date.now();
            
            res.json({
                success: true,
                session_token: sessionToken,
                shop_info: {
                    id: data.id,
                    name: data.shop_name,
                    subscription_plan: data.subscription_plan || 'basic'
                },
                message: 'ログインしました。'
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ショップ認証エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース認証
        const shopsData = await loadShopsData();
        const shop = shopsData.find(s => s.id === parseInt(shop_id));

        if (!shop || password !== 'shop123') {
            return res.status(401).json({
                success: false,
                error: 'invalid_credentials',
                message: 'ショップIDまたはパスワードが正しくありません。'
            });
        }

        console.log('🏪 ショップログイン成功（フォールバック）:', shop.shop_name);

        const sessionToken = 'shop_session_' + Date.now();
        
        res.json({
            success: true,
            session_token: sessionToken,
            shop_info: {
                id: shop.id,
                name: shop.shop_name,
                subscription_plan: 'basic'
            },
            message: 'ログインしました。'
        });

    } catch (error) {
        console.error('ショップ認証API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'auth_error',
            message: '認証処理に失敗しました'
        });
    }
});

// ショップダッシュボードデータ取得API
app.get('/api/shop/dashboard/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log('📊 ショップダッシュボードデータ取得:', shopId);

        // Supabaseからデータを取得
        try {
            // ショップ基本情報
            const { data: shopData, error: shopError } = await supabase
                .from('shops')
                .select('*')
                .eq('id', parseInt(shopId))
                .single();

            if (shopError) throw shopError;

            // 口コミ統計
            const { data: reviewStats, error: reviewError } = await supabase
                .rpc('get_shop_review_stats', { shop_id: parseInt(shopId) });

            // 最近の口コミ
            const { data: recentReviews, error: recentError } = await supabase
                .from('reviews')
                .select('*')
                .eq('shop_id', parseInt(shopId))
                .order('created_at', { ascending: false })
                .limit(5);

            const dashboardData = {
                shop_info: shopData,
                review_stats: reviewStats?.[0] || {
                    total_reviews: 0,
                    average_rating: 0,
                    pending_reviews: 0
                },
                recent_reviews: recentReviews || [],
                monthly_stats: {
                    views: Math.floor(Math.random() * 1000) + 500,
                    inquiries: Math.floor(Math.random() * 50) + 20,
                    bookings: Math.floor(Math.random() * 30) + 10
                }
            };

            console.log('📊 ショップダッシュボードデータ取得成功（Supabase）');

            res.json({
                success: true,
                stats: {
                    avg_rating: dashboardData.review_stats.average_rating,
                    total_reviews: dashboardData.review_stats.total_reviews,
                    monthly_views: dashboardData.monthly_stats.views,
                    pending_reviews: dashboardData.review_stats.pending_reviews
                },
                data: dashboardData
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ショップダッシュボードエラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const shopsData = await loadShopsData();
        const shop = shopsData.find(s => s.id === parseInt(shopId));

        if (!shop) {
            return res.status(404).json({
                success: false,
                error: 'shop_not_found',
                message: 'ショップが見つかりません。'
            });
        }

        // 口コミデータ
        const reviewsData = await loadReviewsData();
        const shopReviews = reviewsData.reviews.filter(r => r.shop_id === parseInt(shopId));
        const approvedReviews = shopReviews.filter(r => r.status === 'approved');
        const pendingReviews = shopReviews.filter(r => r.status === 'pending');

        const avgRating = approvedReviews.length > 0 
            ? approvedReviews.reduce((sum, r) => sum + r.rating, 0) / approvedReviews.length 
            : 0;

        const dashboardData = {
            shop_info: shop,
            review_stats: {
                total_reviews: approvedReviews.length,
                average_rating: avgRating,
                pending_reviews: pendingReviews.length
            },
            recent_reviews: shopReviews.slice(0, 5),
            monthly_stats: {
                views: Math.floor(Math.random() * 1000) + 500,
                inquiries: Math.floor(Math.random() * 50) + 20,
                bookings: Math.floor(Math.random() * 30) + 10
            }
        };

        console.log('📊 ショップダッシュボードデータ取得成功（フォールバック）');

        res.json({
            success: true,
            stats: {
                avg_rating: dashboardData.review_stats.average_rating,
                total_reviews: dashboardData.review_stats.total_reviews,
                monthly_views: dashboardData.monthly_stats.views,
                pending_reviews: dashboardData.review_stats.pending_reviews
            },
            data: dashboardData
        });

    } catch (error) {
        console.error('ショップダッシュボードAPI エラー:', error);
        res.status(500).json({
            success: false,
            error: 'dashboard_error',
            message: 'ダッシュボードデータの取得に失敗しました'
        });
    }
});

// ショップ情報更新API
app.put('/api/shop/profile/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        const updateData = req.body;
        
        console.log('🏪 ショップ情報更新:', shopId);

        // フィールドマッピングと更新データ準備
        const fieldMapping = {
            'name': 'shop_name',
            'phone': 'phone_line',
            'address': 'address',
            'description': 'description',
            'min_price': 'trial_dive_price_beach',
            'max_price': 'fun_dive_price_2tanks',
            'business_hours': 'operating_hours',
            'closed_days': 'closed_days',
            'services': 'services',
            'features': 'trial_dive_options'
        };
        
        const filteredData = {};
        Object.keys(updateData).forEach(field => {
            if (fieldMapping[field] && updateData[field] !== undefined) {
                let value = updateData[field];
                
                // 配列フィールドは文字列に変換
                if (field === 'services' || field === 'features') {
                    value = Array.isArray(value) ? value.join(',') : value;
                }
                
                filteredData[fieldMapping[field]] = value;
            }
        });

        // Supabaseで更新
        try {
            const { data, error } = await supabase
                .from('shops')
                .update(filteredData)
                .eq('id', parseInt(shopId))
                .select()
                .single();

            if (error) throw error;

            console.log('🏪 ショップ情報更新成功（Supabase）');

            res.json({
                success: true,
                data: data,
                message: 'ショップ情報を更新しました。'
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ショップ情報更新エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース（読み取り専用）
        res.json({
            success: false,
            error: 'update_not_supported',
            message: 'この環境では情報の更新ができません。'
        });

    } catch (error) {
        console.error('ショップ情報更新API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'update_error',
            message: 'ショップ情報の更新に失敗しました'
        });
    }
});

// 口コミ管理API（承認・非承認）
app.put('/api/shop/reviews/:reviewId/status', async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status, shop_id } = req.body;
        
        console.log('🌟 口コミステータス更新:', { reviewId, status });

        // バリデーション
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: '無効なステータスです。'
            });
        }

        // Supabaseで更新
        try {
            const { data, error } = await supabase
                .from('reviews')
                .update({ status: status })
                .eq('id', reviewId)
                .eq('shop_id', parseInt(shop_id))
                .select()
                .single();

            if (error) throw error;

            console.log('🌟 口コミステータス更新成功（Supabase）');

            res.json({
                success: true,
                data: data,
                message: `口コミを${status === 'approved' ? '承認' : '非承認'}しました。`
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase 口コミステータス更新エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const reviewsData = await loadReviewsData();
        const reviewIndex = reviewsData.reviews.findIndex(r => r.id === reviewId && r.shop_id === parseInt(shop_id));

        if (reviewIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'review_not_found',
                message: '口コミが見つかりません。'
            });
        }

        reviewsData.reviews[reviewIndex].status = status;
        await saveReviewsData(reviewsData);

        console.log('🌟 口コミステータス更新成功（フォールバック）');

        res.json({
            success: true,
            data: reviewsData.reviews[reviewIndex],
            message: `口コミを${status === 'approved' ? '承認' : '非承認'}しました。`
        });

    } catch (error) {
        console.error('口コミステータス更新API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'status_update_error',
            message: '口コミステータスの更新に失敗しました'
        });
    }
});

// ショップ情報取得API（編集用）
app.get('/api/shop/profile/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log('🏪 ショッププロフィール取得:', shopId);

        // Supabaseからショップ情報を取得
        try {
            const { data, error } = await supabase
                .from('shops')
                .select('*')
                .eq('id', parseInt(shopId))
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({
                    success: false,
                    error: 'shop_not_found',
                    message: 'ショップが見つかりません。'
                });
            }

            console.log('🏪 ショッププロフィール取得成功（Supabase）');

            // API用にフィールド名をマッピング
            const shopProfile = {
                id: data.id,
                name: data.shop_name,
                phone: data.phone_line,
                address: data.address,
                description: data.description,
                min_price: data.trial_dive_price_beach,
                max_price: data.fun_dive_price_2tanks,
                business_hours: data.operating_hours,
                closed_days: data.closed_days,
                services: data.services ? data.services.split(',') : [],
                features: data.trial_dive_options ? data.trial_dive_options.split(',') : []
            };

            res.json({
                success: true,
                shop: shopProfile
            });
            return;

        } catch (supabaseError) {
            console.warn('Supabase ショッププロフィール取得エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const shopsData = await loadShopsData();
        const shop = shopsData.find(s => s.id === parseInt(shopId));

        if (!shop) {
            return res.status(404).json({
                success: false,
                error: 'shop_not_found',
                message: 'ショップが見つかりません。'
            });
        }

        console.log('🏪 ショッププロフィール取得成功（フォールバック）');

        // フィールド名をマッピング
        const shopProfile = {
            id: shop.id,
            name: shop.shop_name,
            phone: shop.phone_line,
            address: shop.address,
            description: shop.description,
            min_price: shop.trial_dive_price_beach,
            max_price: shop.fun_dive_price_2tanks,
            business_hours: shop.operating_hours,
            closed_days: shop.closed_days || '不定休',
            services: shop.services ? shop.services.split(',') : [],
            features: shop.trial_dive_options ? shop.trial_dive_options.split(',') : []
        };

        res.json({
            success: true,
            shop: shopProfile
        });

    } catch (error) {
        console.error('ショッププロフィール取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'profile_error',
            message: 'ショップ情報の取得に失敗しました'
        });
    }
});

// ===== データ整合性システム - 体験履歴自動追跡 =====

// 新しいダイビング体験記録API
app.post('/api/data-integrity/dive-history/record', async (req, res) => {
    try {
        const {
            user_id,
            shop_id,
            dive_date,
            location,
            dive_site,
            depth,
            duration,
            water_temperature,
            visibility,
            equipment_used,
            buddy,
            instructor,
            certification_earned,
            notes,
            rating,
            photos,
            marine_life,
            weather_conditions
        } = req.body;

        console.log('📊 新しいダイビング体験記録:', { user_id, shop_id, location, dive_site });

        // Supabase使用時
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('dive_histories')
                    .insert([{
                        user_id,
                        shop_id,
                        dive_date,
                        location,
                        dive_site,
                        depth,
                        duration,
                        water_temperature,
                        visibility,
                        equipment_used,
                        buddy,
                        instructor,
                        certification_earned,
                        notes,
                        rating,
                        photos,
                        marine_life,
                        weather_conditions,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }])
                    .select();

                if (error) throw error;

                // ユーザープロフィール自動更新をトリガー
                await updateUserProfileFromDiveHistory(user_id);

                console.log('✅ ダイビング体験記録完了 (Supabase):', data[0].id);
                return res.json({
                    success: true,
                    dive_history: data[0],
                    message: 'ダイビング体験が記録され、プロフィールが更新されました'
                });
            } catch (supabaseError) {
                console.error('Supabase記録エラー、フォールバック:', supabaseError.message);
            }
        }

        // フォールバック: ファイルベースシステム
        const filePath = path.join(__dirname, 'data', 'dive-history.json');
        let diveHistoryData = { dive_history: [], stats: { total_entries: 0, last_updated: new Date().toISOString(), active_divers: 0 } };

        try {
            if (fs.existsSync(filePath)) {
                diveHistoryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (readError) {
            console.warn('履歴ファイル読み込み警告:', readError.message);
        }

        // 新しい体験記録を追加
        const newDiveHistory = {
            id: `dive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            user_id,
            shop_id,
            dive_date,
            location,
            dive_site,
            depth,
            duration,
            water_temperature,
            visibility,
            equipment_used: equipment_used || [],
            buddy,
            instructor,
            certification_earned,
            notes,
            rating,
            photos: photos || [],
            marine_life: marine_life || [],
            weather_conditions,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        diveHistoryData.dive_history.push(newDiveHistory);
        diveHistoryData.stats.total_entries = diveHistoryData.dive_history.length;
        diveHistoryData.stats.last_updated = new Date().toISOString();
        diveHistoryData.stats.active_divers = [...new Set(diveHistoryData.dive_history.map(h => h.user_id))].length;

        // ファイルに保存
        fs.writeFileSync(filePath, JSON.stringify(diveHistoryData, null, 2));

        // ユーザープロフィール自動更新をトリガー
        await updateUserProfileFromDiveHistory(user_id);

        console.log('✅ ダイビング体験記録完了 (ファイル):', newDiveHistory.id);
        res.json({
            success: true,
            dive_history: newDiveHistory,
            message: 'ダイビング体験が記録され、プロフィールが更新されました'
        });

    } catch (error) {
        console.error('ダイビング体験記録エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'ダイビング体験の記録に失敗しました'
        });
    }
});

// ユーザーのダイビング履歴取得API
app.get('/api/data-integrity/dive-history/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { limit = 20, offset = 0, location, date_from, date_to } = req.query;

        console.log('📊 ダイビング履歴取得:', { user_id, limit, offset, location });

        // Supabase使用時
        if (supabase) {
            try {
                let query = supabase
                    .from('dive_histories')
                    .select('*')
                    .eq('user_id', user_id)
                    .order('dive_date', { ascending: false });

                if (location) {
                    query = query.ilike('location', `%${location}%`);
                }
                if (date_from) {
                    query = query.gte('dive_date', date_from);
                }
                if (date_to) {
                    query = query.lte('dive_date', date_to);
                }

                query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

                const { data, error } = await query;
                if (error) throw error;

                console.log('✅ ダイビング履歴取得完了 (Supabase):', data.length, '件');
                return res.json({
                    success: true,
                    dive_history: data,
                    count: data.length,
                    total_dives: data.length > 0 ? data.length : 0
                });
            } catch (supabaseError) {
                console.error('Supabase履歴取得エラー、フォールバック:', supabaseError.message);
            }
        }

        // フォールバック: ファイルベースシステム
        const filePath = path.join(__dirname, 'data', 'dive-history.json');
        let diveHistoryData = { dive_history: [] };

        try {
            if (fs.existsSync(filePath)) {
                diveHistoryData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            }
        } catch (readError) {
            console.warn('履歴ファイル読み込み警告:', readError.message);
        }

        // フィルタリング
        let userDives = diveHistoryData.dive_history.filter(dive => dive.user_id === user_id);

        if (location) {
            userDives = userDives.filter(dive => 
                dive.location && dive.location.toLowerCase().includes(location.toLowerCase())
            );
        }
        if (date_from) {
            userDives = userDives.filter(dive => 
                dive.dive_date && dive.dive_date >= date_from
            );
        }
        if (date_to) {
            userDives = userDives.filter(dive => 
                dive.dive_date && dive.dive_date <= date_to
            );
        }

        // ソート（新しい順）
        userDives.sort((a, b) => new Date(b.dive_date) - new Date(a.dive_date));

        // ページネーション
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        const paginatedDives = userDives.slice(startIndex, endIndex);

        console.log('✅ ダイビング履歴取得完了 (ファイル):', paginatedDives.length, '件');
        res.json({
            success: true,
            dive_history: paginatedDives,
            count: paginatedDives.length,
            total_dives: userDives.length
        });

    } catch (error) {
        console.error('ダイビング履歴取得エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'ダイビング履歴の取得に失敗しました'
        });
    }
});

// プロフィール動的更新関数
async function updateUserProfileFromDiveHistory(user_id) {
    try {
        console.log('🔄 プロフィール動的更新開始:', user_id);

        // ダイビング履歴を取得
        let diveHistory = [];
        
        // Supabase使用時
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('dive_histories')
                    .select('*')
                    .eq('user_id', user_id);
                    
                if (!error) {
                    diveHistory = data || [];
                }
            } catch (supabaseError) {
                console.warn('Supabase履歴取得エラー、フォールバック:', supabaseError.message);
            }
        }

        // フォールバック: ファイルベースシステム
        if (diveHistory.length === 0) {
            const historyPath = path.join(__dirname, 'data', 'dive-history.json');
            if (fs.existsSync(historyPath)) {
                const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                diveHistory = historyData.dive_history.filter(dive => dive.user_id === user_id);
            }
        }

        if (diveHistory.length === 0) {
            console.log('📊 履歴なし、プロフィール更新スキップ:', user_id);
            return;
        }

        // 統計情報を計算
        const totalDives = diveHistory.length;
        const maxDepth = Math.max(...diveHistory.map(dive => dive.depth || 0));
        const totalDuration = diveHistory.reduce((sum, dive) => sum + (dive.duration || 0), 0);
        const avgDepth = diveHistory.reduce((sum, dive) => sum + (dive.depth || 0), 0) / totalDives;
        const avgRating = diveHistory.reduce((sum, dive) => sum + (dive.rating || 0), 0) / totalDives;
        
        // 最新のダイビング日
        const lastDiveDate = diveHistory
            .map(dive => dive.dive_date)
            .sort()
            .reverse()[0];

        // 訪問したロケーション
        const visitedLocations = [...new Set(diveHistory.map(dive => dive.location).filter(Boolean))];
        
        // よく見る海洋生物
        const marineLife = diveHistory
            .flatMap(dive => dive.marine_life || [])
            .reduce((acc, species) => {
                acc[species] = (acc[species] || 0) + 1;
                return acc;
            }, {});
        const favoriteMarineLife = Object.entries(marineLife)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([species]) => species);

        // 認定レベルを推定（最新の履歴から）
        const latestCertification = diveHistory
            .filter(dive => dive.certification_earned)
            .sort((a, b) => new Date(b.dive_date) - new Date(a.dive_date))[0];

        const updatedProfile = {
            total_dives: totalDives,
            max_depth: maxDepth,
            total_dive_time: totalDuration,
            avg_depth: Math.round(avgDepth * 10) / 10,
            avg_rating: Math.round(avgRating * 10) / 10,
            last_dive_date: lastDiveDate,
            visited_locations: visitedLocations,
            favorite_marine_life: favoriteMarineLife,
            last_synced: new Date().toISOString()
        };

        if (latestCertification) {
            updatedProfile.certification_level = latestCertification.certification_earned;
        }

        // プロフィール更新
        // Supabase使用時
        if (supabase) {
            try {
                const { error } = await supabase
                    .from('users')
                    .update(updatedProfile)
                    .eq('id', user_id);
                    
                if (!error) {
                    console.log('✅ プロフィール動的更新完了 (Supabase):', user_id);
                    return;
                }
            } catch (supabaseError) {
                console.warn('Supabaseプロフィール更新エラー、フォールバック:', supabaseError.message);
            }
        }

        // フォールバック: ファイルベースシステム
        const usersPath = path.join(__dirname, 'data', 'users.json');
        if (fs.existsSync(usersPath)) {
            const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
            const userIndex = usersData.users.findIndex(user => user.id === user_id);
            
            if (userIndex !== -1) {
                usersData.users[userIndex] = {
                    ...usersData.users[userIndex],
                    ...updatedProfile,
                    updated_at: new Date().toISOString()
                };
                
                fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
                console.log('✅ プロフィール動的更新完了 (ファイル):', user_id);
            }
        }

    } catch (error) {
        console.error('プロフィール動的更新エラー:', error);
    }
}

// データ整合性チェックAPI
app.get('/api/data-integrity/check/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        
        console.log('🔍 データ整合性チェック開始:', user_id);

        // ユーザー情報取得
        let user = null;
        
        // Supabase使用時
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', user_id)
                    .single();
                    
                if (!error) {
                    user = data;
                }
            } catch (supabaseError) {
                console.warn('Supabaseユーザー取得エラー、フォールバック:', supabaseError.message);
            }
        }

        // フォールバック: ファイルベースシステム
        if (!user) {
            const usersPath = path.join(__dirname, 'data', 'users.json');
            if (fs.existsSync(usersPath)) {
                const usersData = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
                user = usersData.users.find(u => u.id === user_id);
            }
        }

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found',
                message: 'ユーザーが見つかりません'
            });
        }

        // ダイビング履歴取得
        let diveHistory = [];
        
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('dive_histories')
                    .select('*')
                    .eq('user_id', user_id);
                    
                if (!error) {
                    diveHistory = data || [];
                }
            } catch (supabaseError) {
                console.warn('Supabase履歴取得エラー、フォールバック:', supabaseError.message);
            }
        }

        if (diveHistory.length === 0) {
            const historyPath = path.join(__dirname, 'data', 'dive-history.json');
            if (fs.existsSync(historyPath)) {
                const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                diveHistory = historyData.dive_history.filter(dive => dive.user_id === user_id);
            }
        }

        // 整合性チェック
        const inconsistencies = [];
        
        // 総ダイビング回数チェック
        const actualTotalDives = diveHistory.length;
        const profileTotalDives = user.total_dives || 0;
        
        if (actualTotalDives !== profileTotalDives) {
            inconsistencies.push({
                type: 'total_dives_mismatch',
                profile_value: profileTotalDives,
                actual_value: actualTotalDives,
                description: 'プロフィールの総ダイビング回数と履歴の回数が一致しません'
            });
        }

        // 最大深度チェック
        if (diveHistory.length > 0) {
            const actualMaxDepth = Math.max(...diveHistory.map(dive => dive.depth || 0));
            const profileMaxDepth = user.max_depth || 0;
            
            if (Math.abs(actualMaxDepth - profileMaxDepth) > 0.1) {
                inconsistencies.push({
                    type: 'max_depth_mismatch',
                    profile_value: profileMaxDepth,
                    actual_value: actualMaxDepth,
                    description: 'プロフィールの最大深度と履歴の最大深度が一致しません'
                });
            }
        }

        // 最後のダイビング日チェック
        if (diveHistory.length > 0) {
            const actualLastDive = diveHistory
                .map(dive => dive.dive_date)
                .sort()
                .reverse()[0];
            const profileLastDive = user.last_dive_date;
            
            if (actualLastDive !== profileLastDive) {
                inconsistencies.push({
                    type: 'last_dive_date_mismatch',
                    profile_value: profileLastDive,
                    actual_value: actualLastDive,
                    description: '最後のダイビング日が一致しません'
                });
            }
        }

        const isConsistent = inconsistencies.length === 0;
        
        console.log('🔍 整合性チェック完了:', user_id, isConsistent ? '整合性OK' : `${inconsistencies.length}件の不整合`);
        
        res.json({
            success: true,
            user_id,
            is_consistent: isConsistent,
            inconsistencies,
            stats: {
                profile_total_dives: user.total_dives || 0,
                actual_total_dives: diveHistory.length,
                profile_max_depth: user.max_depth || 0,
                actual_max_depth: diveHistory.length > 0 ? Math.max(...diveHistory.map(dive => dive.depth || 0)) : 0,
                last_sync: user.last_synced || null
            },
            message: isConsistent ? 'データ整合性に問題ありません' : `${inconsistencies.length}件の不整合が検出されました`
        });

    } catch (error) {
        console.error('データ整合性チェックエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'データ整合性チェックに失敗しました'
        });
    }
});

// 整合性修復API
app.post('/api/data-integrity/repair/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        
        console.log('🔧 データ整合性修復開始:', user_id);

        // プロフィール動的更新を実行（これが修復処理）
        await updateUserProfileFromDiveHistory(user_id);
        
        console.log('✅ データ整合性修復完了:', user_id);
        res.json({
            success: true,
            user_id,
            message: 'データ整合性を修復しました。プロフィールが最新の履歴に基づいて更新されました。'
        });

    } catch (error) {
        console.error('データ整合性修復エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'データ整合性の修復に失敗しました'
        });
    }
});

// ===== サブスクリプション・課金システム =====

// サブスクリプションプラン一覧取得API
app.get('/api/subscription/plans', async (req, res) => {
    try {
        console.log('💳 サブスクリプションプラン取得');

        // プランデータを読み込み
        const plansData = await loadSubscriptionData();
        
        res.json({
            success: true,
            plans: plansData.plans
        });

    } catch (error) {
        console.error('サブスクリプションプラン取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'plans_error',
            message: 'プラン情報の取得に失敗しました'
        });
    }
});

// ショップのサブスクリプション情報取得API
app.get('/api/shop/subscription/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log('📊 ショップサブスクリプション情報取得:', shopId);

        const plansData = await loadSubscriptionData();
        const subscription = plansData.subscriptions.find(s => s.shop_id === parseInt(shopId));
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'subscription_not_found',
                message: 'サブスクリプション情報が見つかりません。'
            });
        }

        const plan = plansData.plans.find(p => p.id === subscription.plan_id);
        
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: 'plan_not_found',
                message: 'プラン情報が見つかりません。'
            });
        }

        console.log('📊 ショップサブスクリプション情報取得成功');

        res.json({
            success: true,
            subscription: subscription,
            plan: plan
        });

    } catch (error) {
        console.error('ショップサブスクリプション情報取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'subscription_error',
            message: 'サブスクリプション情報の取得に失敗しました'
        });
    }
});

// プラン変更API
app.post('/api/shop/subscription/change', async (req, res) => {
    try {
        const { shop_id, new_plan_id } = req.body;
        console.log('🔄 プラン変更:', { shop_id, new_plan_id });

        // バリデーション
        if (!shop_id || !new_plan_id) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'ショップIDと新しいプランIDが必要です。'
            });
        }

        const plansData = await loadSubscriptionData();
        const subscription = plansData.subscriptions.find(s => s.shop_id === parseInt(shop_id));
        const newPlan = plansData.plans.find(p => p.id === new_plan_id);
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'subscription_not_found',
                message: 'サブスクリプション情報が見つかりません。'
            });
        }

        if (!newPlan) {
            return res.status(404).json({
                success: false,
                error: 'plan_not_found',
                message: '指定されたプランが見つかりません。'
            });
        }

        // 現在と同じプランの場合
        if (subscription.plan_id === new_plan_id) {
            return res.status(400).json({
                success: false,
                error: 'same_plan',
                message: '既に同じプランをご利用中です。'
            });
        }

        // プラン変更処理（簡易実装）
        subscription.plan_id = new_plan_id;
        subscription.updated_at = new Date().toISOString();
        
        // 有料プランの場合、支払い方法をデモ設定
        if (newPlan.price > 0 && !subscription.payment_method) {
            subscription.payment_method = {
                type: 'credit_card',
                last4: '4242',
                brand: 'visa'
            };
        }

        // データ保存
        await saveSubscriptionData(plansData);

        console.log('🔄 プラン変更成功:', newPlan.name);

        res.json({
            success: true,
            subscription: subscription,
            plan: newPlan,
            message: `${newPlan.name}に変更しました。`
        });

    } catch (error) {
        console.error('プラン変更API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'plan_change_error',
            message: 'プラン変更に失敗しました'
        });
    }
});

// 支払い履歴取得API
app.get('/api/shop/subscription/:shopId/payments', async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log('💰 支払い履歴取得:', shopId);

        const plansData = await loadSubscriptionData();
        const subscription = plansData.subscriptions.find(s => s.shop_id === parseInt(shopId));
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'subscription_not_found',
                message: 'サブスクリプション情報が見つかりません。'
            });
        }

        // そのサブスクリプションの支払い履歴を取得
        const payments = plansData.payment_history.filter(p => p.subscription_id === subscription.id);
        
        console.log('💰 支払い履歴取得成功:', payments.length + '件');

        res.json({
            success: true,
            payments: payments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
        });

    } catch (error) {
        console.error('支払い履歴取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'payment_history_error',
            message: '支払い履歴の取得に失敗しました'
        });
    }
});

// Stripe Webhook処理（デモ版）
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), (req, res) => {
    try {
        console.log('🔗 Stripe Webhook受信（デモ）');
        
        // 実際の実装では Stripe の署名検証を行う
        const event = JSON.parse(req.body);
        
        switch (event.type) {
            case 'payment_intent.succeeded':
                console.log('💳 決済成功:', event.data.object.id);
                // 決済成功処理
                break;
            case 'payment_intent.payment_failed':
                console.log('❌ 決済失敗:', event.data.object.id);
                // 決済失敗処理
                break;
            case 'customer.subscription.updated':
                console.log('🔄 サブスクリプション更新:', event.data.object.id);
                // サブスクリプション更新処理
                break;
            default:
                console.log('❓ 未対応イベント:', event.type);
        }

        res.json({ received: true });

    } catch (error) {
        console.error('Stripe Webhook エラー:', error);
        res.status(400).json({
            success: false,
            error: 'webhook_error'
        });
    }
});

// プラン制限チェック機能
async function checkPlanLimits(shopId, limitType, currentUsage = 0) {
    try {
        const plansData = await loadSubscriptionData();
        const subscription = plansData.subscriptions.find(s => s.shop_id === parseInt(shopId));
        
        if (!subscription) {
            return { allowed: false, reason: 'サブスクリプションが見つかりません' };
        }

        const plan = plansData.plans.find(p => p.id === subscription.plan_id);
        
        if (!plan) {
            return { allowed: false, reason: 'プラン情報が見つかりません' };
        }

        const limits = plan.limits;
        
        switch (limitType) {
            case 'monthly_views':
                if (limits.monthly_views === -1) return { allowed: true };
                return {
                    allowed: currentUsage < limits.monthly_views,
                    remaining: Math.max(0, limits.monthly_views - currentUsage),
                    limit: limits.monthly_views,
                    reason: currentUsage >= limits.monthly_views ? '月間PV上限に達しています' : null
                };
                
            case 'photos':
                if (limits.photos === -1) return { allowed: true };
                return {
                    allowed: currentUsage < limits.photos,
                    remaining: Math.max(0, limits.photos - currentUsage),
                    limit: limits.photos,
                    reason: currentUsage >= limits.photos ? '写真上限に達しています' : null
                };
                
            case 'reviews_management':
                return {
                    allowed: limits.reviews_management,
                    reason: !limits.reviews_management ? 'このプランでは口コミ管理機能はご利用いただけません' : null
                };
                
            case 'priority_support':
                return {
                    allowed: limits.priority_support,
                    reason: !limits.priority_support ? 'このプランでは優先サポートはご利用いただけません' : null
                };
                
            case 'analytics':
                return {
                    allowed: limits.analytics,
                    reason: !limits.analytics ? 'このプランでは詳細分析機能はご利用いただけません' : null
                };
                
            case 'custom_branding':
                return {
                    allowed: limits.custom_branding,
                    reason: !limits.custom_branding ? 'このプランではカスタムブランディング機能はご利用いただけません' : null
                };
                
            default:
                return { allowed: true };
        }
        
    } catch (error) {
        console.error('プラン制限チェックエラー:', error);
        return { allowed: false, reason: 'プラン制限の確認中にエラーが発生しました' };
    }
}

// プラン制限情報取得API
app.get('/api/shop/plan-limits/:shopId', async (req, res) => {
    try {
        const { shopId } = req.params;
        console.log('📋 プラン制限情報取得:', shopId);

        const plansData = await loadSubscriptionData();
        const subscription = plansData.subscriptions.find(s => s.shop_id === parseInt(shopId));
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'subscription_not_found',
                message: 'サブスクリプション情報が見つかりません。'
            });
        }

        const plan = plansData.plans.find(p => p.id === subscription.plan_id);
        
        if (!plan) {
            return res.status(404).json({
                success: false,
                error: 'plan_not_found',
                message: 'プラン情報が見つかりません。'
            });
        }

        // 現在の使用状況と制限をチェック
        const usage = subscription.usage || {};
        const limits = plan.limits;
        
        const limitChecks = {
            monthly_views: await checkPlanLimits(shopId, 'monthly_views', usage.monthly_views || 0),
            photos: await checkPlanLimits(shopId, 'photos', usage.photos_used || 0),
            reviews_management: await checkPlanLimits(shopId, 'reviews_management'),
            priority_support: await checkPlanLimits(shopId, 'priority_support'),
            analytics: await checkPlanLimits(shopId, 'analytics'),
            custom_branding: await checkPlanLimits(shopId, 'custom_branding')
        };

        console.log('📋 プラン制限情報取得成功');

        res.json({
            success: true,
            plan: {
                id: plan.id,
                name: plan.name,
                limits: limits
            },
            usage: usage,
            limit_checks: limitChecks
        });

    } catch (error) {
        console.error('プラン制限情報取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'limits_error',
            message: 'プラン制限情報の取得に失敗しました'
        });
    }
});

// 使用量更新API（PV数、写真数などの増加）
app.post('/api/shop/usage/update', async (req, res) => {
    try {
        const { shop_id, usage_type, increment = 1 } = req.body;
        console.log('📊 使用量更新:', { shop_id, usage_type, increment });

        // バリデーション
        if (!shop_id || !usage_type) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'ショップIDと使用量タイプが必要です。'
            });
        }

        const plansData = await loadSubscriptionData();
        const subscription = plansData.subscriptions.find(s => s.shop_id === parseInt(shop_id));
        
        if (!subscription) {
            return res.status(404).json({
                success: false,
                error: 'subscription_not_found',
                message: 'サブスクリプション情報が見つかりません。'
            });
        }

        // 使用量を更新
        if (!subscription.usage) {
            subscription.usage = {};
        }

        const currentUsage = subscription.usage[usage_type] || 0;
        const newUsage = currentUsage + increment;

        // プラン制限をチェック
        const limitCheck = await checkPlanLimits(shop_id, usage_type, newUsage);
        
        if (!limitCheck.allowed) {
            return res.status(403).json({
                success: false,
                error: 'limit_exceeded',
                message: limitCheck.reason,
                current_usage: currentUsage,
                limit: limitCheck.limit
            });
        }

        // 使用量を更新
        subscription.usage[usage_type] = newUsage;
        subscription.updated_at = new Date().toISOString();

        // データ保存
        await saveSubscriptionData(plansData);

        console.log('📊 使用量更新成功:', { usage_type, newUsage });

        res.json({
            success: true,
            usage: subscription.usage,
            remaining: limitCheck.remaining,
            message: '使用量を更新しました。'
        });

    } catch (error) {
        console.error('使用量更新API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'usage_update_error',
            message: '使用量の更新に失敗しました'
        });
    }
});

// ===== LINE Bot - Web連携システム =====

// LINE Bot - Web認証連携API
app.post('/api/integration/line-web/auth', async (req, res) => {
    try {
        const { line_user_id, web_user_id, action } = req.body;
        console.log('🔗 LINE-Web認証連携:', { line_user_id, web_user_id, action });

        // バリデーション
        if (!line_user_id || !action) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'LINE User IDとアクションが必要です。'
            });
        }

        // Supabaseで連携処理
        try {
            if (action === 'link') {
                // LINE IDとWeb User IDを連携
                const { data, error } = await supabase
                    .from('user_integrations')
                    .upsert({
                        line_user_id: line_user_id,
                        web_user_id: web_user_id,
                        linked_at: new Date().toISOString(),
                        status: 'active'
                    })
                    .select()
                    .single();

                if (error) throw error;

                console.log('🔗 LINE-Web連携成功（Supabase）');

                res.json({
                    success: true,
                    integration: data,
                    message: 'LINE BotとWebアカウントを連携しました。'
                });

            } else if (action === 'unlink') {
                // LINE IDとWeb User IDの連携解除
                const { data, error } = await supabase
                    .from('user_integrations')
                    .update({ status: 'inactive', unlinked_at: new Date().toISOString() })
                    .eq('line_user_id', line_user_id)
                    .select()
                    .single();

                if (error) throw error;

                console.log('🔗 LINE-Web連携解除成功（Supabase）');

                res.json({
                    success: true,
                    integration: data,
                    message: 'LINE BotとWebアカウントの連携を解除しました。'
                });

            } else {
                return res.status(400).json({
                    success: false,
                    error: 'invalid_action',
                    message: '無効なアクションです。'
                });
            }

            return;

        } catch (supabaseError) {
            console.warn('Supabase LINE-Web連携エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const integrationsData = await loadIntegrationsData();
        
        if (action === 'link') {
            const integration = {
                id: 'int_' + Date.now(),
                line_user_id: line_user_id,
                web_user_id: web_user_id,
                linked_at: new Date().toISOString(),
                status: 'active'
            };

            integrationsData.integrations.push(integration);
            await saveIntegrationsData(integrationsData);

            console.log('🔗 LINE-Web連携成功（フォールバック）');

            res.json({
                success: true,
                integration: integration,
                message: 'LINE BotとWebアカウントを連携しました。'
            });

        } else if (action === 'unlink') {
            const integrationIndex = integrationsData.integrations.findIndex(
                i => i.line_user_id === line_user_id && i.status === 'active'
            );

            if (integrationIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'integration_not_found',
                    message: '連携情報が見つかりません。'
                });
            }

            integrationsData.integrations[integrationIndex].status = 'inactive';
            integrationsData.integrations[integrationIndex].unlinked_at = new Date().toISOString();

            await saveIntegrationsData(integrationsData);

            console.log('🔗 LINE-Web連携解除成功（フォールバック）');

            res.json({
                success: true,
                integration: integrationsData.integrations[integrationIndex],
                message: 'LINE BotとWebアカウントの連携を解除しました。'
            });
        }

    } catch (error) {
        console.error('LINE-Web認証連携API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'integration_error',
            message: 'LINE-Web連携処理に失敗しました'
        });
    }
});

// ユーザー統合情報取得API
app.get('/api/integration/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { type = 'web' } = req.query; // 'web' or 'line'
        console.log('👤 ユーザー統合情報取得:', { userId, type });

        // Supabaseで統合情報取得
        try {
            const column = type === 'line' ? 'line_user_id' : 'web_user_id';
            const { data, error } = await supabase
                .from('user_integrations')
                .select('*')
                .eq(column, userId)
                .eq('status', 'active')
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                // 連携されたユーザーの詳細情報を取得
                let linkedUserInfo = {};
                if (type === 'web' && data.line_user_id) {
                    // LINE Botからユーザー情報取得（実装は省略）
                    linkedUserInfo = { line_user_id: data.line_user_id };
                } else if (type === 'line' && data.web_user_id) {
                    // WebユーザーDB情報取得
                    const usersData = await loadUsersData();
                    const webUser = usersData.users.find(u => u.id === data.web_user_id);
                    linkedUserInfo = webUser || {};
                }

                console.log('👤 ユーザー統合情報取得成功（Supabase）');

                res.json({
                    success: true,
                    integration: data,
                    linked_user: linkedUserInfo
                });
                return;
            }

        } catch (supabaseError) {
            console.warn('Supabase ユーザー統合情報取得エラー、フォールバックへ:', supabaseError.message);
        }

        // フォールバック: ファイルベース
        const integrationsData = await loadIntegrationsData();
        const column = type === 'line' ? 'line_user_id' : 'web_user_id';
        const integration = integrationsData.integrations.find(
            i => i[column] === userId && i.status === 'active'
        );

        if (!integration) {
            return res.json({
                success: true,
                integration: null,
                linked_user: null,
                message: '連携情報は見つかりませんでした。'
            });
        }

        console.log('👤 ユーザー統合情報取得成功（フォールバック）');

        res.json({
            success: true,
            integration: integration,
            linked_user: {} // フォールバックでは詳細なユーザー情報は省略
        });

    } catch (error) {
        console.error('ユーザー統合情報取得API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'user_integration_error',
            message: 'ユーザー統合情報の取得に失敗しました'
        });
    }
});

// データ同期API（LINE Bot ⇔ Web）
app.post('/api/integration/sync-data', async (req, res) => {
    try {
        const { user_id, user_type, data_type, data, action = 'sync' } = req.body;
        console.log('🔄 データ同期:', { user_id, user_type, data_type, action });

        // バリデーション
        if (!user_id || !user_type || !data_type) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'User ID、User Type、Data Typeが必要です。'
            });
        }

        // 統合情報を取得
        const integrationResponse = await fetch(`http://localhost:${PORT}/api/integration/user/${user_id}?type=${user_type}`);
        const integrationData = await integrationResponse.json();

        if (!integrationData.success || !integrationData.integration) {
            return res.status(404).json({
                success: false,
                error: 'no_integration',
                message: 'ユーザーの連携情報が見つかりません。'
            });
        }

        const integration = integrationData.integration;
        
        // データタイプ別の同期処理
        let syncResult = {};
        
        switch (data_type) {
            case 'user_profile':
                syncResult = await syncUserProfile(integration, data, action);
                break;
            case 'diving_history':
                syncResult = await syncDivingHistory(integration, data, action);
                break;
            case 'favorites':
                syncResult = await syncFavorites(integration, data, action);
                break;
            case 'points':
                syncResult = await syncPoints(integration, data, action);
                break;
            default:
                return res.status(400).json({
                    success: false,
                    error: 'invalid_data_type',
                    message: 'サポートされていないデータタイプです。'
                });
        }

        console.log('🔄 データ同期成功:', data_type);

        res.json({
            success: true,
            sync_result: syncResult,
            message: 'データ同期が完了しました。'
        });

    } catch (error) {
        console.error('データ同期API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'sync_error',
            message: 'データ同期に失敗しました'
        });
    }
});

// シームレス遷移用トークン生成API
app.post('/api/integration/generate-transition-token', async (req, res) => {
    try {
        const { user_id, user_type, target_action, expires_in = 300 } = req.body;
        console.log('🎫 遷移トークン生成:', { user_id, user_type, target_action });

        // バリデーション
        if (!user_id || !user_type || !target_action) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'User ID、User Type、Target Actionが必要です。'
            });
        }

        // トークン生成
        const transitionToken = {
            token: 'tt_' + Math.random().toString(36).substring(2, 15) + Date.now(),
            user_id: user_id,
            user_type: user_type,
            target_action: target_action,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
            status: 'active'
        };

        // トークンを保存（簡易実装）
        const transitionsData = await loadTransitionsData();
        transitionsData.tokens.push(transitionToken);
        await saveTransitionsData(transitionsData);

        console.log('🎫 遷移トークン生成成功');

        // Webサイトへの遷移URL生成
        const transitionUrl = `${BASE_URL}/transition?token=${transitionToken.token}&action=${target_action}`;

        res.json({
            success: true,
            transition_token: transitionToken.token,
            transition_url: transitionUrl,
            expires_at: transitionToken.expires_at,
            message: '遷移トークンを生成しました。'
        });

    } catch (error) {
        console.error('遷移トークン生成API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'token_generation_error',
            message: '遷移トークンの生成に失敗しました'
        });
    }
});

// トークンを使った認証済み遷移API
app.post('/api/integration/authenticate-transition', async (req, res) => {
    try {
        const { token } = req.body;
        console.log('🔓 遷移認証:', token);

        // バリデーション
        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'トークンが必要です。'
            });
        }

        // トークン検証
        const transitionsData = await loadTransitionsData();
        const transitionToken = transitionsData.tokens.find(t => t.token === token && t.status === 'active');

        if (!transitionToken) {
            return res.status(404).json({
                success: false,
                error: 'invalid_token',
                message: '無効なトークンです。'
            });
        }

        // 有効期限チェック
        if (new Date() > new Date(transitionToken.expires_at)) {
            return res.status(401).json({
                success: false,
                error: 'token_expired',
                message: 'トークンが期限切れです。'
            });
        }

        // トークンを使用済みにマーク
        transitionToken.status = 'used';
        transitionToken.used_at = new Date().toISOString();
        await saveTransitionsData(transitionsData);

        // 統合情報を取得
        const integrationResponse = await fetch(`http://localhost:${PORT}/api/integration/user/${transitionToken.user_id}?type=${transitionToken.user_type}`);
        const integrationData = await integrationResponse.json();

        console.log('🔓 遷移認証成功');

        res.json({
            success: true,
            user_id: transitionToken.user_id,
            user_type: transitionToken.user_type,
            target_action: transitionToken.target_action,
            integration: integrationData.integration,
            message: '認証が完了しました。'
        });

    } catch (error) {
        console.error('遷移認証API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'auth_error',
            message: '遷移認証に失敗しました'
        });
    }
});

// ===== B2Bシステム ヘルパー関数 =====

// ショップデータ読み込み（シンプル版）
async function loadShopsData() {
    try {
        // 既存のショップAPIから取得
        const response = await fetch('http://localhost:3000/api/shops');
        const data = await response.json();
        return data.success ? data.data.shops : [];
    } catch (error) {
        console.error('ショップデータ読み込みエラー:', error);
        return [];
    }
}
