#!/usr/bin/env node

/**
 * 🎯 管理画面専用アプリ - dive-buddys.com
 * 目的: 管理画面のみ動作する最小構成
 */

const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Supabase設定
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('📊 Supabase初期化完了');
} else {
    console.warn('⚠️ Supabase設定が見つかりません（モックモードで動作）');
}

const app = express();
const PORT = process.env.PORT || 3000;

// 基本設定
app.use(express.json());
app.use(express.static('public'));

// ===== ヘルスチェック =====
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mode: 'admin_only',
        timestamp: new Date().toISOString() 
    });
});

app.get('/api/health', async (req, res) => {
    let dbStatus = 'unavailable';
    let dbError = null;
    
    // Supabase接続テスト
    if (supabase) {
        try {
            const { data, error } = await supabase
                .from('blogs')
                .select('count', { count: 'exact', head: true });
            
            if (error) {
                dbStatus = 'error';
                dbError = error.message;
            } else {
                dbStatus = 'connected';
            }
        } catch (error) {
            dbStatus = 'connection_failed';
            dbError = error.message;
        }
    }
    
    res.json({
        status: 'healthy',
        server: 'running',
        database: dbStatus,
        admin_panel: 'available',
        supabase_configured: !!supabase,
        error: dbError,
        timestamp: new Date().toISOString()
    });
});

// ===== 管理画面ページルーティング =====

// 管理ダッシュボード
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/dashboard.html'));
});

// 記事作成ページ
app.get('/admin/blog-editor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/blog-editor.html'));
});

// 記事管理ページ
app.get('/admin/blog-list', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin/blog-list.html'));
});

// ===== 管理画面用API（基本のみ） =====

// 記事一覧API（Supabase連携）
app.get('/api/blog/articles', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            message: 'Supabaseが設定されていません'
        });
    }
    
    try {
        const { data: articles, error } = await supabase
            .from('blogs')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('記事取得エラー:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: '記事の取得に失敗しました'
            });
        }
        
        res.json({
            success: true,
            data: articles || [],
            total: articles ? articles.length : 0
        });
        
    } catch (error) {
        console.error('API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'サーバーエラーが発生しました'
        });
    }
});

// 記事作成API（Supabase連携）
app.post('/api/blog/articles', async (req, res) => {
    if (!supabase) {
        return res.status(503).json({
            success: false,
            error: 'Database not available',
            message: 'Supabaseが設定されていません'
        });
    }
    
    try {
        const { title, excerpt, content, category, tags } = req.body;
        
        // 必須フィールドチェック
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'タイトルと内容は必須です'
            });
        }
        
        const articleData = {
            title,
            excerpt: excerpt || '',
            content,
            category: category || 'general',
            tags: Array.isArray(tags) ? tags : [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        const { data: article, error } = await supabase
            .from('blogs')
            .insert([articleData])
            .select()
            .single();
        
        if (error) {
            console.error('記事作成エラー:', error);
            return res.status(500).json({
                success: false,
                error: error.message,
                message: '記事の作成に失敗しました'
            });
        }
        
        console.log('📝 記事作成成功:', article);
        res.json({
            success: true,
            message: '記事が正常に作成されました',
            data: article
        });
        
    } catch (error) {
        console.error('API エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'サーバーエラーが発生しました'
        });
    }
});

// ===== メインページリダイレクト =====
app.get('/', (req, res) => {
    res.redirect('/admin/dashboard');
});

// ===== 404ハンドリング =====
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: '管理画面専用モードです',
        available_endpoints: [
            '/admin/dashboard',
            '/admin/blog-editor', 
            '/admin/blog-list',
            '/api/health',
            '/health'
        ]
    });
});

// ===== サーバー起動 =====
app.listen(PORT, () => {
    console.log('\n🎉=====================================');
    console.log('🎯 管理画面専用サーバー起動完了！');
    console.log('🌊 Dive Buddy\'s Admin Panel');
    console.log('=====================================');
    console.log(`📡 サーバー: https://dive-buddys.com`);
    console.log(`🎯 管理画面: https://dive-buddys.com/admin/dashboard`);
    console.log(`📝 記事作成: https://dive-buddys.com/admin/blog-editor`);
    console.log(`📋 記事管理: https://dive-buddys.com/admin/blog-list`);
    console.log('=====================================🎉\n');
});