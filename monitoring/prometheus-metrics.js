/**
 * Prometheus メトリクス収集 - Jijiダイビングボット
 * システムパフォーマンス、セキュリティ、業務メトリクスの収集
 */

const client = require('prom-client');

// デフォルトメトリクスを収集
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });

// カスタムメトリクス定義

// HTTPリクエスト関連
const httpRequestDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTPリクエストの処理時間（秒）',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'HTTPリクエストの総数',
    labelNames: ['method', 'route', 'status_code']
});

const httpRequestSize = new client.Histogram({
    name: 'http_request_size_bytes',
    help: 'HTTPリクエストサイズ（バイト）',
    labelNames: ['method', 'route'],
    buckets: [100, 1000, 10000, 100000, 1000000]
});

const httpResponseSize = new client.Histogram({
    name: 'http_response_size_bytes',
    help: 'HTTPレスポンスサイズ（バイト）',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [100, 1000, 10000, 100000, 1000000]
});

// セキュリティ関連
const securityEventsTotal = new client.Counter({
    name: 'security_events_total',
    help: 'セキュリティイベントの総数',
    labelNames: ['type', 'severity', 'source']
});

const rateLimitExceededTotal = new client.Counter({
    name: 'rate_limit_exceeded_total',
    help: 'レート制限超過の総数',
    labelNames: ['ip', 'endpoint']
});

const authFailuresTotal = new client.Counter({
    name: 'auth_failures_total',
    help: '認証失敗の総数',
    labelNames: ['type', 'reason']
});

const suspiciousActivityTotal = new client.Counter({
    name: 'suspicious_activity_total',
    help: '疑わしい活動の総数',
    labelNames: ['type', 'pattern']
});

// 業務メトリクス
const userRegistrationsTotal = new client.Counter({
    name: 'user_registrations_total',
    help: 'ユーザー登録の総数',
    labelNames: ['type', 'source']
});

const shopSearchesTotal = new client.Counter({
    name: 'shop_searches_total',
    help: 'ショップ検索の総数',
    labelNames: ['area', 'filters_used']
});

const reviewsPostedTotal = new client.Counter({
    name: 'reviews_posted_total',
    help: '口コミ投稿の総数',
    labelNames: ['shop_id', 'rating']
});

const bookingRequestsTotal = new client.Counter({
    name: 'booking_requests_total',
    help: '予約リクエストの総数',
    labelNames: ['shop_id', 'status']
});

const lineMessagesTotal = new client.Counter({
    name: 'line_messages_total',
    help: 'LINE Bot メッセージの総数',
    labelNames: ['type', 'user_type']
});

// データベース関連
const databaseQueriesTotal = new client.Counter({
    name: 'database_queries_total',
    help: 'データベースクエリの総数',
    labelNames: ['operation', 'table', 'status']
});

const databaseQueryDuration = new client.Histogram({
    name: 'database_query_duration_seconds',
    help: 'データベースクエリの処理時間（秒）',
    labelNames: ['operation', 'table'],
    buckets: [0.01, 0.1, 0.5, 1, 2, 5]
});

const databaseConnectionsActive = new client.Gauge({
    name: 'database_connections_active',
    help: 'アクティブなデータベース接続数'
});

// 外部API関連
const externalApiRequestsTotal = new client.Counter({
    name: 'external_api_requests_total',
    help: '外部API呼び出しの総数',
    labelNames: ['service', 'endpoint', 'status']
});

const externalApiDuration = new client.Histogram({
    name: 'external_api_duration_seconds',
    help: '外部API呼び出しの処理時間（秒）',
    labelNames: ['service', 'endpoint'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

// システムリソース関連
const memoryUsage = new client.Gauge({
    name: 'nodejs_memory_usage_bytes',
    help: 'Node.js メモリ使用量（バイト）',
    labelNames: ['type']
});

const cpuUsage = new client.Gauge({
    name: 'nodejs_cpu_usage_percent',
    help: 'Node.js CPU使用率（%）'
});

const eventLoopLag = new client.Gauge({
    name: 'nodejs_eventloop_lag_seconds',
    help: 'Node.js イベントループの遅延（秒）'
});

// メトリクス更新関数
const updateSystemMetrics = () => {
    // メモリ使用量
    const memUsage = process.memoryUsage();
    memoryUsage.set({ type: 'rss' }, memUsage.rss);
    memoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    memoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    memoryUsage.set({ type: 'external' }, memUsage.external);
    
    // CPU使用率
    const cpuUsageValue = process.cpuUsage();
    cpuUsage.set((cpuUsageValue.user + cpuUsageValue.system) / 1000000);
    
    // イベントループラグ
    const start = process.hrtime();
    setImmediate(() => {
        const lag = process.hrtime(start);
        eventLoopLag.set(lag[0] + lag[1] / 1e9);
    });
};

// Express.js ミドルウェア
const prometheusMiddleware = (req, res, next) => {
    const start = Date.now();
    const end = httpRequestDuration.startTimer({
        method: req.method,
        route: req.route?.path || req.path
    });
    
    // リクエストサイズ
    const requestSize = parseInt(req.get('content-length') || '0');
    httpRequestSize.observe({
        method: req.method,
        route: req.route?.path || req.path
    }, requestSize);
    
    // レスポンス完了時の処理
    res.on('finish', () => {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;
        const route = req.route?.path || req.path;
        
        // メトリクス更新
        end({ status_code: statusCode });
        httpRequestsTotal.inc({
            method: req.method,
            route: route,
            status_code: statusCode
        });
        
        // レスポンスサイズ
        const responseSize = parseInt(res.get('content-length') || '0');
        httpResponseSize.observe({
            method: req.method,
            route: route,
            status_code: statusCode
        }, responseSize);
        
        // 遅いリクエストの記録
        if (duration > 2000) {
            securityEventsTotal.inc({
                type: 'slow_request',
                severity: 'warning',
                source: 'application'
            });
        }
        
        // エラーレスポンスの記録
        if (statusCode >= 500) {
            securityEventsTotal.inc({
                type: 'server_error',
                severity: 'error',
                source: 'application'
            });
        }
    });
    
    next();
};

// メトリクス記録用のヘルパー関数
const recordMetrics = {
    // セキュリティイベント
    securityEvent: (type, severity, source, additionalLabels = {}) => {
        securityEventsTotal.inc({
            type,
            severity,
            source,
            ...additionalLabels
        });
    },
    
    // レート制限超過
    rateLimitExceeded: (ip, endpoint) => {
        rateLimitExceededTotal.inc({ ip, endpoint });
    },
    
    // 認証失敗
    authFailure: (type, reason) => {
        authFailuresTotal.inc({ type, reason });
    },
    
    // 疑わしい活動
    suspiciousActivity: (type, pattern) => {
        suspiciousActivityTotal.inc({ type, pattern });
    },
    
    // ユーザー登録
    userRegistration: (type, source) => {
        userRegistrationsTotal.inc({ type, source });
    },
    
    // ショップ検索
    shopSearch: (area, filtersUsed) => {
        shopSearchesTotal.inc({ area, filters_used: filtersUsed });
    },
    
    // 口コミ投稿
    reviewPosted: (shopId, rating) => {
        reviewsPostedTotal.inc({ shop_id: shopId, rating: rating.toString() });
    },
    
    // 予約リクエスト
    bookingRequest: (shopId, status) => {
        bookingRequestsTotal.inc({ shop_id: shopId, status });
    },
    
    // LINE Bot メッセージ
    lineMessage: (type, userType) => {
        lineMessagesTotal.inc({ type, user_type: userType });
    },
    
    // データベースクエリ
    databaseQuery: (operation, table, status, duration) => {
        databaseQueriesTotal.inc({ operation, table, status });
        if (duration !== undefined) {
            databaseQueryDuration.observe({ operation, table }, duration / 1000);
        }
    },
    
    // 外部API呼び出し
    externalApiRequest: (service, endpoint, status, duration) => {
        externalApiRequestsTotal.inc({ service, endpoint, status });
        if (duration !== undefined) {
            externalApiDuration.observe({ service, endpoint }, duration / 1000);
        }
    }
};

// システムメトリクス定期更新
setInterval(updateSystemMetrics, 10000); // 10秒ごと

// レジストリとメトリクスエンドポイント
const register = client.register;

// メトリクスエンドポイント用のハンドラー
const metricsHandler = async (req, res) => {
    try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    } catch (error) {
        res.status(500).end(error.message);
    }
};

module.exports = {
    prometheusMiddleware,
    recordMetrics,
    metricsHandler,
    register,
    // 個別メトリクス（必要に応じて）
    httpRequestDuration,
    httpRequestsTotal,
    securityEventsTotal,
    userRegistrationsTotal,
    shopSearchesTotal,
    reviewsPostedTotal,
    databaseQueriesTotal,
    externalApiRequestsTotal
};