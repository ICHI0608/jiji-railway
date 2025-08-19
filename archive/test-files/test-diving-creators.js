/**
 * ダイビングクリエイター機能テストスクリプト
 */

const express = require('express');
const path = require('path');

// 簡易テストサーバー作成
const app = express();
const port = 3001;

// 静的ファイル提供
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// ダイビングクリエイター API テスト
app.get('/api/diving-creators', (req, res) => {
    try {
        const creatorsData = require('./data/diving-creators.json');
        console.log('✅ クリエイターデータ正常取得:', creatorsData.creators.length + '件');
        
        res.json({
            success: true,
            creators: creatorsData.creators,
            categories: creatorsData.categories,
            lastUpdated: creatorsData.lastUpdated
        });
    } catch (error) {
        console.error('❌ クリエイターデータ取得エラー:', error);
        res.status(500).json({
            success: false,
            error: 'クリエイター情報の取得に失敗しました'
        });
    }
});

// クリエイター動画取得 API（サンプル）
app.get('/api/creator-videos', (req, res) => {
    const { creatorId, type = 'latest' } = req.query;

    if (!creatorId) {
        return res.status(400).json({
            success: false,
            error: 'クリエイターIDが必要です'
        });
    }

    // サンプル動画データ
    const sampleVideos = {
        latest: [
            {
                videoId: 'sample_001',
                title: '沖縄ダイビング最新スポット紹介！透明度抜群の海で撮影',
                description: '沖縄本島の新しいダイビングポイントを紹介します。',
                publishedAt: '2025-08-08T10:00:00Z',
                thumbnail: 'https://i.ytimg.com/vi/sample/mqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=sample_001',
                viewCount: 12500
            },
            {
                videoId: 'sample_002',
                title: '初心者必見！安全ダイビングの基本テクニック',
                description: '初心者向けの安全なダイビング方法を解説します。',
                publishedAt: '2025-08-05T14:30:00Z',
                thumbnail: 'https://i.ytimg.com/vi/sample/mqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=sample_002',
                viewCount: 8900
            },
            {
                videoId: 'sample_003',
                title: '宮古島の地形ダイビング完全ガイド',
                description: '宮古島の美しい地形を楽しむダイビングツアー。',
                publishedAt: '2025-08-03T09:15:00Z',
                thumbnail: 'https://i.ytimg.com/vi/sample/mqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=sample_003',
                viewCount: 15200
            }
        ],
        popular: [
            {
                videoId: 'popular_001',
                title: 'マンタとの感動的な遭遇！石垣島ダイビング',
                description: '石垣島でマンタとの貴重な遭遇を収録しました。',
                publishedAt: '2025-07-20T16:45:00Z',
                thumbnail: 'https://i.ytimg.com/vi/sample/mqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=popular_001',
                viewCount: 45800
            },
            {
                videoId: 'popular_002',
                title: '沖縄の海中生物図鑑！珍しい魚たちを特集',
                description: '沖縄の海で見られる珍しい魚たちを詳しく紹介。',
                publishedAt: '2025-07-15T11:20:00Z',
                thumbnail: 'https://i.ytimg.com/vi/sample/mqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=popular_002',
                viewCount: 38900
            },
            {
                videoId: 'popular_003',
                title: 'ダイビング器材レビュー2025年版',
                description: '最新ダイビング器材の詳細レビューと比較。',
                publishedAt: '2025-07-10T13:30:00Z',
                thumbnail: 'https://i.ytimg.com/vi/sample/mqdefault.jpg',
                url: 'https://www.youtube.com/watch?v=popular_003',
                viewCount: 31200
            }
        ]
    };

    console.log(`✅ 動画データ取得: creatorId=${creatorId}, type=${type}`);
    
    res.json({
        success: true,
        creatorId: creatorId,
        creatorName: 'テストクリエイター',
        type: type,
        videos: sampleVideos[type] || []
    });
});

// クリエイター紹介ページ提供
app.get('/diving-creators', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/diving-creators/index.html'));
});

// テスト用ルート
app.get('/test', (req, res) => {
    res.json({
        message: 'ダイビングクリエイター機能テストサーバー正常動作中',
        timestamp: new Date().toISOString(),
        endpoints: [
            'GET /api/diving-creators - クリエイター一覧',
            'GET /api/creator-videos?creatorId=xxx&type=latest - 最新動画',
            'GET /api/creator-videos?creatorId=xxx&type=popular - 人気動画',
            'GET /diving-creators - クリエイター紹介ページ'
        ]
    });
});

// サーバー起動
app.listen(port, () => {
    console.log('🎥 ダイビングクリエイター機能テストサーバー起動');
    console.log(`📡 テストURL: http://localhost:${port}`);
    console.log('🧪 テスト可能な機能:');
    console.log('   - GET /api/diving-creators');
    console.log('   - GET /api/creator-videos?creatorId=creator_001&type=latest');
    console.log('   - GET /api/creator-videos?creatorId=creator_001&type=popular');
    console.log('   - GET /diving-creators');
    console.log('   - GET /test');
});