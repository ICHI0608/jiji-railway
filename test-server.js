#!/usr/bin/env node

console.log('🔥 TEST SERVER STARTING');

const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: 'test-version',
        message: 'Test server is working'
    });
});

// UptimeRobot endpoints - GET and POST support
app.get('/api/line-webhook', (req, res) => {
    res.json({
        status: 'ok',
        message: 'LINE Bot Webhook endpoint is active (GET)',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/line-webhook', (req, res) => {
    res.json({
        status: 'ok',
        message: 'LINE Bot Webhook endpoint is active (POST)',
        timestamp: new Date().toISOString()
    });
});

app.get('/admin', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Admin panel endpoint is active',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/reviews', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Review system endpoint is active',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/reviews', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Review submission endpoint is active',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/shops/search', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Shop search endpoint is active',
        timestamp: new Date().toISOString()
    });
});

app.get('/member', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Member system endpoint is active',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Jiji Test Server',
        endpoints: [
            '/api/health',
            '/api/line-webhook',
            '/admin',
            '/api/reviews',
            '/api/shops/search',
            '/member'
        ]
    });
});

app.listen(port, () => {
    console.log(`✅ Test server running on port ${port}`);
    console.log(`🌐 Health: http://localhost:${port}/api/health`);
});