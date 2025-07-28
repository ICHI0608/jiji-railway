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

// 会員登録ページ
app.get('/member/register', (req, res) => {
    console.log('🔍 会員登録ページアクセス:', req.url);
    const filePath = path.join(__dirname, 'public/member/register.html');
    console.log('📁 ファイルパス:', filePath);
    
    // ファイル存在確認
    const fs = require('fs');
    if (fs.existsSync(filePath)) {
        console.log('✅ register.htmlファイル存在確認');
        res.sendFile(filePath);
    } else {
        console.error('❌ register.htmlファイルが見つかりません');
        res.status(404).send('会員登録ページが見つかりません');
    }
});

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

// 会員登録API
app.post('/api/members/register', async (req, res) => {
    try {
        const {
            email,
            password,
            name,
            phone,
            diving_experience,
            certification_level,
            preferred_areas,
            newsletter_subscribe
        } = req.body;
        
        console.log('👤 会員登録:', { email, name, diving_experience });
        
        // バリデーション
        const validation = validateMemberData({
            email, password, name, phone, diving_experience, certification_level
        });
        
        if (!validation.valid) {
            return res.status(400).json({
                success: false,
                error: 'validation_error',
                message: 'データが正しくありません',
                validation_errors: validation.errors
            });
        }
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                // メールアドレス重複チェック
                const { data: existingUser } = await supabase
                    .from('members')
                    .select('email')
                    .eq('email', email)
                    .single();
                
                if (existingUser) {
                    return res.status(409).json({
                        success: false,
                        error: 'email_exists',
                        message: 'このメールアドレスは既に登録されています'
                    });
                }
                
                // パスワードハッシュ化（実際の実装では bcrypt 使用）
                const hashedPassword = hashPassword(password);
                
                // 会員データ挿入
                const memberData = {
                    email,
                    password_hash: hashedPassword,
                    name,
                    phone,
                    diving_experience,
                    certification_level,
                    preferred_areas: preferred_areas || [],
                    newsletter_subscribe: newsletter_subscribe || false,
                    email_verified: false,
                    verification_token: generateVerificationToken(),
                    created_at: new Date().toISOString(),
                    status: 'pending'
                };
                
                const { data: newMember, error } = await supabase
                    .from('members')
                    .insert([memberData])
                    .select()
                    .single();
                
                if (!error && newMember) {
                    // メール認証送信（模擬）
                    await sendVerificationEmail(email, memberData.verification_token);
                    
                    console.log('👤 会員登録成功（Supabase）:', email);
                    return res.json({
                        success: true,
                        member: {
                            id: newMember.id,
                            email: newMember.email,
                            name: newMember.name,
                            status: newMember.status
                        },
                        message: '会員登録が完了しました。認証メールをご確認ください。',
                        source: 'supabase'
                    });
                }
            } catch (supabaseError) {
                console.warn('Supabase会員登録エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: メモリベース会員管理
        if (!global.tempMembers) {
            global.tempMembers = [];
        }
        
        // メール重複チェック
        const existingMember = global.tempMembers.find(m => m.email === email);
        if (existingMember) {
            return res.status(409).json({
                success: false,
                error: 'email_exists',
                message: 'このメールアドレスは既に登録されています'
            });
        }
        
        // 新規会員作成
        const memberId = 'member_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const hashedPassword = hashPassword(password);
        const verificationToken = generateVerificationToken();
        
        const newMember = {
            id: memberId,
            email,
            password_hash: hashedPassword,
            name,
            phone,
            diving_experience,
            certification_level,
            preferred_areas: preferred_areas || [],
            newsletter_subscribe: newsletter_subscribe || false,
            email_verified: false,
            verification_token: verificationToken,
            created_at: new Date().toISOString(),
            status: 'pending'
        };
        
        global.tempMembers.push(newMember);
        
        // メール認証送信（模擬）
        await sendVerificationEmail(email, verificationToken);
        
        console.log('👤 会員登録成功（フォールバック）:', email);
        res.json({
            success: true,
            member: {
                id: newMember.id,
                email: newMember.email,
                name: newMember.name,
                status: newMember.status
            },
            message: '会員登録が完了しました。認証メールをご確認ください。',
            source: 'fallback'
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

// メール認証API
app.post('/api/members/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        
        console.log('📧 メール認証:', { token: token.substr(0, 10) + '...' });
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data: member, error } = await supabase
                    .from('members')
                    .select('*')
                    .eq('verification_token', token)
                    .single();
                
                if (!error && member) {
                    // 認証状態更新
                    const { error: updateError } = await supabase
                        .from('members')
                        .update({
                            email_verified: true,
                            status: 'active',
                            verified_at: new Date().toISOString()
                        })
                        .eq('id', member.id);
                    
                    if (!updateError) {
                        console.log('📧 メール認証成功（Supabase）:', member.email);
                        return res.json({
                            success: true,
                            message: 'メール認証が完了しました',
                            source: 'supabase'
                        });
                    }
                }
            } catch (supabaseError) {
                console.warn('Supabaseメール認証エラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: メモリベース認証
        if (!global.tempMembers) {
            return res.status(404).json({
                success: false,
                error: 'token_not_found',
                message: '認証トークンが見つかりません'
            });
        }
        
        const memberIndex = global.tempMembers.findIndex(m => m.verification_token === token);
        if (memberIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'token_not_found',
                message: '認証トークンが見つかりません'
            });
        }
        
        // 認証状態更新
        global.tempMembers[memberIndex].email_verified = true;
        global.tempMembers[memberIndex].status = 'active';
        global.tempMembers[memberIndex].verified_at = new Date().toISOString();
        
        console.log('📧 メール認証成功（フォールバック）:', global.tempMembers[memberIndex].email);
        res.json({
            success: true,
            message: 'メール認証が完了しました',
            source: 'fallback'
        });
        
    } catch (error) {
        console.error('メール認証API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'メール認証に失敗しました'
        });
    }
});

// ログインAPI
app.post('/api/members/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        console.log('🔐 ログイン試行:', { email });
        
        // Supabase接続試行
        if (supabase && supabaseStatus === 'connected') {
            try {
                const { data: member, error } = await supabase
                    .from('members')
                    .select('*')
                    .eq('email', email)
                    .single();
                
                if (!error && member) {
                    // パスワード検証
                    if (verifyPassword(password, member.password_hash)) {
                        if (!member.email_verified) {
                            return res.status(401).json({
                                success: false,
                                error: 'email_not_verified',
                                message: 'メール認証が完了していません'
                            });
                        }
                        
                        // セッショントークン生成
                        const sessionToken = generateSessionToken();
                        
                        console.log('🔐 ログイン成功（Supabase）:', email);
                        return res.json({
                            success: true,
                            session_token: sessionToken,
                            member: {
                                id: member.id,
                                email: member.email,
                                name: member.name,
                                diving_experience: member.diving_experience,
                                certification_level: member.certification_level
                            },
                            source: 'supabase'
                        });
                    }
                }
            } catch (supabaseError) {
                console.warn('Supabaseログインエラー、フォールバックへ:', supabaseError.message);
            }
        }
        
        // フォールバック: メモリベースログイン
        if (!global.tempMembers) {
            return res.status(401).json({
                success: false,
                error: 'invalid_credentials',
                message: 'メールアドレスまたはパスワードが正しくありません'
            });
        }
        
        const member = global.tempMembers.find(m => m.email === email);
        if (!member) {
            return res.status(401).json({
                success: false,
                error: 'invalid_credentials',
                message: 'メールアドレスまたはパスワードが正しくありません'
            });
        }
        
        // パスワード検証
        if (!verifyPassword(password, member.password_hash)) {
            return res.status(401).json({
                success: false,
                error: 'invalid_credentials',
                message: 'メールアドレスまたはパスワードが正しくありません'
            });
        }
        
        if (!member.email_verified) {
            return res.status(401).json({
                success: false,
                error: 'email_not_verified',
                message: 'メール認証が完了していません'
            });
        }
        
        // セッショントークン生成
        const sessionToken = generateSessionToken();
        
        console.log('🔐 ログイン成功（フォールバック）:', email);
        res.json({
            success: true,
            session_token: sessionToken,
            member: {
                id: member.id,
                email: member.email,
                name: member.name,
                diving_experience: member.diving_experience,
                certification_level: member.certification_level
            },
            source: 'fallback'
        });
        
    } catch (error) {
        console.error('ログインAPI エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'ログインに失敗しました'
        });
    }
});

// バリデーション関数
function validateMemberData(data) {
    const errors = [];
    
    // メールアドレス検証
    if (!data.email) {
        errors.push({ field: 'email', message: 'メールアドレスは必須です' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push({ field: 'email', message: 'メールアドレスの形式が正しくありません' });
    }
    
    // パスワード検証
    if (!data.password) {
        errors.push({ field: 'password', message: 'パスワードは必須です' });
    } else if (data.password.length < 8) {
        errors.push({ field: 'password', message: 'パスワードは8文字以上である必要があります' });
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
        errors.push({ field: 'password', message: 'パスワードは大文字、小文字、数字を含む必要があります' });
    }
    
    // 名前検証
    if (!data.name) {
        errors.push({ field: 'name', message: '名前は必須です' });
    } else if (data.name.length < 2) {
        errors.push({ field: 'name', message: '名前は2文字以上である必要があります' });
    }
    
    // 電話番号検証（任意）
    if (data.phone && !/^[\d-+()]+$/.test(data.phone)) {
        errors.push({ field: 'phone', message: '電話番号の形式が正しくありません' });
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

// パスワードハッシュ化（実際の実装では bcrypt 使用）
function hashPassword(password) {
    // 簡易実装（本番では bcrypt.hash 使用）
    return 'hashed_' + Buffer.from(password).toString('base64');
}

// パスワード検証
function verifyPassword(password, hash) {
    return hash === hashPassword(password);
}

// 認証トークン生成
function generateVerificationToken() {
    return 'verify_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
}

// セッショントークン生成
function generateSessionToken() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
}

// メール認証送信（模擬実装）
async function sendVerificationEmail(email, token) {
    // 実際の実装では SendGrid, AWS SES等を使用
    console.log(`📧 認証メール送信（模擬）: ${email}`);
    console.log(`認証URL: https://dive-buddys.com/member/verify?token=${token}`);
    return Promise.resolve();
}

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

// ===== 交通ルート検索API関数 =====

// Google Maps API - ルート検索
async function getDirections(origin, destination, mode = 'driving') {
    try {
        if (!GOOGLE_MAPS_CONFIG.api_key) {
            console.log('⚠️ Google Maps API未設定 - フォールバックデータ使用');
            return getFallbackDirections(origin, destination, mode);
        }
        
        const params = new URLSearchParams({
            origin: origin,
            destination: destination,
            mode: mode, // driving, walking, transit, bicycling
            key: GOOGLE_MAPS_CONFIG.api_key,
            language: 'ja',
            region: 'jp'
        });
        
        console.log(`🗺️ Google Maps ルート検索: ${origin} → ${destination} (${mode})`);
        
        const response = await axios.get(`${GOOGLE_MAPS_CONFIG.endpoints.directions}?${params}`);
        
        if (response.data.status === 'OK') {
            return {
                success: true,
                data: response.data,
                routes: response.data.routes || []
            };
        } else {
            throw new Error(`Google Maps API Error: ${response.data.status}`);
        }
        
    } catch (error) {
        console.error('❌ Google Maps API エラー:', error.response?.data || error.message);
        return getFallbackDirections(origin, destination, mode);
    }
}

// 交通手段別最適ルート取得
async function getTransportOptions(origin, destination, area = 'okinawa') {
    try {
        console.log(`🚗 交通手段検索: ${origin} → ${destination} (${area})`);
        
        // 複数の交通手段で並行取得
        const [drivingRoute, transitRoute, walkingRoute] = await Promise.all([
            getDirections(origin, destination, 'driving'),
            getDirections(origin, destination, 'transit'),
            getDirections(origin, destination, 'walking')
        ]);
        
        // 沖縄特化情報追加
        const transportInfo = getOkinawaTransportInfo(area, origin, destination);
        
        return {
            success: true,
            origin: origin,
            destination: destination,
            area: area,
            options: {
                driving: {
                    route: drivingRoute.data,
                    rental_cars: transportInfo.rental_cars,
                    parking_info: transportInfo.parking
                },
                transit: {
                    route: transitRoute.data,
                    bus_info: transportInfo.buses,
                    ferry_info: transportInfo.ferries
                },
                walking: {
                    route: walkingRoute.data,
                    walkable: isWalkableDistance(walkingRoute.data)
                }
            },
            recommendations: generateTransportRecommendations(drivingRoute, transitRoute, walkingRoute, area),
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('❌ 交通手段検索エラー:', error);
        return {
            success: false,
            error: error.message,
            message: '交通手段検索でエラーが発生しました'
        };
    }
}

// 沖縄特化交通情報取得
function getOkinawaTransportInfo(area, origin, destination) {
    const areaKey = area === 'ishigaki' ? 'ishigaki' : 
                   area === 'miyako' ? 'miyako' : 'okinawa_main';
    
    return {
        rental_cars: OKINAWA_TRANSPORT_DATA.rental_car_companies.filter(company => 
            company.locations.includes(getLocationForArea(area))
        ),
        buses: OKINAWA_TRANSPORT_DATA.bus_companies[areaKey] || [],
        ferries: OKINAWA_TRANSPORT_DATA.ferry_routes.filter(route => 
            route.name.includes(getAreaName(area))
        ),
        parking: {
            availability: area === 'okinawa_main' ? 'limited' : 'available',
            cost: area === 'okinawa_main' ? '200-500円/時間' : '無料〜200円/時間',
            recommendation: 'ダイビングショップに駐車場確認を推奨'
        }
    };
}

// 交通手段推奨アルゴリズム
function generateTransportRecommendations(driving, transit, walking, area) {
    const recommendations = [];
    
    // レンタカー推奨条件
    if (driving.success && driving.data?.routes?.[0]) {
        const drivingTime = getDuration(driving.data.routes[0]);
        if (drivingTime < 60 && area !== 'kerama') {
            recommendations.push({
                method: 'rental_car',
                priority: 1,
                reason: '最も便利で時間効率が良い',
                duration: `${drivingTime}分`,
                cost: '2,500-8,000円/日',
                pros: ['自由度が高い', '荷物運搬楽', '複数箇所回れる'],
                cons: ['運転必要', '駐車場確認必要', '燃料費別途']
            });
        }
    }
    
    // 公共交通推奨条件
    if (transit.success && area === 'okinawa_main') {
        recommendations.push({
            method: 'public_transit',
            priority: 2,
            reason: '運転不要で環境に優しい',
            duration: '30-90分',
            cost: '200-800円',
            pros: ['運転不要', '安価', '地元体験'],
            cons: ['時間制約', '荷物運搬大変', '乗り継ぎ必要']
        });
    }
    
    // フェリー推奨（離島）
    if (area === 'kerama') {
        recommendations.push({
            method: 'ferry',
            priority: 1,
            reason: '慶良間諸島唯一のアクセス手段',
            duration: '35-50分',
            cost: '往復4,160-4,750円',
            pros: ['海上移動の爽快感', '景色が良い'],
            cons: ['天候に左右される', '時刻表制約', '事前予約推奨']
        });
    }
    
    return recommendations.sort((a, b) => a.priority - b.priority);
}

// フォールバックデータ（Google Maps API未設定時）
function getFallbackDirections(origin, destination, mode) {
    console.log('🔄 交通ルート フォールバックデータ使用');
    
    const estimatedTime = estimateTravelTime(origin, destination, mode);
    const estimatedDistance = estimateDistance(origin, destination);
    
    return {
        success: true,
        fallback: true,
        data: {
            routes: [{
                legs: [{
                    duration: { text: `${estimatedTime}分`, value: estimatedTime * 60 },
                    distance: { text: `${estimatedDistance}km`, value: estimatedDistance * 1000 },
                    start_address: origin,
                    end_address: destination
                }],
                summary: `${mode}での移動`,
                overview_polyline: { points: 'fallback_route' }
            }],
            status: 'OK'
        }
    };
}

// 移動時間推定（フォールバック用）
function estimateTravelTime(origin, destination, mode) {
    const baseTime = {
        driving: 30,
        transit: 60,
        walking: 120,
        bicycling: 45
    };
    
    // 沖縄内の距離による調整
    const isLongDistance = origin.includes('空港') || destination.includes('空港');
    const multiplier = isLongDistance ? 1.5 : 1.0;
    
    return Math.round(baseTime[mode] * multiplier);
}

// 距離推定（フォールバック用）
function estimateDistance(origin, destination) {
    // 沖縄内の平均的な距離
    if (origin.includes('空港')) return 25;
    if (destination.includes('空港')) return 25;
    return 15;
}

// ユーティリティ関数
function getDuration(route) {
    return route.legs?.[0]?.duration?.value ? 
           Math.round(route.legs[0].duration.value / 60) : 30;
}

function isWalkableDistance(routeData) {
    const distance = routeData.routes?.[0]?.legs?.[0]?.distance?.value || 0;
    return distance < 2000; // 2km以下は徒歩可能
}

function getLocationForArea(area) {
    const mapping = {
        okinawa: '那覇空港',
        ishigaki: '石垣空港', 
        miyako: '宮古空港'
    };
    return mapping[area] || '那覇空港';
}

function getAreaName(area) {
    const mapping = {
        kerama: '泊港',
        ishigaki: '石垣',
        miyako: '宮古'
    };
    return mapping[area] || '';
}

// ===== 交通ルート検索APIエンドポイント =====

// 基本ルート検索API
app.get('/api/transport/directions', async (req, res) => {
    try {
        const { origin, destination, mode = 'driving' } = req.query;
        
        if (!origin || !destination) {
            return res.status(400).json({
                success: false,
                error: 'missing_parameters',
                message: '出発地と目的地が必要です',
                required: ['origin', 'destination']
            });
        }
        
        console.log(`🗺️ ルート検索API: ${origin} → ${destination} (${mode})`);
        
        const result = await getDirections(origin, destination, mode);
        
        if (result.success) {
            res.json({
                success: true,
                origin: origin,
                destination: destination,
                mode: mode,
                routes: result.data?.routes || [],
                status: result.data?.status || 'OK',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('❌ ルート検索APIエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'ルート検索でエラーが発生しました'
        });
    }
});

// 交通手段比較API
app.get('/api/transport/options', async (req, res) => {
    try {
        const { origin, destination, area = 'okinawa' } = req.query;
        
        if (!origin || !destination) {
            return res.status(400).json({
                success: false,
                error: 'missing_parameters',
                message: '出発地と目的地が必要です'
            });
        }
        
        console.log(`🚗 交通手段比較API: ${origin} → ${destination} (${area})`);
        
        const result = await getTransportOptions(origin, destination, area);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ 交通手段比較APIエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '交通手段比較でエラーが発生しました'
        });
    }
});

// 沖縄交通情報API
app.get('/api/transport/okinawa-info/:area?', async (req, res) => {
    try {
        const { area = 'all' } = req.params;
        
        console.log(`🏝️ 沖縄交通情報API: ${area}`);
        
        let transportData = {};
        
        if (area === 'all') {
            transportData = OKINAWA_TRANSPORT_DATA;
        } else {
            transportData = {
                airports: OKINAWA_TRANSPORT_DATA.airports,
                buses: OKINAWA_TRANSPORT_DATA.bus_companies[area] || [],
                rental_cars: OKINAWA_TRANSPORT_DATA.rental_car_companies,
                ferries: OKINAWA_TRANSPORT_DATA.ferry_routes.filter(route => 
                    route.name.includes(getAreaName(area))
                ),
                diving_areas: OKINAWA_TRANSPORT_DATA.diving_areas
            };
        }
        
        res.json({
            success: true,
            area: area,
            data: transportData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 沖縄交通情報APIエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '沖縄交通情報の取得に失敗しました'
        });
    }
});

// 空港からダイビングショップへのルート特化API
app.get('/api/transport/airport-to-shop', async (req, res) => {
    try {
        const { airport, shop_id, shop_area } = req.query;
        
        if (!airport) {
            return res.status(400).json({
                success: false,
                error: 'missing_airport',
                message: '空港が指定されていません'
            });
        }
        
        // 空港情報取得
        const airportInfo = OKINAWA_TRANSPORT_DATA.airports[airport];
        if (!airportInfo) {
            return res.status(400).json({
                success: false,
                error: 'invalid_airport',
                message: '無効な空港です'
            });
        }
        
        // 目的地設定（ショップID指定時はショップ情報取得、未指定時はエリア中心）
        let destination = '';
        if (shop_id) {
            // ショップの詳細な位置を取得する場合の処理
            destination = `沖縄県のダイビングショップ`; // 実際のショップ位置情報取得
        } else if (shop_area) {
            destination = `${shop_area}のダイビングエリア`;
        } else {
            destination = '那覇市内';
        }
        
        console.log(`✈️ 空港→ショップ ルート: ${airportInfo.name} → ${destination}`);
        
        const result = await getTransportOptions(airportInfo.name, destination, airport);
        
        // ダイビング特化情報を追加
        result.diving_specific = {
            equipment_transport: {
                rental_car: '最適 - 重器材も楽々',
                bus: '注意 - 大きな荷物制限あり',
                taxi: '可能 - 追加料金の可能性'
            },
            arrival_timing: {
                recommendation: '到着後2時間以上の余裕を推奨',
                reason: 'レンタカー手続き・移動・ショップでの説明時間'
            },
            area_specific: getDivingAreaInfo(shop_area || airport)
        };
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ 空港→ショップ ルートAPIエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '空港からショップへのルート検索でエラーが発生しました'
        });
    }
});

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
            '/partners',
            '/partners/dashboard',
            '/partners/advertising',
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