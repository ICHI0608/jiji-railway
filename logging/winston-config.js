/**
 * Winston + ELK Stack ログ設定
 * 完全無料構成 - Elasticsearch, Logstash, Kibana
 */

const winston = require('winston');
const path = require('path');

// ログディレクトリの確保
const logDir = path.join(__dirname, '../logs');
const fs = require('fs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// カスタムフォーマット
const customFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] })
);

// 本番環境用フォーマット
const productionFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// 開発環境用フォーマット
const developmentFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let metaString = '';
        if (Object.keys(meta).length > 0) {
            metaString = JSON.stringify(meta, null, 2);
        }
        return `${timestamp} [${level}]: ${message} ${metaString}`;
    })
);

// ログレベル設定
const logLevel = process.env.LOG_LEVEL || 'info';

// トランスポート設定
const transports = [];

// ファイル出力設定
if (process.env.NODE_ENV === 'production') {
    // 本番環境: JSON形式でファイル出力
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: productionFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: productionFormat,
            maxsize: 5242880, // 5MB
            maxFiles: 5,
        })
    );
} else {
    // 開発環境: 読みやすい形式でファイル出力
    transports.push(
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            format: customFormat,
        }),
        new winston.transports.File({
            filename: path.join(logDir, 'combined.log'),
            format: customFormat,
        })
    );
}

// コンソール出力設定
if (process.env.NODE_ENV !== 'production') {
    transports.push(
        new winston.transports.Console({
            format: developmentFormat,
            level: logLevel
        })
    );
}

// メインロガー設定
const logger = winston.createLogger({
    level: logLevel,
    format: customFormat,
    transports: transports,
    exceptionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'exceptions.log'),
            format: productionFormat
        })
    ],
    rejectionHandlers: [
        new winston.transports.File({
            filename: path.join(logDir, 'rejections.log'),
            format: productionFormat
        })
    ],
    exitOnError: false
});

// 特定用途のロガー
const loggers = {
    // セキュリティ関連ログ
    security: winston.createLogger({
        level: 'info',
        format: customFormat,
        transports: [
            new winston.transports.File({
                filename: path.join(logDir, 'security.log'),
                format: productionFormat,
                maxsize: 5242880,
                maxFiles: 10,
            }),
            new winston.transports.File({
                filename: path.join(logDir, 'security-error.log'),
                level: 'error',
                format: productionFormat,
                maxsize: 5242880,
                maxFiles: 10,
            })
        ]
    }),

    // API関連ログ
    api: winston.createLogger({
        level: 'info',
        format: customFormat,
        transports: [
            new winston.transports.File({
                filename: path.join(logDir, 'api.log'),
                format: productionFormat,
                maxsize: 5242880,
                maxFiles: 5,
            }),
            new winston.transports.File({
                filename: path.join(logDir, 'api-error.log'),
                level: 'error',
                format: productionFormat,
                maxsize: 5242880,
                maxFiles: 5,
            })
        ]
    }),

    // パフォーマンス関連ログ
    performance: winston.createLogger({
        level: 'info',
        format: customFormat,
        transports: [
            new winston.transports.File({
                filename: path.join(logDir, 'performance.log'),
                format: productionFormat,
                maxsize: 5242880,
                maxFiles: 3,
            })
        ]
    }),

    // 業務ログ
    business: winston.createLogger({
        level: 'info',
        format: customFormat,
        transports: [
            new winston.transports.File({
                filename: path.join(logDir, 'business.log'),
                format: productionFormat,
                maxsize: 5242880,
                maxFiles: 10,
            })
        ]
    })
};

// コンソール出力を開発環境でのみ有効化
if (process.env.NODE_ENV !== 'production') {
    Object.values(loggers).forEach(logger => {
        logger.add(new winston.transports.Console({
            format: developmentFormat
        }));
    });
}

// Express.jsミドルウェア用のログ関数
const expressLogger = (req, res, next) => {
    const start = Date.now();
    
    // レスポンス完了時の処理
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.url,
            status: res.statusCode,
            duration: duration,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            contentLength: res.get('Content-Length'),
            referrer: req.get('Referrer')
        };

        // ステータスコードに応じてログレベルを決定
        if (res.statusCode >= 500) {
            loggers.api.error('API Error', logData);
        } else if (res.statusCode >= 400) {
            loggers.api.warn('API Warning', logData);
        } else if (duration > 1000) {
            loggers.performance.warn('Slow API Response', logData);
        } else {
            loggers.api.info('API Request', logData);
        }
    });

    next();
};

// 構造化ログ用のヘルパー関数
const structuredLog = {
    security: (event, data) => {
        loggers.security.info(event, {
            event: event,
            timestamp: new Date().toISOString(),
            ...data
        });
    },
    
    performance: (metric, value, context) => {
        loggers.performance.info(`Performance: ${metric}`, {
            metric: metric,
            value: value,
            context: context,
            timestamp: new Date().toISOString()
        });
    },
    
    business: (event, data) => {
        loggers.business.info(event, {
            event: event,
            timestamp: new Date().toISOString(),
            ...data
        });
    }
};

// エラーハンドリング用のログ関数
const logError = (error, context = {}) => {
    const errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        context: context,
        timestamp: new Date().toISOString()
    };

    logger.error('Application Error', errorData);
    
    // セキュリティ関連のエラーは別途ログ
    if (error.name === 'SecurityError' || error.message.includes('security')) {
        loggers.security.error('Security Error', errorData);
    }
};

// ログローテーション設定
const setupLogRotation = () => {
    const logrotate = require('logrotate-stream');
    
    // 日次ローテーション
    const dailyRotation = logrotate({
        file: path.join(logDir, 'combined.log'),
        size: '10m',
        keep: 7,
        compress: true
    });

    return dailyRotation;
};

module.exports = {
    logger,
    loggers,
    expressLogger,
    structuredLog,
    logError,
    setupLogRotation
};