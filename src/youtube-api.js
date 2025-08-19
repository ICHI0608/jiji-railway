/**
 * YouTube Data API v3 統合システム
 * ダイビングクリエイター紹介・動画情報取得
 */

const axios = require('axios');

class YouTubeAPI {
    constructor() {
        this.apiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyCRebQiuofGEtqyM0FQ4JUZbf7053mpjkc';
        this.baseURL = 'https://www.googleapis.com/youtube/v3';
        this.quotaUsage = {
            daily: 0,
            calls: [],
            lastReset: new Date().toDateString()
        };
        this.dailyLimit = 10000; // YouTube API daily quota limit
    }

    /**
     * API使用量を記録
     */
    trackAPIUsage(operation, cost) {
        // 日付が変わった場合のリセット
        const today = new Date().toDateString();
        if (this.quotaUsage.lastReset !== today) {
            this.quotaUsage.daily = 0;
            this.quotaUsage.calls = [];
            this.quotaUsage.lastReset = today;
        }

        this.quotaUsage.daily += cost;
        this.quotaUsage.calls.push({
            operation,
            cost,
            timestamp: new Date().toISOString(),
            remaining: this.dailyLimit - this.quotaUsage.daily
        });

        console.log(`YouTube API Usage: ${operation} (+${cost} units) | Daily: ${this.quotaUsage.daily}/${this.dailyLimit}`);
        
        // 制限近づき時の警告
        if (this.quotaUsage.daily > this.dailyLimit * 0.8) {
            console.warn(`⚠️ YouTube API quota warning: ${this.quotaUsage.daily}/${this.dailyLimit} used (${Math.round(this.quotaUsage.daily/this.dailyLimit*100)}%)`);
        }
    }

    /**
     * チャンネルの最新動画3本を取得
     */
    async getLatestVideos(channelId, maxResults = 3) {
        try {
            // Quota check
            const estimatedCost = 100; // search operation cost
            if (this.quotaUsage.daily + estimatedCost > this.dailyLimit) {
                console.error('YouTube API quota exceeded for today');
                return [];
            }

            const response = await axios.get(`${this.baseURL}/search`, {
                params: {
                    part: 'snippet',
                    channelId: channelId,
                    maxResults: maxResults,
                    order: 'date',
                    type: 'video',
                    key: this.apiKey
                },
                headers: {
                    'Referer': 'https://dive-buddys.com'
                }
            });

            this.trackAPIUsage('search_latest', estimatedCost);

            return response.data.items.map(video => ({
                videoId: video.id.videoId,
                title: video.snippet.title,
                description: video.snippet.description,
                publishedAt: video.snippet.publishedAt,
                thumbnail: video.snippet.thumbnails.medium.url,
                url: `https://www.youtube.com/watch?v=${video.id.videoId}`
            }));
        } catch (error) {
            console.error('YouTube API Error (latest videos):', error.message);
            return [];
        }
    }

    /**
     * チャンネルの人気動画ベスト3を取得
     */
    async getPopularVideos(channelId, maxResults = 3) {
        try {
            // Quota check for two operations
            const estimatedCost = 101; // search (100) + videos (1)
            if (this.quotaUsage.daily + estimatedCost > this.dailyLimit) {
                console.error('YouTube API quota exceeded for today');
                return [];
            }

            const response = await axios.get(`${this.baseURL}/search`, {
                params: {
                    part: 'snippet',
                    channelId: channelId,
                    maxResults: maxResults,
                    order: 'viewCount',
                    type: 'video',
                    key: this.apiKey
                },
                headers: {
                    'Referer': 'https://dive-buddys.com'
                }
            });

            const videoIds = response.data.items.map(item => item.id.videoId).join(',');
            
            // 詳細統計情報を取得
            const statsResponse = await axios.get(`${this.baseURL}/videos`, {
                params: {
                    part: 'statistics,snippet',
                    id: videoIds,
                    key: this.apiKey
                }
            });

            this.trackAPIUsage('search_popular', 100);
            this.trackAPIUsage('videos_stats', 1);

            return statsResponse.data.items.map(video => ({
                videoId: video.id,
                title: video.snippet.title,
                description: video.snippet.description,
                publishedAt: video.snippet.publishedAt,
                thumbnail: video.snippet.thumbnails.medium.url,
                url: `https://www.youtube.com/watch?v=${video.id}`,
                viewCount: parseInt(video.statistics.viewCount),
                likeCount: parseInt(video.statistics.likeCount || 0)
            }));
        } catch (error) {
            console.error('YouTube API Error (popular videos):', error.message);
            return [];
        }
    }

    /**
     * チャンネル基本情報を取得
     */
    async getChannelInfo(channelId) {
        try {
            // Quota check
            const estimatedCost = 1; // channels operation cost
            if (this.quotaUsage.daily + estimatedCost > this.dailyLimit) {
                console.error('YouTube API quota exceeded for today');
                return null;
            }

            const response = await axios.get(`${this.baseURL}/channels`, {
                params: {
                    part: 'snippet,statistics',
                    id: channelId,
                    key: this.apiKey
                }
            });

            this.trackAPIUsage('channels', estimatedCost);

            if (response.data.items.length === 0) {
                return null;
            }

            const channel = response.data.items[0];
            return {
                channelId: channel.id,
                title: channel.snippet.title,
                description: channel.snippet.description,
                thumbnail: channel.snippet.thumbnails.medium.url,
                subscriberCount: parseInt(channel.statistics.subscriberCount),
                videoCount: parseInt(channel.statistics.videoCount),
                viewCount: parseInt(channel.statistics.viewCount),
                publishedAt: channel.snippet.publishedAt
            };
        } catch (error) {
            console.error('YouTube API Error (channel info):', error.message);
            return null;
        }
    }

    /**
     * 複数クリエイターの包括データ取得
     */
    async getCreatorsData(creators) {
        const results = [];
        
        for (const creator of creators) {
            try {
                console.log(`Fetching data for: ${creator.name}`);
                
                const [channelInfo, latestVideos, popularVideos] = await Promise.all([
                    this.getChannelInfo(creator.channelId),
                    this.getLatestVideos(creator.channelId),
                    this.getPopularVideos(creator.channelId)
                ]);

                results.push({
                    ...creator,
                    channelInfo,
                    latestVideos,
                    popularVideos,
                    lastUpdated: new Date().toISOString()
                });

                // API制限を避けるための遅延
                await new Promise(resolve => setTimeout(resolve, 100));
                
            } catch (error) {
                console.error(`Error fetching data for ${creator.name}:`, error.message);
                results.push({
                    ...creator,
                    error: error.message,
                    lastUpdated: new Date().toISOString()
                });
            }
        }

        return results;
    }

    /**
     * 動画のview数をフォーマット
     */
    static formatViewCount(viewCount) {
        if (viewCount >= 1000000) {
            return Math.floor(viewCount / 100000) / 10 + 'M';
        } else if (viewCount >= 1000) {
            return Math.floor(viewCount / 100) / 10 + 'K';
        }
        return viewCount.toString();
    }

    /**
     * 公開日をフォーマット
     */
    static formatPublishedDate(publishedAt) {
        const date = new Date(publishedAt);
        const now = new Date();
        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return '今日';
        if (diffDays === 1) return '1日前';
        if (diffDays < 30) return `${diffDays}日前`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)}ヶ月前`;
        return `${Math.floor(diffDays / 365)}年前`;
    }

    /**
     * API使用量統計を取得
     */
    getQuotaStats() {
        return {
            dailyUsage: this.quotaUsage.daily,
            dailyLimit: this.dailyLimit,
            usagePercentage: Math.round((this.quotaUsage.daily / this.dailyLimit) * 100),
            remaining: this.dailyLimit - this.quotaUsage.daily,
            lastReset: this.quotaUsage.lastReset,
            recentCalls: this.quotaUsage.calls.slice(-10), // 最新10件
            totalCalls: this.quotaUsage.calls.length,
            status: this.quotaUsage.daily > this.dailyLimit * 0.9 ? 'critical' :
                   this.quotaUsage.daily > this.dailyLimit * 0.8 ? 'warning' : 'ok'
        };
    }

    /**
     * 今日のAPI使用量をリセット（テスト用）
     */
    resetDailyQuota() {
        this.quotaUsage.daily = 0;
        this.quotaUsage.calls = [];
        this.quotaUsage.lastReset = new Date().toDateString();
        console.log('YouTube API quota reset');
    }
}

module.exports = YouTubeAPI;