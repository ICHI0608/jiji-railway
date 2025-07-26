/**
 * 気象庁API統合テストスクリプト
 */

const { WeatherAPIService, OKINAWA_AREA_CODES } = require('../src/weather-api');

async function testWeatherAPI() {
    console.log('🌊 気象庁API統合テスト開始...\n');
    
    const weatherService = new WeatherAPIService();
    
    try {
        // 1. 個別地域テスト
        console.log('=== 個別地域データ取得テスト ===');
        
        for (const [region, code] of Object.entries(OKINAWA_AREA_CODES)) {
            try {
                console.log(`\n📍 ${region} (${code}) テスト中...`);
                const data = await weatherService.getForecastByArea(code);
                
                console.log(`✅ ${region} データ取得成功:`);
                console.log(`   発表: ${data.office}`);
                console.log(`   時刻: ${data.publishedAt}`);
                console.log(`   天気: ${data.today.weather}`);
                console.log(`   風: ${data.today.wind}`);
                console.log(`   波: ${data.today.waves}`);
                console.log(`   気温: ${data.today.temperature}`);
                console.log(`   降水: ${data.today.precipitation}`);
                
                // ダイビング適性判定テスト
                const conditions = weatherService.analyzeDivingConditions(data.today);
                console.log(`   🤿 ダイビング適性: ${conditions.overall} (${conditions.score}点)`);
                console.log(`   💬 推奨: ${conditions.recommendation}`);
                if (conditions.warnings.length > 0) {
                    console.log(`   ⚠️ 警告: ${conditions.warnings.join(', ')}`);
                }
                
            } catch (error) {
                console.error(`❌ ${region} エラー:`, error.message);
            }
        }
        
        // 2. 全地域一括取得テスト
        console.log('\n=== 全地域一括取得テスト ===');
        const allData = await weatherService.getOkinawaWeatherData();
        
        console.log(`✅ 一括取得完了:`);
        console.log(`   成功地域: ${Object.keys(allData.regions).length}個`);
        console.log(`   エラー: ${allData.errors.length}個`);
        console.log(`   取得時刻: ${allData.timestamp}`);
        
        if (allData.errors.length > 0) {
            console.log('\n❌ エラー詳細:');
            allData.errors.forEach(err => {
                console.log(`   ${err.region}: ${err.error}`);
            });
        }
        
        // 3. ダイビング推奨地域選定
        console.log('\n=== ダイビング推奨地域選定 ===');
        const recommendations = [];
        
        Object.entries(allData.regions).forEach(([region, data]) => {
            const conditions = weatherService.analyzeDivingConditions(data.today);
            recommendations.push({
                region,
                score: conditions.score,
                status: conditions.overall,
                recommendation: conditions.recommendation
            });
        });
        
        // スコア順でソート
        recommendations.sort((a, b) => b.score - a.score);
        
        console.log('🏆 本日のダイビング推奨ランキング:');
        recommendations.forEach((rec, index) => {
            const medal = ['🥇', '🥈', '🥉'][index] || '📍';
            console.log(`${medal} ${index + 1}位: ${rec.region} (${rec.score}点)`);
            console.log(`    ${rec.recommendation}`);
        });
        
        console.log('\n✅ 気象庁API統合テスト完了！');
        
    } catch (error) {
        console.error('❌ テスト実行エラー:', error);
        process.exit(1);
    }
}

// テスト実行
if (require.main === module) {
    testWeatherAPI();
}

module.exports = { testWeatherAPI };