/**
 * 🌊 Dive Buddy's アンケートシステム セットアップスクリプト
 * データベース初期化・リッチメニュー設定・テスト実行
 */

const { supabase, createV28Tables } = require('./database');
const { richMenuManager } = require('./rich-menu-manager');
const { surveyManager } = require('./survey-manager');
const fs = require('fs');
const path = require('path');

/**
 * アンケートシステム完全セットアップ
 */
async function setupSurveySystem() {
    console.log('🚀 Dive Buddy\'s アンケートシステム セットアップ開始');
    
    try {
        // 1. データベースセットアップ
        await setupDatabase();
        
        // 2. リッチメニューセットアップ  
        await setupRichMenu();
        
        // 3. システムテスト実行
        await runSystemTests();
        
        console.log('🎉 アンケートシステム セットアップ完了！');
        
    } catch (error) {
        console.error('❌ セットアップエラー:', error);
        process.exit(1);
    }
}

/**
 * アンケート専用テーブル作成
 */
async function createSurveyTables() {
    console.log('📋 アンケートテーブル作成中...');
    
    try {
        // user_surveys テーブル
        const { error: surveysError } = await supabase.rpc('create_survey_tables');
        
        if (surveysError && !surveysError.message.includes('already exists')) {
            console.error('⚠️ アンケートテーブル作成エラー（続行）:', surveysError.message);
        }
        
        console.log('✅ アンケートテーブル作成完了');
        
    } catch (error) {
        console.error('⚠️ アンケートテーブル作成エラー（続行）:', error.message);
    }
}

/**
 * データベースセットアップ
 */
async function setupDatabase() {
    console.log('🗄️ データベースセットアップ開始...');
    
    try {
        // 環境変数確認
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.log('⚠️ Supabase設定が見つかりません。データベースセットアップをスキップします。');
            console.log('📝 .envファイルに以下を追加してください:');
            console.log('   SUPABASE_URL=https://xxxxx.supabase.co');
            console.log('   SUPABASE_ANON_KEY=your_anon_key');
            return;
        }
        
        // Supabase用のテーブル作成関数を使用
        console.log('🔧 Supabase用テーブル作成を実行...');
        await createV28Tables();
        console.log('✅ V2.8テーブル作成完了');
        
        // アンケート専用テーブルを手動で作成
        await createSurveyTables();
        
        console.log('✅ データベースセットアップ完了');
        
    } catch (error) {
        console.error('❌ データベースセットアップエラー:', error);
        throw error;
    }
}

/**
 * リッチメニューセットアップ
 */
async function setupRichMenu() {
    console.log('🎨 リッチメニューセットアップ開始...');
    
    try {
        // LINE SDK設定確認
        if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_CHANNEL_SECRET) {
            console.log('⚠️ LINE Bot設定が見つかりません。リッチメニューセットアップをスキップします。');
            return;
        }
        
        // リッチメニュー設定
        const richMenuId = await richMenuManager.setupCompleteRichMenu();
        console.log('✅ リッチメニューセットアップ完了:', richMenuId);
        
    } catch (error) {
        console.error('❌ リッチメニューセットアップエラー:', error);
        console.log('⚠️ リッチメニューエラーは無視して続行します');
    }
}

/**
 * システムテスト実行
 */
async function runSystemTests() {
    console.log('🧪 システムテスト開始...');
    
    const testUserId = 'test_user_survey_' + Date.now();
    
    try {
        // 1. アンケート開始テスト
        console.log('📋 アンケート開始テスト...');
        const startResponse = await surveyManager.startSurvey(testUserId, true);
        console.log('✅ アンケート開始:', startResponse.type);
        
        // 2. Q1回答テスト
        console.log('📝 Q1回答テスト...');
        const q1Response = await surveyManager.processAnswer(testUserId, 'okinawa_experienced');
        console.log('✅ Q1回答処理:', q1Response.type);
        
        // 3. Q1.5回答テスト
        console.log('📝 Q1.5回答テスト...');
        const q1_5Response = await surveyManager.processAnswer(testUserId, 'aow_plus');
        console.log('✅ Q1.5回答処理:', q1_5Response.type);
        
        // 4. Q2回答テスト（完了）
        console.log('📝 Q2回答テスト...');
        const q2Response = await surveyManager.processAnswer(testUserId, 'ishigaki_yaeyama');
        console.log('✅ Q2回答処理:', q2Response.type);
        
        // 5. アンケート結果確認
        const survey = await surveyManager.getUserSurvey(testUserId);
        console.log('📊 アンケート結果:', {
            completed: survey.survey_completed,
            experience: survey.experience_level,
            license: survey.license_type
        });
        
        // 6. 洞察生成確認
        const insights = await surveyManager.getSurveyInsights(testUserId);
        console.log('🧠 分析結果:', {
            segment: insights?.user_segment,
            motivation: insights?.primary_motivation
        });
        
        // 7. テストデータクリーンアップ
        await cleanupTestData(testUserId);
        
        console.log('✅ システムテスト完了');
        
    } catch (error) {
        console.error('❌ システムテストエラー:', error);
        
        // テストデータクリーンアップ
        try {
            await cleanupTestData(testUserId);
        } catch (cleanupError) {
            console.error('❌ テストデータクリーンアップエラー:', cleanupError);
        }
        
        throw error;
    }
}

/**
 * テストデータクリーンアップ
 */
async function cleanupTestData(testUserId) {
    try {
        // Supabase用のクリーンアップ
        await supabase.from('survey_insights').delete().eq('user_id', testUserId);
        await supabase.from('survey_responses').delete().eq('user_id', testUserId);
        await supabase.from('user_surveys').delete().eq('user_id', testUserId);
        console.log('🧹 テストデータクリーンアップ完了');
    } catch (error) {
        console.error('❌ クリーンアップエラー:', error);
    }
}

/**
 * アンケート統計表示
 */
async function showSurveyStats() {
    console.log('📊 アンケート統計情報');
    
    try {
        // Supabase環境変数確認
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
            console.log('⚠️ Supabase設定がないため統計を表示できません');
            return;
        }
        
        // 全体統計
        const { data: allSurveys, error: allError } = await supabase
            .from('user_surveys')
            .select('survey_completed');
            
        if (allError) {
            console.error('❌ 統計取得エラー:', allError.message);
            return;
        }
        
        const totalSurveys = allSurveys?.length || 0;
        const completedSurveys = allSurveys?.filter(s => s.survey_completed).length || 0;
        const completionRate = totalSurveys > 0 ? (completedSurveys / totalSurveys * 100).toFixed(2) : 0;
        
        console.log('📈 アンケート完了率:', {
            total_surveys: totalSurveys,
            completed_surveys: completedSurveys,
            completion_rate: completionRate + '%'
        });
        
        // 経験レベル分布
        const { data: experienceData, error: expError } = await supabase
            .from('user_surveys')
            .select('experience_level')
            .eq('survey_completed', true);
            
        if (!expError && experienceData) {
            const experienceStats = experienceData.reduce((acc, curr) => {
                acc[curr.experience_level] = (acc[curr.experience_level] || 0) + 1;
                return acc;
            }, {});
            console.log('🎯 経験レベル分布:', experienceStats);
        }
        
        // ライセンス分布
        const { data: licenseData, error: licError } = await supabase
            .from('user_surveys')
            .select('license_type')
            .eq('survey_completed', true);
            
        if (!licError && licenseData) {
            const licenseStats = licenseData.reduce((acc, curr) => {
                acc[curr.license_type] = (acc[curr.license_type] || 0) + 1;
                return acc;
            }, {});
            console.log('🏆 ライセンス分布:', licenseStats);
        }
        
    } catch (error) {
        console.error('❌ 統計取得エラー:', error);
    }
}

/**
 * 開発者向けヘルプ表示
 */
function showDeveloperHelp() {
    console.log(`
🌊 Dive Buddy's アンケートシステム 開発者ガイド

📋 セットアップ:
  node src/setup-survey-system.js setup

📊 統計確認:
  node src/setup-survey-system.js stats

🧪 テスト実行:
  node src/setup-survey-system.js test

🎨 リッチメニューのみ:
  node src/setup-survey-system.js rich-menu

🗄️ データベースのみ:
  node src/setup-survey-system.js database

❓ ヘルプ:
  node src/setup-survey-system.js help

📁 重要ファイル:
  - src/survey-manager.js (アンケート管理)
  - src/rich-menu-manager.js (リッチメニュー)
  - src/survey-schema.sql (データベーススキーマ)
  - src/message-handler.js (メイン処理)
`);
}

// コマンドライン引数処理
async function main() {
    const command = process.argv[2];
    
    switch (command) {
        case 'setup':
            await setupSurveySystem();
            break;
        case 'database':
            await setupDatabase();
            break;
        case 'rich-menu':
            await setupRichMenu();
            break;
        case 'test':
            await runSystemTests();
            break;
        case 'stats':
            await showSurveyStats();
            break;
        case 'help':
        case undefined:
            showDeveloperHelp();
            break;
        default:
            console.log('❌ 不明なコマンド:', command);
            showDeveloperHelp();
            process.exit(1);
    }
}

// スクリプト実行
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 実行エラー:', error);
        process.exit(1);
    });
}

module.exports = {
    setupSurveySystem,
    setupDatabase,
    setupRichMenu,
    runSystemTests,
    showSurveyStats
};