/**
 * セキュリティミドルウェア - 基本的なセキュリティ機能の実装
 * 完全無料構成 - helmet, express-rate-limit, joi, winston
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const winston = require('winston');

// セキュリティログ設定
const securityLogger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: 'logs/security.log',
            level: 'warn'
        }),
        new winston.transports.File({ 
            filename: 'logs/security-error.log',
            level: 'error'
        })
    ]
});

// 本番環境でのみコンソール出力を無効化
if (process.env.NODE_ENV !== 'production') {
    securityLogger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

/**
 * 基本的なセキュリティヘッダー設定
 */
const securityHeaders = () => {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
                scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'", "https://api.openai.com"],
                fontSrc: ["'self'", "https://fonts.gstatic.com"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        crossOriginEmbedderPolicy: false,
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    });
};

/**
 * レート制限設定
 */
const rateLimitConfig = {
    // 一般的なAPI制限
    general: rateLimit({
        windowMs: 15 * 60 * 1000, // 15分
        max: 100, // 最大100リクエスト
        message: {
            error: 'Too many requests from this IP, please try again later.',
            retryAfter: 15 * 60 // 15分後に再試行
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            securityLogger.warn('Rate limit exceeded', {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                path: req.path,
                method: req.method
            });
            res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
            });
        }
    }),

    // API制限（より厳しい）
    api: rateLimit({
        windowMs: 15 * 60 * 1000, // 15分
        max: 50, // 最大50リクエスト
        message: {
            error: 'Too many API requests, please try again later.',
            retryAfter: 15 * 60
        },
        standardHeaders: true,
        legacyHeaders: false
    }),

    // 認証関連（最も厳しい）
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15分
        max: 5, // 最大5リクエスト
        message: {
            error: 'Too many authentication attempts, please try again later.',
            retryAfter: 15 * 60
        },
        standardHeaders: true,
        legacyHeaders: false
    }),

    // 検索機能
    search: rateLimit({
        windowMs: 1 * 60 * 1000, // 1分
        max: 30, // 最大30リクエスト
        message: {
            error: 'Too many search requests, please try again later.',
            retryAfter: 60
        }
    })
};

/**
 * 入力検証ミドルウェア
 */
const validateInput = {
    // ショップ検索用
    shopSearch: [
        body('area').optional().isString().isLength({ min: 1, max: 50 }).trim(),
        body('keyword').optional().isString().isLength({ min: 1, max: 100 }).trim(),
        body('maxPrice').optional().isInt({ min: 0, max: 100000 }),
        body('minRating').optional().isFloat({ min: 0, max: 5 }),
        body('beginnerFriendly').optional().isBoolean(),
        body('femaleInstructor').optional().isBoolean(),
        body('englishSupport').optional().isBoolean()
    ],

    // 口コミ投稿用
    reviewPost: [
        body('shopId').notEmpty().isString().isLength({ min: 1, max: 50 }).trim(),
        body('rating').isInt({ min: 1, max: 5 }),
        body('comment').isString().isLength({ min: 10, max: 1000 }).trim(),
        body('userName').isString().isLength({ min: 1, max: 50 }).trim(),
        body('divingType').optional().isString().isLength({ max: 50 }).trim(),
        body('experienceLevel').optional().isString().isLength({ max: 50 }).trim()
    ],

    // 会員登録用
    userRegistration: [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8, max: 128 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
        body('name').isString().isLength({ min: 1, max: 50 }).trim(),
        body('phone').optional().isMobilePhone('ja-JP'),
        body('age').optional().isInt({ min: 18, max: 120 }),
        body('experience').optional().isString().isLength({ max: 100 }).trim()
    ],

    // 一般的な入力検証
    general: [
        body('*').customSanitizer(value => {
            if (typeof value === 'string') {
                // XSS対策: HTMLタグを除去
                return value.replace(/<[^>]*>/g, '');
            }
            return value;
        })
    ]
};

/**
 * バリデーションエラーハンドラー
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        securityLogger.warn('Validation error', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            errors: errors.array(),
            body: req.body
        });
        
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(error => ({
                field: error.path,
                message: error.msg,
                value: error.value
            }))
        });
    }
    next();
};

/**
 * セキュリティイベントログ
 */
const logSecurityEvent = (eventType, req, additionalData = {}) => {
    securityLogger.info('Security event', {
        event: eventType,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString(),
        ...additionalData
    });
};

/**
 * 疑わしい活動の検知
 */
const detectSuspiciousActivity = (req, res, next) => {
    const suspiciousPatterns = [
        /(?:union|select|insert|delete|update|drop|create|alter|exec|script)/i,
        /<script[^>]*>.*?<\/script>/gi,
        /javascript:/i,
        /on\w+\s*=/i
    ];

    const requestData = JSON.stringify(req.body) + JSON.stringify(req.query);
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestData)) {
            logSecurityEvent('SUSPICIOUS_ACTIVITY', req, {
                pattern: pattern.toString(),
                data: requestData
            });
            
            return res.status(403).json({
                error: 'Suspicious activity detected'
            });
        }
    }
    
    next();
};

/**
 * CORS設定
 */
const corsOptions = {
    origin: function (origin, callback) {
        // 本番環境では特定のドメインのみ許可
        const allowedOrigins = [
            'https://your-domain.com',
            'https://jiji-diving-bot.railway.app',
            'http://localhost:3000',
            'http://localhost:8080'
        ];
        
        if (process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logSecurityEvent('CORS_VIOLATION', { origin }, { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

/**
 * リクエスト情報のログ
 */
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        
        // エラーレスポンスまたは疑わしいリクエストのみログ
        if (res.statusCode >= 400 || duration > 5000) {
            securityLogger.info('Request log', {
                ip: req.ip,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: duration,
                userAgent: req.get('User-Agent'),
                contentLength: req.get('content-length')
            });
        }
    });
    
    next();
};

module.exports = {
    securityHeaders,
    rateLimitConfig,
    validateInput,
    handleValidationErrors,
    logSecurityEvent,
    detectSuspiciousActivity,
    corsOptions,
    requestLogger,
    securityLogger
};