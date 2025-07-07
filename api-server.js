#!/usr/bin/env node

/**
 * Jiji Diving Bot API Server
 * Phase 2: API Integration with Emotional Matching System
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import our modules
const MockJijiSheetsConnector = require('./src/sheets-connector-mock');
const JijiEmotionalMatcherWithRealData = require('./test-emotional-matching-with-real-data');

class JijiAPIServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.sheetsConnector = new MockJijiSheetsConnector();
        this.emotionalMatcher = new JijiEmotionalMatcherWithRealData();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Basic middleware
        this.app.use(cors());
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
        
        // Serve static files (excluding index.html which we handle manually)
        this.app.use(express.static(path.join(__dirname), { 
            index: false  // Don't serve index.html automatically
        }));
    }

    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                version: '1.2.0',
                services: {
                    emotional_matching: 'active',
                    sheets_connector: 'active',
                    jiji_persona: 'active'
                }
            });
        });

        // Get all shops
        this.app.get('/api/shops', async (req, res) => {
            try {
                const shops = await this.sheetsConnector.getAllShops();
                res.json({
                    success: true,
                    data: shops,
                    count: shops.length
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get shops by area
        this.app.get('/api/shops/area/:area', async (req, res) => {
            try {
                const { area } = req.params;
                const shops = await this.sheetsConnector.getShopsByArea(area);
                res.json({
                    success: true,
                    data: shops,
                    count: shops.length,
                    area: area
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get shop by ID
        this.app.get('/api/shops/:id', async (req, res) => {
            try {
                const { id } = req.params;
                const shop = await this.sheetsConnector.getShopById(id);
                
                if (!shop) {
                    return res.status(404).json({
                        success: false,
                        error: 'Shop not found'
                    });
                }
                
                res.json({
                    success: true,
                    data: shop
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Emotional matching endpoint
        this.app.post('/api/match', async (req, res) => {
            try {
                const { message, area, maxResults = 3 } = req.body;
                
                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required'
                    });
                }
                
                console.log(`🔍 Matching request: "${message}" in area: ${area || 'all'}`);
                
                const results = await this.emotionalMatcher.findBestMatches(
                    message, 
                    area, 
                    maxResults
                );
                
                res.json({
                    success: true,
                    data: {
                        query: {
                            message,
                            area,
                            maxResults
                        },
                        emotional_analysis: results.emotionalAnalysis,
                        recommendations: results.recommendations,
                        search_stats: {
                            total_shops_searched: results.totalShopsSearched,
                            area_searched: results.searchArea,
                            processing_time: 'instant'
                        }
                    }
                });
                
            } catch (error) {
                console.error('❌ Matching error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Search shops with filters
        this.app.post('/api/shops/search', async (req, res) => {
            try {
                const { 
                    area, 
                    minRating = 0, 
                    maxPrice = 50000, 
                    beginnerFriendly, 
                    soloWelcome,
                    privateGuide 
                } = req.body;
                
                let shops = await this.sheetsConnector.getAllShops();
                
                // Apply filters
                if (area) {
                    shops = shops.filter(shop => shop.area === area);
                }
                
                if (minRating > 0) {
                    shops = shops.filter(shop => shop.customer_rating >= minRating);
                }
                
                if (maxPrice < 50000) {
                    shops = shops.filter(shop => shop.fun_dive_price_2tanks <= maxPrice);
                }
                
                if (beginnerFriendly !== undefined) {
                    shops = shops.filter(shop => shop.beginner_friendly === beginnerFriendly);
                }
                
                if (soloWelcome !== undefined) {
                    shops = shops.filter(shop => shop.solo_welcome === soloWelcome);
                }
                
                if (privateGuide !== undefined) {
                    shops = shops.filter(shop => shop.private_guide_available === privateGuide);
                }
                
                res.json({
                    success: true,
                    data: shops,
                    count: shops.length,
                    filters_applied: {
                        area, minRating, maxPrice, beginnerFriendly, soloWelcome, privateGuide
                    }
                });
                
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Get statistics
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.sheetsConnector.getShopStatistics();
                res.json({
                    success: true,
                    data: stats
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Serve the main website
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, 'index-integrated.html'));
        });

        // Serve the original website
        this.app.get('/original', (req, res) => {
            res.sendFile(path.join(__dirname, 'index.html'));
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                available_endpoints: [
                    'GET /api/health',
                    'GET /api/shops',
                    'GET /api/shops/area/:area',
                    'GET /api/shops/:id',
                    'POST /api/match',
                    'POST /api/shops/search',
                    'GET /api/stats'
                ]
            });
        });

        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('❌ Server error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        });
    }

    async start() {
        try {
            // Test database connection
            console.log('🔧 Testing database connection...');
            const stats = await this.sheetsConnector.getShopStatistics();
            console.log(`✅ Database ready: ${stats.totalShops} shops loaded`);
            
            // Start server
            this.app.listen(this.port, () => {
                console.log('\n🚀 Jiji Diving Bot API Server Started!');
                console.log('='.repeat(50));
                console.log(`🌐 Server: http://localhost:${this.port}`);
                console.log(`📊 API Health: http://localhost:${this.port}/api/health`);
                console.log(`🧠 Emotional Matching: POST http://localhost:${this.port}/api/match`);
                console.log(`🏪 Shop Data: http://localhost:${this.port}/api/shops`);
                console.log(`📈 Statistics: http://localhost:${this.port}/api/stats`);
                console.log('='.repeat(50));
                console.log('💡 Ready for Phase 2 testing!');
            });
            
        } catch (error) {
            console.error('❌ Failed to start server:', error);
            process.exit(1);
        }
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new JijiAPIServer();
    server.start();
}

module.exports = JijiAPIServer;