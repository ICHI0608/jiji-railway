#!/usr/bin/env node

/**
 * Jiji感情的マッチングシステム - 実行可能テスト
 */

const { JijiEmotionalMatcherStandalone } = require('./src/emotional-matching-standalone');

// テスト用ユーザープロファイル
const testUsers = [
    {
        name: '田中美咲',
        diving_experience: 'none',
        license_type: 'none',
        participation_style: 'solo',
        preferred_area: '石垣島',
        budget_range: 'medium'
    },
    {
        name: '佐藤健一',
        diving_experience: 'beginner',
        license_type: 'OWD',
        participation_style: 'solo',
        preferred_area: '宮古島',
        budget_range: 'low'
    },
    {
        name: '山田カップル',
        diving_experience: 'beginner',
        license_type: 'OWD',
        participation_style: 'couple',
        preferred_area: '慶良間',
        budget_range: 'high'
    }
];

// テスト用不安・懸念メッセージ
const testConcerns = [
    [
        '初めてのダイビングで不安です',
        '泳ぎが得意じゃないけど大丈夫？',
        '器材が壊れたりしないか心配',
        '一人で参加しても浮かない？'
    ],
    [
        'まだ経験が少なくて自信がない',
        'お金をそんなにかけられない',
        '一人参加で知らない人ばかりだと緊張する'
    ],
    [
        '彼女と一緒に安全に楽しみたい',
        'ウミガメに会えるかな？',
        '写真もたくさん撮りたい'
    ]
];

async function runTest() {
    console.log('🌊 Jiji感情的マッチングシステム - テスト実行');
    console.log('=' .repeat(60));

    const matcher = new JijiEmotionalMatcherStandalone();

    for (let i = 0; i < testUsers.length; i++) {
        const user = testUsers[i];
        const concerns = testConcerns[i];

        console.log(`\n📋 テストケース ${i + 1}: ${user.name}さん`);
        console.log('-'.repeat(40));
        
        console.log(`👤 プロファイル:`, {
            experience: user.diving_experience,
            license: user.license_type,
            style: user.participation_style,
            area: user.preferred_area
        });

        console.log(`💭 不安・懸念:`, concerns);

        try {
            const startTime = Date.now();
            const result = await matcher.findOptimalShops(user, concerns, user.preferred_area);
            const executionTime = Date.now() - startTime;

            if (!result.success) {
                console.error(`❌ マッチング失敗: ${result.error}`);
                continue;
            }

            console.log(`\n🎯 マッチング結果 (実行時間: ${executionTime}ms):`);
            console.log(`📊 統計: ${result.matchingStats.totalShops}店舗中${result.matchingStats.filteredShops}店舗が条件適合`);
            console.log(`🎭 Jijiメッセージ: "${result.jijiMainMessage}"`);

            console.log('\n🏆 おすすめショップ TOP3:');
            result.recommendations.forEach((rec) => {
                console.log(`\n${rec.ranking}: ${rec.shop.shop_name}`);
                console.log(`  💝 感情スコア: ${rec.shop.emotional_score}点`);
                console.log(`  🏅 総合スコア: ${rec.shop.total_score}点`);
                console.log(`  💰 価格: ¥${rec.shop.fun_dive_price_2tanks || rec.shop.trial_dive_price_beach}`);
                console.log(`  🤿 Jijiコメント: "${rec.jijiMainComment}"`);
                console.log(`  📝 体験談: "${rec.experiencePreview}"`);
                
                if (rec.shop.emotional_reasons.length > 0) {
                    console.log(`  🔍 感情的マッチ理由:`);
                    rec.shop.emotional_reasons.forEach(reason => {
                        console.log(`    • ${reason.concern}: ${reason.solution} (${reason.score}点)`);
                    });
                }
            });

            // スコア詳細分析
            const topShop = result.recommendations[0].shop;
            if (topShop.score_breakdown) {
                console.log('\n📊 スコア詳細分析（第1位ショップ）:');
                console.log(`  感情スコア: ${topShop.score_breakdown.emotional}点`);
                console.log(`  サービススコア: ${topShop.score_breakdown.service}点`);
                console.log(`  総合スコア: ${topShop.score_breakdown.total}点`);
                
                if (topShop.score_breakdown.details) {
                    console.log('  感情スコア内訳:');
                    Object.entries(topShop.score_breakdown.details).forEach(([category, score]) => {
                        console.log(`    ${category}: ${score}点`);
                    });
                }
            }

        } catch (error) {
            console.error(`❌ テストケース ${i + 1} でエラー:`, error);
        }
    }

    console.log('\n✅ 全テスト完了！');
    console.log('=' .repeat(60));
}

// パフォーマンステスト
async function runPerformanceTest() {
    console.log('⚡ パフォーマンステスト開始');
    
    const matcher = new JijiEmotionalMatcherStandalone();
    const iterations = 10;
    const times = [];

    for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await matcher.findOptimalShops(
            testUsers[0], 
            testConcerns[0], 
            '石垣島'
        );
        
        const endTime = Date.now();
        times.push(endTime - startTime);
    }

    const averageTime = times.reduce((a, b) => a + b) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    console.log(`📊 パフォーマンス結果 (${iterations}回実行):`);
    console.log(`  平均実行時間: ${averageTime.toFixed(2)}ms`);
    console.log(`  最短時間: ${minTime}ms`);
    console.log(`  最長時間: ${maxTime}ms`);
}

// コマンドライン引数による実行制御
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === 'test') {
    runTest();
} else if (args[0] === 'performance') {
    runPerformanceTest();
} else {
    console.log('📖 使用方法:');
    console.log('  node test-emotional-matching.js          # 全テスト実行');
    console.log('  node test-emotional-matching.js test     # 全テスト実行');
    console.log('  node test-emotional-matching.js performance # パフォーマンステスト');
}