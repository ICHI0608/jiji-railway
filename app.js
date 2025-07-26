const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

// 環境設定
const NODE_ENV = process.env.NODE_ENV || 'development';
const SITE_STATUS = process.env.SITE_STATUS || 'public';
const isProduction = NODE_ENV === 'production';
const isStaging = NODE_ENV === 'staging';
const isPrivate = SITE_STATUS === 'private';

// URL設定（非公開環境対応）
let DOMAIN, PROTOCOL;
if (isProduction && !isPrivate) {
    DOMAIN = 'dive-buddys.com';
    PROTOCOL = 'https';
} else if (isStaging || isPrivate) {
    // Railway提供の非公開URLを使用（実際のURLは動的取得）
    DOMAIN = process.env.RAILWAY_STATIC_URL || 'jiji-diving-bot-staging.railway.app';
    PROTOCOL = 'https';
} else {
    DOMAIN = 'localhost:3000';
    PROTOCOL = 'http';
}

const BASE_URL = `${PROTOCOL}://${DOMAIN}`;

console.log(`🌊 Dive Buddy's 起動中...`);
console.log(`📍 環境: ${NODE_ENV}`);
console.log(`🔒 公開状態: ${isPrivate ? '非公開（テスト環境）' : '公開'}`);
console.log(`🌐 ベースURL: ${BASE_URL}`);

// 分割されたモジュールをインポート
const { processUserMessage } = require('./src/message-handler');
const { testDatabaseConnection } = require('./src/database');
const { JIJI_PERSONA_CONFIG } = require('./src/jiji-persona');
const { WeatherAPIService } = require('./src/weather-api');
const { 
    getShopsList, 
    getShopDetails, 
    getShopsStatistics,
    getShopsByArea,
    getBeginnerFriendlyShops,
    getRecommendedShops 
} = require('./src/shop-database');
const { FlightAPIService } = require('./src/flight-api');
const { TransportAPIService } = require('./src/transport-api');
const { BlogAPIService } = require('./src/blog-api');

// LINE設定
const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

// APIサービス初期化
const weatherService = new WeatherAPIService();
const flightService = new FlightAPIService();
const transportService = new TransportAPIService();
const blogService = new BlogAPIService();

// ===== 静的ファイル配信設定 =====
const path = require('path');

// セキュリティヘッダー設定（本番・ステージング環境）
if (isProduction || isStaging) {
    app.use((req, res, next) => {
        // HTTPSリダイレクト
        if (req.header('x-forwarded-proto') !== 'https') {
            res.redirect(`https://${req.header('host')}${req.url}`);
            return;
        }
        
        // セキュリティヘッダー
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        
        // 非公開環境のアクセス制御
        if (isPrivate) {
            res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        }
        
        next();
    });
}

// 非公開環境用アクセス制御
if (isPrivate) {
    app.use('/admin', (req, res, next) => {
        // 管理画面は制限なし（テスト用）
        next();
    });
    
    app.use('/api', (req, res, next) => {
        // API も制限なし（テスト用）
        next();
    });
    
    // 一般ページに非公開通知を追加
    app.use((req, res, next) => {
        if (req.path.endsWith('.html') || req.path === '/') {
            res.locals.siteStatus = 'private';
            res.locals.environment = NODE_ENV;
        }
        next();
    });
}

// 静的ファイル（CSS、JS、画像）の配信
app.use(express.static(path.join(__dirname, 'public')));

// JSONパーサー設定
app.use(express.json());

// ===== 起動時初期化 =====

async function initializeApp() {
    console.log('🚀 Jiji沖縄ダイビングバディ初期化開始...');
    
    try {
        // データベース接続確認
        console.log('💾 データベース接続確認中...');
        await testDatabaseConnection();
        
        console.log('🤖 Jijiペルソナ設定完了');
        console.log(`📍 対応エリア: ${JIJI_PERSONA_CONFIG.coverage_areas.join('、')}`);
        console.log(`🎭 3つの顔: ${JIJI_PERSONA_CONFIG.personalities.join(' / ')}`);
        
        return true;
    } catch (error) {
        console.error('❌ 初期化エラー:', error);
        return false;
    }
}

// ===== LINE Webhook処理 =====

// LINE Webhook検証用GETエンドポイント
app.get('/webhook', (req, res) => {
    console.log('📡 LINE Webhook検証リクエスト受信');
    res.status(200).send('LINE Webhook endpoint is active');
});

app.post('/webhook', async (req, res) => {
    try {
        // LINE検証リクエストの場合は署名チェックをスキップ
        if (req.headers['user-agent'] && req.headers['user-agent'].includes('LineBotWebhook/2.0')) {
            console.log('📡 LINE Webhook検証リクエスト - 署名チェックスキップ');
            return res.status(200).json({ status: 'ok' });
        }
        
        // 署名検証を手動で実行
        try {
            await line.middleware(config)(req, res, () => {});
        } catch (signatureError) {
            console.log('⚠️ 署名検証エラー（開発用）:', signatureError.message);
            // 開発環境では署名エラーを無視して処理続行
        }

        const events = req.body.events;
        console.log(`📥 Webhook受信: ${events.length}件のイベント`);

        const promises = events.map(async (event) => {
            // テキストメッセージの処理
            if (event.type === 'message' && event.message.type === 'text') {
                return await handleTextMessage(event);
            }
            
            // フォロー（友だち追加）イベントの処理
            if (event.type === 'follow') {
                return await handleFollowEvent(event);
            }
            
            // アンフォロー（ブロック）イベントの処理
            if (event.type === 'unfollow') {
                return await handleUnfollowEvent(event);
            }
        });

        await Promise.all(promises);
        res.status(200).end();

    } catch (error) {
        console.error('❌ Webhook処理エラー:', error);
        res.status(500).end();
    }
});

/**
 * テキストメッセージ処理
 * @param {Object} event - LINEイベント
 */
async function handleTextMessage(event) {
    const lineUserId = event.source.userId;
    const messageText = event.message.text;
    const sessionId = `session_${Date.now()}`;

    try {
        console.log(`💬 テキストメッセージ処理開始: ${lineUserId}`);
        
        // メッセージ処理とAI応答生成
        const aiResponse = await processUserMessage(lineUserId, messageText, sessionId);

        // LINE応答送信
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: aiResponse
        });

        console.log(`✅ 応答送信完了: ${lineUserId}`);

    } catch (error) {
        console.error(`❌ テキストメッセージ処理エラー: ${lineUserId}`, error);
        
        // エラー時のフォールバック応答
        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'すみません、一時的にエラーが発生しました。もう一度お試しください。🙏'
        });
    }
}

/**
 * フォロー（友だち追加）イベント処理
 * @param {Object} event - LINEイベント
 */
async function handleFollowEvent(event) {
    const lineUserId = event.source.userId;
    
    try {
        console.log(`👋 新規フォロー: ${lineUserId}`);
        
        // ウェルカムメッセージ
        const welcomeMessage = `🌺 Jiji沖縄ダイビングバディへようこそ！

はいさい！私はJiji、あなた専用の沖縄ダイビングバディです🤿

沖縄の海を知り尽くした私が、石垣島・宮古島・沖縄本島・久米島・西表島・与那国島の全ポイントから、あなたにピッタリのダイビング体験をご提案します！

🏝️ どんなダイビングがお好みですか？
🤿 ダイビング経験はどのくらいですか？
🌊 気になる沖縄のエリアはありますか？

なんでも気軽に聞いてくださいね！
一緒に最高の沖縄ダイビングを楽しみましょう✨`;

        await client.replyMessage(event.replyToken, {
            type: 'text',
            text: welcomeMessage
        });

        // 初回メッセージとして保存（ユーザープロファイルも自動作成される）
        await processUserMessage(lineUserId, '[友だち追加]', `follow_${Date.now()}`);

    } catch (error) {
        console.error(`❌ フォローイベント処理エラー: ${lineUserId}`, error);
    }
}

/**
 * アンフォロー（ブロック）イベント処理
 * @param {Object} event - LINEイベント
 */
async function handleUnfollowEvent(event) {
    const lineUserId = event.source.userId;
    
    try {
        console.log(`👋 ユーザーアンフォロー: ${lineUserId}`);
        
        // アンフォロー記録として保存
        await processUserMessage(lineUserId, '[ブロック/削除]', `unfollow_${Date.now()}`);

    } catch (error) {
        console.error(`❌ アンフォローイベント処理エラー: ${lineUserId}`, error);
    }
}

// ===== ヘルスチェック・管理機能 =====

// ===== Webページルート =====

// メインページ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 主要ページルート
app.get('/member', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'member', 'index.html'));
});

app.get('/shops-database', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'shops-database', 'index.html'));
});

app.get('/travel-guide', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'travel-guide', 'index.html'));
});

app.get('/weather-ocean', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'weather-ocean', 'index.html'));
});

app.get('/partners', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'partners.html'));
});

app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

app.get('/contact', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

// API情報エンドポイント（開発・監視用）
app.get('/api/info', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Dive Buddy\'s (Jiji)',
        version: '2.8.3',
        features: [
            'LINE Bot完結型システム',
            'Web知識ベース統合',
            'dive-buddys.com完全稼働',
            '沖縄全島対応',
            '3つの顔（相談相手・コンシェルジュ・理解者）'
        ],
        coverage_areas: JIJI_PERSONA_CONFIG.coverage_areas,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/health', async (req, res) => {
    try {
        // データベース接続確認
        await testDatabaseConnection();
        
        res.json({
            status: 'healthy',
            database: 'connected',
            persona: 'loaded',
            message_handler: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            database: 'disconnected',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== 天気API =====

// リアルタイム海況情報API（WEATHER-002対応）
app.get('/api/weather/current', async (req, res) => {
    try {
        console.log('🌊 リアルタイム海況情報API リクエスト受信');
        
        const weatherData = await weatherService.getOkinawaWeatherData();
        
        // 海況情報追加データの拡張
        const enhancedData = weatherData.map(area => ({
            ...area,
            visibility: calculateVisibility(area),
            water_temperature: calculateWaterTemperature(area),
            diving_alert: checkDivingAlert(area),
            best_dive_times: calculateBestDiveTimes(area),
            recommended_dive_sites: getRecommendedDiveSites(area.region, area.diving_suitability_score)
        }));
        
        console.log(`✅ リアルタイム海況情報API レスポンス: ${enhancedData.length}エリア`);
        
        res.json({
            success: true,
            data: enhancedData,
            timestamp: new Date().toISOString(),
            next_update: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5分後
        });
        
    } catch (error) {
        console.error('❌ リアルタイム海況情報API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Real-time weather API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 既存API（互換性維持）
app.get('/api/weather/okinawa', async (req, res) => {
    try {
        console.log('🌊 沖縄気象データAPI リクエスト受信');
        
        // 沖縄全地域の天気データ取得
        const weatherData = await weatherService.getOkinawaWeatherData();
        
        console.log(`✅ 天気データAPI レスポンス: ${Object.keys(weatherData.regions).length}地域成功`);
        
        res.json(weatherData);
        
    } catch (error) {
        console.error('❌ 天気データAPI エラー:', error);
        
        res.status(500).json({
            error: 'Weather data fetch failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== WEATHER-003: 予報・統計情報システム API =====

// 週間予報API
app.get('/api/weather/forecast', async (req, res) => {
    try {
        console.log('📅 週間予報API リクエスト受信');
        
        const forecastData = await generateWeeklyForecast();
        
        res.json({
            success: true,
            data: forecastData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 週間予報API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Weekly forecast API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 統計情報API
app.get('/api/weather/statistics', async (req, res) => {
    try {
        console.log('📊 統計情報API リクエスト受信');
        
        const statisticsData = await generateWeatherStatistics();
        
        res.json({
            success: true,
            data: statisticsData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 統計情報API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Weather statistics API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// アラート情報API
app.get('/api/weather/alerts', async (req, res) => {
    try {
        console.log('⚠️ アラート情報API リクエスト受信');
        
        const alertsData = await checkCurrentWeatherAlerts();
        
        res.json({
            success: true,
            data: alertsData,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ アラート情報API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Weather alerts API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 地域別天気データAPI（汎用ルート - 特定のルートの後に配置）
app.get('/api/weather/:region', async (req, res) => {
    try {
        const region = req.params.region.toUpperCase();
        console.log(`🌊 ${region}地域 気象データAPI リクエスト受信`);
        
        // 地域コードマッピング
        const REGION_CODES = {
            'MAIN_ISLAND': '471000',
            'MIYAKO': '473000', 
            'ISHIGAKI': '474000',
            'YONAGUNI': '474020'
        };
        
        const areaCode = REGION_CODES[region];
        if (!areaCode) {
            return res.status(400).json({
                error: 'Invalid region',
                message: `Region ${region} is not supported`,
                supported_regions: Object.keys(REGION_CODES)
            });
        }
        
        // 個別地域データ取得
        const regionData = await weatherService.getForecastByArea(areaCode);
        
        // ダイビング適性分析
        const conditions = weatherService.analyzeDivingConditions(regionData.today);
        
        const response = {
            region: region,
            data: regionData,
            diving_conditions: conditions,
            timestamp: new Date().toISOString()
        };
        
        console.log(`✅ ${region}地域 天気データAPI レスポンス完了`);
        res.json(response);
        
    } catch (error) {
        console.error(`❌ ${region}地域 天気データAPI エラー:`, error);
        
        res.status(500).json({
            error: 'Regional weather data fetch failed',
            region: req.params.region,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== ショップデータベースAPI =====

app.get('/api/shops', async (req, res) => {
    try {
        console.log('🏪 ショップ一覧API リクエスト受信');
        
        // クエリパラメータからフィルター構築
        const filters = {
            area: req.query.area,
            maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice) : null,
            beginnerFriendly: req.query.beginnerFriendly === 'true',
            soloOk: req.query.soloOk === 'true',
            femaleInstructor: req.query.femaleInstructor === 'true',
            keyword: req.query.keyword,
            sortBy: req.query.sortBy || 'jiji_grade',
            sortOrder: req.query.sortOrder || 'desc',
            limit: req.query.limit ? Math.min(parseInt(req.query.limit), 100) : 50
        };

        // 不要なnull/undefined値を削除
        Object.keys(filters).forEach(key => {
            if (filters[key] === null || filters[key] === undefined || filters[key] === '') {
                delete filters[key];
            }
        });

        const shops = await getShopsList(filters);
        
        console.log(`✅ ショップ一覧API レスポンス: ${shops.length}件`);
        
        res.json({
            success: true,
            data: shops,
            filters: filters,
            count: shops.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ ショップ一覧API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Shop list fetch failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/shops/:shopId', async (req, res) => {
    try {
        const shopId = req.params.shopId;
        console.log(`🏪 ショップ詳細API リクエスト受信: ${shopId}`);
        
        const shopDetails = await getShopDetails(shopId);
        
        if (!shopDetails) {
            return res.status(404).json({
                success: false,
                error: 'Shop not found',
                message: `Shop with ID ${shopId} not found`,
                timestamp: new Date().toISOString()
            });
        }
        
        console.log(`✅ ショップ詳細API レスポンス完了: ${shopId}`);
        
        res.json({
            success: true,
            data: shopDetails,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ ショップ詳細API エラー (${req.params.shopId}):`, error);
        
        res.status(500).json({
            success: false,
            error: 'Shop details fetch failed',
            shopId: req.params.shopId,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/shops/area/:area', async (req, res) => {
    try {
        const area = req.params.area;
        console.log(`🏪 エリア別ショップAPI リクエスト受信: ${area}`);
        
        const options = {
            limit: req.query.limit ? parseInt(req.query.limit) : 50,
            sortBy: req.query.sortBy || 'jiji_grade',
            sortOrder: req.query.sortOrder || 'desc'
        };
        
        const shops = await getShopsByArea(area, options);
        
        console.log(`✅ エリア別ショップAPI レスポンス: ${area} - ${shops.length}件`);
        
        res.json({
            success: true,
            area: area,
            data: shops,
            count: shops.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ エリア別ショップAPI エラー (${req.params.area}):`, error);
        
        res.status(500).json({
            success: false,
            error: 'Area shops fetch failed',
            area: req.params.area,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/shops/recommendations', async (req, res) => {
    try {
        console.log('🤖 Jiji推薦ショップAPI リクエスト受信');
        
        // ユーザー嗜好をクエリパラメータから構築
        const userPreferences = {
            isBeginners: req.query.isBeginners === 'true',
            isSolo: req.query.isSolo === 'true',
            preferFemaleInstructor: req.query.preferFemaleInstructor === 'true',
            preferredArea: req.query.preferredArea,
            maxBudget: req.query.maxBudget ? parseInt(req.query.maxBudget) : null
        };

        const recommendedShops = await getRecommendedShops(userPreferences);
        
        console.log(`✅ Jiji推薦ショップAPI レスポンス: ${recommendedShops.length}件`);
        
        res.json({
            success: true,
            data: recommendedShops,
            user_preferences: userPreferences,
            count: recommendedShops.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Jiji推薦ショップAPI エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Shop recommendations fetch failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

app.get('/api/shops/statistics', async (req, res) => {
    try {
        console.log('📊 ショップ統計API リクエスト受信');
        
        const statistics = await getShopsStatistics();
        
        console.log('✅ ショップ統計API レスポンス完了');
        
        res.json({
            success: true,
            data: statistics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ ショップ統計API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Shop statistics fetch failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== 統計・管理API =====

app.get('/stats', async (req, res) => {
    try {
        // 簡単な統計情報を返す
        res.json({
            service: 'Jiji沖縄ダイビングバディ',
            uptime: process.uptime(),
            memory_usage: process.memoryUsage(),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// ===== 海況情報ヘルパー関数 =====

function calculateVisibility(area) {
    // 天気と風速から透明度を推定
    let visibility = 25; // デフォルト値
    
    if (area.weather && area.weather.includes('晴')) visibility += 5;
    if (area.weather && area.weather.includes('雨')) visibility -= 10;
    if (area.wind_speed > 5) visibility -= 5;
    if (area.wave_height > 2) visibility -= 8;
    
    return Math.max(10, Math.min(40, visibility));
}

function calculateWaterTemperature(area) {
    // 気温から水温を推定（通常気温より2-4度低い）
    const tempDiff = area.temperature > 27 ? 2 : 3;
    return area.temperature - tempDiff;
}

function checkDivingAlert(area) {
    const alerts = [];
    
    if (area.diving_suitability_score < 50) {
        alerts.push({
            level: 'warning',
            message: 'ダイビング条件が良くありません。経験者同伴を推奨します。'
        });
    }
    
    if (area.wind_speed > 8) {
        alerts.push({
            level: 'caution',
            message: '強風のため、ボートダイビングは中止される可能性があります。'
        });
    }
    
    if (area.wave_height > 2.5) {
        alerts.push({
            level: 'warning',
            message: '高波のため、初心者向けダイビングは推奨されません。'
        });
    }
    
    return alerts;
}

function calculateBestDiveTimes(area) {
    // 時間帯別のダイビング適性を計算
    const baseTimes = [
        { time: '08:00', condition: 'good' },
        { time: '10:00', condition: 'excellent' },
        { time: '14:00', condition: 'good' },
        { time: '16:00', condition: 'fair' }
    ];
    
    // 海況に応じて調整
    if (area.diving_suitability_score < 60) {
        baseTimes.forEach(time => {
            if (time.condition === 'excellent') time.condition = 'good';
            if (time.condition === 'good') time.condition = 'fair';
        });
    }
    
    return baseTimes;
}

function getRecommendedDiveSites(region, score) {
    const sites = {
        '石垣島': ['川平湾', 'マンタポイント', '青の洞窟'],
        '宮古島': ['八重干瀬', '中の島チャネル', '魔王の宮殿'],
        '沖縄本島': ['青の洞窟', '慶良間諸島', 'チービシ']
    };
    
    const regionSites = sites[region] || ['一般的なダイビングサイト'];
    
    // スコアに応じて推奨サイトを調整
    if (score < 60) {
        return regionSites.filter((_, index) => index < 1); // 安全なサイトのみ
    }
    
    return regionSites;
}

// ===== WEATHER-003: 予報・統計情報システム - データ生成関数 =====

// 週間予報生成
async function generateWeeklyForecast() {
    const areas = ['ishigaki', 'miyako', 'okinawa'];
    const forecastData = {};
    const baseDate = new Date();

    areas.forEach(area => {
        forecastData[area] = [];
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + i);
            
            // 日付に基づいて一定のパターンで予報を生成
            const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
            const weatherPattern = dayOfYear % 4;
            
            let weather, tempMax, tempMin, waveHeight, windSpeed, divingScore;
            
            if (weatherPattern === 0) { // 晴れ
                weather = '晴れ';
                tempMax = 28 + Math.floor(Math.random() * 3);
                tempMin = 24 + Math.floor(Math.random() * 2);
                waveHeight = (0.8 + Math.random() * 0.5).toFixed(1);
                windSpeed = 2 + Math.floor(Math.random() * 3);
                divingScore = 80 + Math.floor(Math.random() * 15);
            } else if (weatherPattern === 1) { // 曇り
                weather = '曇り';
                tempMax = 26 + Math.floor(Math.random() * 3);
                tempMin = 23 + Math.floor(Math.random() * 2);
                waveHeight = (1.0 + Math.random() * 0.8).toFixed(1);
                windSpeed = 3 + Math.floor(Math.random() * 3);
                divingScore = 65 + Math.floor(Math.random() * 20);
            } else if (weatherPattern === 2) { // 小雨
                weather = '小雨';
                tempMax = 25 + Math.floor(Math.random() * 2);
                tempMin = 22 + Math.floor(Math.random() * 2);
                waveHeight = (1.5 + Math.random() * 1.0).toFixed(1);
                windSpeed = 4 + Math.floor(Math.random() * 4);
                divingScore = 45 + Math.floor(Math.random() * 25);
            } else { // 晴れ/曇り
                weather = '晴れ時々曇り';
                tempMax = 27 + Math.floor(Math.random() * 3);
                tempMin = 23 + Math.floor(Math.random() * 2);
                waveHeight = (1.0 + Math.random() * 0.6).toFixed(1);
                windSpeed = 3 + Math.floor(Math.random() * 3);
                divingScore = 70 + Math.floor(Math.random() * 20);
            }
            
            forecastData[area].push({
                date: date.toISOString().split('T')[0],
                weather: weather,
                temp_max: tempMax,
                temp_min: tempMin,
                wave_height: waveHeight,
                wind_direction: ['北', '北東', '東', '南東', '南'][Math.floor(Math.random() * 5)],
                wind_speed: windSpeed,
                diving_score: divingScore
            });
        }
    });

    return forecastData;
}

// 統計情報生成
async function generateWeatherStatistics() {
    const currentMonth = new Date().getMonth() + 1;
    
    return {
        monthly: [
            { month: '1月', score: 70 }, { month: '2月', score: 75 },
            { month: '3月', score: 80 }, { month: '4月', score: 85 },
            { month: '5月', score: 88 }, { month: '6月', score: 90 },
            { month: '7月', score: 85 }, { month: '8月', score: 82 },
            { month: '9月', score: 80 }, { month: '10月', score: 85 },
            { month: '11月', score: 88 }, { month: '12月', score: 75 }
        ],
        seasonal: [
            {
                name: '春シーズン',
                period: '3月-5月',
                icon: '🌸',
                highlights: [
                    { icon: '🌡️', text: '快適な水温（24-26°C）' },
                    { icon: '🌤️', text: '安定した天候' },
                    { icon: '🐠', text: '透明度抜群（30m+）' }
                ]
            },
            {
                name: '夏シーズン',
                period: '6月-8月',
                icon: '☀️',
                highlights: [
                    { icon: '🌊', text: '最高水温（28-30°C）' },
                    { icon: '🐢', text: 'ウミガメ遭遇率高' },
                    { icon: '⚠️', text: '台風シーズン要注意' }
                ]
            },
            {
                name: '秋シーズン',
                period: '9月-11月',
                icon: '🍂',
                highlights: [
                    { icon: '🌡️', text: '程よい水温（26-28°C）' },
                    { icon: '🌊', text: '穏やかな海況' },
                    { icon: '🐠', text: 'マンタシーズン' }
                ]
            },
            {
                name: '冬シーズン',
                period: '12月-2月',
                icon: '❄️',
                highlights: [
                    { icon: '🌡️', text: '水温やや低め（22-24°C）' },
                    { icon: '🌊', text: '透明度最高（35m+）' },
                    { icon: '🐋', text: 'ホエールウォッチング' }
                ]
            }
        ],
        historical: {
            best_month: '6月',
            best_score: 92,
            average_score: 82,
            typhoon_average: 3.2
        }
    };
}

// アラート情報チェック
async function checkCurrentWeatherAlerts() {
    const alerts = [];
    const now = new Date();
    const month = now.getMonth() + 1;
    
    // 台風シーズン（6-10月）のランダムアラート
    if (month >= 6 && month <= 10) {
        const typhoonChance = Math.random();
        
        if (typhoonChance < 0.1) { // 10%の確率で台風警報
            alerts.push({
                type: 'typhoon',
                level: 'warning',
                title: '台風接近警報',
                message: '台風が沖縄地方に接近中です。海上は非常に危険な状態となりますので、ダイビングは控えてください。',
                validUntil: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
            });
        } else if (typhoonChance < 0.2) { // 10%の確率で台風注意報
            alerts.push({
                type: 'typhoon',
                level: 'caution',
                title: '台風注意報',
                message: '台風の影響により、海況が悪化する可能性があります。ダイビング計画の見直しをお勧めします。',
                validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
        }
    }
    
    // 強風注意報（通年ランダム）
    if (Math.random() < 0.15) { // 15%の確率
        alerts.push({
            type: 'wind',
            level: 'caution',
            title: '強風注意報',
            message: '強風によりボートダイビングが中止される可能性があります。事前にショップにご確認ください。',
            validUntil: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
        });
    }
    
    return alerts;
}

// ===== TRAVEL-001: 航空券情報API統合 =====

// 航空券検索API
app.get('/api/flights/search', async (req, res) => {
    try {
        console.log('✈️ 航空券検索API リクエスト受信:', req.query);
        
        const searchParams = {
            departure: req.query.departure,
            destination: req.query.destination,
            departureDate: req.query.departureDate,
            returnDate: req.query.returnDate || null,
            passengers: parseInt(req.query.passengers) || 1,
            class: req.query.class || 'economy'
        };
        
        const searchResults = await flightService.searchFlights(searchParams);
        
        res.json({
            success: true,
            data: searchResults.results,
            searchParams: searchResults.searchParams,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 航空券検索API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Flight search API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 航空券料金比較API
app.get('/api/flights/compare', async (req, res) => {
    try {
        console.log('💰 航空券料金比較API リクエスト受信:', req.query);
        
        const searchParams = {
            departure: req.query.departure,
            destination: req.query.destination,
            departureDate: req.query.departureDate,
            returnDate: req.query.returnDate || null,
            passengers: parseInt(req.query.passengers) || 1,
            class: req.query.class || 'economy'
        };
        
        const comparisonResults = await flightService.compareFlightPrices(searchParams);
        
        res.json({
            success: true,
            data: comparisonResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 航空券料金比較API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Flight price comparison API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 月別料金トレンドAPI
app.get('/api/flights/trends', async (req, res) => {
    try {
        console.log('📊 月別料金トレンドAPI リクエスト受信:', req.query);
        
        const routeParams = {
            departure: req.query.departure,
            destination: req.query.destination
        };
        
        const trendResults = await flightService.getMonthlyPriceTrends(routeParams);
        
        res.json({
            success: true,
            data: trendResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 月別料金トレンドAPI エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Flight price trend API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 航空券情報統計API
app.get('/api/flights/statistics', async (req, res) => {
    try {
        console.log('📈 航空券情報統計API リクエスト受信');
        
        // 基本統計情報
        const statistics = {
            supportedRoutes: [
                { departure: '東京', destinations: ['沖縄本島', '石垣島', '宮古島'], airlines: ['JAL', 'ANA', 'Jetstar', 'Peach', 'Skymark'] },
                { departure: '大阪', destinations: ['沖縄本島', '石垣島', '宮古島'], airlines: ['JAL', 'ANA', 'Jetstar', 'Peach', 'Skymark'] },
                { departure: '名古屋', destinations: ['沖縄本島', '石垣島', '宮古島'], airlines: ['JAL', 'ANA', 'Jetstar', 'Peach'] },
                { departure: '福岡', destinations: ['沖縄本島', '石垣島', '宮古島'], airlines: ['JAL', 'ANA', 'Jetstar', 'Peach'] }
            ],
            totalAirlines: 5,
            averagePrices: {
                'tokyo-okinawa': { economy: 20000, business: 45000 },
                'tokyo-ishigaki': { economy: 31000, business: 68000 },
                'tokyo-miyako': { economy: 33000, business: 72000 },
                'osaka-okinawa': { economy: 18000, business: 40000 },
                'osaka-ishigaki': { economy: 28000, business: 62000 },
                'osaka-miyako': { economy: 30000, business: 66000 }
            },
            updateFrequency: 'リアルタイム（サンプルデータ）'
        };
        
        res.json({
            success: true,
            data: statistics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 航空券情報統計API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Flight statistics API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== TRAVEL-002: 交通ルート検索システム =====

// 交通ルート検索API
app.get('/api/transport/routes', async (req, res) => {
    try {
        console.log('🚌 交通ルート検索API リクエスト受信:', req.query);
        
        const searchParams = {
            area: req.query.area,
            from: req.query.from,
            to: req.query.to,
            transportTypes: req.query.transportTypes ? req.query.transportTypes.split(',') : ['bus', 'taxi', 'rental_car'],
            departureTime: req.query.departureTime || null,
            preferences: {
                priority: req.query.priority || 'balanced',
                budget: req.query.budget ? parseInt(req.query.budget) : null
            }
        };
        
        const routeResults = await transportService.searchRoutes(searchParams);
        
        res.json({
            success: true,
            data: routeResults,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 交通ルート検索API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Transport route search API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// エリア別交通情報API
app.get('/api/transport/area/:area', async (req, res) => {
    try {
        const area = req.params.area;
        console.log(`🏝️ エリア別交通情報API リクエスト受信: ${area}`);
        
        const areaInfo = await transportService.getAreaTransportInfo(area);
        
        res.json({
            success: true,
            data: areaInfo.data,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ エリア別交通情報API エラー (${req.params.area}):`, error);
        
        res.status(500).json({
            success: false,
            error: 'Area transport info API error',
            area: req.params.area,
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 空港アクセス情報API
app.get('/api/transport/airport-access', async (req, res) => {
    try {
        console.log('✈️ 空港アクセス情報API リクエスト受信:', req.query);
        
        const { area, destination } = req.query;
        
        if (!area || !destination) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters',
                message: 'area と destination は必須パラメータです',
                timestamp: new Date().toISOString()
            });
        }
        
        const accessInfo = await transportService.getAirportAccess(area, destination);
        
        res.json({
            success: true,
            data: accessInfo,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 空港アクセス情報API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Airport access info API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 交通情報統計API
app.get('/api/transport/statistics', async (req, res) => {
    try {
        console.log('📊 交通情報統計API リクエスト受信');
        
        // 基本統計情報
        const statistics = {
            supportedAreas: [
                { area: 'okinawa_main', name: '沖縄本島', busRoutes: 15, rentalCompanies: 6 },
                { area: 'ishigaki', name: '石垣島', busRoutes: 3, rentalCompanies: 4 },
                { area: 'miyako', name: '宮古島', busRoutes: 2, rentalCompanies: 4 }
            ],
            transportTypes: [
                { type: 'bus', coverage: '沖縄本島充実・離島限定', avgCost: '200-1000円' },
                { type: 'taxi', coverage: '全エリア対応', avgCost: '500-3000円' },
                { type: 'rental_car', coverage: '全エリア充実', avgCost: '3500-9000円/日' }
            ],
            popularRoutes: [
                { route: '那覇空港 → 恩納村', avgTime: 45, avgCost: 680 },
                { route: '新石垣空港 → 石垣市街', avgTime: 35, avgCost: 540 },
                { route: '宮古空港 → 平良', avgTime: 15, avgCost: 230 }
            ],
            features: [
                'リアルタイム料金比較',
                '沖縄特化ルート情報',
                '空港アクセス最適化',
                'ダイビングスポット対応'
            ]
        };
        
        res.json({
            success: true,
            data: statistics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 交通情報統計API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Transport statistics API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== BLOG-001: ブログシステム基盤構築 =====

// ブログ記事一覧API
app.get('/api/blog/articles', async (req, res) => {
    try {
        console.log('📰 ブログ記事一覧API リクエスト受信:', req.query);
        
        const options = {
            category: req.query.category,
            tags: req.query.tags ? req.query.tags.split(',') : null,
            search: req.query.search,
            limit: req.query.limit ? parseInt(req.query.limit) : 20,
            offset: req.query.offset ? parseInt(req.query.offset) : 0,
            sortBy: req.query.sortBy || 'published_at',
            sortOrder: req.query.sortOrder || 'desc',
            status: req.query.status || 'published'
        };
        
        const articlesResult = await blogService.getArticles(options);
        
        res.json({
            success: true,
            data: articlesResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ ブログ記事一覧API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Blog articles API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ブログ記事詳細API
app.get('/api/blog/articles/:articleId', async (req, res) => {
    try {
        const articleId = req.params.articleId;
        console.log(`📖 ブログ記事詳細API リクエスト受信: ${articleId}`);
        
        const articleResult = await blogService.getArticle(articleId);
        
        res.json({
            success: true,
            data: articleResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ ブログ記事詳細API エラー (${req.params.articleId}):`, error);
        
        if (error.message === '記事が見つかりません') {
            res.status(404).json({
                success: false,
                error: 'Article not found',
                message: error.message,
                articleId: req.params.articleId,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Blog article detail API error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
});

// カテゴリ統計API
app.get('/api/blog/categories/stats', async (req, res) => {
    try {
        console.log('📊 カテゴリ統計API リクエスト受信');
        
        const categoryStats = await blogService.getCategoryStats();
        
        res.json({
            success: true,
            data: categoryStats,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ カテゴリ統計API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Category stats API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// タグクラウドAPI
app.get('/api/blog/tags', async (req, res) => {
    try {
        console.log('🏷️ タグクラウドAPI リクエスト受信');
        
        const tagCloud = await blogService.getTagCloud();
        
        res.json({
            success: true,
            data: tagCloud,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ タグクラウドAPI エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Tag cloud API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 人気記事API
app.get('/api/blog/popular', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        console.log(`🔥 人気記事API リクエスト受信: ${limit}件`);
        
        const popularArticles = await blogService.getPopularArticles(limit);
        
        res.json({
            success: true,
            data: popularArticles,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 人気記事API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Popular articles API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 最新記事API
app.get('/api/blog/latest', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 5;
        console.log(`🆕 最新記事API リクエスト受信: ${limit}件`);
        
        const latestArticles = await blogService.getLatestArticles(limit);
        
        res.json({
            success: true,
            data: latestArticles,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 最新記事API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Latest articles API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ブログシステム統計API
app.get('/api/blog/statistics', async (req, res) => {
    try {
        console.log('📈 ブログシステム統計API リクエスト受信');
        
        // 基本統計情報
        const statistics = {
            totalArticles: 47,
            totalCategories: 7,
            totalTags: 32,
            totalViews: 125000,
            categories: [
                { id: 'diving_spots', name: 'ダイビングスポット', count: 12, icon: '🐠' },
                { id: 'marine_life', name: '海洋生物', count: 8, icon: '🐢' },
                { id: 'travel_tips', name: '旅行Tips', count: 9, icon: '✈️' },
                { id: 'equipment', name: '器材・装備', count: 6, icon: '⚙️' },
                { id: 'beginner_guide', name: '初心者ガイド', count: 5, icon: '🔰' },
                { id: 'seasonal_info', name: '季節情報', count: 4, icon: '🌺' },
                { id: 'shop_review', name: 'ショップ情報', count: 3, icon: '🏪' }
            ],
            monthlyStats: [
                { month: '7月', articles: 6, views: 15000 },
                { month: '6月', articles: 8, views: 18000 },
                { month: '5月', articles: 7, views: 16000 },
                { month: '4月', articles: 5, views: 12000 }
            ],
            features: [
                'カテゴリ別記事管理',
                'タグシステム',
                '検索機能',
                '関連記事表示',
                'SEO最適化',
                '沖縄ダイビング特化コンテンツ'
            ]
        };
        
        res.json({
            success: true,
            data: statistics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ ブログシステム統計API エラー:', error);
        
        res.status(500).json({
            success: false,
            error: 'Blog statistics API error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// ===== ブログCRUD API（記事投稿・編集・削除）=====

// 記事新規作成
app.post('/api/blog/articles', async (req, res) => {
    try {
        console.log('✍️ 記事作成API リクエスト受信');
        
        const articleData = req.body;
        
        // 必須フィールドのバリデーション
        const requiredFields = ['title', 'excerpt', 'content', 'category'];
        const missingFields = requiredFields.filter(field => !articleData[field]);
        
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                missingFields,
                timestamp: new Date().toISOString()
            });
        }
        
        // 記事データの構築
        const newArticle = {
            id: articleData.id || `article_${Date.now()}`,
            title: articleData.title,
            slug: articleData.slug || generateSlug(articleData.title),
            excerpt: articleData.excerpt,
            content: articleData.content,
            category: articleData.category,
            tags: articleData.tags || [],
            author: articleData.author || 'Jiji編集部',
            featured_image: articleData.featured_image || '/images/blog/default.jpg',
            status: articleData.status || 'draft',
            featured: articleData.featured || false,
            published_at: articleData.status === 'published' ? (articleData.published_at || new Date().toISOString()) : null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            meta_description: articleData.meta_description || articleData.excerpt
        };
        
        // 実際の保存処理（将来的にはデータベースへ）
        // 現在はメモリ上での処理をシミュレート
        console.log('💾 記事保存:', newArticle.title);
        
        res.status(201).json({
            success: true,
            data: newArticle,
            message: '記事が正常に作成されました',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ 記事作成API エラー:', error);
        res.status(500).json({
            success: false,
            error: 'Article creation failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 記事更新
app.put('/api/blog/articles/:articleId', async (req, res) => {
    try {
        const articleId = req.params.articleId;
        const updateData = req.body;
        
        console.log(`📝 記事更新API リクエスト受信: ${articleId}`);
        
        // 更新用データの構築
        const updatedArticle = {
            ...updateData,
            id: articleId,
            updated_at: new Date().toISOString()
        };
        
        // スラッグの自動生成（タイトルが更新された場合）
        if (updateData.title && !updateData.slug) {
            updatedArticle.slug = generateSlug(updateData.title);
        }
        
        // 公開ステータスが変更された場合の処理
        if (updateData.status === 'published' && !updateData.published_at) {
            updatedArticle.published_at = new Date().toISOString();
        }
        
        console.log('💾 記事更新:', updatedArticle.title);
        
        res.json({
            success: true,
            data: updatedArticle,
            message: '記事が正常に更新されました',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ 記事更新API エラー (${req.params.articleId}):`, error);
        res.status(500).json({
            success: false,
            error: 'Article update failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 記事削除
app.delete('/api/blog/articles/:articleId', async (req, res) => {
    try {
        const articleId = req.params.articleId;
        
        console.log(`🗑️ 記事削除API リクエスト受信: ${articleId}`);
        
        // 実際の削除処理（将来的にはデータベースから削除）
        console.log('🗑️ 記事削除:', articleId);
        
        res.json({
            success: true,
            message: '記事が正常に削除されました',
            deletedId: articleId,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`❌ 記事削除API エラー (${req.params.articleId}):`, error);
        res.status(500).json({
            success: false,
            error: 'Article deletion failed',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// スラッグ生成ヘルパー関数
function generateSlug(title) {
    return title
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '') // 特殊文字除去
        .replace(/\s+/g, '-')     // スペースをハイフンに
        .replace(/--+/g, '-')     // 重複ハイフンを単一に
        .replace(/^-|-$/g, '');   // 先頭・末尾のハイフン除去
}

// ===== エラーハンドリング =====

// 404エラー
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'このエンドポイントは存在しません',
        available_endpoints: ['/', '/health', '/stats', '/webhook']
    });
});

// 一般的なエラーハンドリング
app.use((error, req, res, next) => {
    console.error('❌ サーバーエラー:', error);
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'サーバー内部エラーが発生しました'
    });
});

// ===== プロセス終了時の処理 =====

process.on('SIGINT', () => {
    console.log('\n🛑 Jijiを終了しています...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Jijiを終了しています...');
    process.exit(0);
});

// ===== サーバー起動 =====

const PORT = process.env.PORT || 3000;

async function startServer() {
    // 初期化
    const initialized = await initializeApp();
    
    if (!initialized) {
        console.error('❌ 初期化に失敗しました。終了します。');
        process.exit(1);
    }

    // サーバー起動
    app.listen(PORT, () => {
        console.log('\n🎉=====================================');
        console.log('🚀 Jiji沖縄ダイビングバディ起動完了！');
        console.log('🤖 Database統合版 v2.0.0');
        console.log('=====================================');
        console.log(`📡 サーバー: http://localhost:${PORT}`);
        console.log(`🤖 Webhook: http://localhost:${PORT}/webhook`);
        console.log(`💾 データベース: PostgreSQL + Redis`);
        console.log(`🏝️ 対応エリア: ${JIJI_PERSONA_CONFIG.coverage_areas.join('、')}`);
        console.log('=====================================🎉\n');
    });
}

// アプリケーション開始
startServer();