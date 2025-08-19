/**
 * Dive Buddy's パフォーマンス最適化JavaScript
 * Core Web Vitals改善・SEO強化・ユーザー体験向上
 */

(function() {
    'use strict';

    // ========== Critical Performance Initialization ==========
    
    // パフォーマンス監視
    const perfMonitor = {
        // Core Web Vitals測定
        measureCoreWebVitals: function() {
            // LCP (Largest Contentful Paint)
            if ('PerformanceObserver' in window) {
                const lcpObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    console.log('LCP:', lastEntry.startTime);
                    
                    // Analytics送信（実装時）
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'web_vitals', {
                            event_category: 'performance',
                            event_label: 'LCP',
                            value: Math.round(lastEntry.startTime),
                            non_interaction: true
                        });
                    }
                });
                
                try {
                    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                } catch (e) {
                    console.warn('LCP measurement not supported');
                }

                // FID (First Input Delay)
                const fidObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    entries.forEach((entry) => {
                        console.log('FID:', entry.processingStart - entry.startTime);
                        
                        if (typeof gtag !== 'undefined') {
                            gtag('event', 'web_vitals', {
                                event_category: 'performance',
                                event_label: 'FID',
                                value: Math.round(entry.processingStart - entry.startTime),
                                non_interaction: true
                            });
                        }
                    });
                });
                
                try {
                    fidObserver.observe({ entryTypes: ['first-input'] });
                } catch (e) {
                    console.warn('FID measurement not supported');
                }

                // CLS (Cumulative Layout Shift)
                let clsValue = 0;
                let clsEntries = [];
                const clsObserver = new PerformanceObserver((entryList) => {
                    const entries = entryList.getEntries();
                    entries.forEach((entry) => {
                        if (!entry.hadRecentInput) {
                            clsEntries.push(entry);
                            clsValue += entry.value;
                        }
                    });
                    
                    console.log('CLS:', clsValue);
                    
                    if (typeof gtag !== 'undefined') {
                        gtag('event', 'web_vitals', {
                            event_category: 'performance',
                            event_label: 'CLS',
                            value: Math.round(clsValue * 1000),
                            non_interaction: true
                        });
                    }
                });
                
                try {
                    clsObserver.observe({ entryTypes: ['layout-shift'] });
                } catch (e) {
                    console.warn('CLS measurement not supported');
                }
            }
        },

        // ページ読み込み時間測定
        measureLoadTime: function() {
            window.addEventListener('load', function() {
                const navigationTiming = performance.getEntriesByType('navigation')[0];
                if (navigationTiming) {
                    const loadTime = navigationTiming.loadEventEnd - navigationTiming.fetchStart;
                    console.log('Page Load Time:', loadTime + 'ms');
                    
                    // 3秒以上の場合は警告
                    if (loadTime > 3000) {
                        console.warn('Page load time is slow:', loadTime + 'ms');
                    }
                }
            });
        }
    };

    // ========== Lazy Loading Implementation ==========
    
    const lazyLoader = {
        // Intersection Observer設定
        observer: null,
        
        init: function() {
            if ('IntersectionObserver' in window) {
                this.observer = new IntersectionObserver((entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting) {
                            this.loadElement(entry.target);
                            this.observer.unobserve(entry.target);
                        }
                    });
                }, {
                    rootMargin: '50px'  // 50px手前で読み込み開始
                });
                
                // lazy-loadクラスの要素を監視
                document.querySelectorAll('.lazy-load').forEach((el) => {
                    this.observer.observe(el);
                });
                
                // 画像の遅延読み込み
                document.querySelectorAll('img[data-src]').forEach((img) => {
                    this.observer.observe(img);
                });
            } else {
                // Intersection Observer非対応の場合のフォールバック
                this.loadAllImages();
            }
        },
        
        loadElement: function(element) {
            // 画像の場合
            if (element.tagName === 'IMG' && element.hasAttribute('data-src')) {
                element.src = element.getAttribute('data-src');
                element.removeAttribute('data-src');
                element.classList.add('loaded');
            }
            
            // その他の要素
            if (element.classList.contains('lazy-load')) {
                element.classList.add('loaded');
            }
            
            // 背景画像の場合
            if (element.hasAttribute('data-bg')) {
                element.style.backgroundImage = `url(${element.getAttribute('data-bg')})`;
                element.removeAttribute('data-bg');
            }
        },
        
        loadAllImages: function() {
            // フォールバック: 全画像を即座に読み込み
            document.querySelectorAll('img[data-src]').forEach((img) => {
                this.loadElement(img);
            });
        }
    };

    // ========== Resource Optimization ==========
    
    const resourceOptimizer = {
        // CSS Critical Path最適化
        optimizeCSSLoading: function() {
            // 非クリティカルCSSの遅延読み込み
            const nonCriticalCSS = [
                '/css/non-critical.css',
                '/css/animations.css'
            ];
            
            nonCriticalCSS.forEach((href) => {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = href;
                link.media = 'print';  // 一旦print用として読み込み
                link.onload = function() {
                    this.media = 'all';  // 読み込み完了後にall適用
                };
                document.head.appendChild(link);
            });
        },
        
        // JavaScript最適化
        optimizeJSLoading: function() {
            // 非同期でサードパーティスクリプト読み込み
            const scripts = [
                {
                    src: 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID',
                    async: true
                }
            ];
            
            scripts.forEach((scriptInfo) => {
                const script = document.createElement('script');
                script.src = scriptInfo.src;
                script.async = scriptInfo.async || false;
                script.defer = scriptInfo.defer || false;
                document.head.appendChild(script);
            });
        },
        
        // プリロード最適化
        addResourceHints: function() {
            const hints = [
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true },
                { rel: 'dns-prefetch', href: 'https://www.google-analytics.com' },
                { rel: 'prefetch', href: '/images/hero-bg.webp' }
            ];
            
            hints.forEach((hint) => {
                const link = document.createElement('link');
                link.rel = hint.rel;
                link.href = hint.href;
                if (hint.crossorigin) link.crossOrigin = hint.crossorigin;
                document.head.appendChild(link);
            });
        }
    };

    // ========== User Experience Optimization ==========
    
    const uxOptimizer = {
        // スムーススクロール実装
        initSmoothScroll: function() {
            document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
                anchor.addEventListener('click', function(e) {
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
        },
        
        // フォーカス管理改善
        improveAccessibility: function() {
            // キーボードナビゲーション改善
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    document.body.classList.add('keyboard-navigation');
                }
            });
            
            document.addEventListener('mousedown', () => {
                document.body.classList.remove('keyboard-navigation');
            });
            
            // スキップリンク実装
            const skipLink = document.createElement('a');
            skipLink.href = '#main-content';
            skipLink.textContent = 'メインコンテンツにスキップ';
            skipLink.className = 'skip-link sr-only';
            skipLink.addEventListener('focus', () => {
                skipLink.classList.remove('sr-only');
            });
            skipLink.addEventListener('blur', () => {
                skipLink.classList.add('sr-only');
            });
            document.body.insertBefore(skipLink, document.body.firstChild);
        },
        
        // ローディング状態改善
        showLoadingStates: function() {
            // フォーム送信時のローディング
            document.querySelectorAll('form').forEach((form) => {
                form.addEventListener('submit', function() {
                    const submitBtn = this.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.disabled = true;
                        submitBtn.textContent = '送信中...';
                        submitBtn.classList.add('loading');
                    }
                });
            });
            
            // Ajax読み込み中の表示
            if (window.fetch) {
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                    // ローディング表示
                    document.body.classList.add('loading');
                    
                    return originalFetch.apply(this, args)
                        .finally(() => {
                            document.body.classList.remove('loading');
                        });
                };
            }
        }
    };

    // ========== SEO Enhancement ==========
    
    const seoOptimizer = {
        // 構造化データ動的生成
        generateStructuredData: function() {
            const pageType = document.body.getAttribute('data-page-type');
            let structuredData = {};
            
            switch (pageType) {
                case 'shop-detail':
                    structuredData = this.generateShopSchema();
                    break;
                case 'diving-guide':
                    structuredData = this.generateTravelGuideSchema();
                    break;
                case 'weather':
                    structuredData = this.generateWeatherSchema();
                    break;
                default:
                    structuredData = this.generateWebsiteSchema();
            }
            
            if (Object.keys(structuredData).length > 0) {
                const script = document.createElement('script');
                script.type = 'application/ld+json';
                script.textContent = JSON.stringify(structuredData);
                document.head.appendChild(script);
            }
        },
        
        generateShopSchema: function() {
            return {
                "@context": "https://schema.org",
                "@type": "LocalBusiness",
                "name": document.querySelector('h1').textContent,
                "address": {
                    "@type": "PostalAddress",
                    "addressRegion": "沖縄県"
                },
                "serviceType": "ダイビングショップ"
            };
        },
        
        generateTravelGuideSchema: function() {
            return {
                "@context": "https://schema.org",
                "@type": "TravelGuide",
                "name": document.querySelector('h1').textContent,
                "about": {
                    "@type": "Place",
                    "name": "沖縄"
                }
            };
        },
        
        generateWeatherSchema: function() {
            return {
                "@context": "https://schema.org",
                "@type": "WeatherForecast",
                "name": "沖縄ダイビング海況情報"
            };
        },
        
        generateWebsiteSchema: function() {
            return {
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "Dive Buddy's",
                "url": "https://dive-buddys.com"
            };
        },
        
        // 内部リンク最適化
        optimizeInternalLinks: function() {
            document.querySelectorAll('a[href^="/"]').forEach((link) => {
                if (!link.hasAttribute('aria-label') && link.textContent.trim().length < 3) {
                    link.setAttribute('aria-label', 'ページリンク: ' + link.href);
                }
            });
        }
    };

    // ========== Error Handling ==========
    
    const errorHandler = {
        init: function() {
            // JavaScript エラー監視
            window.addEventListener('error', (e) => {
                console.error('JavaScript Error:', e.error);
                this.reportError('js_error', e.error.message, e.filename, e.lineno);
            });
            
            // Promise rejection 監視
            window.addEventListener('unhandledrejection', (e) => {
                console.error('Unhandled Promise Rejection:', e.reason);
                this.reportError('promise_rejection', e.reason);
            });
            
            // リソース読み込みエラー監視
            window.addEventListener('error', (e) => {
                if (e.target !== window) {
                    console.error('Resource Load Error:', e.target.src || e.target.href);
                    this.reportError('resource_error', e.target.src || e.target.href);
                }
            }, true);
        },
        
        reportError: function(type, message, filename, lineno) {
            // エラー情報をAnalyticsに送信（実装時）
            if (typeof gtag !== 'undefined') {
                gtag('event', 'exception', {
                    description: `${type}: ${message}`,
                    fatal: false
                });
            }
            
            // 重要なエラーの場合はフォールバック処理
            if (type === 'resource_error') {
                this.handleResourceError();
            }
        },
        
        handleResourceError: function() {
            // CSS読み込みエラーの場合は基本スタイル適用
            if (!document.querySelector('link[href*="design-system.css"]')) {
                this.loadFallbackCSS();
            }
        },
        
        loadFallbackCSS: function() {
            const fallbackCSS = `
                body { font-family: sans-serif; margin: 0; padding: 20px; }
                .container { max-width: 1200px; margin: 0 auto; }
                .btn { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; }
            `;
            const style = document.createElement('style');
            style.textContent = fallbackCSS;
            document.head.appendChild(style);
        }
    };

    // ========== Initialization ==========
    
    function init() {
        // DOM読み込み完了後に実行
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializePerformanceOptimizations);
        } else {
            initializePerformanceOptimizations();
        }
    }
    
    function initializePerformanceOptimizations() {
        try {
            // パフォーマンス監視開始
            perfMonitor.measureCoreWebVitals();
            perfMonitor.measureLoadTime();
            
            // 遅延読み込み初期化
            lazyLoader.init();
            
            // リソース最適化
            resourceOptimizer.optimizeCSSLoading();
            resourceOptimizer.addResourceHints();
            
            // UX改善
            uxOptimizer.initSmoothScroll();
            uxOptimizer.improveAccessibility();
            uxOptimizer.showLoadingStates();
            
            // SEO最適化
            seoOptimizer.generateStructuredData();
            seoOptimizer.optimizeInternalLinks();
            
            // エラーハンドリング
            errorHandler.init();
            
            console.log('✅ Performance optimizations initialized');
            
        } catch (error) {
            console.error('Performance optimization initialization failed:', error);
        }
    }
    
    // 初期化実行
    init();
    
    // グローバルAPI公開
    window.DiveBuddysPerformance = {
        perfMonitor: perfMonitor,
        lazyLoader: lazyLoader,
        resourceOptimizer: resourceOptimizer,
        uxOptimizer: uxOptimizer,
        seoOptimizer: seoOptimizer
    };

})();