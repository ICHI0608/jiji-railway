// src/utils.js - ユーティリティ関数とエラーハンドリング
const fs = require('fs');
const path = require('path');

// ロガークラス
class Logger {
  constructor(logDir = './logs') {
    this.logDir = logDir;
    this.ensureLogDir();
  }
  
  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }
  
  getTimestamp() {
    return new Date().toISOString();
  }
  
  logToFile(level, message, data = {}) {
    const timestamp = this.getTimestamp();
    const logEntry = {
      timestamp,
      level,
      message,
      ...data
    };
    
    try {
      const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.error('ログファイル書き込みエラー:', error);
    }
  }
  
  info(message, data = {}) {
    console.log(`ℹ️ ${message}`, data);
    this.logToFile('info', message, data);
  }
  
  error(message, error, data = {}) {
    console.error(`❌ ${message}`, error);
    this.logToFile('error', message, {
      error: error?.message || error,
      stack: error?.stack,
      ...data
    });
  }
  
  warn(message, data = {}) {
    console.warn(`⚠️ ${message}`, data);
    this.logToFile('warn', message, data);
  }
  
  debug(message, data = {}) {
    console.log(`🐛 ${message}`, data);
    this.logToFile('debug', message, data);
  }
}

// リトライ関数（指数バックオフ付き）
async function withRetry(fn, options = {}) {
  const { 
    maxRetries = 3, 
    initialDelay = 1000, 
    backoffMultiplier = 2,
    maxDelay = 10000,
    shouldRetry = () => true 
  } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw lastError;
      }
      
      const delay = Math.min(
        initialDelay * Math.pow(backoffMultiplier, attempt - 1),
        maxDelay
      );
      
      console.warn(`試行 ${attempt}/${maxRetries} 失敗: ${error.message}`);
      console.log(`${delay}ms後に再試行します...`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// OpenAI API特有のエラー判定
function shouldRetryOpenAIError(error) {
  // 再試行すべきエラーコード
  const retryableStatusCodes = [429, 500, 502, 503, 504];
  const retryableErrorTypes = ['rate_limit_exceeded', 'server_error', 'timeout'];
  
  if (error.response) {
    const status = error.response.status;
    const errorType = error.response.data?.error?.type;
    
    return retryableStatusCodes.includes(status) || 
           retryableErrorTypes.includes(errorType);
  }
  
  // ネットワークエラーなども再試行対象
  return error.code === 'ECONNRESET' || 
         error.code === 'ETIMEDOUT' || 
         error.message.includes('timeout');
}

// LINE API特有のエラー判定
function shouldRetryLineError(error) {
  const retryableStatusCodes = [429, 500, 502, 503, 504];
  
  if (error.response) {
    return retryableStatusCodes.includes(error.response.status);
  }
  
  return error.code === 'ECONNRESET' || 
         error.code === 'ETIMEDOUT';
}

// 使用量追跡クラス
class UsageTracker {
  constructor() {
    this.dailyUsage = new Map();
    this.resetDaily();
  }
  
  resetDaily() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow.getTime() - now.getTime();
    
    setTimeout(() => {
      this.dailyUsage.clear();
      this.resetDaily();
    }, msUntilMidnight);
  }
  
  track(userId, type, metadata = {}) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}-${today}`;
    
    if (!this.dailyUsage.has(key)) {
      this.dailyUsage.set(key, { messages: 0, tokens: 0, errors: 0 });
    }
    
    const usage = this.dailyUsage.get(key);
    
    switch (type) {
      case 'message':
        usage.messages++;
        break;
      case 'tokens':
        usage.tokens += metadata.count || 0;
        break;
      case 'error':
        usage.errors++;
        break;
    }
    
    this.dailyUsage.set(key, usage);
  }
  
  getUsage(userId) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${userId}-${today}`;
    return this.dailyUsage.get(key) || { messages: 0, tokens: 0, errors: 0 };
  }
}

// エラーメッセージ生成
function generateUserFriendlyErrorMessage(error, context = {}) {
  const { userId, operation } = context;
  
  // OpenAI APIエラー
  if (error.response?.data?.error) {
    const openaiError = error.response.data.error;
    
    switch (openaiError.type) {
      case 'rate_limit_exceeded':
        return 'ちょっと質問が多すぎるみたい😅 1分ほど待ってからもう一度話しかけてね！';
      
      case 'insufficient_quota':
        return 'すみません、現在システムの利用上限に達しています。しばらく経ってから再度お試しください。';
      
      case 'model_overloaded':
        return 'AIが混雑しているみたい💦 30秒ほど待ってからもう一度試してね！';
      
      default:
        return 'ちょっと調子が悪いみたい😓 もう一度話しかけてくれる？';
    }
  }
  
  // LINE APIエラー
  if (operation === 'line_reply') {
    return 'メッセージの送信でエラーが発生しました。もう一度お試しください。';
  }
  
  // ネットワークエラー
  if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
    return '応答に時間がかかっています。もう一度試してみてね！';
  }
  
  // 一般的なエラー
  return 'すみません、一時的な問題が発生しました。少し待ってからもう一度お試しください。';
}

module.exports = {
  Logger,
  withRetry,
  shouldRetryOpenAIError,
  shouldRetryLineError,
  UsageTracker,
  generateUserFriendlyErrorMessage
};