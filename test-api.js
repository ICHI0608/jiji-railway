#!/usr/bin/env node

/**
 * API Testing Script
 * Tests all Phase 2 API endpoints
 */

const axios = require('axios');

class APITester {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL;
        this.axios = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    async testEndpoint(method, url, data = null, description = '') {
        try {
            console.log(`\n🧪 Testing: ${method.toUpperCase()} ${url}`);
            console.log(`📝 ${description}`);
            
            const config = { method, url };
            if (data) config.data = data;
            
            const response = await this.axios(config);
            
            console.log(`✅ Status: ${response.status}`);
            
            if (response.data) {
                if (response.data.success) {
                    console.log(`📊 Success: ${response.data.success}`);
                }
                if (response.data.count !== undefined) {
                    console.log(`📈 Count: ${response.data.count}`);
                }
                if (response.data.data && Array.isArray(response.data.data)) {
                    console.log(`🏪 First item: ${response.data.data[0]?.shop_name || 'N/A'}`);
                }
            }
            
            return { success: true, status: response.status, data: response.data };
            
        } catch (error) {
            console.log(`❌ Error: ${error.response?.status || 'Network'} - ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    async runAllTests() {
        console.log('\n🚀 JIJI API TESTING SUITE');
        console.log('='.repeat(50));
        
        const tests = [
            {
                method: 'get',
                url: '/api/health',
                description: 'Server health check'
            },
            {
                method: 'get',
                url: '/api/stats',
                description: 'Database statistics'
            },
            {
                method: 'get',
                url: '/api/shops',
                description: 'Get all shops'
            },
            {
                method: 'get',
                url: '/api/shops/area/石垣島',
                description: 'Get shops in Ishigaki'
            },
            {
                method: 'get',
                url: '/api/shops/SHOP_001',
                description: 'Get specific shop by ID'
            },
            {
                method: 'post',
                url: '/api/match',
                data: {
                    message: 'ダイビング初心者で安全面が心配です',
                    area: '石垣島',
                    maxResults: 3
                },
                description: 'Emotional matching test - safety concerns'
            },
            {
                method: 'post',
                url: '/api/match',
                data: {
                    message: '一人参加でも大丈夫でしょうか？宮古島を希望します',
                    area: '宮古島'
                },
                description: 'Emotional matching test - solo diving'
            },
            {
                method: 'post',
                url: '/api/shops/search',
                data: {
                    area: '石垣島',
                    minRating: 4.5,
                    maxPrice: 16000,
                    beginnerFriendly: true
                },
                description: 'Shop search with filters'
            }
        ];
        
        const results = [];
        
        for (let i = 0; i < tests.length; i++) {
            const test = tests[i];
            const result = await this.testEndpoint(
                test.method,
                test.url,
                test.data,
                test.description
            );
            
            results.push({
                ...test,
                result
            });
            
            // Brief pause between tests
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Summary
        console.log('\n📊 TEST SUMMARY');
        console.log('='.repeat(30));
        
        const successful = results.filter(r => r.result.success).length;
        const total = results.length;
        
        console.log(`✅ Successful: ${successful}/${total}`);
        console.log(`❌ Failed: ${total - successful}/${total}`);
        
        if (successful === total) {
            console.log('\n🎉 ALL TESTS PASSED!');
            console.log('🔗 API is ready for frontend integration');
        } else {
            console.log('\n⚠️  Some tests failed. Check server logs.');
        }
        
        return results;
    }

    async testRealtimeMatching() {
        console.log('\n🎯 REALTIME MATCHING DEMO');
        console.log('='.repeat(40));
        
        const scenarios = [
            {
                user: '田中美咲 (初心者)',
                message: '石垣島でダイビングしたいのですが、初めてで安全面が心配です',
                area: '石垣島'
            },
            {
                user: '佐藤健一 (予算重視)',
                message: '予算をなるべく抑えたくて、でも下手なので丁寧に教えてもらえるところがいいです',
                area: null
            },
            {
                user: '山田花子 (一人参加)',
                message: '宮古島で一人参加を考えています。女性一人でも大丈夫でしょうか？',
                area: '宮古島'
            }
        ];
        
        for (const scenario of scenarios) {
            console.log(`\n👤 ${scenario.user}`);
            console.log(`💬 "${scenario.message}"`);
            
            try {
                const response = await this.axios.post('/api/match', {
                    message: scenario.message,
                    area: scenario.area,
                    maxResults: 2
                });
                
                if (response.data.success) {
                    const recs = response.data.data.recommendations;
                    console.log(`🏆 Top recommendation: ${recs[0].shop.shop_name} (${recs[0].totalScore}点)`);
                    console.log(`📍 Area: ${recs[0].shop.area} | Rating: ${recs[0].shop.customer_rating}★`);
                } else {
                    console.log('❌ Matching failed');
                }
                
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
        }
    }
}

// Run tests
async function main() {
    const tester = new APITester();
    
    console.log('⏳ Waiting for server to start...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    try {
        await tester.runAllTests();
        await tester.testRealtimeMatching();
        
        console.log('\n💡 Next steps:');
        console.log('1. Frontend integration ready');
        console.log('2. LINE Bot integration possible');
        console.log('3. Real Google Sheets connection');
        
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        console.log('💡 Make sure the server is running: npm run dev');
    }
}

// Install axios if not present
const checkAxios = () => {
    try {
        require('axios');
        return true;
    } catch {
        return false;
    }
};

if (!checkAxios()) {
    console.log('📦 Installing axios for API testing...');
    const { execSync } = require('child_process');
    execSync('npm install axios', { stdio: 'inherit' });
}

if (require.main === module) {
    main();
}

module.exports = APITester;