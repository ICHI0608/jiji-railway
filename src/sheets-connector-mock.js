/**
 * Mock Google Sheets Connector for Development
 * Simulates Google Sheets API with local data
 */

const fs = require('fs');
const path = require('path');

class MockJijiSheetsConnector {
    constructor() {
        this.mockDataPath = path.join(__dirname, '..', 'mock-shops-data.json');
        this.loadMockData();
        
        // 34項目ヘッダー定義
        this.shopHeaders = [
            'shop_id', 'shop_name', 'area', 'phone_line', 'website', 'operating_hours',
            'fun_dive_available', 'trial_dive_options', 'license_course_available', 
            'max_group_size', 'private_guide_available', 'fun_dive_price_2tanks',
            'trial_dive_price_beach', 'trial_dive_price_boat', 'equipment_rental_included',
            'additional_fees', 'safety_equipment', 'insurance_coverage', 'female_instructor',
            'english_support', 'pickup_service', 'beginner_friendly', 'solo_welcome',
            'family_friendly', 'photo_service', 'video_service', 'speciality_areas',
            'certification_level', 'experience_years', 'customer_rating', 'review_count',
            'incident_record', 'jiji_grade', 'last_updated'
        ];
    }

    loadMockData() {
        try {
            if (fs.existsSync(this.mockDataPath)) {
                const data = fs.readFileSync(this.mockDataPath, 'utf8');
                this.mockShopsData = JSON.parse(data);
            } else {
                this.mockShopsData = [];
            }
        } catch (error) {
            console.warn('Mock data file not found, using empty dataset');
            this.mockShopsData = [];
        }
    }

    saveMockData() {
        fs.writeFileSync(this.mockDataPath, JSON.stringify(this.mockShopsData, null, 2));
    }

    async getAllShops() {
        console.log('📊 [MOCK] Getting all shops...');
        return this.mockShopsData;
    }

    async getShopById(shopId) {
        console.log(`🔍 [MOCK] Getting shop: ${shopId}`);
        return this.mockShopsData.find(shop => shop.shop_id === shopId);
    }

    async getShopsByArea(area) {
        console.log(`🏝️  [MOCK] Getting shops in area: ${area}`);
        return this.mockShopsData.filter(shop => shop.area === area);
    }

    async getShopsByCriteria(criteria) {
        console.log(`🔍 [MOCK] Filtering shops by criteria:`, criteria);
        return this.mockShopsData.filter(shop => {
            return Object.keys(criteria).every(key => {
                if (typeof criteria[key] === 'boolean') {
                    return shop[key] === criteria[key];
                }
                return shop[key] === criteria[key];
            });
        });
    }

    async getShopsByPriceRange(minPrice, maxPrice) {
        console.log(`💰 [MOCK] Getting shops in price range: ¥${minPrice}-${maxPrice}`);
        return this.mockShopsData.filter(shop => {
            const price = shop.fun_dive_price_2tanks;
            return price >= minPrice && price <= maxPrice;
        });
    }

    async getShopsByRating(minRating) {
        console.log(`⭐ [MOCK] Getting shops with rating >= ${minRating}`);
        return this.mockShopsData.filter(shop => shop.customer_rating >= minRating);
    }

    async addShop(shopData) {
        console.log(`➕ [MOCK] Adding shop: ${shopData.shop_name}`);
        this.mockShopsData.push(shopData);
        this.saveMockData();
        return shopData;
    }

    async updateShop(shopId, updateData) {
        console.log(`🔄 [MOCK] Updating shop: ${shopId}`);
        const index = this.mockShopsData.findIndex(shop => shop.shop_id === shopId);
        if (index !== -1) {
            this.mockShopsData[index] = { ...this.mockShopsData[index], ...updateData };
            this.saveMockData();
            return this.mockShopsData[index];
        }
        return null;
    }

    async getShopStatistics() {
        console.log('📊 [MOCK] Getting shop statistics...');
        
        const totalShops = this.mockShopsData.length;
        const areas = [...new Set(this.mockShopsData.map(shop => shop.area))];
        const avgRating = this.mockShopsData.reduce((sum, shop) => sum + shop.customer_rating, 0) / totalShops || 0;
        const avgPrice = this.mockShopsData.reduce((sum, shop) => sum + shop.fun_dive_price_2tanks, 0) / totalShops || 0;

        return {
            totalShops,
            areas,
            avgRating: Math.round(avgRating * 10) / 10,
            avgPrice: Math.round(avgPrice),
            beginnerFriendly: this.mockShopsData.filter(shop => shop.beginner_friendly).length,
            soloWelcome: this.mockShopsData.filter(shop => shop.solo_welcome).length
        };
    }

    async logOperation(operation, details) {
        console.log(`📝 [MOCK] Log: ${operation} - ${details}`);
        // In real implementation, this would log to Google Sheets
        return true;
    }
}

module.exports = MockJijiSheetsConnector;