/**
 * 沖縄交通ルート検索APIモジュール (TRAVEL-002)
 * Google Maps API統合・沖縄特化交通情報（バス・レンタカー）
 */

// ===== 沖縄交通ルート検索・情報システム =====

/**
 * 沖縄交通情報APIサービス
 */
class TransportAPIService {
    constructor() {
        // Google Maps API設定（将来的な実装用）
        this.mapsApiKey = process.env.GOOGLE_MAPS_API_KEY || null;
        this.mapsApiEndpoint = 'https://maps.googleapis.com/maps/api';
        
        // 沖縄エリア・交通拠点データ
        this.okinawaAreas = {
            // 沖縄本島
            okinawa_main: {
                name: '沖縄本島',
                airports: [{ code: 'OKA', name: '那覇空港', lat: 26.1958, lng: 127.6461 }],
                ports: [
                    { name: '那覇港', lat: 26.2120, lng: 127.6792 },
                    { name: '本部港', lat: 26.6938, lng: 127.8776 }
                ],
                mainStations: [
                    { name: '県庁前駅', lat: 26.2115, lng: 127.6792, type: 'monorail' },
                    { name: '首里駅', lat: 26.2172, lng: 127.7199, type: 'monorail' },
                    { name: '那覇バスターミナル', lat: 26.2123, lng: 127.6792, type: 'bus' }
                ]
            },
            // 石垣島
            ishigaki: {
                name: '石垣島',
                airports: [{ code: 'ISG', name: '新石垣空港', lat: 24.3968, lng: 124.2451 }],
                ports: [{ name: '石垣港離島ターミナル', lat: 24.3404, lng: 124.1573 }],
                mainStations: [
                    { name: '石垣バスターミナル', lat: 24.3404, lng: 124.1573, type: 'bus' },
                    { name: '離島ターミナル', lat: 24.3404, lng: 124.1573, type: 'ferry' }
                ]
            },
            // 宮古島
            miyako: {
                name: '宮古島',
                airports: [{ code: 'MMY', name: '宮古空港', lat: 24.7828, lng: 125.2951 }],
                ports: [{ name: '平良港', lat: 24.8051, lng: 125.2820 }],
                mainStations: [
                    { name: '宮古空港', lat: 24.7828, lng: 125.2951, type: 'airport' },
                    { name: '平良市街地', lat: 24.8051, lng: 125.2820, type: 'city_center' }
                ]
            }
        };
        
        // バス路線データ
        this.busRoutes = {
            okinawa_main: [
                {
                    company: '琉球バス交通',
                    routes: [
                        { number: '20', name: '名護西線', from: '那覇バスターミナル', to: '名護バスターミナル', duration: 90, fare: 970 },
                        { number: '25', name: '普天間空港線', from: '那覇空港', to: '普天間', duration: 45, fare: 560 },
                        { number: '28', name: '読谷線', from: '那覇バスターミナル', to: '読谷バスターミナル', duration: 60, fare: 680 }
                    ]
                },
                {
                    company: '沖縄バス',
                    routes: [
                        { number: '77', name: '名護東線', from: '那覇バスターミナル', to: '名護バスターミル', duration: 85, fare: 970 },
                        { number: '83', name: '玉泉洞線', from: '那覇バスターミナル', to: '玉泉洞前', duration: 35, fare: 410 }
                    ]
                },
                {
                    company: '東陽バス',
                    routes: [
                        { number: '53', name: '志喜屋線', from: '那覇バスターミナル', to: '志喜屋', duration: 40, fare: 480 },
                        { number: '56', name: '浦添線', from: '那覇バスターミナル', to: '浦添総合病院', duration: 25, fare: 300 }
                    ]
                }
            ],
            ishigaki: [
                {
                    company: '東運輸',
                    routes: [
                        { number: '4', name: '空港線', from: '新石垣空港', to: '石垣港ターミナル', duration: 35, fare: 540 },
                        { number: '10', name: '川平線', from: 'バスターミナル', to: '川平公園', duration: 40, fare: 560 }
                    ]
                },
                {
                    company: '系統バス',
                    routes: [
                        { number: '1', name: '市内一周線', from: 'バスターミナル', to: '一周', duration: 60, fare: 200 }
                    ]
                }
            ],
            miyako: [
                {
                    company: '宮古協栄バス',
                    routes: [
                        { number: '1', name: '空港線', from: '宮古空港', to: '平良港', duration: 15, fare: 230 },
                        { number: '2', name: '東平安名崎線', from: '平良', to: '東平安名崎', duration: 45, fare: 410 }
                    ]
                }
            ]
        };
        
        // レンタカー会社データ
        this.rentalCarCompanies = {
            major: [
                {
                    name: 'トヨタレンタカー',
                    areas: ['okinawa_main', 'ishigaki', 'miyako'],
                    vehicleTypes: ['軽自動車', 'コンパクト', 'スタンダード', 'ワゴン'],
                    pricing: { daily: { light: 4000, compact: 5500, standard: 7000, wagon: 9000 } },
                    features: ['カーナビ', 'ETC', '24時間サポート']
                },
                {
                    name: 'ニッポンレンタカー',
                    areas: ['okinawa_main', 'ishigaki', 'miyako'],
                    vehicleTypes: ['軽自動車', 'コンパクト', 'スタンダード', 'ミニバン'],
                    pricing: { daily: { light: 3800, compact: 5200, standard: 6800, minivan: 8500 } },
                    features: ['カーナビ', 'ETC', '無料送迎']
                }
            ],
            local: [
                {
                    name: 'オリックスレンタカー沖縄',
                    areas: ['okinawa_main', 'ishigaki', 'miyako'],
                    vehicleTypes: ['軽自動車', 'コンパクト', 'スタンダード', 'オープンカー'],
                    pricing: { daily: { light: 3500, compact: 4800, standard: 6200, convertible: 12000 } },
                    features: ['カーナビ', 'ETC', '空港送迎', '沖縄特化サービス']
                },
                {
                    name: 'スカイレンタカー',
                    areas: ['okinawa_main', 'ishigaki'],
                    vehicleTypes: ['軽自動車', 'コンパクト', 'SUV'],
                    pricing: { daily: { light: 3200, compact: 4500, suv: 8000 } },
                    features: ['格安料金', 'カーナビ', '空港送迎']
                }
            ]
        };
        
        // タクシー・その他交通手段
        this.otherTransport = {
            taxi: {
                okinawa_main: {
                    baseFare: 500,
                    perKm: 80,
                    companies: ['沖縄第一交通', '琉球交通', 'かりゆしタクシー'],
                    specialServices: ['観光タクシー', '定額制空港送迎']
                },
                ishigaki: {
                    baseFare: 500,
                    perKm: 80,
                    companies: ['石垣島タクシー', '八重山交通'],
                    specialServices: ['島内観光コース']
                },
                miyako: {
                    baseFare: 500,
                    perKm: 80,
                    companies: ['宮古島タクシー'],
                    specialServices: ['空港送迎', '観光コース']
                }
            },
            ferry: {
                ishigaki_islands: [
                    { route: '石垣-竹富', duration: 10, fare: 700, company: '安栄観光' },
                    { route: '石垣-西表', duration: 45, fare: 2060, company: '八重山観光フェリー' },
                    { route: '石垣-波照間', duration: 70, fare: 3090, company: '安栄観光' }
                ],
                miyako_islands: [
                    { route: '宮古-伊良部', duration: 25, fare: 410, company: '宮古フェリー' }
                ]
            }
        };
    }

    /**
     * 交通ルート検索（メイン機能）
     * @param {Object} searchParams - 検索パラメータ
     * @returns {Promise<Object>} ルート検索結果
     */
    async searchRoutes(searchParams) {
        try {
            console.log('🚌 交通ルート検索開始:', searchParams);
            
            const {
                area,
                from,
                to,
                transportTypes = ['bus', 'taxi', 'rental_car'],
                departureTime,
                preferences = {}
            } = searchParams;
            
            // 入力値バリデーション
            if (!area || !from || !to) {
                throw new Error('エリア、出発地、目的地は必須です');
            }
            
            // エリア情報取得
            const areaData = this.okinawaAreas[area];
            if (!areaData) {
                throw new Error('対応していないエリアです');
            }
            
            // 各交通手段のルート検索
            const routeOptions = [];
            
            if (transportTypes.includes('bus')) {
                const busRoutes = await this.searchBusRoutes(area, from, to, departureTime);
                routeOptions.push(...busRoutes);
            }
            
            if (transportTypes.includes('taxi')) {
                const taxiOptions = await this.searchTaxiOptions(area, from, to);
                routeOptions.push(...taxiOptions);
            }
            
            if (transportTypes.includes('rental_car')) {
                const rentalOptions = await this.searchRentalCarOptions(area, from, to, preferences);
                routeOptions.push(...rentalOptions);
            }
            
            // 結果をソート（時間・料金・利便性で評価）
            const sortedRoutes = this.sortRoutesByPreference(routeOptions, preferences);
            
            console.log(`✅ 交通ルート検索完了: ${sortedRoutes.length}件のオプション`);
            
            return {
                success: true,
                searchParams,
                areaInfo: areaData,
                routes: sortedRoutes,
                summary: this.generateRouteSummary(sortedRoutes),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ 交通ルート検索エラー:', error);
            throw error;
        }
    }

    /**
     * バス路線検索
     */
    async searchBusRoutes(area, from, to, departureTime) {
        const busData = this.busRoutes[area] || [];
        const routes = [];
        
        busData.forEach(company => {
            company.routes.forEach(route => {
                // 簡易的なルートマッチング
                if (this.isRouteMatch(route, from, to)) {
                    routes.push({
                        transportType: 'bus',
                        company: company.company,
                        routeNumber: route.number,
                        routeName: route.name,
                        from: route.from,
                        to: route.to,
                        duration: route.duration,
                        fare: route.fare,
                        departureTime: this.generateBusDepartureTimes(departureTime),
                        features: ['定時運行', 'IC乗車券対応', '観光地アクセス'],
                        accessibility: 'wheelchair_accessible',
                        rating: 4.0
                    });
                }
            });
        });
        
        return routes;
    }

    /**
     * タクシー検索
     */
    async searchTaxiOptions(area, from, to) {
        const taxiData = this.otherTransport.taxi[area];
        if (!taxiData) return [];
        
        // 概算距離・料金計算（実際はGoogle Maps APIを使用）
        const estimatedDistance = this.calculateEstimatedDistance(from, to);
        const estimatedFare = taxiData.baseFare + (estimatedDistance * taxiData.perKm);
        const estimatedDuration = Math.ceil(estimatedDistance / 30 * 60); // 30km/h想定
        
        return taxiData.companies.map((company, index) => ({
            transportType: 'taxi',
            company: company,
            from: from,
            to: to,
            duration: estimatedDuration,
            fare: Math.floor(estimatedFare * (0.9 + Math.random() * 0.2)), // 料金に若干の差をつける
            departureTime: 'いつでも利用可能',
            features: ['ドア・ツー・ドア', '24時間対応', '荷物対応'],
            specialServices: taxiData.specialServices,
            accessibility: 'universal_design',
            rating: 4.2 + (Math.random() * 0.6),
            estimatedDistance: estimatedDistance
        }));
    }

    /**
     * レンタカー検索
     */
    async searchRentalCarOptions(area, from, to, preferences) {
        const allCompanies = [...this.rentalCarCompanies.major, ...this.rentalCarCompanies.local];
        const availableCompanies = allCompanies.filter(company => 
            company.areas.includes(area)
        );
        
        const options = [];
        
        availableCompanies.forEach(company => {
            company.vehicleTypes.forEach(vehicleType => {
                const vehicleKey = this.getVehicleKey(vehicleType);
                const dailyRate = company.pricing.daily[vehicleKey];
                
                if (dailyRate) {
                    // 概算距離・時間計算
                    const estimatedDistance = this.calculateEstimatedDistance(from, to);
                    const estimatedDuration = Math.ceil(estimatedDistance / 40 * 60); // 40km/h想定
                    const fuelCost = Math.ceil(estimatedDistance / 15 * 150); // 燃費15km/L, ガソリン150円/L想定
                    
                    options.push({
                        transportType: 'rental_car',
                        company: company.name,
                        vehicleType: vehicleType,
                        from: from,
                        to: to,
                        duration: estimatedDuration,
                        fare: fuelCost, // 移動のみの燃料費
                        dailyRate: dailyRate,
                        features: company.features,
                        departureTime: '自由時間',
                        accessibility: 'driver_required',
                        rating: 4.3 + (Math.random() * 0.5),
                        estimatedDistance: estimatedDistance,
                        advantages: ['自由なスケジュール', 'プライバシー確保', '荷物制限なし']
                    });
                }
            });
        });
        
        return options;
    }

    /**
     * 沖縄特化交通情報取得
     * @param {string} area - エリア名
     * @returns {Promise<Object>} エリア特化情報
     */
    async getAreaTransportInfo(area) {
        try {
            console.log(`🏝️ ${area}エリア交通情報取得開始`);
            
            const areaData = this.okinawaAreas[area];
            if (!areaData) {
                throw new Error('対応していないエリアです');
            }
            
            // エリア特化交通情報を生成
            const transportInfo = {
                area: areaData.name,
                overview: this.getAreaTransportOverview(area),
                busSystem: this.getBusSystemInfo(area),
                rentalCarInfo: this.getRentalCarInfo(area),
                taxiInfo: this.getTaxiInfo(area),
                specialTransport: this.getSpecialTransportInfo(area),
                tips: this.getAreaTransportTips(area)
            };
            
            return {
                success: true,
                area: area,
                data: transportInfo,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ ${area}エリア交通情報取得エラー:`, error);
            throw error;
        }
    }

    /**
     * 空港アクセス情報取得
     * @param {string} area - エリア名
     * @param {string} destination - 目的地
     * @returns {Promise<Object>} 空港アクセス情報
     */
    async getAirportAccess(area, destination) {
        try {
            console.log(`✈️ ${area}空港アクセス情報取得: → ${destination}`);
            
            const areaData = this.okinawaAreas[area];
            if (!areaData || !areaData.airports.length) {
                throw new Error('空港情報が見つかりません');
            }
            
            const airport = areaData.airports[0];
            const accessOptions = [];
            
            // バスアクセス
            const busRoutes = await this.searchBusRoutes(area, airport.name, destination);
            accessOptions.push(...busRoutes);
            
            // タクシーアクセス
            const taxiOptions = await this.searchTaxiOptions(area, airport.name, destination);
            accessOptions.push(...taxiOptions);
            
            // レンタカーアクセス
            const rentalOptions = await this.searchRentalCarOptions(area, airport.name, destination);
            accessOptions.push(...rentalOptions);
            
            return {
                success: true,
                airport: airport,
                destination: destination,
                accessOptions: accessOptions,
                recommendations: this.getAirportAccessRecommendations(area, destination),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`❌ 空港アクセス情報取得エラー:`, error);
            throw error;
        }
    }

    // ===== ヘルパー関数 =====

    isRouteMatch(route, from, to) {
        // 簡易的なルートマッチング（実際はより複雑な判定が必要）
        const routeStops = [route.from, route.to].join(' ').toLowerCase();
        const fromMatch = routeStops.includes(from.toLowerCase()) || from.toLowerCase().includes('空港') || from.toLowerCase().includes('バス');
        const toMatch = routeStops.includes(to.toLowerCase()) || to.toLowerCase().includes('ビーチ') || to.toLowerCase().includes('ホテル');
        
        return fromMatch || toMatch;
    }

    generateBusDepartureTimes(requestedTime) {
        // 30分間隔でバス運行時刻を生成
        const times = [];
        for (let hour = 6; hour < 22; hour++) {
            times.push(`${hour.toString().padStart(2, '0')}:00`);
            times.push(`${hour.toString().padStart(2, '0')}:30`);
        }
        
        if (requestedTime) {
            // 指定時刻以降の便を表示
            return times.filter(time => time >= requestedTime).slice(0, 3);
        }
        
        return times.slice(0, 5); // 最初の5便
    }

    calculateEstimatedDistance(from, to) {
        // 簡易的な距離計算（実際はGoogle Maps Distance Matrix APIを使用）
        const distanceMatrix = {
            '那覇空港-首里': 15,
            '那覇空港-名護': 65,
            '那覇空港-恩納村': 45,
            '新石垣空港-石垣市街': 30,
            '新石垣空港-川平湾': 40,
            '宮古空港-平良': 6,
            '宮古空港-東平安名崎': 25
        };
        
        const key = `${from}-${to}`;
        const reverseKey = `${to}-${from}`;
        
        return distanceMatrix[key] || distanceMatrix[reverseKey] || 20; // デフォルト20km
    }

    getVehicleKey(vehicleType) {
        const keyMap = {
            '軽自動車': 'light',
            'コンパクト': 'compact',
            'スタンダード': 'standard',
            'ワゴン': 'wagon',
            'ミニバン': 'minivan',
            'SUV': 'suv',
            'オープンカー': 'convertible'
        };
        return keyMap[vehicleType] || 'compact';
    }

    sortRoutesByPreference(routes, preferences = {}) {
        return routes.sort((a, b) => {
            // 優先順位：料金 > 時間 > 利便性
            if (preferences.priority === 'cost') {
                return a.fare - b.fare;
            } else if (preferences.priority === 'time') {
                return a.duration - b.duration;
            } else {
                // デフォルトは総合評価
                const scoreA = this.calculateRouteScore(a);
                const scoreB = this.calculateRouteScore(b);
                return scoreB - scoreA;
            }
        });
    }

    calculateRouteScore(route) {
        let score = 0;
        
        // 交通手段別の基本スコア
        if (route.transportType === 'bus') score += 7;
        else if (route.transportType === 'rental_car') score += 8;
        else if (route.transportType === 'taxi') score += 6;
        
        // 料金評価（安いほど高得点）
        if (route.fare < 500) score += 3;
        else if (route.fare < 1000) score += 2;
        else if (route.fare > 2000) score -= 1;
        
        // 時間評価（短いほど高得点）
        if (route.duration < 30) score += 2;
        else if (route.duration > 90) score -= 1;
        
        // 利便性評価
        if (route.features && route.features.length > 3) score += 1;
        if (route.rating && route.rating > 4.0) score += 1;
        
        return score;
    }

    generateRouteSummary(routes) {
        const summary = {
            totalOptions: routes.length,
            transportTypes: [...new Set(routes.map(r => r.transportType))],
            priceRange: {
                min: Math.min(...routes.map(r => r.fare)),
                max: Math.max(...routes.map(r => r.fare))
            },
            timeRange: {
                min: Math.min(...routes.map(r => r.duration)),
                max: Math.max(...routes.map(r => r.duration))
            }
        };
        
        // 最安値・最速オプションを特定
        summary.cheapest = routes.find(r => r.fare === summary.priceRange.min);
        summary.fastest = routes.find(r => r.duration === summary.timeRange.min);
        
        return summary;
    }

    // エリア特化情報取得関数群
    getAreaTransportOverview(area) {
        const overviews = {
            okinawa_main: '沖縄本島は充実したバス網とモノレール、豊富なレンタカー会社が特徴。観光地間の移動も便利です。',
            ishigaki: '石垣島はバス路線が限られるため、レンタカーが最も便利。離島巡りには港へのアクセスが重要。',
            miyako: '宮古島は公共交通が限定的。レンタカーでの移動が基本となりますが、コンパクトな島なので移動は比較的簡単。'
        };
        return overviews[area] || '交通情報を準備中です。';
    }

    getBusSystemInfo(area) {
        const busInfo = this.busRoutes[area] || [];
        return {
            companies: busInfo.map(company => company.company),
            coverage: busInfo.length > 0 ? '市内・観光地アクセス良好' : '限定的',
            ticketTypes: ['現金', 'IC乗車券', '1日パス'],
            operatingHours: '6:00-22:00'
        };
    }

    getRentalCarInfo(area) {
        const availableCompanies = [...this.rentalCarCompanies.major, ...this.rentalCarCompanies.local]
            .filter(company => company.areas.includes(area));
        
        return {
            companies: availableCompanies.map(c => c.name),
            vehicleTypes: [...new Set(availableCompanies.flatMap(c => c.vehicleTypes))],
            averageDailyRate: '3,500円-9,000円',
            features: ['カーナビ標準装備', 'ETC対応', '24時間サポート']
        };
    }

    getTaxiInfo(area) {
        const taxiData = this.otherTransport.taxi[area];
        return taxiData ? {
            baseFare: `${taxiData.baseFare}円`,
            perKm: `${taxiData.perKm}円/km`,
            companies: taxiData.companies,
            specialServices: taxiData.specialServices
        } : { message: 'タクシー情報準備中' };
    }

    getSpecialTransportInfo(area) {
        const special = [];
        
        if (area === 'okinawa_main') {
            special.push('沖縄都市モノレール（ゆいレール）');
        }
        
        if (area === 'ishigaki') {
            special.push('離島フェリー（竹富島・西表島・波照間島）');
        }
        
        return special;
    }

    getAreaTransportTips(area) {
        const tips = {
            okinawa_main: [
                'ゆいレールの1日券が観光には便利',
                'バスは渋滞に注意、余裕を持った計画を',
                'レンタカーは早期予約で割引あり'
            ],
            ishigaki: [
                '空港から市街地はバスが便利',
                '離島巡りは港へのアクセスを確認',
                '観光地巡りはレンタカーがおすすめ'
            ],
            miyako: [
                '島内移動はレンタカーが基本',
                '空港から宮古島市街は近い',
                '絶景ドライブルートが充実'
            ]
        };
        
        return tips[area] || ['交通情報を準備中です'];
    }

    getAirportAccessRecommendations(area, destination) {
        return [
            '荷物が多い場合はタクシーがおすすめ',
            '複数人ならレンタカーが経済的',
            'バスは時間に余裕があれば最も経済的',
            '早朝・深夜便の場合は事前に交通手段を確認'
        ];
    }
}

module.exports = {
    TransportAPIService
};