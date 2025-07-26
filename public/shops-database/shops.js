/**
 * ショップデータベース フロントエンド機能
 * Dive Buddy's ショップ検索・表示システム
 */

// 状態管理
let shopsData = [];
let currentFilters = {};
let isLoading = false;

// DOM要素
const elementsById = {
    'loadingIndicator': null,
    'shopsContainer': null,
    'searchKeyword': null,
    'searchSuggestions': null,
    'areaFilter': null,
    'minPriceFilter': null,
    'maxPriceFilter': null,
    'gradeFilter': null,
    'beginnerFriendlyFilter': null,
    'soloOkFilter': null,
    'femaleInstructorFilter': null,
    'englishSupportFilter': null,
    'pickupServiceFilter': null,
    'photoServiceFilter': null,
    'privateGuideFilter': null,
    'licenseCoursesFilter': null,
    'sortByFilter': null,
    'totalCount': null,
    'statisticsContainer': null
};

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    initializeElements();
    setupEventListeners();
    loadInitialData();
});

// DOM要素初期化
function initializeElements() {
    Object.keys(elementsById).forEach(id => {
        elementsById[id] = document.getElementById(id);
    });
}

// イベントリスナー設定
function setupEventListeners() {
    // 検索フィルター（リアルタイム検索 + 自動補完）
    if (elementsById.searchKeyword) {
        elementsById.searchKeyword.addEventListener('input', debounce(handleSearchInput, 300));
        elementsById.searchKeyword.addEventListener('focus', showSearchSuggestions);
        elementsById.searchKeyword.addEventListener('blur', debounce(hideSearchSuggestions, 200));
        elementsById.searchKeyword.addEventListener('keydown', handleSearchKeyNavigation);
    }
    
    // エリアタブ
    document.querySelectorAll('.area-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            // アクティブタブ切り替え
            document.querySelectorAll('.area-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // フィルター適用
            currentFilters.area = this.dataset.area === 'all' ? null : this.dataset.area;
            applyFilters();
        });
    });
    
    // 新しいフィルター要素
    const newFilterIds = [
        'minPriceFilter', 'maxPriceFilter', 'gradeFilter', 'beginnerFriendlyFilter', 
        'soloOkFilter', 'femaleInstructorFilter', 'englishSupportFilter', 
        'pickupServiceFilter', 'photoServiceFilter', 'privateGuideFilter', 
        'licenseCoursesFilter', 'sortByFilter'
    ];
    
    newFilterIds.forEach(filterId => {
        if (elementsById[filterId]) {
            elementsById[filterId].addEventListener('change', applyFilters);
        }
    });
    
    // Jiji推薦ボタン
    const jijiRecommendBtn = document.getElementById('jijiRecommendBtn');
    if (jijiRecommendBtn) {
        jijiRecommendBtn.addEventListener('click', loadJijiRecommendations);
    }
    
    // 初心者向けボタン
    const beginnerFilterBtn = document.getElementById('beginnerFilterBtn');
    if (beginnerFilterBtn) {
        beginnerFilterBtn.addEventListener('click', () => {
            currentFilters = { beginnerFriendly: true };
            updateUI();
            applyFilters();
        });
    }
}

// 初期データ読み込み
async function loadInitialData() {
    await Promise.all([
        loadShopsData(),
        loadStatistics()
    ]);
}

// ショップデータ読み込み
async function loadShopsData(filters = {}) {
    if (isLoading) return;
    
    try {
        isLoading = true;
        showLoading(true);
        
        // APIパラメータ構築
        const params = new URLSearchParams();
        Object.entries({ ...currentFilters, ...filters }).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });
        
        console.log('🏪 ショップデータ取得中...', params.toString());
        
        const response = await fetch(`/api/shops?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            shopsData = result.data || [];
            console.log(`✅ ショップデータ取得成功: ${shopsData.length}件`);
            renderShopsData(shopsData);
            updateResultsCount(shopsData.length);
        } else {
            throw new Error(result.message || 'ショップデータ取得失敗');
        }
        
    } catch (error) {
        console.error('❌ ショップデータ取得エラー:', error);
        showError('ショップデータの取得に失敗しました。しばらく後にもう一度お試しください。');
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

// 統計データ読み込み
async function loadStatistics() {
    try {
        const response = await fetch('/api/shops/statistics');
        
        if (!response.ok) return;
        
        const result = await response.json();
        
        if (result.success && result.data) {
            renderStatistics(result.data);
        }
        
    } catch (error) {
        console.error('⚠️ 統計データ取得エラー:', error);
    }
}

// Jiji AI推薦取得
async function loadJijiRecommendations() {
    try {
        showLoading(true);
        
        // ユーザー嗜好を推定（今後アンケート連携予定）
        const userPreferences = {
            isBeginners: true,
            isSolo: false,
            preferFemaleInstructor: false,
            preferredArea: currentFilters.area || null,
            maxBudget: currentFilters.maxPrice || null
        };
        
        const params = new URLSearchParams(userPreferences);
        
        const response = await fetch(`/api/shops/recommendations?${params.toString()}`);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            shopsData = result.data || [];
            console.log(`✅ Jiji推薦ショップ取得成功: ${shopsData.length}件`);
            renderShopsData(shopsData, true); // 推薦モード
            updateResultsCount(shopsData.length, 'Jiji AI推薦');
        }
        
    } catch (error) {
        console.error('❌ Jiji推薦取得エラー:', error);
        showError('AI推薦の取得に失敗しました。');
    } finally {
        showLoading(false);
    }
}

// 検索入力ハンドリング（リアルタイム検索 + 自動補完）
async function handleSearchInput() {
    const keyword = elementsById.searchKeyword?.value || '';
    
    if (keyword.length >= 2) {
        await generateSearchSuggestions(keyword);
        showSearchSuggestions();
    } else {
        hideSearchSuggestions();
    }
    
    applyFilters();
}

// 検索候補生成
async function generateSearchSuggestions(keyword) {
    if (!elementsById.searchSuggestions) return;
    
    try {
        // ショップ名、エリア、サービス内容から候補を生成
        const suggestions = [];
        
        // エリア候補
        const areas = ['石垣島', '宮古島', '沖縄本島'];
        areas.forEach(area => {
            if (area.includes(keyword) || area.toLowerCase().includes(keyword.toLowerCase())) {
                suggestions.push({ type: 'area', text: area, icon: '🏝️' });
            }
        });
        
        // サービス候補
        const services = [
            { name: '体験ダイビング', icon: '🤿' },
            { name: 'ファンダイビング', icon: '🐠' },
            { name: 'ライセンス取得', icon: '📜' },
            { name: '初心者歓迎', icon: '🔰' },
            { name: '女性インストラクター', icon: '👩‍🏫' },
            { name: '写真撮影', icon: '📸' },
            { name: '送迎サービス', icon: '🚐' }
        ];
        
        services.forEach(service => {
            if (service.name.includes(keyword)) {
                suggestions.push({ type: 'service', text: service.name, icon: service.icon });
            }
        });
        
        // 人気検索候補
        if (keyword.length === 1) {
            const popularSearches = [
                { text: 'マンタ', icon: '🐠' },
                { text: '青の洞窟', icon: '💙' },
                { text: 'ウミガメ', icon: '🐢' },
                { text: 'プレミアム', icon: '🌟' }
            ];
            
            popularSearches.forEach(search => {
                if (search.text.includes(keyword)) {
                    suggestions.push({ type: 'popular', text: search.text, icon: search.icon });
                }
            });
        }
        
        renderSearchSuggestions(suggestions.slice(0, 8)); // 最大8件
        
    } catch (error) {
        console.error('検索候補生成エラー:', error);
    }
}

// 検索候補表示
function renderSearchSuggestions(suggestions) {
    if (!elementsById.searchSuggestions || suggestions.length === 0) {
        hideSearchSuggestions();
        return;
    }
    
    const html = suggestions.map((suggestion, index) => `
        <div class="suggestion-item" data-index="${index}" data-text="${suggestion.text}">
            ${suggestion.icon} ${suggestion.text}
        </div>
    `).join('');
    
    elementsById.searchSuggestions.innerHTML = html;
    
    // 候補項目クリックイベント
    elementsById.searchSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const text = item.dataset.text;
            elementsById.searchKeyword.value = text;
            hideSearchSuggestions();
            applyFilters();
        });
    });
}

// 検索候補表示
function showSearchSuggestions() {
    if (elementsById.searchSuggestions && elementsById.searchSuggestions.children.length > 0) {
        elementsById.searchSuggestions.style.display = 'block';
    }
}

// 検索候補非表示
function hideSearchSuggestions() {
    if (elementsById.searchSuggestions) {
        elementsById.searchSuggestions.style.display = 'none';
    }
}

// キーナビゲーション
function handleSearchKeyNavigation(event) {
    if (!elementsById.searchSuggestions || elementsById.searchSuggestions.style.display === 'none') return;
    
    const suggestions = elementsById.searchSuggestions.querySelectorAll('.suggestion-item');
    const selected = elementsById.searchSuggestions.querySelector('.suggestion-item.selected');
    let selectedIndex = selected ? parseInt(selected.dataset.index) : -1;
    
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
        updateSelectedSuggestion(suggestions, selectedIndex);
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, -1);
        updateSelectedSuggestion(suggestions, selectedIndex);
    } else if (event.key === 'Enter' && selected) {
        event.preventDefault();
        selected.click();
    } else if (event.key === 'Escape') {
        hideSearchSuggestions();
    }
}

// 選択候補更新
function updateSelectedSuggestion(suggestions, selectedIndex) {
    suggestions.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
    });
}

// フィルター適用（拡張版）
function applyFilters() {
    // 現在のフィルター値を収集
    currentFilters = {
        keyword: elementsById.searchKeyword?.value || null,
        area: document.querySelector('.area-tab.active')?.dataset.area === 'all' ? null : document.querySelector('.area-tab.active')?.dataset.area,
        minPrice: elementsById.minPriceFilter?.value || null,
        maxPrice: elementsById.maxPriceFilter?.value || null,
        grade: elementsById.gradeFilter?.value || null,
        beginnerFriendly: elementsById.beginnerFriendlyFilter?.checked || null,
        soloOk: elementsById.soloOkFilter?.checked || null,
        femaleInstructor: elementsById.femaleInstructorFilter?.checked || null,
        englishSupport: elementsById.englishSupportFilter?.checked || null,
        pickupService: elementsById.pickupServiceFilter?.checked || null,
        photoService: elementsById.photoServiceFilter?.checked || null,
        privateGuide: elementsById.privateGuideFilter?.checked || null,
        licenseCoursesAvailable: elementsById.licenseCoursesFilter?.checked || null,
        sortBy: elementsById.sortByFilter?.value || 'grade'
    };
    
    // null値を削除
    Object.keys(currentFilters).forEach(key => {
        if (currentFilters[key] === null || currentFilters[key] === undefined || currentFilters[key] === '') {
            delete currentFilters[key];
        }
    });
    
    console.log('🔍 フィルター適用:', currentFilters);
    
    // データ再取得
    loadShopsData(currentFilters);
}

// ショップデータ表示
function renderShopsData(shops, isRecommendation = false) {
    const container = elementsById.shopsContainer;
    if (!container) return;
    
    container.innerHTML = '';
    
    if (shops.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <div class="no-results-icon">🔍</div>
                <h3>該当するショップが見つかりません</h3>
                <p>検索条件を変更してお試しください。</p>
                <button onclick="clearAllFilters()" class="btn-secondary">フィルターをクリア</button>
            </div>
        `;
        return;
    }
    
    shops.forEach(shop => {
        const shopCard = createShopCard(shop, isRecommendation);
        container.appendChild(shopCard);
    });
    
    // アニメーション適用
    container.classList.add('fade-in');
}

// ショップカード作成
function createShopCard(shop, isRecommendation = false) {
    const card = document.createElement('div');
    card.className = 'shop-card';
    
    // グレードバッジ
    const gradeBadge = getGradeBadge(shop.jiji_grade);
    
    // 価格表示
    const priceDisplay = shop.trial_dive_price_beach ? 
        `¥${shop.trial_dive_price_beach.toLocaleString()}〜` : '料金要確認';
    
    // 推薦情報
    const recommendationInfo = isRecommendation && shop.jiji_match_score ? `
        <div class="recommendation-info">
            <div class="match-score">マッチ度: ${shop.jiji_match_score}%</div>
            <div class="recommendation-reason">${shop.recommendation_reason || ''}</div>
        </div>
    ` : '';
    
    // サービスアイコン
    const services = [];
    if (shop.beginner_friendly) services.push('<span class="service-icon" title="初心者歓迎">🔰</span>');
    if (shop.solo_participant_ok) services.push('<span class="service-icon" title="一人参加OK">👤</span>');
    if (shop.female_instructor_available) services.push('<span class="service-icon" title="女性インストラクター">👩‍🏫</span>');
    if (shop.photo_service_available) services.push('<span class="service-icon" title="写真サービス">📸</span>');
    if (shop.pickup_service_available) services.push('<span class="service-icon" title="送迎サービス">🚐</span>');
    
    card.innerHTML = `
        <div class="shop-card-header">
            <div class="shop-grade-badge ${shop.jiji_grade}">${gradeBadge}</div>
            <div class="shop-area">${shop.area}</div>
        </div>
        
        <div class="shop-main-info">
            <h3 class="shop-name">${shop.shop_name}</h3>
            <div class="shop-services">
                ${services.join(' ')}
            </div>
        </div>
        
        <div class="shop-details">
            <div class="shop-options">${shop.trial_dive_options || '体験ダイビング'}</div>
            <div class="shop-hours">営業: ${shop.operating_hours || '要確認'}</div>
        </div>
        
        <div class="shop-pricing">
            <div class="price-main">体験ダイビング: ${priceDisplay}</div>
            ${shop.fun_dive_available ? `<div class="price-fun">ファンダイビング: ¥${shop.fun_dive_price_2tanks?.toLocaleString() || '要確認'}</div>` : ''}
        </div>
        
        ${recommendationInfo}
        
        <div class="shop-actions">
            <button class="btn-primary" onclick="viewShopDetails('${shop.shop_id}')">
                詳細を見る
            </button>
            <button class="btn-secondary" onclick="contactShop('${shop.shop_id}')">
                問い合わせ
            </button>
        </div>
    `;
    
    return card;
}

// グレードバッジ取得
function getGradeBadge(grade) {
    const badges = {
        'premium': '🌟 プレミアム',
        'standard': '⭐ スタンダード',
        'basic': '⚪ ベーシック'
    };
    return badges[grade] || '⚪ ベーシック';
}

// 統計情報表示
function renderStatistics(stats) {
    const container = elementsById.statisticsContainer;
    if (!container || !stats) return;
    
    container.innerHTML = `
        <div class="stats-summary">
            <div class="stat-item">
                <div class="stat-number">${stats.total_shops || 79}</div>
                <div class="stat-label">総店舗数</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.by_area?.['石垣島'] || 32}</div>
                <div class="stat-label">石垣島</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.by_area?.['宮古島'] || 24}</div>
                <div class="stat-label">宮古島</div>
            </div>
            <div class="stat-item">
                <div class="stat-number">${stats.by_area?.['沖縄本島'] || 23}</div>
                <div class="stat-label">沖縄本島</div>
            </div>
        </div>
    `;
}

// 結果件数更新
function updateResultsCount(count, label = '検索結果') {
    if (elementsById.totalCount) {
        elementsById.totalCount.textContent = `${label}: ${count}件`;
    }
}

// ローディング表示制御
function showLoading(show) {
    const loading = elementsById.loadingIndicator;
    const container = elementsById.shopsContainer;
    
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
    
    if (container) {
        container.style.opacity = show ? '0.5' : '1';
    }
}

// エラー表示
function showError(message) {
    const container = elementsById.shopsContainer;
    if (!container) return;
    
    container.innerHTML = `
        <div class="error-message">
            <div class="error-icon">❌</div>
            <h3>エラーが発生しました</h3>
            <p>${message}</p>
            <button onclick="loadShopsData()" class="btn-primary">再試行</button>
        </div>
    `;
}

// ショップ詳細表示
function viewShopDetails(shopId) {
    // 詳細ページまたはモーダル表示
    window.location.href = `/shops-database/details.html?id=${shopId}`;
}

// ショップ問い合わせ
function contactShop(shopId) {
    const shop = shopsData.find(s => s.shop_id === shopId);
    if (!shop) return;
    
    // 問い合わせ確認ダイアログ
    const confirmed = confirm(`${shop.shop_name}に問い合わせしますか？\n\n電話番号: ${shop.phone_line || '要確認'}\nWebサイト: ${shop.website || 'なし'}`);
    
    if (confirmed && shop.website) {
        window.open(shop.website, '_blank');
    }
}

// フィルタークリア（拡張版）
function clearAllFilters() {
    // フォーム要素リセット
    if (elementsById.searchKeyword) elementsById.searchKeyword.value = '';
    if (elementsById.minPriceFilter) elementsById.minPriceFilter.value = '';
    if (elementsById.maxPriceFilter) elementsById.maxPriceFilter.value = '';
    if (elementsById.gradeFilter) elementsById.gradeFilter.value = '';
    if (elementsById.beginnerFriendlyFilter) elementsById.beginnerFriendlyFilter.checked = false;
    if (elementsById.soloOkFilter) elementsById.soloOkFilter.checked = false;
    if (elementsById.femaleInstructorFilter) elementsById.femaleInstructorFilter.checked = false;
    if (elementsById.englishSupportFilter) elementsById.englishSupportFilter.checked = false;
    if (elementsById.pickupServiceFilter) elementsById.pickupServiceFilter.checked = false;
    if (elementsById.photoServiceFilter) elementsById.photoServiceFilter.checked = false;
    if (elementsById.privateGuideFilter) elementsById.privateGuideFilter.checked = false;
    if (elementsById.licenseCoursesFilter) elementsById.licenseCoursesFilter.checked = false;
    if (elementsById.sortByFilter) elementsById.sortByFilter.value = 'grade';
    
    // エリアタブリセット
    document.querySelectorAll('.area-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.area === 'all') {
            tab.classList.add('active');
        }
    });
    
    // 検索候補非表示
    hideSearchSuggestions();
    
    // フィルター適用
    currentFilters = {};
    applyFilters();
}

// UI更新
function updateUI() {
    // フィルター状態をUIに反映
    Object.entries(currentFilters).forEach(([key, value]) => {
        const element = elementsById[key + 'Filter'] || elementsById[key];
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = value;
            } else {
                element.value = value;
            }
        }
    });
}

// デバウンス関数
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// エクスポート（テスト用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadShopsData,
        applyFilters,
        createShopCard,
        getGradeBadge
    };
}