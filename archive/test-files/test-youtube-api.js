/**
 * YouTube API 実際のクリエイター動画取得テスト
 */

const YouTubeAPI = require('./src/youtube-api');
const creatorsData = require('./data/diving-creators.json');

async function testCreatorVideos() {
    const youtube = new YouTubeAPI();
    
    console.log('🎥 YouTube API クリエイター動画取得テスト開始');
    console.log('===============================================');
    
    // YouTubeクリエイターのみテスト
    const youtubeCreators = creatorsData.creators.filter(c => c.platform !== 'instagram');
    
    for (const creator of youtubeCreators) {
        console.log(`\n📺 ${creator.name} (@${creator.channelHandle})`);
        console.log(`   チャンネルID: ${creator.channelId}`);
        
        try {
            // 最新動画取得テスト
            console.log('   📥 最新動画取得中...');
            const latestVideos = await youtube.getLatestVideos(creator.channelId, 3);
            
            if (latestVideos && latestVideos.length > 0) {
                console.log(`   ✅ 最新動画 ${latestVideos.length}件取得成功`);
                latestVideos.forEach((video, index) => {
                    console.log(`      ${index + 1}. ${video.title}`);
                    console.log(`         公開日: ${video.publishedAt}`);
                    console.log(`         URL: ${video.url}`);
                });
            } else {
                console.log('   ⚠️ 最新動画取得結果が空です');
            }
            
            // 少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // 人気動画取得テスト
            console.log('   📈 人気動画取得中...');
            const popularVideos = await youtube.getPopularVideos(creator.channelId, 3);
            
            if (popularVideos && popularVideos.length > 0) {
                console.log(`   ✅ 人気動画 ${popularVideos.length}件取得成功`);
                popularVideos.forEach((video, index) => {
                    console.log(`      ${index + 1}. ${video.title}`);
                });
            } else {
                console.log('   ⚠️ 人気動画取得結果が空です');
            }
            
        } catch (error) {
            console.error(`   ❌ エラー: ${error.message}`);
            if (error.response?.data?.error) {
                console.error(`   詳細: ${error.response.data.error.message}`);
            }
        }
        
        // API制限対策で少し待機
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n===============================================');
    console.log('🏁 YouTube API テスト完了');
}

// チャンネル情報取得テスト関数
async function testChannelInfo() {
    const youtube = new YouTubeAPI();
    
    console.log('\n📊 チャンネル詳細情報取得テスト');
    console.log('===============================================');
    
    // 実際のチャンネルIDでテスト（熱烈ダイビングチャンネル）
    try {
        const channelInfo = await youtube.getChannelInfo('UCshu1316');
        if (channelInfo) {
            console.log('✅ チャンネル情報取得成功');
            console.log(`   チャンネル名: ${channelInfo.title}`);
            console.log(`   登録者数: ${channelInfo.subscriberCount || '非公開'}`);
            console.log(`   動画数: ${channelInfo.videoCount || '不明'}`);
        }
    } catch (error) {
        console.error('❌ チャンネル情報取得エラー:', error.message);
    }
}

// メイン実行
async function main() {
    await testCreatorVideos();
    await testChannelInfo();
}

main().catch(console.error);