/**
 * Jiji統合サイト共通JavaScript
 * Phase 6-A: 統合Webサイト構築
 */

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', function() {
    initializeCommonFeatures();
    setupAnalytics();
    setupAnimations();
});

// ===== 共通機能初期化 =====
function initializeCommonFeatures() {
    setupNavigation();
    setupSmoothScroll();
    setupFormValidation();
    setupLoadingStates();
    console.log('🌊 Jiji Common Features Initialized');
}

// ===== ナビゲーション設定 =====
function setupNavigation() {
    const hamburger = document.querySelector('.nav-hamburger');
    const navMenu = document.querySelector('.main-nav-menu');
    
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            hamburger.classList.toggle('active');
            
            // ハンバーガーアニメーション
            const spans = hamburger.querySelectorAll('span');
            if (hamburger.classList.contains('active')) {
                spans[0].style.transform = 'rotate(-45deg) translate(-5px, 6px)';
                spans[1].style.opacity = '0';
                spans[2].style.transform = 'rotate(45deg) translate(-5px, -6px)';
            } else {
                spans.forEach(span => {
                    span.style.transform = 'none';
                    span.style.opacity = '1';
                });
            }
        });
        
        // メニュー外クリックで閉じる
        document.addEventListener('click', function(e) {
            if (!hamburger.contains(e.target) && !navMenu.contains(e.target)) {
                navMenu.classList.remove('active');
                hamburger.classList.remove('active');
                
                const spans = hamburger.querySelectorAll('span');
                spans.forEach(span => {
                    span.style.transform = 'none';
                    span.style.opacity = '1';
                });
            }
        });
    }
}

// ===== スムーススクロール =====
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const headerHeight = document.querySelector('.main-header')?.offsetHeight || 0;
                const targetPosition = target.offsetTop - headerHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// ===== フォームバリデーション =====
function setupFormValidation() {
    const forms = document.querySelectorAll('form[data-validate]');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            if (!validateForm(this)) {
                e.preventDefault();
            }
        });
        
        // リアルタイムバリデーション
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                validateField(this);
            });
        });
    });
}

function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    
    inputs.forEach(input => {
        if (!validateField(input)) {
            isValid = false;
        }
    });
    
    return isValid;
}

function validateField(field) {
    const value = field.value.trim();
    const fieldType = field.type;
    let isValid = true;
    let message = '';
    
    // 必須チェック
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        message = 'この項目は必須です';
    }
    
    // メールバリデーション
    if (fieldType === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
            message = '正しいメールアドレスを入力してください';
        }
    }
    
    // 電話番号バリデーション
    if (fieldType === 'tel' && value) {
        const phoneRegex = /^[\d\-\(\)\+\s]+$/;
        if (!phoneRegex.test(value)) {
            isValid = false;
            message = '正しい電話番号を入力してください';
        }
    }
    
    // エラー表示/非表示
    showFieldError(field, isValid ? null : message);
    
    return isValid;
}

function showFieldError(field, message) {
    const errorElement = field.nextElementSibling?.classList.contains('field-error') 
        ? field.nextElementSibling 
        : null;
    
    if (message) {
        field.classList.add('error');
        
        if (!errorElement) {
            const error = document.createElement('div');
            error.className = 'field-error';
            error.textContent = message;
            field.parentNode.insertBefore(error, field.nextSibling);
        } else {
            errorElement.textContent = message;
        }
    } else {
        field.classList.remove('error');
        if (errorElement) {
            errorElement.remove();
        }
    }
}

// ===== ローディング状態管理 =====
function setupLoadingStates() {
    window.showLoading = function(element, text = 'Loading...') {
        const button = element.tagName === 'BUTTON' ? element : element.querySelector('button');
        if (button) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = `<span class="loading-spinner"></span> ${text}`;
        }
    };
    
    window.hideLoading = function(element) {
        const button = element.tagName === 'BUTTON' ? element : element.querySelector('button');
        if (button) {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    };
}

// ===== アニメーション設定 =====
function setupAnimations() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                
                // カウンターアニメーション
                if (entry.target.classList.contains('counter')) {
                    animateCounter(entry.target);
                }
                
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // 監視対象要素を登録
    document.querySelectorAll('.card, .stat-card, .counter, .animate-on-scroll').forEach(el => {
        observer.observe(el);
    });
}

// ===== カウンターアニメーション =====
function animateCounter(element) {
    const target = parseInt(element.dataset.target) || parseInt(element.textContent);
    const duration = 2000; // 2秒
    const step = target / (duration / 16); // 60fps
    let current = 0;
    
    const timer = setInterval(() => {
        current += step;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}

// ===== 分析・トラッキング =====
function setupAnalytics() {
    // Google Analytics 4 設定
    const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // 実際のGA IDに置き換え
    
    // GA4スクリプトの動的読み込み
    loadGoogleAnalytics(GA_MEASUREMENT_ID);
    
    // Google Tag Manager設定
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() {
        dataLayer.push(arguments);
    };
    
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
        custom_map: {
            'custom_parameter_1': 'user_type',
            'custom_parameter_2': 'diving_experience'
        }
    });
    
    // イベントトラッキング関数
    window.trackEvent = function(eventName, parameters = {}) {
        if (typeof gtag === 'function') {
            gtag('event', eventName, {
                ...parameters,
                page_path: window.location.pathname,
                page_title: document.title,
                timestamp: new Date().toISOString()
            });
        }
        
        // 開発環境でのログ出力
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('📊 Event tracked:', eventName, parameters);
        }
        
        // カスタムイベントをdataLayerにも送信
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: eventName,
            ...parameters
        });
    };
    
    // コンバージョントラッキング
    window.trackConversion = function(conversionType, value = 0) {
        gtag('event', 'conversion', {
            send_to: GA_MEASUREMENT_ID,
            value: value,
            currency: 'JPY',
            conversion_type: conversionType
        });
    };
    
    // 自動トラッキング設定
    setupAutoTracking();
    setupEcommerceTracking();
}

function loadGoogleAnalytics(measurementId) {
    // GA4スクリプトの動的読み込み
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
}

function setupAutoTracking() {
    // CTAボタンクリック追跡
    document.querySelectorAll('.btn-primary, .btn-cta').forEach(button => {
        button.addEventListener('click', function() {
            trackEvent('cta_click', {
                button_text: this.textContent.trim(),
                button_location: this.closest('section')?.id || 'unknown'
            });
        });
    });
    
    // 外部リンククリック追跡
    document.querySelectorAll('a[href^="http"], a[target="_blank"]').forEach(link => {
        link.addEventListener('click', function() {
            trackEvent('external_link_click', {
                link_url: this.href,
                link_text: this.textContent.trim()
            });
        });
    });
    
    // フォーム送信追跡
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', function() {
            trackEvent('form_submit', {
                form_id: this.id || 'unknown',
                form_action: this.action || window.location.pathname
            });
        });
    });
    
    // スクロール深度追跡
    let maxScrollPercentage = 0;
    window.addEventListener('scroll', throttle(() => {
        const scrollPercentage = Math.round(
            (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
        );
        
        if (scrollPercentage > maxScrollPercentage) {
            maxScrollPercentage = scrollPercentage;
            
            // 25%, 50%, 75%, 100%の節目でイベント送信
            if ([25, 50, 75, 100].includes(scrollPercentage)) {
                trackEvent('scroll_depth', {
                    percentage: scrollPercentage
                });
            }
        }
    }, 1000));
}

function setupEcommerceTracking() {
    // プレミアムプラン購入追跡
    window.trackPurchase = function(planType, value, currency = 'JPY') {
        gtag('event', 'purchase', {
            transaction_id: `txn_${Date.now()}`,
            value: value,
            currency: currency,
            items: [{
                item_id: `plan_${planType}`,
                item_name: `Jiji ${planType} プラン`,
                category: 'subscription',
                price: value,
                quantity: 1
            }]
        });
        
        trackConversion('purchase', value);
    };
    
    // リード生成追跡
    window.trackLead = function(leadType, value = 0) {
        gtag('event', 'generate_lead', {
            lead_type: leadType,
            value: value,
            currency: 'JPY'
        });
        
        trackConversion('lead', value);
    };
    
    // ダイビングショップ予約追跡
    window.trackBooking = function(shopId, shopName, bookingValue) {
        gtag('event', 'booking', {
            shop_id: shopId,
            shop_name: shopName,
            value: bookingValue,
            currency: 'JPY'
        });
        
        trackConversion('booking', bookingValue);
    };
}

// ===== ユーティリティ関数 =====
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// ===== API関連ユーティリティ =====
window.jijiAPI = {
    baseURL: '',
    
    async request(endpoint, options = {}) {
        const url = this.baseURL + endpoint;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `HTTP error! status: ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },
    
    async get(endpoint) {
        return this.request(endpoint);
    },
    
    async post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }
};

// ===== 通知システム =====
window.showNotification = function(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // 通知コンテナがなければ作成
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    
    container.appendChild(notification);
    
    // 閉じるボタン
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
    
    // 自動削除
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, duration);
    }
    
    return notification;
};

// ===== SEO・構造化データ =====
function setupSEOOptimization() {
    // 構造化データの動的生成
    generateStructuredData();
    
    // メタタグの最適化
    optimizeMetaTags();
    
    // パフォーマンス監視
    setupPerformanceMonitoring();
    
    // Core Web Vitals測定
    measureWebVitals();
}

function generateStructuredData() {
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Jiji AI感情分析ダイビングマッチング",
        "description": "初心者ダイバーの『できない』を『できる』に変える魔法の存在。AI感情分析×79店舗データベースで最適なダイビング体験を提供します。",
        "url": window.location.origin,
        "applicationCategory": "TravelApplication",
        "operatingSystem": "Web",
        "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "JPY",
            "availability": "https://schema.org/InStock"
        },
        "provider": {
            "@type": "Organization",
            "name": "Jiji",
            "description": "AI感情分析ダイビングマッチングサービス"
        },
        "aggregateRating": {
            "@type": "AggregateRating",
            "ratingValue": "4.8",
            "ratingCount": "156",
            "bestRating": "5"
        },
        "featureList": [
            "AI感情分析（6カテゴリ）",
            "79店舗データベース",
            "LINE Bot相談",
            "Web App体験",
            "ショップマッチング",
            "パートナーシップ"
        ]
    };
    
    // 構造化データの挿入
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);
}

function optimizeMetaTags() {
    // ページタイトルの最適化
    if (document.title.length > 60) {
        console.warn('⚠️ Page title is too long (>60 characters):', document.title);
    }
    
    // メタディスクリプションの確認
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        const descLength = metaDescription.content.length;
        if (descLength > 160) {
            console.warn('⚠️ Meta description is too long (>160 characters):', descLength);
        }
    }
    
    // 動的メタタグ追加
    addDynamicMetaTags();
}

function addDynamicMetaTags() {
    const existingTags = {};
    document.querySelectorAll('meta').forEach(meta => {
        if (meta.name) existingTags[meta.name] = true;
        if (meta.property) existingTags[meta.property] = true;
    });
    
    // 必要なメタタグを追加
    const metaTags = [
        { name: 'robots', content: 'index,follow' },
        { name: 'author', content: 'Jiji Development Team' },
        { name: 'theme-color', content: '#667eea' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Jiji AI感情分析ダイビングマッチング' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:site', content: '@JijiDiving' }
    ];
    
    metaTags.forEach(tag => {
        const key = tag.name || tag.property;
        if (!existingTags[key]) {
            const meta = document.createElement('meta');
            if (tag.name) meta.name = tag.name;
            if (tag.property) meta.property = tag.property;
            meta.content = tag.content;
            document.head.appendChild(meta);
        }
    });
}

function setupPerformanceMonitoring() {
    // Resource Timing API
    if ('performance' in window) {
        window.addEventListener('load', () => {
            // ページロード時間の詳細測定
            const perfData = performance.timing;
            const loadTime = perfData.loadEventEnd - perfData.navigationStart;
            const domContentLoaded = perfData.domContentLoadedEventEnd - perfData.navigationStart;
            
            // Paint Timing API
            const paintMetrics = performance.getEntriesByType('paint');
            const firstPaint = paintMetrics.find(entry => entry.name === 'first-paint')?.startTime || 0;
            const firstContentfulPaint = paintMetrics.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
            
            trackEvent('page_performance', {
                load_time: loadTime,
                dom_content_loaded: domContentLoaded,
                first_paint: Math.round(firstPaint),
                first_contentful_paint: Math.round(firstContentfulPaint),
                navigation_type: performance.navigation.type
            });
            
            // パフォーマンス警告
            if (loadTime > 3000) {
                console.warn('⚠️ Page load time is slow:', loadTime + 'ms');
            }
        });
    }
    
    // Navigation Timing API
    if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.entryType === 'navigation') {
                    trackEvent('navigation_timing', {
                        dns_lookup: entry.domainLookupEnd - entry.domainLookupStart,
                        tcp_connection: entry.connectEnd - entry.connectStart,
                        request_response: entry.responseEnd - entry.requestStart,
                        dom_processing: entry.domContentLoadedEventEnd - entry.responseEnd
                    });
                }
            });
        });
        
        observer.observe({ entryTypes: ['navigation'] });
    }
}

function measureWebVitals() {
    // Core Web Vitals測定
    if ('PerformanceObserver' in window) {
        // Largest Contentful Paint (LCP)
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            
            trackEvent('core_web_vitals', {
                metric: 'LCP',
                value: Math.round(lastEntry.startTime),
                rating: lastEntry.startTime < 2500 ? 'good' : lastEntry.startTime < 4000 ? 'needs_improvement' : 'poor'
            });
        });
        
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        
        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                trackEvent('core_web_vitals', {
                    metric: 'FID',
                    value: Math.round(entry.processingStart - entry.startTime),
                    rating: entry.processingStart - entry.startTime < 100 ? 'good' : 
                           entry.processingStart - entry.startTime < 300 ? 'needs_improvement' : 'poor'
                });
            });
        });
        
        fidObserver.observe({ entryTypes: ['first-input'] });
        
        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            });
            
            trackEvent('core_web_vitals', {
                metric: 'CLS',
                value: clsValue,
                rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs_improvement' : 'poor'
            });
        });
        
        clsObserver.observe({ entryTypes: ['layout-shift'] });
    }
}

// ===== パフォーマンス監視 =====
if ('performance' in window) {
    window.addEventListener('load', () => {
        // ページロード時間の測定
        const perfData = performance.timing;
        const loadTime = perfData.loadEventEnd - perfData.navigationStart;
        
        trackEvent('page_performance', {
            load_time: loadTime,
            dom_content_loaded: perfData.domContentLoadedEventEnd - perfData.navigationStart,
            first_paint: performance.getEntriesByType('paint')[0]?.startTime || 0
        });
    });
}

// SEO最適化の初期化
document.addEventListener('DOMContentLoaded', function() {
    setupSEOOptimization();
});