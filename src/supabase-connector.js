/**
 * Jiji Supabase Database Connector
 * Phase 4-A Task 3: Mock → Real DB Migration
 * 
 * Handles all database operations with Supabase PostgreSQL
 * Replaces mock JSON data with real database
 */

const { createClient } = require('@supabase/supabase-js');

class JijiSupabaseConnector {
    constructor() {
        this.initializeSupabase();
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

    initializeSupabase() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            console.warn('⚠️ Supabase credentials not found in environment variables');
            console.warn('   SUPABASE_URL and SUPABASE_ANON_KEY required');
            console.warn('   Falling back to mock mode');
            this.supabase = null;
            return;
        }
        
        try {
            this.supabase = createClient(supabaseUrl, supabaseKey);
            console.log('✅ Supabase client initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error.message);
            this.supabase = null;
        }
    }

    async testConnection() {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        try {
            const { data, error } = await this.supabase
                .from('diving_shops')
                .select('count', { count: 'exact', head: true });
            
            if (error) throw error;
            
            console.log('✅ Supabase connection test successful');
            return true;
        } catch (error) {
            console.error('❌ Supabase connection test failed:', error.message);
            throw error;
        }
    }

    async createTables() {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log('🔧 Creating database tables...');
        
        // Note: In production, these tables should be created via Supabase Dashboard
        // or migration scripts. This is for development setup.
        
        const divingShopsSchema = `
            CREATE TABLE IF NOT EXISTS diving_shops (
                id SERIAL PRIMARY KEY,
                shop_id VARCHAR(50) UNIQUE NOT NULL,
                shop_name VARCHAR(255) NOT NULL,
                area VARCHAR(100) NOT NULL,
                phone_line VARCHAR(50),
                website TEXT,
                operating_hours VARCHAR(100),
                fun_dive_available BOOLEAN DEFAULT false,
                trial_dive_options TEXT,
                license_course_available BOOLEAN DEFAULT false,
                max_group_size INTEGER,
                private_guide_available BOOLEAN DEFAULT false,
                fun_dive_price_2tanks INTEGER,
                trial_dive_price_beach INTEGER,
                trial_dive_price_boat INTEGER,
                equipment_rental_included BOOLEAN DEFAULT false,
                additional_fees TEXT,
                safety_equipment BOOLEAN DEFAULT false,
                insurance_coverage BOOLEAN DEFAULT false,
                female_instructor BOOLEAN DEFAULT false,
                english_support BOOLEAN DEFAULT false,
                pickup_service BOOLEAN DEFAULT false,
                beginner_friendly BOOLEAN DEFAULT false,
                solo_welcome BOOLEAN DEFAULT false,
                family_friendly BOOLEAN DEFAULT false,
                photo_service BOOLEAN DEFAULT false,
                video_service BOOLEAN DEFAULT false,
                speciality_areas TEXT,
                certification_level VARCHAR(100),
                experience_years INTEGER,
                customer_rating DECIMAL(3,2),
                review_count INTEGER DEFAULT 0,
                incident_record TEXT,
                jiji_grade VARCHAR(50),
                last_updated DATE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_diving_shops_area ON diving_shops(area);
            CREATE INDEX IF NOT EXISTS idx_diving_shops_beginner_friendly ON diving_shops(beginner_friendly);
            CREATE INDEX IF NOT EXISTS idx_diving_shops_rating ON diving_shops(customer_rating);
            CREATE INDEX IF NOT EXISTS idx_diving_shops_jiji_grade ON diving_shops(jiji_grade);
        `;
        
        const userFeedbackSchema = `
            CREATE TABLE IF NOT EXISTS user_feedback (
                id SERIAL PRIMARY KEY,
                feedback_id VARCHAR(100) UNIQUE NOT NULL,
                shop_id VARCHAR(50) REFERENCES diving_shops(shop_id),
                user_id VARCHAR(100),
                rating DECIMAL(2,1) CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                experience_type VARCHAR(50),
                recommendation_id VARCHAR(100),
                processed BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_feedback_shop_id ON user_feedback(shop_id);
            CREATE INDEX IF NOT EXISTS idx_user_feedback_created_at ON user_feedback(created_at);
        `;
        
        const userProfilesSchema = `
            CREATE TABLE IF NOT EXISTS user_profiles (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(100) UNIQUE NOT NULL,
                name VARCHAR(255),
                diving_experience VARCHAR(50),
                license_type VARCHAR(100),
                preferences JSONB,
                profile_completion_rate INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
        `;
        
        const conversationsSchema = `
            CREATE TABLE IF NOT EXISTS conversations (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(100),
                message_type VARCHAR(50),
                message_content TEXT,
                emotional_analysis JSONB,
                jiji_response TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
            CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at);
        `;
        
        console.log('ℹ️ Tables should be created via Supabase Dashboard');
        console.log('   diving_shops, user_feedback, user_profiles, conversations');
        
        return true;
    }

    async getAllShops() {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log('📊 [SUPABASE] Getting all shops...');
        
        try {
            const { data, error } = await this.supabase
                .from('diving_shops')
                .select('*')
                .order('shop_name');
            
            if (error) throw error;
            
            console.log(`✅ Retrieved ${data.length} shops from Supabase`);
            return data;
        } catch (error) {
            console.error('❌ Error getting all shops:', error.message);
            throw error;
        }
    }

    async getShopById(shopId) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`🔍 [SUPABASE] Getting shop: ${shopId}`);
        
        try {
            const { data, error } = await this.supabase
                .from('diving_shops')
                .select('*')
                .eq('shop_id', shopId)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    return null; // Shop not found
                }
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error(`❌ Error getting shop ${shopId}:`, error.message);
            throw error;
        }
    }

    async getShopsByArea(area) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`🏝️ [SUPABASE] Getting shops in area: ${area}`);
        
        try {
            const { data, error } = await this.supabase
                .from('diving_shops')
                .select('*')
                .eq('area', area)
                .order('customer_rating', { ascending: false });
            
            if (error) throw error;
            
            console.log(`✅ Found ${data.length} shops in ${area}`);
            return data;
        } catch (error) {
            console.error(`❌ Error getting shops in ${area}:`, error.message);
            throw error;
        }
    }

    async getShopsByCriteria(criteria) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`🔍 [SUPABASE] Filtering shops by criteria:`, criteria);
        
        try {
            let query = this.supabase.from('diving_shops').select('*');
            
            // Apply filters
            Object.entries(criteria).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    query = query.eq(key, value);
                }
            });
            
            const { data, error } = await query.order('customer_rating', { ascending: false });
            
            if (error) throw error;
            
            console.log(`✅ Found ${data.length} shops matching criteria`);
            return data;
        } catch (error) {
            console.error('❌ Error filtering shops:', error.message);
            throw error;
        }
    }

    async getShopsByPriceRange(minPrice, maxPrice) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`💰 [SUPABASE] Getting shops in price range: ¥${minPrice}-${maxPrice}`);
        
        try {
            const { data, error } = await this.supabase
                .from('diving_shops')
                .select('*')
                .gte('fun_dive_price_2tanks', minPrice)
                .lte('fun_dive_price_2tanks', maxPrice)
                .order('fun_dive_price_2tanks');
            
            if (error) throw error;
            
            console.log(`✅ Found ${data.length} shops in price range`);
            return data;
        } catch (error) {
            console.error('❌ Error getting shops by price range:', error.message);
            throw error;
        }
    }

    async getShopsByRating(minRating) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`⭐ [SUPABASE] Getting shops with rating >= ${minRating}`);
        
        try {
            const { data, error } = await this.supabase
                .from('diving_shops')
                .select('*')
                .gte('customer_rating', minRating)
                .order('customer_rating', { ascending: false });
            
            if (error) throw error;
            
            console.log(`✅ Found ${data.length} shops with rating >= ${minRating}`);
            return data;
        } catch (error) {
            console.error('❌ Error getting shops by rating:', error.message);
            throw error;
        }
    }

    async addShop(shopData) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`➕ [SUPABASE] Adding shop: ${shopData.shop_name}`);
        
        try {
            const { data, error } = await this.supabase
                .from('diving_shops')
                .insert([shopData])
                .select()
                .single();
            
            if (error) throw error;
            
            console.log(`✅ Shop added successfully: ${data.shop_name}`);
            return data;
        } catch (error) {
            console.error('❌ Error adding shop:', error.message);
            throw error;
        }
    }

    async updateShop(shopId, updateData) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`🔄 [SUPABASE] Updating shop: ${shopId}`);
        
        try {
            // Add updated_at timestamp
            const dataWithTimestamp = {
                ...updateData,
                updated_at: new Date().toISOString()
            };
            
            const { data, error } = await this.supabase
                .from('diving_shops')
                .update(dataWithTimestamp)
                .eq('shop_id', shopId)
                .select()
                .single();
            
            if (error) throw error;
            
            console.log(`✅ Shop updated successfully: ${data.shop_name}`);
            return data;
        } catch (error) {
            console.error('❌ Error updating shop:', error.message);
            throw error;
        }
    }

    async deleteShop(shopId) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`🗑️ [SUPABASE] Deleting shop: ${shopId}`);
        
        try {
            const { error } = await this.supabase
                .from('diving_shops')
                .delete()
                .eq('shop_id', shopId);
            
            if (error) throw error;
            
            console.log(`✅ Shop deleted successfully: ${shopId}`);
            return true;
        } catch (error) {
            console.error('❌ Error deleting shop:', error.message);
            throw error;
        }
    }

    async bulkInsertShops(shopsData) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`📥 [SUPABASE] Bulk inserting ${shopsData.length} shops...`);
        
        try {
            // Supabase has a limit on bulk inserts, so we'll do it in chunks
            const chunkSize = 100;
            const results = [];
            
            for (let i = 0; i < shopsData.length; i += chunkSize) {
                const chunk = shopsData.slice(i, i + chunkSize);
                
                console.log(`   Processing chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(shopsData.length/chunkSize)} (${chunk.length} shops)`);
                
                const { data, error } = await this.supabase
                    .from('diving_shops')
                    .insert(chunk)
                    .select();
                
                if (error) {
                    console.error(`❌ Error in chunk ${Math.floor(i/chunkSize) + 1}:`, error.message);
                    throw error;
                }
                
                results.push(...data);
            }
            
            console.log(`✅ Successfully inserted ${results.length} shops`);
            return results;
        } catch (error) {
            console.error('❌ Error in bulk insert:', error.message);
            throw error;
        }
    }

    async getShopStatistics() {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log('📊 [SUPABASE] Getting shop statistics...');
        
        try {
            // Get total count
            const { count: totalShops, error: countError } = await this.supabase
                .from('diving_shops')
                .select('*', { count: 'exact', head: true });
            
            if (countError) throw countError;
            
            // Get all shops for detailed stats
            const { data: allShops, error: dataError } = await this.supabase
                .from('diving_shops')
                .select('area, customer_rating, fun_dive_price_2tanks, beginner_friendly, solo_welcome');
            
            if (dataError) throw dataError;
            
            // Calculate statistics
            const areas = [...new Set(allShops.map(shop => shop.area))];
            const avgRating = allShops.reduce((sum, shop) => sum + (shop.customer_rating || 0), 0) / allShops.length || 0;
            const avgPrice = allShops.reduce((sum, shop) => sum + (shop.fun_dive_price_2tanks || 0), 0) / allShops.length || 0;
            const beginnerFriendly = allShops.filter(shop => shop.beginner_friendly).length;
            const soloWelcome = allShops.filter(shop => shop.solo_welcome).length;
            
            const stats = {
                totalShops,
                areas: areas.sort(),
                avgRating: Math.round(avgRating * 10) / 10,
                avgPrice: Math.round(avgPrice),
                beginnerFriendly,
                soloWelcome,
                dataSource: 'supabase',
                lastUpdated: new Date().toISOString()
            };
            
            console.log(`✅ Statistics calculated for ${totalShops} shops`);
            return stats;
        } catch (error) {
            console.error('❌ Error getting statistics:', error.message);
            throw error;
        }
    }

    async saveFeedback(feedbackData) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        console.log(`📝 [SUPABASE] Saving feedback for shop: ${feedbackData.shop_id}`);
        
        try {
            const { data, error } = await this.supabase
                .from('user_feedback')
                .insert([feedbackData])
                .select()
                .single();
            
            if (error) throw error;
            
            console.log(`✅ Feedback saved: ${data.feedback_id}`);
            return data;
        } catch (error) {
            console.error('❌ Error saving feedback:', error.message);
            throw error;
        }
    }

    async getFeedbackByShop(shopId) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        try {
            const { data, error } = await this.supabase
                .from('user_feedback')
                .select('*')
                .eq('shop_id', shopId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('❌ Error getting feedback:', error.message);
            throw error;
        }
    }

    async saveConversation(conversationData) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        try {
            const { data, error } = await this.supabase
                .from('conversations')
                .insert([conversationData])
                .select()
                .single();
            
            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('❌ Error saving conversation:', error.message);
            throw error;
        }
    }

    async getUserConversations(userId, limit = 10) {
        if (!this.supabase) {
            throw new Error('Supabase not initialized');
        }
        
        try {
            const { data, error } = await this.supabase
                .from('conversations')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (error) throw error;
            
            return data;
        } catch (error) {
            console.error('❌ Error getting conversations:', error.message);
            throw error;
        }
    }

    async logOperation(operation, details) {
        console.log(`📝 [SUPABASE] Operation: ${operation} - ${details}`);
        
        // In production, this could save to a logs table
        // For now, just console log
        return true;
    }
}

module.exports = JijiSupabaseConnector;