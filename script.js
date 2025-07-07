// Jiji沖縄ダイビングバディ - メインJavaScript

// グローバル変数
let currentWeatherData = null;
let shopData = [];
let filteredShops = [];

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    loadShopData();
    setupScrollAnimations();
    setupHeaderScroll();
});

// ===== アプリ初期化 =====
function initializeApp() {
    console.log('🌊 Jiji沖縄ダイビングバディ初期化開始');
    
    // 現在時刻表示
    updateCurrentTime();
    setInterval(updateCurrentTime, 60000); // 1分ごとに更新
    
    // 海況データ初期化
    initializeWeatherData();
    
    // ポイントシステム初期化
    initializePointSystem();
    
    console.log('✅ Jiji初期化完了');
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
    
    // ショップ検索フィルター
    const filterElements = ['area-filter', 'skill-filter', 'style-filter', 'budget-filter'];
    filterElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', function() {
                filterShops();
            });
        }
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
        } else {
            header.classList.remove('scrolled');
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
                entry.target.classList.add('animate-in');
            }
        });
    }, observerOptions);
    
    // アニメーション対象要素を監視
    const animateElements = document.querySelectorAll('.weather-card, .anxiety-card, .shop-card, .experience-story, .personality-card');
    animateElements.forEach(el => {
        el.classList.add('animate-ready');
        observer.observe(el);
    });
}

// ===== 時刻更新 =====
function updateCurrentTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('ja-JP', { 
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Tokyo'
    });
    
    // 時刻表示要素があれば更新
    const timeElements = document.querySelectorAll('.current-time');
    timeElements.forEach(el => {
        el.textContent = `沖縄時間 ${timeString}`;
    });
}

// ===== 海況データ初期化 =====
function initializeWeatherData() {
    // 模擬海況データ（実際にはAPIから取得）
    currentWeatherData = {
        ishigaki: {
            name: '石垣島',
            temp: 28,
            windDirection: '北東',
            windSpeed: 3,
            waveHeight: 1.0,
            visibility: '25-30m期待',
            condition: 'excellent',
            icon: '☀️',
            jijiComment: 'こんな穏やかな日は、マンタスクランブルも期待できそう！'
        },
        miyako: {
            name: '宮古島',
            temp: 27,
            windDirection: '東',
            windSpeed: 4,
            waveHeight: 1.5,
            visibility: '30m+期待',
            condition: 'excellent',
            icon: '⛅',
            jijiComment: '下地島の青の洞窟、今日は特に神秘的かも✨'
        },
        okinawa: {
            name: '沖縄本島',
            temp: 26,
            windDirection: '北',
            windSpeed: 2,
            waveHeight: 0.5,
            visibility: '20-25m期待',
            condition: 'good',
            icon: '🌤️',
            jijiComment: '慶良間諸島への船も快適そう！初心者にも優しいコンディション'
        }
    };
    
    updateWeatherDisplay();
}

// ===== 海況表示更新 =====
function updateWeatherDisplay() {
    Object.keys(currentWeatherData).forEach(area => {
        const data = currentWeatherData[area];
        const card = document.querySelector(`.weather-card.${area}`);
        
        if (card) {
            // 温度更新
            const tempElement = card.querySelector('.temperature');
            if (tempElement) tempElement.textContent = `${data.temp}°C`;
            
            // アイコン更新
            const iconElement = card.querySelector('.weather-icon');
            if (iconElement) iconElement.textContent = data.icon;
            
            // 風向・風速更新
            const windElement = card.querySelector('.info-item:nth-child(1) .value');
            if (windElement) windElement.textContent = `${data.windDirection} ${data.windSpeed}m/s`;
            
            // 波高更新
            const waveElement = card.querySelector('.info-item:nth-child(2) .value');
            if (waveElement) waveElement.textContent = `${data.waveHeight}m`;
            
            // 透明度更新
            const visibilityElement = card.querySelector('.info-item:nth-child(3) .value');
            if (visibilityElement) {
                visibilityElement.textContent = data.visibility;
                visibilityElement.className = `value ${data.condition}`;
            }
            
            // Jijiコメント更新
            const commentElement = card.querySelector('.jiji-comment p');
            if (commentElement) commentElement.textContent = data.jijiComment;
        }
    });
}

// ===== ショップデータ読み込み =====
function loadShopData() {
    // 模擬ショップデータ（実際にはGoogle Sheets APIから取得）
    shopData = [
        {
            id: 'ishigaki-marine',
            name: '石垣島マリンサービス',
            area: 'ishigaki',
            rating: 4.9,
            grade: 'S級認定',
            tags: ['初心者専門', '一人参加歓迎', '少人数制'],
            price: 13500,
            features: ['🤿 1対1指導可能', '📸 写真撮影無料', '🚗 ホテル送迎あり'],
            jijiComment: '一人参加の方に特におすすめ！スタッフの田中さんは元々ビビリだったから、初心者の気持ちを本当によく分かってくれます',
            experience: '「初ダイビングで不安でしたが、スタッフの方が『大丈夫、一緒にゆっくりやりましょう』と声をかけてくれて安心できました」',
            skillLevel: ['trial', 'owd'],
            participationStyle: ['solo', 'couple'],
            budgetRange: 'medium'
        },
        {
            id: 'miyako-blue',
            name: '宮古島ブルーダイビング',
            area: 'miyako',
            rating: 4.7,
            grade: 'A級認定',
            tags: ['青の洞窟専門', '女性スタッフ在籍', 'カップル人気'],
            price: 12800,
            features: ['💙 青の洞窟ガイド', '👩‍🎓 女性インストラクター', '🎥 動画撮影サービス'],
            jijiComment: '宮古島の青の洞窟なら絶対ここ！神秘的な光のカーテンに、きっと感動すること間違いなしです',
            experience: '「青の洞窟の美しさに圧倒されました。写真では伝わらない神秘的な体験でした」',
            skillLevel: ['trial', 'owd', 'aow'],
            participationStyle: ['couple', 'family'],
            budgetRange: 'medium'
        },
        {
            id: 'kerama-island',
            name: '慶良間アイランドダイビング',
            area: 'kerama',
            rating: 4.8,
            grade: 'S級認定',
            tags: ['ウミガメ遭遇率95%', 'ファミリー歓迎', '安全第一'],
            price: 14200,
            features: ['🐢 ウミガメガイド', '🆘 AED・酸素完備', '🥽 器材無料レンタル'],
            jijiComment: 'ウミガメに会いたいならここ！95%の遭遇率は本当にすごい。安全管理も徹底してるから家族連れにも安心です',
            experience: '「3匹のウミガメと泳ぐことができました！子供たちも大興奮でした」',
            skillLevel: ['trial', 'owd', 'aow'],
            participationStyle: ['family', 'group'],
            budgetRange: 'high'
        },
        {
            id: 'ishigaki-beginner',
            name: '石垣島初心者ダイビングセンター',
            area: 'ishigaki',
            rating: 4.6,
            grade: 'S級認定',
            tags: ['体験ダイビング専門', '器材講習充実', '不安解消'],
            price: 9800,
            features: ['🔰 初心者専門', '⏰ 時間制限なし', '📚 事前講習充実'],
            jijiComment: '体験ダイビングから始めたい方にピッタリ！時間をかけてじっくり慣れることができます',
            experience: '「泳げない私でも楽しめました。スタッフの方がとても親切で安心でした」',
            skillLevel: ['trial'],
            participationStyle: ['solo', 'couple'],
            budgetRange: 'low'
        },
        {
            id: 'miyako-advanced',
            name: '宮古島アドベンチャーダイビング',
            area: 'miyako',
            rating: 4.5,
            grade: 'A級認定',
            tags: ['地形ダイビング', 'ドリフト可能', '上級者向け'],
            price: 16500,
            features: ['🏔️ 地形スペシャリスト', '🌊 ドリフトダイビング', '📊 ログブック管理'],
            jijiComment: 'スキルアップしたい方におすすめ！宮古島の地形ダイビングを存分に楽しめます',
            experience: '「通り池での地形ダイビングは圧巻でした。上級者にも満足できる内容です」',
            skillLevel: ['aow', 'rescue'],
            participationStyle: ['solo', 'group'],
            budgetRange: 'high'
        }
    ];
    
    filteredShops = [...shopData];
    updateShopDisplay();
}

// ===== ショップフィルタリング =====
function filterShops() {
    const area = document.getElementById('area-filter')?.value || '';
    const skill = document.getElementById('skill-filter')?.value || '';
    const style = document.getElementById('style-filter')?.value || '';
    const budget = document.getElementById('budget-filter')?.value || '';
    
    filteredShops = shopData.filter(shop => {
        const areaMatch = !area || shop.area === area;
        const skillMatch = !skill || shop.skillLevel.includes(skill);
        const styleMatch = !style || shop.participationStyle.includes(style);
        const budgetMatch = !budget || shop.budgetRange === budget;
        
        return areaMatch && skillMatch && styleMatch && budgetMatch;
    });
    
    updateShopDisplay();
    
    // フィルタリング結果をJijiコメントで表示
    showFilterResults();
}

// ===== ショップ表示更新 =====
function updateShopDisplay() {
    const resultsContainer = document.getElementById('shop-results');
    if (!resultsContainer) return;
    
    if (filteredShops.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <div class="no-results-content">
                    <div class="jiji-avatar-large">🤿</div>
                    <h3>条件に合うショップが見つかりませんでした</h3>
                    <p>フィルターを調整するか、Jijiに直接相談してみてください</p>
                    <button class="btn-primary" onclick="askJijiRecommendation()">
                        Jijiに相談する
                    </button>
                </div>
            </div>
        `;
        return;
    }
    
    resultsContainer.innerHTML = filteredShops.map(shop => createShopCard(shop)).join('');
}

// ===== ショップカード生成 =====
function createShopCard(shop) {
    const isFeatured = shop.grade === 'S級認定' ? 'featured' : '';
    const stars = '★'.repeat(Math.floor(shop.rating)) + (shop.rating % 1 ? '☆' : '');
    
    return `
        <div class="shop-card ${isFeatured}">
            <div class="shop-badge">${shop.grade}</div>
            <div class="shop-header">
                <h3>${shop.name}</h3>
                <div class="shop-rating">
                    <span class="stars">${stars}</span>
                    <span class="rating-score">${shop.rating}</span>
                </div>
            </div>
            <div class="shop-details">
                <div class="shop-tags">
                    ${shop.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                <div class="shop-price">¥${shop.price.toLocaleString()}/2本</div>
                <div class="shop-features">
                    ${shop.features.map(feature => `<div class="feature">${feature}</div>`).join('')}
                </div>
                <div class="jiji-recommendation">
                    <div class="jiji-avatar-small">🤿</div>
                    <p>${shop.jijiComment}</p>
                </div>
                <div class="experience-preview">
                    <strong>最新の体験談：</strong>
                    <p>${shop.experience}</p>
                </div>
            </div>
            <div class="shop-actions">
                <button class="btn-primary" onclick="viewShopDetails('${shop.id}')">
                    詳細を見る
                </button>
                <button class="btn-secondary" onclick="consultAboutShop('${shop.id}')">
                    Jijiに相談
                </button>
            </div>
        </div>
    `;
}

// ===== フィルタリング結果表示 =====
function showFilterResults() {
    const resultCount = filteredShops.length;
    const totalCount = shopData.length;
    
    // 結果表示用の要素を作成または更新
    let resultMessage = document.querySelector('.filter-results-message');
    if (!resultMessage) {
        resultMessage = document.createElement('div');
        resultMessage.className = 'filter-results-message';
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) {
            searchContainer.appendChild(resultMessage);
        }
    }
    
    if (resultCount === totalCount) {
        resultMessage.innerHTML = '';
        return;
    }
    
    resultMessage.innerHTML = `
        <div class="filter-results">
            <div class="jiji-avatar-small">🤿</div>
            <p>${resultCount}件のショップが見つかりました！${generateFilterComment(resultCount)}</p>
        </div>
    `;
}

// ===== フィルターコメント生成 =====
function generateFilterComment(count) {
    if (count === 0) {
        return 'フィルターを調整するか、僕に直接相談してみてください';
    } else if (count === 1) {
        return 'とても厳選された結果ですね！きっと素晴らしい体験になります';
    } else if (count <= 3) {
        return 'いい感じに絞れましたね！比較検討してみてください';
    } else {
        return 'たくさんの選択肢がありますね！さらに条件を絞ることもできます';
    }
}

// ===== ポイントシステム初期化 =====
function initializePointSystem() {
    // ローカルストレージからポイント情報を取得
    const userPoints = localStorage.getItem('jijiUserPoints') || 0;
    const userRank = calculateUserRank(userPoints);
    
    // ポイント表示要素があれば更新
    updatePointDisplay(userPoints, userRank);
}

// ===== ユーザーランク計算 =====
function calculateUserRank(points) {
    if (points >= 20000) return 'レジェンドダイバー';
    if (points >= 8000) return 'プラチナダイバー';
    if (points >= 3000) return 'ゴールドダイバー';
    if (points >= 1000) return 'シルバーダイバー';
    return 'ブロンズダイバー';
}

// ===== ポイント表示更新 =====
function updatePointDisplay(points, rank) {
    const pointElements = document.querySelectorAll('.user-points');
    const rankElements = document.querySelectorAll('.user-rank');
    
    pointElements.forEach(el => {
        el.textContent = `${points}P`;
    });
    
    rankElements.forEach(el => {
        el.textContent = rank;
    });
}

// ===== イベントハンドラー関数 =====

// LINE相談開始
function openLINE() {
    // 実際にはLINE公式アカウントのURLに遷移
    const lineURL = 'https://line.me/R/ti/p/@jiji-diving';
    
    // アナリティクス記録
    recordEvent('line_consultation_start', {
        source: 'header_button',
        timestamp: new Date().toISOString()
    });
    
    // 確認ダイアログ
    if (confirm('LINE公式アカウントでJijiと相談を始めますか？\n初回登録で200ポイント獲得！')) {
        window.open(lineURL, '_blank');
    }
}

// ダイビング計画開始
function startPlanning() {
    recordEvent('planning_start', {
        source: 'header_button',
        timestamp: new Date().toISOString()
    });
    
    // 簡単なアンケートモーダルを表示
    showQuickSurvey();
}

// ダイビング体験開始
function startJourney() {
    recordEvent('journey_start', {
        source: 'hero_section',
        timestamp: new Date().toISOString()
    });
    
    showQuickSurvey();
}

// 動画視聴
function watchVideo() {
    recordEvent('video_watch', {
        source: 'hero_section',
        timestamp: new Date().toISOString()
    });
    
    // 動画モーダル表示（実装は省略）
    alert('🎥 沖縄の美しい海の動画をお楽しみください！\n（実際にはYouTube動画などが再生されます）');
}

// 詳細海況確認
function checkDetailedWeather() {
    recordEvent('detailed_weather_check', {
        timestamp: new Date().toISOString()
    });
    
    // 詳細ページに遷移（実装は省略）
    alert('📊 詳細な海況予報ページに移動します\n・時間別の波高予測\n・風向変化グラフ\n・透明度予想マップ');
}

// Jijiに海況相談
function askJijiWeather() {
    recordEvent('jiji_weather_consultation', {
        timestamp: new Date().toISOString()
    });
    
    openLINE();
}

// Jijiに不安相談
function consultJiji() {
    recordEvent('anxiety_consultation', {
        timestamp: new Date().toISOString()
    });
    
    openLINE();
}

// ショップ検索
function searchShops() {
    recordEvent('shop_search', {
        area: document.getElementById('area-filter')?.value,
        skill: document.getElementById('skill-filter')?.value,
        style: document.getElementById('style-filter')?.value,
        budget: document.getElementById('budget-filter')?.value,
        timestamp: new Date().toISOString()
    });
    
    filterShops();
    
    // 検索結果セクションにスクロール
    const resultsSection = document.getElementById('shop-results');
    if (resultsSection) {
        resultsSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Jijiにおすすめ相談
function askJijiRecommendation() {
    recordEvent('jiji_recommendation_request', {
        current_filters: {
            area: document.getElementById('area-filter')?.value,
            skill: document.getElementById('skill-filter')?.value,
            style: document.getElementById('style-filter')?.value,
            budget: document.getElementById('budget-filter')?.value
        },
        timestamp: new Date().toISOString()
    });
    
    openLINE();
}

// ショップ詳細表示
function viewShopDetails(shopId) {
    const shop = shopData.find(s => s.id === shopId);
    if (!shop) return;
    
    recordEvent('shop_details_view', {
        shop_id: shopId,
        shop_name: shop.name,
        timestamp: new Date().toISOString()
    });
    
    // 詳細モーダルまたは詳細ページ表示（実装は省略）
    alert(`🏪 ${shop.name}の詳細ページに移動します\n・詳細なサービス内容\n・スタッフ紹介\n・実際の体験談\n・予約カレンダー`);
}

// ショップについてJijiに相談
function consultAboutShop(shopId) {
    const shop = shopData.find(s => s.id === shopId);
    if (!shop) return;
    
    recordEvent('shop_consultation', {
        shop_id: shopId,
        shop_name: shop.name,
        timestamp: new Date().toISOString()
    });
    
    // LINEに事前情報を含めて遷移
    const message = encodeURIComponent(`${shop.name}について詳しく相談したいです`);
    const lineURL = `https://line.me/R/ti/p/@jiji-diving?message=${message}`;
    window.open(lineURL, '_blank');
}

// 詳細相談開始
function startDetailedConsultation() {
    recordEvent('detailed_consultation_start', {
        timestamp: new Date().toISOString()
    });
    
    openLINE();
}

// 体験談投稿
function shareExperience() {
    recordEvent('experience_share_start', {
        timestamp: new Date().toISOString()
    });
    
    // 体験談投稿フォーム表示（実装は省略）
    alert('📝 体験談投稿フォームを開きます\n・150ポイント獲得\n・写真付きで+50ポイント\n・他のユーザーの参考に！');
}

// LINE相談開始（CTA）
function startWithLINE() {
    recordEvent('cta_line_start', {
        source: 'final_cta',
        timestamp: new Date().toISOString()
    });
    
    openLINE();
}

// WEB詳細探索
function exploreWeb() {
    recordEvent('cta_web_explore', {
        source: 'final_cta',
        timestamp: new Date().toISOString()
    });
    
    // 詳細ページに遷移（実装は省略）
    alert('🌐 詳細情報ページに移動します\n・リアルタイム海況\n・全ショップ詳細\n・旅行プラン作成\n・ポイント管理');
}

// ===== 簡単アンケート表示 =====
function showQuickSurvey() {
    const modal = document.createElement('div');
    modal.className = 'survey-modal';
    modal.innerHTML = `
        <div class="survey-content">
            <div class="survey-header">
                <div class="jiji-avatar-large">🤿</div>
                <h3>はいさい！簡単なアンケートにお答えください</h3>
                <p>あなたにピッタリのダイビング体験をご提案します</p>
            </div>
            <div class="survey-form">
                <div class="survey-question">
                    <label>🤿 ダイビング経験レベル</label>
                    <select id="survey-experience">
                        <option value="">選択してください</option>
                        <option value="none">ライセンス取得前</option>
                        <option value="beginner">1-5本</option>
                        <option value="intermediate">6-20本</option>
                        <option value="advanced">21本以上</option>
                    </select>
                </div>
                <div class="survey-question">
                    <label>🏝️ 興味のあるエリア</label>
                    <select id="survey-area">
                        <option value="">選択してください</option>
                        <option value="ishigaki">石垣島</option>
                        <option value="miyako">宮古島</option>
                        <option value="okinawa">沖縄本島</option>
                        <option value="any">どこでも</option>
                    </select>
                </div>
                <div class="survey-question">
                    <label>💰 予算（2本ダイビング）</label>
                    <select id="survey-budget">
                        <option value="">選択してください</option>
                        <option value="low">¥10,000以下</option>
                        <option value="medium">¥10,000-15,000</option>
                        <option value="high">¥15,000以上</option>
                        <option value="flexible">予算は柔軟</option>
                    </select>
                </div>
            </div>
            <div class="survey-actions">
                <button class="btn-primary" onclick="submitSurvey()">
                    🎁 おすすめプランを見る（200ポイント獲得）
                </button>
                <button class="btn-secondary" onclick="closeSurvey()">
                    後で回答する
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // モーダル表示アニメーション
    setTimeout(() => modal.classList.add('show'), 10);
}

// ===== アンケート送信 =====
function submitSurvey() {
    const experience = document.getElementById('survey-experience')?.value;
    const area = document.getElementById('survey-area')?.value;
    const budget = document.getElementById('survey-budget')?.value;
    
    if (!experience || !area || !budget) {
        alert('すべての項目にご回答ください');
        return;
    }
    
    recordEvent('survey_completed', {
        experience,
        area,
        budget,
        timestamp: new Date().toISOString()
    });
    
    // ポイント付与
    addPoints(200);
    
    // おすすめプラン生成
    generateRecommendation(experience, area, budget);
    
    closeSurvey();
}

// ===== アンケートクローズ =====
function closeSurvey() {
    const modal = document.querySelector('.survey-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

// ===== おすすめプラン生成 =====
function generateRecommendation(experience, area, budget) {
    // フィルターを適用
    if (area !== 'any') {
        document.getElementById('area-filter').value = area;
    }
    
    const skillMapping = {
        'none': 'trial',
        'beginner': 'owd',
        'intermediate': 'aow',
        'advanced': 'aow'
    };
    
    if (skillMapping[experience]) {
        document.getElementById('skill-filter').value = skillMapping[experience];
    }
    
    if (budget !== 'flexible') {
        document.getElementById('budget-filter').value = budget;
    }
    
    // ショップ検索実行
    filterShops();
    
    // ショップ検索セクションにスクロール
    const shopSection = document.getElementById('shop-search');
    if (shopSection) {
        shopSection.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
        });
    }
    
    // 成功メッセージ表示
    setTimeout(() => {
        showNotification('🎉 200ポイント獲得！あなたにおすすめのショップを表示しました', 'success');
    }, 1000);
}

// ===== ポイント追加 =====
function addPoints(points) {
    const currentPoints = parseInt(localStorage.getItem('jijiUserPoints') || '0');
    const newPoints = currentPoints + points;
    
    localStorage.setItem('jijiUserPoints', newPoints.toString());
    
    const newRank = calculateUserRank(newPoints);
    updatePointDisplay(newPoints, newRank);
    
    recordEvent('points_earned', {
        points_earned: points,
        total_points: newPoints,
        new_rank: newRank,
        timestamp: new Date().toISOString()
    });
}

// ===== 通知表示 =====
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // アニメーション表示
    setTimeout(() => notification.classList.add('show'), 10);
    
    // 自動非表示
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// ===== イベント記録 =====
function recordEvent(eventName, data) {
    // アナリティクス記録（実際にはGoogle Analytics等に送信）
    console.log('📊 Event:', eventName, data);
    
    // ローカルストレージに記録（開発用）
    const events = JSON.parse(localStorage.getItem('jijiEvents') || '[]');
    events.push({
        event: eventName,
        data: data,
        timestamp: new Date().toISOString()
    });
    
    // 最新100件のみ保持
    if (events.length > 100) {
        events.splice(0, events.length - 100);
    }
    
    localStorage.setItem('jijiEvents', JSON.stringify(events));
}

// ===== CSS動的スタイル追加 =====
const additionalStyles = `
<style>
/* 動的に追加されるスタイル */
.survey-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.survey-modal.show {
    opacity: 1;
}

.survey-content {
    background: white;
    padding: 40px;
    border-radius: 16px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    transform: translateY(20px);
    transition: transform 0.3s ease;
}

.survey-modal.show .survey-content {
    transform: translateY(0);
}

.survey-header {
    text-align: center;
    margin-bottom: 30px;
}

.survey-header h3 {
    color: var(--ocean-blue);
    margin: 16px 0 8px 0;
    font-size: 1.5rem;
}

.survey-header p {
    color: var(--medium-gray);
    margin: 0;
}

.survey-question {
    margin-bottom: 20px;
}

.survey-question label {
    display: block;
    font-weight: 600;
    color: var(--ocean-blue);
    margin-bottom: 8px;
}

.survey-question select {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e9ecef;
    border-radius: 8px;
    font-size: 1rem;
    background: white;
    color: var(--dark-gray);
}

.survey-question select:focus {
    outline: none;
    border-color: var(--ocean-blue);
    box-shadow: 0 0 0 3px rgba(0, 105, 148, 0.1);
}

.survey-actions {
    display: flex;
    gap: 16px;
    margin-top: 30px;
}

.survey-actions .btn-primary,
.survey-actions .btn-secondary {
    flex: 1;
    justify-content: center;
    padding: 16px;
}

.filter-results-message {
    margin-top: 20px;
    background: rgba(0, 105, 148, 0.05);
    border-radius: 8px;
    padding: 16px;
}

.filter-results {
    display: flex;
    gap: 12px;
    align-items: center;
}

.filter-results p {
    margin: 0;
    color: var(--dark-gray);
    font-weight: 500;
}

.no-results {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
}

.no-results-content h3 {
    color: var(--ocean-blue);
    margin: 20px 0 16px 0;
    font-size: 1.5rem;
}

.no-results-content p {
    color: var(--medium-gray);
    margin-bottom: 24px;
    line-height: 1.6;
}

.notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
    z-index: 10001;
    transform: translateX(400px);
    transition: transform 0.3s ease;
    min-width: 300px;
    max-width: 500px;
}

.notification.show {
    transform: translateX(0);
}

.notification-success {
    border-left: 4px solid #28a745;
}

.notification-info {
    border-left: 4px solid var(--ocean-blue);
}

.notification-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
}

.notification-content span {
    color: var(--dark-gray);
    font-weight: 500;
    line-height: 1.4;
}

.notification-content button {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--medium-gray);
    cursor: pointer;
    padding: 0;
    margin-left: 16px;
}

.header.scrolled {
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 2px 20px rgba(0, 0, 0, 0.15);
}

.animate-ready {
    opacity: 0;
    transform: translateY(30px);
    transition: opacity 0.6s ease, transform 0.6s ease;
}

.animate-in {
    opacity: 1;
    transform: translateY(0);
}

@media (max-width: 768px) {
    .survey-content {
        padding: 30px 20px;
        margin: 20px;
    }
    
    .survey-actions {
        flex-direction: column;
    }
    
    .notification {
        right: 10px;
        left: 10px;
        min-width: auto;
        max-width: none;
        transform: translateY(-100px);
    }
    
    .notification.show {
        transform: translateY(0);
    }
}
</style>
`;

// スタイルを追加
document.head.insertAdjacentHTML('beforeend', additionalStyles);

// ===== エクスポート用（必要に応じて） =====
window.JijiWebApp = {
    openLINE,
    startPlanning,
    startJourney,
    searchShops,
    filterShops,
    viewShopDetails,
    consultAboutShop,
    addPoints,
    recordEvent,
    showNotification
};