/**
 * 気象庁API統合モジュール
 * 沖縄ダイビング向け海況情報取得システム
 */

const axios = require('axios');

// 沖縄地域コード定義
const OKINAWA_AREA_CODES = {
    MAIN_ISLAND: '471000',      // 沖縄本島
    MIYAKO: '473000',           // 宮古島
    ISHIGAKI: '474000',         // 石垣島（八重山）
    YONAGUNI: '474020'          // 与那国島
};

// 気象庁API基本設定
const JMA_API_CONFIG = {
    BASE_URL: 'https://www.jma.go.jp/bosai',
    ENDPOINTS: {
        FORECAST: '/forecast/data/forecast',
        OVERVIEW: '/forecast/data/overview_forecast',
        AREA_CODES: '/common/const/area.json'
    },
    TIMEOUT: 10000,
    RETRY_COUNT: 3,
    RETRY_DELAY: 2000
};

/**
 * 気象庁API接続クラス
 */
class WeatherAPIService {
    constructor() {
        this.client = axios.create({
            timeout: JMA_API_CONFIG.TIMEOUT,
            headers: {
                'User-Agent': 'Dive-Buddys-Weather-Service/1.0'
            }
        });
        
        // リクエストインターセプター
        this.client.interceptors.request.use(
            (config) => {
                console.log(`🌊 気象庁API リクエスト: ${config.url}`);
                return config;
            },
            (error) => {
                console.error('❌ リクエストエラー:', error);
                return Promise.reject(error);
            }
        );
    }

    /**
     * 地域別天気予報取得
     * @param {string} areaCode - 地域コード
     * @returns {Promise<Object>} 天気予報データ
     */
    async getForecastByArea(areaCode) {
        const url = `${JMA_API_CONFIG.BASE_URL}${JMA_API_CONFIG.ENDPOINTS.FORECAST}/${areaCode}.json`;
        
        try {
            const response = await this.retryRequest(() => this.client.get(url));
            
            if (response.status === 200 && response.data) {
                console.log(`✅ 気象データ取得成功: ${areaCode}`);
                return this.parseForecastData(response.data, areaCode);
            } else {
                throw new Error(`無効なレスポンス: ${response.status}`);
            }
        } catch (error) {
            console.error(`❌ 気象データ取得失敗 (${areaCode}):`, error.message);
            throw new Error(`気象データ取得失敗: ${error.message}`);
        }
    }

    /**
     * 沖縄全地域の天気予報取得
     * @returns {Promise<Object>} 全地域の天気データ
     */
    async getOkinawaWeatherData() {
        console.log('🌊 沖縄全地域の気象データ取得開始...');
        
        const promises = Object.entries(OKINAWA_AREA_CODES).map(async ([region, code]) => {
            try {
                const data = await this.getForecastByArea(code);
                return { region, data, success: true };
            } catch (error) {
                console.error(`❌ ${region} データ取得失敗:`, error.message);
                return { region, error: error.message, success: false };
            }
        });

        const results = await Promise.allSettled(promises);
        
        const weatherData = {
            timestamp: new Date().toISOString(),
            regions: {},
            errors: []
        };

        results.forEach((result, index) => {
            const regionName = Object.keys(OKINAWA_AREA_CODES)[index];
            
            if (result.status === 'fulfilled' && result.value.success) {
                weatherData.regions[regionName] = result.value.data;
            } else {
                const error = result.status === 'rejected' ? result.reason : result.value.error;
                weatherData.errors.push({ region: regionName, error });
            }
        });

        console.log(`✅ 沖縄気象データ取得完了: ${Object.keys(weatherData.regions).length}地域成功`);
        return weatherData;
    }

    /**
     * ダイビング適性判定
     * @param {Object} weatherData - 天気データ
     * @returns {Object} ダイビング適性情報
     */
    analyzeDivingConditions(weatherData) {
        const conditions = {
            overall: 'unknown',
            score: 0,
            factors: {
                weather: { score: 0, status: '', reason: '' },
                wind: { score: 0, status: '', reason: '' },
                waves: { score: 0, status: '', reason: '' }
            },
            recommendation: '',
            warnings: []
        };

        try {
            // 天気評価
            if (weatherData.weather) {
                const weather = weatherData.weather.toLowerCase();
                if (weather.includes('晴') || weather.includes('曇')) {
                    conditions.factors.weather = { score: 3, status: 'good', reason: '良好な天気' };
                } else if (weather.includes('雨')) {
                    conditions.factors.weather = { score: 1, status: 'poor', reason: '雨天' };
                    conditions.warnings.push('⚠️ 雨天により視界が悪い可能性');
                } else {
                    conditions.factors.weather = { score: 2, status: 'fair', reason: '普通の天気' };
                }
            }

            // 風評価
            if (weatherData.wind) {
                const wind = weatherData.wind;
                if (wind.includes('弱') || wind.includes('やや強')) {
                    conditions.factors.wind = { score: 3, status: 'good', reason: '穏やかな風' };
                } else if (wind.includes('強') || wind.includes('非常に強')) {
                    conditions.factors.wind = { score: 1, status: 'poor', reason: '強風' };
                    conditions.warnings.push('⚠️ 強風により海況悪化の可能性');
                } else {
                    conditions.factors.wind = { score: 2, status: 'fair', reason: '普通の風' };
                }
            }

            // 波評価
            if (weatherData.waves) {
                const waves = weatherData.waves;
                const waveHeight = this.extractWaveHeight(waves);
                
                if (waveHeight <= 1.5) {
                    conditions.factors.waves = { score: 3, status: 'good', reason: '穏やかな海況' };
                } else if (waveHeight <= 3.0) {
                    conditions.factors.waves = { score: 2, status: 'fair', reason: '普通の海況' };
                } else {
                    conditions.factors.waves = { score: 1, status: 'poor', reason: '高波' };
                    conditions.warnings.push('⚠️ 高波により初心者には危険');
                }
            }

            // 総合スコア計算
            const totalScore = Object.values(conditions.factors)
                .reduce((sum, factor) => sum + factor.score, 0);
            conditions.score = Math.round((totalScore / 9) * 100);

            // 総合判定
            if (conditions.score >= 80) {
                conditions.overall = 'excellent';
                conditions.recommendation = '🌟 最高のダイビング日和です！';
            } else if (conditions.score >= 60) {
                conditions.overall = 'good';
                conditions.recommendation = '👍 ダイビングに適しています';
            } else if (conditions.score >= 40) {
                conditions.overall = 'fair';
                conditions.recommendation = '⚠️ 注意してダイビング可能';
            } else {
                conditions.overall = 'poor';
                conditions.recommendation = '❌ ダイビングは推奨されません';
            }

        } catch (error) {
            console.error('❌ ダイビング適性分析エラー:', error);
            conditions.overall = 'error';
            conditions.recommendation = 'データ分析エラー';
        }

        return conditions;
    }

    /**
     * 波高数値抽出
     * @param {string} waveText - 波情報テキスト
     * @returns {number} 波高（メートル）
     */
    extractWaveHeight(waveText) {
        try {
            const match = waveText.match(/(\d+(?:\.\d+)?)/);
            return match ? parseFloat(match[1]) : 2.0; // デフォルト値
        } catch (error) {
            return 2.0;
        }
    }

    /**
     * 気象庁データのパース処理
     * @param {Object} rawData - 生データ
     * @param {string} areaCode - 地域コード
     * @returns {Object} パース済みデータ
     */
    parseForecastData(rawData, areaCode) {
        try {
            const timeSeries = rawData[0]?.timeSeries || [];
            const publishInfo = rawData[0] || {};
            
            // 今日のデータ取得
            const todayData = this.extractTodayData(timeSeries);
            
            return {
                areaCode,
                publishedAt: publishInfo.reportDatetime,
                office: publishInfo.publishingOffice,
                today: todayData,
                raw: rawData
            };
        } catch (error) {
            console.error('❌ データパースエラー:', error);
            throw new Error(`データパース失敗: ${error.message}`);
        }
    }

    /**
     * 今日のデータ抽出
     * @param {Array} timeSeries - 時系列データ
     * @returns {Object} 今日のデータ
     */
    extractTodayData(timeSeries) {
        const todayData = {
            weather: '不明',
            wind: '不明',
            waves: '不明',
            temperature: '不明',
            precipitation: '不明'
        };

        try {
            // 基本天気情報（第1系列）
            if (timeSeries[0]?.areas?.[0]) {
                const area = timeSeries[0].areas[0];
                todayData.weather = area.weathers?.[0] || '不明';
                todayData.wind = area.winds?.[0] || '不明';
                todayData.waves = area.waves?.[0] || '不明';
            }

            // 気温情報（第2系列）
            if (timeSeries[1]?.areas?.[0]) {
                const tempArea = timeSeries[1].areas[0];
                const temps = tempArea.temps;
                if (temps && temps.length >= 2) {
                    todayData.temperature = `${temps[0]}℃ / ${temps[1]}℃`;
                }
            }

            // 降水確率（第2または第3系列）
            const precipSeries = timeSeries.find(series => 
                series.areas?.[0]?.pops?.length > 0
            );
            if (precipSeries?.areas?.[0]?.pops) {
                todayData.precipitation = `${precipSeries.areas[0].pops[0]}%`;
            }

        } catch (error) {
            console.error('❌ 今日データ抽出エラー:', error);
        }

        return todayData;
    }

    /**
     * リトライ付きリクエスト実行
     * @param {Function} requestFn - リクエスト関数
     * @param {number} retryCount - リトライ回数
     * @returns {Promise} レスポンス
     */
    async retryRequest(requestFn, retryCount = JMA_API_CONFIG.RETRY_COUNT) {
        for (let i = 0; i <= retryCount; i++) {
            try {
                return await requestFn();
            } catch (error) {
                if (i === retryCount) {
                    throw error;
                }
                
                console.log(`⚠️ リトライ ${i + 1}/${retryCount}: ${error.message}`);
                await new Promise(resolve => 
                    setTimeout(resolve, JMA_API_CONFIG.RETRY_DELAY * (i + 1))
                );
            }
        }
    }
}

// エクスポート
module.exports = {
    WeatherAPIService,
    OKINAWA_AREA_CODES,
    JMA_API_CONFIG
};