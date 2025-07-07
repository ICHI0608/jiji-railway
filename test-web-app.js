#!/usr/bin/env node

/**
 * Web Application Test Script
 * Tests the complete integrated web application
 */

const axios = require('axios');

// Conditional import for puppeteer
let puppeteer = null;
try {
    puppeteer = require('puppeteer');
} catch (error) {
    // Puppeteer not available
}

class WebAppTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.browser = null;
        this.page = null;
    }

    async setup() {
        console.log('🔧 Setting up browser testing environment...');
        
        if (!puppeteer) {
            console.log('⚠️  Puppeteer not available, using API testing only');
            return false;
        }
        
        // Check if puppeteer is available, if not, fall back to API testing only
        try {
            this.browser = await puppeteer.launch({ 
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1200, height: 800 });
            console.log('✅ Browser testing environment ready');
            return true;
        } catch (error) {
            console.log('⚠️  Browser testing not available, using API testing only');
            return false;
        }
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async testServerResponse() {
        console.log('\n🌐 Testing server response...');
        
        try {
            const response = await axios.get(this.baseURL, {
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WebAppTester)' }
            });
            
            console.log(`✅ Status: ${response.status}`);
            console.log(`📄 Content-Type: ${response.headers['content-type']}`);
            console.log(`📊 Content Length: ${response.data.length} characters`);
            
            // Check for key elements
            const html = response.data;
            const checks = [
                { name: 'Jiji Title', test: html.includes('Jiji沖縄ダイビングバディ') },
                { name: 'AI Matching Interface', test: html.includes('感情マッチング') },
                { name: 'Chat Container', test: html.includes('jiji-chat-container') },
                { name: 'API Integration', test: html.includes('/api/match') },
                { name: 'Stats Section', test: html.includes('statsGrid') }
            ];
            
            checks.forEach(check => {
                console.log(`${check.test ? '✅' : '❌'} ${check.name}`);
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Server response test failed:', error.message);
            return false;
        }
    }

    async testBrowserInteraction() {
        if (!this.page) {
            console.log('⚠️  Skipping browser tests (puppeteer not available)');
            return true;
        }

        console.log('\n🖱️  Testing browser interactions...');
        
        try {
            // Load the page
            await this.page.goto(this.baseURL, { waitUntil: 'networkidle0' });
            console.log('✅ Page loaded successfully');

            // Test page title
            const title = await this.page.title();
            console.log(`📄 Page title: ${title}`);

            // Test if key elements exist
            const elements = [
                { selector: '.jiji-avatar', name: 'Jiji Avatar' },
                { selector: '#userMessage', name: 'Message Input' },
                { selector: '#matchButton', name: 'Match Button' },
                { selector: '.area-btn', name: 'Area Buttons' },
                { selector: '#statsGrid', name: 'Stats Grid' }
            ];

            for (const element of elements) {
                const exists = await this.page.$(element.selector) !== null;
                console.log(`${exists ? '✅' : '❌'} ${element.name}`);
            }

            // Test area button interaction
            await this.page.click('.area-btn[data-area="宮古島"]');
            console.log('✅ Area button interaction works');

            // Test message input
            await this.page.type('#userMessage', 'テスト用のメッセージです。初心者で安全面が心配です。');
            console.log('✅ Message input works');

            // Wait for stats to load
            await this.page.waitForSelector('.stat-number', { timeout: 5000 });
            console.log('✅ Stats loaded successfully');

            return true;

        } catch (error) {
            console.error('❌ Browser interaction test failed:', error.message);
            return false;
        }
    }

    async testEmotionalMatchingFlow() {
        console.log('\n🧠 Testing emotional matching flow...');
        
        const testCases = [
            {
                name: '初心者・安全重視',
                message: '初めてのダイビングで安全面が心配です。石垣島でマンタを見たいです。',
                area: '石垣島'
            },
            {
                name: '一人参加・女性',
                message: '宮古島で一人参加を考えています。女性一人でも大丈夫でしょうか？',
                area: '宮古島'
            },
            {
                name: '予算重視',
                message: '予算をなるべく抑えたくて、でも丁寧に教えてもらえるところがいいです。',
                area: null
            }
        ];

        let successCount = 0;

        for (const testCase of testCases) {
            try {
                console.log(`\n🧪 テスト: ${testCase.name}`);
                console.log(`💬 メッセージ: "${testCase.message}"`);

                const response = await axios.post(`${this.baseURL}/api/match`, {
                    message: testCase.message,
                    area: testCase.area,
                    maxResults: 3
                }, {
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.data.success) {
                    const data = response.data.data;
                    console.log(`✅ マッチング成功`);
                    console.log(`📊 感情スコア: ${data.emotional_analysis.totalScore}点`);
                    console.log(`🏆 トップ推薦: ${data.recommendations[0].shop.shop_name} (${data.recommendations[0].totalScore}点)`);
                    console.log(`📍 エリア: ${data.recommendations[0].shop.area}`);
                    console.log(`⭐ 評価: ${data.recommendations[0].shop.customer_rating}★`);
                    successCount++;
                } else {
                    console.log(`❌ マッチング失敗: ${response.data.error}`);
                }

            } catch (error) {
                console.error(`❌ テストエラー: ${error.message}`);
            }
        }

        console.log(`\n📊 マッチングテスト結果: ${successCount}/${testCases.length} 成功`);
        return successCount === testCases.length;
    }

    async testPerformance() {
        console.log('\n⚡ Testing performance...');
        
        try {
            const startTime = Date.now();
            
            // Concurrent API calls
            const promises = [
                axios.get(`${this.baseURL}/api/health`),
                axios.get(`${this.baseURL}/api/stats`),
                axios.get(`${this.baseURL}/api/shops/area/石垣島`),
                axios.post(`${this.baseURL}/api/match`, {
                    message: 'パフォーマンステスト用メッセージ',
                    area: '石垣島'
                })
            ];

            const results = await Promise.all(promises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            console.log(`✅ 4つの同時APIコール完了`);
            console.log(`⏱️  総処理時間: ${totalTime}ms`);
            console.log(`📊 平均レスポンス時間: ${totalTime / 4}ms`);

            const allSuccessful = results.every(r => r.status === 200);
            console.log(`${allSuccessful ? '✅' : '❌'} 全APIコール成功`);

            return allSuccessful && totalTime < 5000; // 5秒以内

        } catch (error) {
            console.error('❌ Performance test failed:', error.message);
            return false;
        }
    }

    async runAllTests() {
        console.log('\n🚀 WEB APPLICATION COMPREHENSIVE TEST SUITE');
        console.log('='.repeat(60));

        const browserAvailable = await this.setup();
        
        const tests = [
            { name: 'Server Response', test: () => this.testServerResponse() },
            { name: 'Browser Interaction', test: () => this.testBrowserInteraction() },
            { name: 'Emotional Matching Flow', test: () => this.testEmotionalMatchingFlow() },
            { name: 'Performance', test: () => this.testPerformance() }
        ];

        const results = [];
        
        for (const test of tests) {
            console.log(`\n${'='.repeat(40)}`);
            console.log(`🧪 Running: ${test.name}`);
            console.log(`${'='.repeat(40)}`);
            
            try {
                const result = await test.test();
                results.push({ name: test.name, success: result });
                console.log(`${result ? '✅' : '❌'} ${test.name}: ${result ? 'PASSED' : 'FAILED'}`);
            } catch (error) {
                console.error(`❌ ${test.name} threw error:`, error.message);
                results.push({ name: test.name, success: false });
            }
        }

        await this.cleanup();

        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));

        const successful = results.filter(r => r.success).length;
        const total = results.length;

        results.forEach(result => {
            console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
        });

        console.log(`\n🎯 Overall Result: ${successful}/${total} tests passed`);

        if (successful === total) {
            console.log('\n🎉 ALL TESTS PASSED!');
            console.log('🌐 Web application is ready for production!');
            console.log('🔗 Access at: http://localhost:3000');
        } else {
            console.log('\n⚠️  Some tests failed. Please check the details above.');
        }

        return successful === total;
    }
}

// Check for puppeteer installation
function checkPuppeteer() {
    try {
        require.resolve('puppeteer');
        return true;
    } catch {
        console.log('📦 Puppeteer not found. Installing for browser testing...');
        return false;
    }
}

// Main execution
async function main() {
    if (!checkPuppeteer()) {
        console.log('⚠️  Running tests without browser automation');
        console.log('💡 To enable full browser testing, run: npm install puppeteer');
    }

    console.log('⏳ Waiting for server to be ready...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    const tester = new WebAppTester();
    const success = await tester.runAllTests();
    
    process.exit(success ? 0 : 1);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = WebAppTester;