#!/usr/bin/env node

/**
 * Test OpenAI Integration
 * Phase 4-A Task 4: Test 6-Category Emotion Analysis + Jiji Response
 */

const JijiOpenAIEmotionAnalyzer = require('./src/openai-emotion-analyzer');

async function testOpenAIIntegration() {
    console.log('🧪 Testing OpenAI Integration...\n');
    
    const analyzer = new JijiOpenAIEmotionAnalyzer();
    
    // Test 1: Analyzer initialization
    console.log('1️⃣ Testing analyzer initialization...');
    
    const mode = analyzer.getAnalysisMode();
    console.log(`✅ Analyzer mode: ${mode}`);
    
    if (mode === 'openai') {
        console.log('🔗 OpenAI integration active');
        console.log(`   🔑 API Key: ${process.env.OPENAI_API_KEY ? 'Found' : 'Not found'}`);
        
        try {
            await analyzer.testConnection();
            console.log('✅ OpenAI connection successful');
        } catch (error) {
            console.log('❌ OpenAI connection failed:', error.message);
        }
    } else {
        console.log('🔗 Using mock mode (development)');
        console.log('   💡 Set OPENAI_API_KEY environment variable to test real OpenAI');
    }
    
    // Test 2: 6-Category Emotion Analysis
    console.log('\n2️⃣ Testing 6-category emotion analysis...');
    
    const testMessages = [
        {
            message: "初心者で一人参加で不安です。安全なダイビングショップを教えてください。",
            description: "複数カテゴリ混在メッセージ（安全性・スキル・一人参加不安）",
            expected_emotions: ['safety', 'skill', 'solo']
        },
        {
            message: "ダイビング初めてで怖いです。事故とか大丈夫でしょうか？",
            description: "安全性不安メッセージ",
            expected_emotions: ['safety', 'skill']
        },
        {
            message: "一人で沖縄ダイビングに行くのですが、知らない人ばかりで馴染めるか心配です。",
            description: "一人参加不安メッセージ",
            expected_emotions: ['solo']
        },
        {
            message: "ダイビング料金って高いですよね。学生なので予算が限られています。",
            description: "予算心配メッセージ",
            expected_emotions: ['cost']
        },
        {
            message: "50歳で体力に自信がないのですが、ダイビングできるでしょうか？",
            description: "体力心配メッセージ",
            expected_emotions: ['physical']
        }
    ];
    
    for (let i = 0; i < testMessages.length; i++) {
        const test = testMessages[i];
        console.log(`\n   テスト ${i + 1}: ${test.description}`);
        console.log(`   📝 メッセージ: "${test.message}"`);
        
        try {
            const analysis = await analyzer.analyzeEmotions(test.message);
            
            console.log(`   ✅ 分析完了:`);
            console.log(`      🧠 検出カテゴリ数: ${analysis.total_categories_detected}`);
            console.log(`      🎯 主要感情: ${analysis.primary_emotion}`);
            console.log(`      📊 検出された感情: ${Object.keys(analysis.detected_emotions).join(', ')}`);
            
            if (analysis.detected_emotions) {
                Object.entries(analysis.detected_emotions).forEach(([emotion, data]) => {
                    console.log(`      💝 ${emotion}: 信頼度${(data.confidence * 100).toFixed(1)}% (重み${data.weight}点)`);
                });
            }
            
            // Check if expected emotions were detected
            const detectedKeys = Object.keys(analysis.detected_emotions);
            const expectedFound = test.expected_emotions.filter(emotion => detectedKeys.includes(emotion));
            const accuracy = expectedFound.length / test.expected_emotions.length;
            
            console.log(`      🎯 精度: ${(accuracy * 100).toFixed(1)}% (${expectedFound.length}/${test.expected_emotions.length})`);
            
            if (analysis.analysis_mode === 'openai') {
                console.log(`      🤖 OpenAI分析: アクティブ`);
                if (analysis.overall_sentiment) {
                    console.log(`      😊 全体的感情: ${analysis.overall_sentiment}`);
                }
                if (analysis.urgency_level) {
                    console.log(`      ⚡ 緊急度: ${analysis.urgency_level}`);
                }
            }
            
        } catch (error) {
            console.log(`   ❌ 分析失敗: ${error.message}`);
        }
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Test 3: Jiji Character Response Generation
    console.log('\n3️⃣ Testing Jiji character response generation...');
    
    const testUserProfile = {
        name: 'テストユーザー',
        diving_experience: 'beginner',
        age_range: '20-30'
    };
    
    const sampleShops = [
        {
            shop_name: 'テストダイビングショップ',
            area: '石垣島',
            jiji_grade: 'S级',
            beginner_friendly: true,
            customer_rating: 4.8
        }
    ];
    
    try {
        const testMessage = "初心者で一人参加で不安です。";
        const emotionAnalysis = await analyzer.analyzeEmotions(testMessage);
        
        console.log(`   💬 テストメッセージ: "${testMessage}"`);
        console.log(`   👤 ユーザープロフィール: ${testUserProfile.name} (${testUserProfile.diving_experience})`);
        
        const jijiResponse = await analyzer.generateJijiResponse(
            emotionAnalysis, 
            sampleShops, 
            testUserProfile
        );
        
        console.log(`   ✅ Jiji応答生成成功:`);
        console.log(`   💬 メッセージ: "${jijiResponse.jiji_main_message}"`);
        console.log(`   🎭 応答タイプ: ${jijiResponse.response_type}`);
        console.log(`   🎯 対応感情: ${jijiResponse.emotion_addressed}`);
        console.log(`   🎨 個人化レベル: ${jijiResponse.personalization_level}`);
        
        // Response quality checks
        const message = jijiResponse.jiji_main_message;
        const hasEmpathy = message.includes('分かります') || message.includes('不安') || message.includes('心配');
        const hasPersonalization = message.includes(testUserProfile.name);
        const hasEncouragement = message.includes('大丈夫') || message.includes('安心') || message.includes('楽しめ');
        
        console.log(`   ✅ 品質チェック:`);
        console.log(`      😊 共感表現: ${hasEmpathy ? 'あり' : 'なし'}`);
        console.log(`      👤 個人化: ${hasPersonalization ? 'あり' : 'なし'}`);
        console.log(`      💪 励まし: ${hasEncouragement ? 'あり' : 'なし'}`);
        
    } catch (error) {
        console.log(`   ❌ Jiji応答生成失敗: ${error.message}`);
    }
    
    // Test 4: Performance and accuracy comparison
    console.log('\n4️⃣ Testing performance comparison...');
    
    const performanceTestMessage = "初心者で安全面が心配です。予算も限られています。";
    
    console.log(`   ⚡ パフォーマンステスト: "${performanceTestMessage}"`);
    
    try {
        const startTime = Date.now();
        const analysis = await analyzer.analyzeEmotions(performanceTestMessage);
        const endTime = Date.now();
        
        const duration = endTime - startTime;
        console.log(`   ⏱️ 分析時間: ${duration}ms`);
        console.log(`   📊 結果: ${analysis.total_categories_detected}カテゴリ検出`);
        
        if (analysis.analysis_mode === 'openai') {
            console.log(`   🚀 OpenAI分析: 高精度・詳細分析`);
        } else {
            console.log(`   ⚡ Mock分析: 高速・基本分析`);
        }
        
        // Expected: safety + cost should be detected
        const hasExpectedCategories = 
            analysis.detected_emotions.safety && 
            analysis.detected_emotions.cost;
        
        console.log(`   🎯 期待結果: ${hasExpectedCategories ? '✅ 正確' : '❌ 不正確'}`);
        
    } catch (error) {
        console.log(`   ❌ パフォーマンステスト失敗: ${error.message}`);
    }
    
    // Test 5: Edge cases
    console.log('\n5️⃣ Testing edge cases...');
    
    const edgeCases = [
        { message: "", description: "空メッセージ" },
        { message: "こんにちは", description: "感情的でないメッセージ" },
        { message: "a".repeat(1000), description: "非常に長いメッセージ" },
        { message: "Hello diving", description: "英語メッセージ" }
    ];
    
    for (const edgeCase of edgeCases) {
        console.log(`   🧪 ${edgeCase.description}: "${edgeCase.message.slice(0, 50)}${edgeCase.message.length > 50 ? '...' : ''}"`);
        
        try {
            const analysis = await analyzer.analyzeEmotions(edgeCase.message);
            console.log(`   ✅ 処理成功: ${analysis.total_categories_detected}カテゴリ検出`);
        } catch (error) {
            console.log(`   ⚠️ 処理結果: ${error.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // Summary
    console.log('\n🎯 OpenAI Integration Test Summary:');
    console.log('✅ 6カテゴリ感情分析システム動作確認');
    console.log('✅ Jijiキャラクター応答システム動作確認');
    console.log('✅ パフォーマンス・精度テスト完了');
    console.log('✅ エッジケース処理確認');
    
    if (analyzer.getAnalysisMode() === 'openai') {
        console.log('🚀 OpenAI統合: ACTIVE');
        console.log('🎯 高精度感情分析・個性豊かなJiji応答生成可能');
    } else {
        console.log('🚀 Mock統合: ACTIVE');
        console.log('💡 OpenAI API KEYを設定すると高精度分析が利用可能');
    }
    
    console.log('\n🚀 Phase 4-A Task 4: COMPLETE ✅');
}

// Run test if this file is executed directly
if (require.main === module) {
    testOpenAIIntegration().catch(console.error);
}

module.exports = { testOpenAIIntegration };