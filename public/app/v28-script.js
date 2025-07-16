/**
 * Jiji沖縄ダイビング知識ベース V2.8 JavaScript
 * LINE Bot完結型・知識ベース特化UI
 */

// グローバル変数
let currentUser = null;
let pointBalance = 0;

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('🌊 Jiji V2.8 知識ベース初期化開始');
    
    initializeV28App();
    setupEventListeners();
    setupScrollAnimations();
    setupHeaderScroll();
    loadUserData();
    
    console.log('✅ Jiji V2.8 知識ベース初期化完了');
});

// ===== V2.8 アプリ初期化 =====
function initializeV28App() {
    console.log('📚 V2.8 知識ベース特化モード');
    
    // 現在時刻表示
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000);
    
    // 知識ベース統計情報初期化
    initializeKnowledgeBaseStats();
    
    // LINE Bot統合確認
    checkLineBotIntegration();
}

// ===== イベントリスナー設定 =====
function setupEventListeners() {
    // ハンバーガーメニュー
    const hamburger = document.querySelector('.hamburger');
    const navMenu = document.querySelector('.nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
        });
    }
    
    // スムーススクロール
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // 知識ベースカードクリック
    document.querySelectorAll('.knowledge-card').forEach(card => {
        card.addEventListener('click', function() {
            const cardId = this.id;
            handleKnowledgeCardClick(cardId);
        });
    });
    
    // LINE Bot チャットボタン
    document.querySelectorAll('a[href*="line.me"]').forEach(button => {
        button.addEventListener('click', function(e) {
            trackLineBotClick();
        });
    });
}

// ===== ヘッダースクロール効果 =====
function setupHeaderScroll() {
    const header = document.querySelector('.header');
    let lastScrollTop = 0;
    
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (scrollTop > 100) {
            header.classList.add('scrolled');
            header.style.background = 'rgba(8, 145, 178, 0.95)';
            header.style.backdropFilter = 'blur(10px)';
        } else {
            header.classList.remove('scrolled');
            header.style.background = 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)';
            header.style.backdropFilter = 'none';
        }
        
        lastScrollTop = scrollTop;
    });
}

// ===== スクロールアニメーション =====
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.6s ease-out forwards';
                entry.target.style.opacity = '1';
            }
        });
    }, observerOptions);
    
    // アニメーション対象要素を監視
    document.querySelectorAll('.knowledge-card, .feature-card, .stat-card').forEach(el => {
        el.style.opacity = '0';
        observer.observe(el);
    });
}

// ===== 知識ベース統計情報初期化 =====
function initializeKnowledgeBaseStats() {
    const stats = {
        totalShops: 79,
        reviewWeight: 50,
        responseTime: 3,
        successRate: 95,
        activeAreas: ['石垣島', '宮古島', '沖縄本島', '慶良間'],
        updateFrequency: '3時間毎'
    };
    
    console.log('📊 知識ベース統計:', stats);
    
    // 統計情報をDOMに反映
    updateStatsDisplay(stats);
}

// ===== 統計表示更新 =====
function updateStatsDisplay(stats) {
    const statCards = document.querySelectorAll('.stat-card');
    
    statCards.forEach((card, index) => {
        const number = card.querySelector('.stat-number');
        const label = card.querySelector('.stat-label');
        
        if (number && label) {
            // カウントアップアニメーション
            animateCountUp(number, getStatValue(index, stats));
        }
    });
}

// ===== 統計値取得 =====
function getStatValue(index, stats) {
    switch(index) {
        case 0: return stats.totalShops;
        case 1: return stats.reviewWeight + '%';
        case 2: return stats.responseTime + '秒';
        case 3: return stats.successRate + '%';
        default: return '---';
    }
}

// ===== カウントアップアニメーション =====
function animateCountUp(element, finalValue) {
    const isPercentage = finalValue.includes('%');
    const isTime = finalValue.includes('秒');
    const numericValue = parseInt(finalValue);
    
    let current = 0;
    const increment = numericValue / 50;
    
    const timer = setInterval(() => {
        current += increment;
        
        if (current >= numericValue) {
            current = numericValue;
            clearInterval(timer);
        }
        
        let displayValue = Math.floor(current).toString();
        if (isPercentage) displayValue += '%';
        if (isTime) displayValue += '秒';
        
        element.textContent = displayValue;
    }, 30);
}

// ===== 知識ベースカードクリック処理 =====
function handleKnowledgeCardClick(cardId) {
    console.log(`📚 知識ベースカードクリック: ${cardId}`);
    
    const urls = {
        'shops': '/shops-database',
        'travel': '/travel-guide',
        'blog': '/diving-blog',
        'weather': '/weather-ocean'
    };
    
    const targetUrl = urls[cardId];
    if (targetUrl) {
        // 実際の実装では該当ページに遷移
        console.log(`→ 遷移先: ${targetUrl}`);
        
        // 仮想的な遷移表示
        showKnowledgePreview(cardId);
    }
}

// ===== 知識ベースプレビュー表示 =====
function showKnowledgePreview(category) {
    const previewData = getPreviewData(category);
    
    // モーダルまたはプレビューセクションを表示
    const preview = document.createElement('div');
    preview.className = 'knowledge-preview-modal';
    preview.innerHTML = `
        <div class="preview-content">
            <div class="preview-header">
                <h3>${previewData.title}</h3>
                <button class="preview-close">&times;</button>
            </div>
            <div class="preview-body">
                <p>${previewData.description}</p>
                <div class="preview-features">
                    ${previewData.features.map(feature => 
                        `<span class="preview-tag">${feature}</span>`
                    ).join('')}
                </div>
                <div class="preview-actions">
                    <button class="btn btn-primary">詳細ページへ</button>
                    <button class="btn btn-outline">LINE Botで相談</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(preview);
    
    // 閉じるボタンのイベント
    preview.querySelector('.preview-close').addEventListener('click', () => {
        document.body.removeChild(preview);
    });
    
    // 3秒後に自動で閉じる
    setTimeout(() => {
        if (document.body.contains(preview)) {
            document.body.removeChild(preview);
        }
    }, 3000);
}

// ===== プレビューデータ取得 =====
function getPreviewData(category) {
    const data = {
        shops: {
            title: '🏪 ショップ情報データベース',
            description: '石垣島44店舗、宮古島35店舗の詳細情報。口コミ・評価・認定バッジで最適なショップを見つけられます。',
            features: ['79店舗登録', '口コミ重視', '認定バッジ', 'プラン比較']
        },
        travel: {
            title: '✈️ 旅行ガイド',
            description: '宿泊施設、交通手段、予算プランの総合情報。コスパの良い旅行計画をサポートします。',
            features: ['予算プラン', '宿泊情報', '交通手段', '節約術']
        },
        blog: {
            title: '📝 ダイビングブログ',
            description: '初心者向け体験談、安全ガイド、器材レビューを掲載。実体験に基づく情報をお届けします。',
            features: ['体験談', '安全ガイド', '器材レビュー', 'Q&A']
        },
        weather: {
            title: '🌊 海況・天気情報',
            description: 'リアルタイム海況、週間予報、ベストシーズン情報。ダイビング計画に必要な気象データを提供。',
            features: ['リアルタイム', '週間予報', 'ベストシーズン', '3時間毎更新']
        }
    };
    
    return data[category] || data.shops;
}

// ===== LINE Bot統合確認 =====
function checkLineBotIntegration() {
    // LINE Bot連携状況をチェック
    const integration = {
        status: 'active',
        version: 'V2.8',
        features: [
            'Web知識ベース統合',
            '口コミ重視マッチング',
            'ポイントシステム',
            '会員連携'
        ],
        responseTime: '平均3秒'
    };
    
    console.log('🤖 LINE Bot統合状況:', integration);
    
    // 統合状態をUIに反映
    updateIntegrationStatus(integration);
}

// ===== 統合状態更新 =====
function updateIntegrationStatus(integration) {
    // LINE Bot統合セクションにステータス表示
    const integrationSection = document.querySelector('.line-integration');
    if (integrationSection) {
        const statusBadge = document.createElement('div');
        statusBadge.className = 'integration-status';
        statusBadge.innerHTML = `
            <span class="status-badge active">
                <i class="fas fa-check-circle"></i>
                LINE Bot ${integration.status.toUpperCase()}
            </span>
        `;
        
        const integrationText = integrationSection.querySelector('.integration-text');
        if (integrationText) {
            integrationText.insertBefore(statusBadge, integrationText.firstChild);
        }
    }
}

// ===== ユーザーデータ読み込み =====
function loadUserData() {
    // 仮想的なユーザーデータ
    const userData = {
        isLoggedIn: false,
        pointBalance: 0,
        memberLevel: 'basic',
        reviewCount: 0,
        lastActivity: null
    };
    
    currentUser = userData;
    pointBalance = userData.pointBalance;
    
    console.log('👤 ユーザーデータ:', userData);
    
    // 会員情報をUIに反映
    updateUserDisplay(userData);
}

// ===== ユーザー表示更新 =====
function updateUserDisplay(userData) {
    // ヘッダーに会員情報表示
    const header = document.querySelector('.header-content');
    if (header && userData.isLoggedIn) {
        const userInfo = document.createElement('div');
        userInfo.className = 'user-info';
        userInfo.innerHTML = `
            <span class="point-balance">
                <i class="fas fa-coins"></i>
                ${userData.pointBalance}P
            </span>
        `;
        header.appendChild(userInfo);
    }
}

// ===== LINE Bot クリック追跡 =====
function trackLineBotClick() {
    console.log('🤖 LINE Bot遷移');
    
    // 分析データ送信（実装時）
    const clickData = {
        timestamp: new Date().toISOString(),
        source: 'knowledge_base',
        action: 'line_bot_click',
        page: window.location.pathname
    };
    
    console.log('📊 クリック分析:', clickData);
}

// ===== 現在時刻更新 =====
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // フッターに時刻表示
    const timeElement = document.querySelector('.current-time');
    if (timeElement) {
        timeElement.textContent = `現在時刻: ${timeString}`;
    }
}

// ===== V2.8 機能: 知識ベース検索 =====
function searchKnowledgeBase(query) {
    console.log(`🔍 知識ベース検索: "${query}"`);
    
    const categories = ['shops', 'travel', 'blog', 'weather'];
    const results = [];
    
    // 簡易検索実装
    categories.forEach(category => {
        const score = calculateSearchScore(query, category);
        if (score > 0) {
            results.push({
                category,
                score,
                url: `/${category.replace('blog', 'diving-blog')}`
            });
        }
    });
    
    return results.sort((a, b) => b.score - a.score);
}

// ===== 検索スコア計算 =====
function calculateSearchScore(query, category) {
    const keywords = {
        shops: ['ショップ', '店舗', '予約', '口コミ', '評価'],
        travel: ['旅行', '宿泊', '交通', '予算', 'ホテル'],
        blog: ['初心者', 'ガイド', '体験', 'コツ', '安全'],
        weather: ['天気', '海況', '台風', 'シーズン', '時期']
    };
    
    const categoryKeywords = keywords[category] || [];
    let score = 0;
    
    categoryKeywords.forEach(keyword => {
        if (query.includes(keyword)) {
            score += 10;
        }
    });
    
    return score;
}

// ===== エラーハンドリング =====
window.addEventListener('error', function(e) {
    console.error('❌ V2.8 JavaScript エラー:', e.error);
    
    // エラー情報をサーバーに送信（実装時）
    const errorData = {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };
    
    console.log('📊 エラー分析:', errorData);
});

// ===== V2.8 API連携（将来実装用） =====
async function fetchKnowledgeBaseData(category) {
    try {
        const response = await fetch(`/api/v28/knowledge/${category}`);
        const data = await response.json();
        
        console.log(`📚 ${category} データ取得:`, data);
        return data;
    } catch (error) {
        console.error(`❌ ${category} データ取得エラー:`, error);
        return null;
    }
}

// ===== CSS動的追加 =====
function addV28Styles() {
    const style = document.createElement('style');
    style.textContent = `
        .knowledge-preview-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            animation: fadeIn 0.3s ease;
        }
        
        .preview-content {
            background: white;
            border-radius: 20px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            animation: slideUp 0.3s ease;
        }
        
        .preview-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 1px solid #e2e8f0;
        }
        
        .preview-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #64748b;
        }
        
        .preview-features {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 20px 0;
        }
        
        .preview-tag {
            background: #f1f5f9;
            color: #475569;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.85rem;
        }
        
        .preview-actions {
            display: flex;
            gap: 15px;
            margin-top: 25px;
        }
        
        .integration-status {
            margin-bottom: 20px;
        }
        
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
        }
        
        .user-info {
            display: flex;
            align-items: center;
            gap: 15px;
        }
        
        .point-balance {
            display: flex;
            align-items: center;
            gap: 5px;
            background: rgba(255,255,255,0.2);
            padding: 5px 12px;
            border-radius: 15px;
            font-weight: 600;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `;
    
    document.head.appendChild(style);
}

// CSS動的追加を実行
addV28Styles();

console.log('✅ Jiji V2.8 知識ベース JavaScript 読み込み完了');