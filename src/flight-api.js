/**
 * 航空券情報API統合モジュール (TRAVEL-001)
 * JAL・ANA・LCC各社の料金比較・空席状況表示機能
 */

// ===== 航空券検索・比較システム =====

/**
 * 航空券検索・比較システム
 */
class FlightAPIService {
    constructor() {
        // 実際のAPI設定（将来的な実装用）
        this.apiConfigs = {
            JAL: {
                endpoint: 'https://api.jal.com/v1/', // 仮想エンドポイント
                apiKey: process.env.JAL_API_KEY || null
            },
            ANA: {
                endpoint: 'https://api.ana.co.jp/v1/', // 仮想エンドポイント
                apiKey: process.env.ANA_API_KEY || null
            },
            // LCC各社も追加予定
            Jetstar: {
                endpoint: 'https://api.jetstar.com/v1/', // 仮想エンドポイント
                apiKey: process.env.JETSTAR_API_KEY || null
            },
            Peach: {
                endpoint: 'https://api.flypeach.com/v1/', // 仮想エンドポイント
                apiKey: process.env.PEACH_API_KEY || null
            }
        };
        
        // 地域・空港コードマッピング
        this.airportCodes = {
            // 出発地（本土）
            tokyo: { code: 'NRT', name: '成田国際空港', city: '東京' },
            haneda: { code: 'HND', name: '羽田空港', city: '東京' },
            osaka: { code: 'KIX', name: '関西国際空港', city: '大阪' },
            itami: { code: 'ITM', name: '大阪国際空港', city: '大阪' },
            nagoya: { code: 'NGO', name: '中部国際空港', city: '名古屋' },
            fukuoka: { code: 'FUK', name: '福岡空港', city: '福岡' },
            
            // 目的地（沖縄）
            okinawa: { code: 'OKA', name: '那覇空港', city: '沖縄本島' },
            ishigaki: { code: 'ISG', name: '新石垣空港', city: '石垣島' },
            miyako: { code: 'MMY', name: '宮古空港', city: '宮古島' },
            yonaguni: { code: 'OGN', name: '与那国空港', city: '与那国島' },
            kumejima: { code: 'UEO', name: '久米島空港', city: '久米島' }
        };
    }

    /**
     * 航空券検索（メイン関数）
     * @param {Object} searchParams - 検索パラメータ
     * @returns {Promise<Object>} 検索結果
     */
    async searchFlights(searchParams) {
        try {
            console.log('✈️ 航空券検索開始:', searchParams);
            
            const {
                departure,
                destination,
                departureDate,
                returnDate,
                passengers = 1,
                class: flightClass = 'economy'
            } = searchParams;
            
            // 入力値バリデーション
            if (!departure || !destination || !departureDate) {
                throw new Error('必須パラメータが不足しています');
            }
            
            // 空港コード取得
            const departureAirport = this.airportCodes[departure];
            const destinationAirport = this.airportCodes[destination];
            
            if (!departureAirport || !destinationAirport) {
                throw new Error('不正な出発地または目的地です');
            }
            
            // 現在はサンプルデータを返却（実際のAPI接続は将来実装）
            const flightResults = await this.generateSampleFlightData(searchParams);
            
            console.log(`✅ 航空券検索完了: ${flightResults.flights.length}件の結果`);
            
            return {
                success: true,
                searchParams: {
                    ...searchParams,
                    departureAirport,
                    destinationAirport
                },
                results: flightResults,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ 航空券検索エラー:', error);
            throw error;
        }
    }

    /**
     * 料金比較機能
     * @param {Object} searchParams - 検索パラメータ
     * @returns {Promise<Object>} 比較結果
     */
    async compareFlightPrices(searchParams) {
        try {
            console.log('💰 料金比較開始:', searchParams);
            
            const searchResults = await this.searchFlights(searchParams);
            const flights = searchResults.results.flights;
            
            // 航空会社別の最安値を計算
            const priceComparison = this.calculatePriceComparison(flights);
            
            // お得な便を特定
            const bestDeals = this.findBestDeals(flights);
            
            console.log('✅ 料金比較完了');
            
            return {
                success: true,
                comparison: priceComparison,
                bestDeals: bestDeals,
                allFlights: flights,
                searchParams: searchResults.searchParams,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ 料金比較エラー:', error);
            throw error;
        }
    }

    /**
     * 月別料金トレンド取得
     * @param {Object} routeParams - ルートパラメータ
     * @returns {Promise<Object>} 月別料金データ
     */
    async getMonthlyPriceTrends(routeParams) {
        try {
            console.log('📊 月別料金トレンド取得:', routeParams);
            
            const { departure, destination } = routeParams;
            
            // サンプル月別データ生成
            const monthlyTrends = this.generateMonthlyTrends(departure, destination);
            
            return {
                success: true,
                route: routeParams,
                trends: monthlyTrends,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('❌ 月別料金トレンド取得エラー:', error);
            throw error;
        }
    }

    /**
     * サンプル航空券データ生成（開発・テスト用）
     */
    async generateSampleFlightData(searchParams) {
        const { departure, destination, departureDate, returnDate, passengers } = searchParams;
        
        const airlines = ['JAL', 'ANA', 'Jetstar', 'Peach', 'Skymark'];
        const flights = [];
        
        // 出発便データ生成
        airlines.forEach((airline, index) => {
            const basePrice = this.getBasePrice(departure, destination, airline);
            const departureTime = this.generateDepartureTime(index);
            const flightDuration = this.getFlightDuration(departure, destination);
            
            flights.push({
                flightId: `${airline}_${departure}_${destination}_${Date.now()}_${index}`,
                airline: airline,
                flightNumber: `${this.getAirlineCode(airline)}${Math.floor(Math.random() * 999) + 100}`,
                route: {
                    departure: departure,
                    destination: destination,
                    departureAirport: this.airportCodes[departure],
                    destinationAirport: this.airportCodes[destination]
                },
                schedule: {
                    departureDate: departureDate,
                    departureTime: departureTime.departure,
                    arrivalTime: departureTime.arrival,
                    duration: flightDuration
                },
                pricing: {
                    economy: Math.floor(basePrice * (0.9 + Math.random() * 0.4)),
                    premium: Math.floor(basePrice * 1.5 * (0.9 + Math.random() * 0.4)),
                    business: Math.floor(basePrice * 2.2 * (0.9 + Math.random() * 0.4))
                },
                availability: {
                    economy: Math.floor(Math.random() * 50) + 5,
                    premium: Math.floor(Math.random() * 20) + 2,
                    business: Math.floor(Math.random() * 10) + 1
                },
                aircraft: this.getAircraftType(airline),
                amenities: this.getAmenities(airline),
                restrictions: this.getRestrictions(airline)
            });
        });
        
        // 復路便データ生成（往復の場合）
        const returnFlights = [];
        if (returnDate) {
            airlines.forEach((airline, index) => {
                const basePrice = this.getBasePrice(destination, departure, airline);
                const departureTime = this.generateDepartureTime(index + 2);
                const flightDuration = this.getFlightDuration(destination, departure);
                
                returnFlights.push({
                    flightId: `${airline}_${destination}_${departure}_${Date.now()}_${index}_return`,
                    airline: airline,
                    flightNumber: `${this.getAirlineCode(airline)}${Math.floor(Math.random() * 999) + 200}`,
                    route: {
                        departure: destination,
                        destination: departure,
                        departureAirport: this.airportCodes[destination],
                        destinationAirport: this.airportCodes[departure]
                    },
                    schedule: {
                        departureDate: returnDate,
                        departureTime: departureTime.departure,
                        arrivalTime: departureTime.arrival,
                        duration: flightDuration
                    },
                    pricing: {
                        economy: Math.floor(basePrice * (0.9 + Math.random() * 0.4)),
                        premium: Math.floor(basePrice * 1.5 * (0.9 + Math.random() * 0.4)),
                        business: Math.floor(basePrice * 2.2 * (0.9 + Math.random() * 0.4))
                    },
                    availability: {
                        economy: Math.floor(Math.random() * 50) + 5,
                        premium: Math.floor(Math.random() * 20) + 2,
                        business: Math.floor(Math.random() * 10) + 1
                    },
                    aircraft: this.getAircraftType(airline),
                    amenities: this.getAmenities(airline),
                    restrictions: this.getRestrictions(airline)
                });
            });
        }
        
        return {
            outbound: flights,
            return: returnFlights,
            flights: [...flights, ...returnFlights],
            summary: {
                totalOptions: flights.length + returnFlights.length,
                priceRange: {
                    min: Math.min(...flights.map(f => f.pricing.economy)),
                    max: Math.max(...flights.map(f => f.pricing.business))
                },
                airlines: airlines
            }
        };
    }

    /**
     * 料金比較計算
     */
    calculatePriceComparison(flights) {
        const comparison = {};
        
        flights.forEach(flight => {
            if (!comparison[flight.airline]) {
                comparison[flight.airline] = {
                    airline: flight.airline,
                    cheapest: flight.pricing.economy,
                    average: flight.pricing.economy,
                    flights: []
                };
            }
            
            comparison[flight.airline].flights.push(flight);
            comparison[flight.airline].cheapest = Math.min(
                comparison[flight.airline].cheapest,
                flight.pricing.economy
            );
        });
        
        // 平均価格計算
        Object.values(comparison).forEach(airlineData => {
            const prices = airlineData.flights.map(f => f.pricing.economy);
            airlineData.average = Math.floor(prices.reduce((a, b) => a + b, 0) / prices.length);
        });
        
        return Object.values(comparison).sort((a, b) => a.cheapest - b.cheapest);
    }

    /**
     * お得な便を特定
     */
    findBestDeals(flights) {
        const sortedFlights = flights.sort((a, b) => a.pricing.economy - b.pricing.economy);
        
        return {
            cheapest: sortedFlights.slice(0, 3),
            bestValue: sortedFlights.filter(flight => {
                const valueScore = this.calculateValueScore(flight);
                return valueScore > 7.5;
            }).slice(0, 3),
            quickest: flights.sort((a, b) => a.schedule.duration - b.schedule.duration).slice(0, 3)
        };
    }

    /**
     * 月別料金トレンド生成
     */
    generateMonthlyTrends(departure, destination) {
        const months = [
            '1月', '2月', '3月', '4月', '5月', '6月',
            '7月', '8月', '9月', '10月', '11月', '12月'
        ];
        
        const basePrice = this.getBasePrice(departure, destination, 'average');
        
        return months.map((month, index) => {
            // 季節係数（沖縄は夏・年末年始が高い）
            let seasonMultiplier = 1.0;
            if ([6, 7, 8].includes(index)) seasonMultiplier = 1.3; // 夏
            if ([11, 0].includes(index)) seasonMultiplier = 1.4; // 年末年始
            if ([1, 2].includes(index)) seasonMultiplier = 0.8; // 冬（2-3月は安い）
            
            const price = Math.floor(basePrice * seasonMultiplier * (0.9 + Math.random() * 0.2));
            
            return {
                month: month,
                monthIndex: index + 1,
                averagePrice: price,
                lowestPrice: Math.floor(price * 0.7),
                highestPrice: Math.floor(price * 1.5),
                recommendation: this.getMonthRecommendation(index)
            };
        });
    }

    // ===== ヘルパー関数 =====

    getBasePrice(departure, destination, airline) {
        const pricingMatrix = {
            // 本土 → 沖縄本島
            'tokyo-okinawa': { JAL: 28000, ANA: 27000, Jetstar: 15000, Peach: 13000, Skymark: 18000, average: 20000 },
            'osaka-okinawa': { JAL: 25000, ANA: 24000, Jetstar: 12000, Peach: 11000, Skymark: 16000, average: 18000 },
            'nagoya-okinawa': { JAL: 26000, ANA: 25000, Jetstar: 13000, Peach: 12000, Skymark: 17000, average: 19000 },
            'fukuoka-okinawa': { JAL: 20000, ANA: 19000, Jetstar: 10000, Peach: 9000, Skymark: 14000, average: 14000 },
            
            // 本土 → 石垣島
            'tokyo-ishigaki': { JAL: 38000, ANA: 37000, Jetstar: 25000, Peach: 23000, average: 31000 },
            'osaka-ishigaki': { JAL: 35000, ANA: 34000, Jetstar: 22000, Peach: 20000, average: 28000 },
            'nagoya-ishigaki': { JAL: 36000, ANA: 35000, Jetstar: 23000, Peach: 21000, average: 29000 },
            'fukuoka-ishigaki': { JAL: 30000, ANA: 29000, Jetstar: 18000, Peach: 16000, average: 23000 },
            
            // 本土 → 宮古島
            'tokyo-miyako': { JAL: 40000, ANA: 39000, Jetstar: 27000, Peach: 25000, average: 33000 },
            'osaka-miyako': { JAL: 37000, ANA: 36000, Jetstar: 24000, Peach: 22000, average: 30000 },
            'nagoya-miyako': { JAL: 38000, ANA: 37000, Jetstar: 25000, Peach: 23000, average: 31000 },
            'fukuoka-miyako': { JAL: 32000, ANA: 31000, Jetstar: 20000, Peach: 18000, average: 25000 }
        };
        
        const route = `${departure}-${destination}`;
        const routePrices = pricingMatrix[route];
        
        if (!routePrices) return 30000; // デフォルト価格
        
        return routePrices[airline] || routePrices.average || 30000;
    }

    generateDepartureTime(index) {
        const baseHour = 7 + (index * 2.5);
        const hour = Math.floor(baseHour) % 24;
        const minute = Math.floor((baseHour % 1) * 60);
        
        const departureTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        // 到着時間計算（仮想的な飛行時間を追加）
        let arrivalHour = hour + 2; // 基本2時間の飛行時間
        if (arrivalHour >= 24) arrivalHour -= 24;
        
        const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        
        return {
            departure: departureTime,
            arrival: arrivalTime
        };
    }

    getFlightDuration(departure, destination) {
        const durationMatrix = {
            'tokyo-okinawa': 150,
            'tokyo-ishigaki': 180,
            'tokyo-miyako': 170,
            'osaka-okinawa': 120,
            'osaka-ishigaki': 150,
            'osaka-miyako': 145,
            'nagoya-okinawa': 135,
            'nagoya-ishigaki': 165,
            'nagoya-miyako': 160,
            'fukuoka-okinawa': 90,
            'fukuoka-ishigaki': 120,
            'fukuoka-miyako': 115
        };
        
        return durationMatrix[`${departure}-${destination}`] || 120;
    }

    getAirlineCode(airline) {
        const codes = {
            JAL: 'JL',
            ANA: 'NH',
            Jetstar: 'JQ',
            Peach: 'MM',
            Skymark: 'BC'
        };
        return codes[airline] || 'XX';
    }

    getAircraftType(airline) {
        const aircraftTypes = {
            JAL: 'Boeing 737-800',
            ANA: 'Boeing 737-800',
            Jetstar: 'Airbus A320',
            Peach: 'Airbus A320neo',
            Skymark: 'Boeing 737-800'
        };
        return aircraftTypes[airline] || 'Boeing 737';
    }

    getAmenities(airline) {
        const amenityMap = {
            JAL: ['機内WiFi', '座席指定無料', '機内食', 'ドリンクサービス'],
            ANA: ['機内WiFi', '座席指定無料', '機内食', 'ドリンクサービス'],
            Jetstar: ['座席指定有料', 'ドリンク有料', '機内食有料'],
            Peach: ['座席指定有料', 'ドリンク有料', '機内食有料'],
            Skymark: ['座席指定無料', 'ドリンクサービス']
        };
        return amenityMap[airline] || [];
    }

    getRestrictions(airline) {
        const restrictionMap = {
            JAL: { baggage: '23kg無料', changeFee: '変更手数料あり' },
            ANA: { baggage: '23kg無料', changeFee: '変更手数料あり' },
            Jetstar: { baggage: '7kg手荷物のみ無料', changeFee: '変更手数料高額' },
            Peach: { baggage: '7kg手荷物のみ無料', changeFee: '変更手数料高額' },
            Skymark: { baggage: '20kg無料', changeFee: '変更手数料あり' }
        };
        return restrictionMap[airline] || {};
    }

    calculateValueScore(flight) {
        // 価格・時間・サービスを総合評価（1-10点）
        let score = 5.0; // ベーススコア
        
        // 価格評価（安いほど高得点）
        if (flight.pricing.economy < 20000) score += 2.0;
        else if (flight.pricing.economy < 30000) score += 1.0;
        else if (flight.pricing.economy > 40000) score -= 1.0;
        
        // 時間評価（適度な時間が高得点）
        const departureHour = parseInt(flight.schedule.departureTime.split(':')[0]);
        if (departureHour >= 8 && departureHour <= 18) score += 1.0;
        
        // 航空会社評価
        if (['JAL', 'ANA'].includes(flight.airline)) score += 1.5;
        else if (flight.airline === 'Skymark') score += 0.5;
        
        return Math.min(Math.max(score, 1.0), 10.0);
    }

    getMonthRecommendation(monthIndex) {
        const recommendations = [
            '年始料金は高め。1月下旬は穴場',
            '最安シーズン。寒いが海は綺麗',
            '気候良好で料金も手頃',
            '春休みで料金上昇。早期予約推奨',
            'GW前が穴場。気候も安定',
            '梅雨時期だが料金は手頃',
            '夏休み開始で料金急上昇',
            '夏真っ盛り。最高シーズン',
            '台風シーズンだが穴場料金',
            '気候安定。連休注意',
            '過ごしやすい気候で人気',
            '年末年始で料金最高値'
        ];
        
        return recommendations[monthIndex] || '要確認';
    }
}

module.exports = {
    FlightAPIService
};