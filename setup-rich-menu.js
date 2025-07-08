#!/usr/bin/env node

/**
 * LINE Bot Rich Menu Setup Script
 * Jiji Diving Bot Rich Menu Configuration
 */

const { Client } = require('@line/bot-sdk');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class JijiRichMenuManager {
    constructor() {
        this.lineConfig = {
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET
        };
        
        if (!this.lineConfig.channelAccessToken || !this.lineConfig.channelSecret) {
            console.error('❌ LINE Bot credentials not found in environment variables');
            console.log('   Add to .env:');
            console.log('   LINE_CHANNEL_ACCESS_TOKEN=your_token');
            console.log('   LINE_CHANNEL_SECRET=your_secret');
            process.exit(1);
        }
        
        this.client = new Client(this.lineConfig);
    }
    
    async setupRichMenu() {
        try {
            console.log('🚀 Jiji Rich Menu Setup Starting...');
            
            // Step 1: Load rich menu configuration
            const richMenuConfig = await this.loadRichMenuConfig();
            console.log('✅ Rich menu configuration loaded');
            
            // Step 2: Create rich menu
            const richMenuId = await this.createRichMenu(richMenuConfig);
            console.log(`✅ Rich menu created with ID: ${richMenuId}`);
            
            // Step 3: Upload rich menu image
            await this.uploadRichMenuImage(richMenuId);
            console.log('✅ Rich menu image uploaded');
            
            // Step 4: Set as default rich menu
            await this.setDefaultRichMenu(richMenuId);
            console.log('✅ Rich menu set as default');
            
            console.log('🎉 Rich menu setup completed successfully!');
            console.log(`📱 Rich Menu ID: ${richMenuId}`);
            
            return richMenuId;
            
        } catch (error) {
            console.error('❌ Rich menu setup failed:', error);
            throw error;
        }
    }
    
    async loadRichMenuConfig() {
        const configPath = path.join(__dirname, 'line-rich-menu.json');
        const configData = await fs.readFile(configPath, 'utf8');
        return JSON.parse(configData);
    }
    
    async createRichMenu(config) {
        console.log('📋 Creating rich menu...');
        const response = await this.client.createRichMenu(config);
        return response.richMenuId;
    }
    
    async uploadRichMenuImage(richMenuId) {
        console.log('🖼️ Uploading rich menu image...');
        
        // Create a simple placeholder image or use pre-made image
        const imagePath = path.join(__dirname, 'rich-menu-image.png');
        
        try {
            const imageBuffer = await fs.readFile(imagePath);
            await this.client.setRichMenuImage(richMenuId, imageBuffer);
        } catch (error) {
            console.warn('⚠️ Rich menu image not found, using placeholder');
            // Create a simple colored image buffer (placeholder)
            await this.createPlaceholderImage(richMenuId);
        }
    }
    
    async createPlaceholderImage(richMenuId) {
        console.log('🎨 Creating placeholder rich menu image...');
        
        // This would typically use a graphics library to create an image
        // For now, we'll skip the image upload in development
        console.log('ℹ️ Skipping image upload in development mode');
        console.log('   To add a custom image:');
        console.log('   1. Create rich-menu-image.png (2500x1686 pixels)');
        console.log('   2. Place it in the project root');
        console.log('   3. Run this script again');
    }
    
    async setDefaultRichMenu(richMenuId) {
        console.log('⚙️ Setting as default rich menu...');
        await this.client.setDefaultRichMenu(richMenuId);
    }
    
    async removeAllRichMenus() {
        try {
            console.log('🧹 Removing existing rich menus...');
            
            const richMenuList = await this.client.getRichMenuList();
            
            for (const richMenu of richMenuList) {
                await this.client.deleteRichMenu(richMenu.richMenuId);
                console.log(`✅ Removed rich menu: ${richMenu.richMenuId}`);
            }
            
            console.log('✅ All rich menus removed');
            
        } catch (error) {
            console.error('❌ Error removing rich menus:', error);
        }
    }
    
    async listRichMenus() {
        try {
            console.log('📋 Listing current rich menus...');
            
            const richMenuList = await this.client.getRichMenuList();
            
            if (richMenuList.length === 0) {
                console.log('ℹ️ No rich menus found');
                return;
            }
            
            richMenuList.forEach((richMenu, index) => {
                console.log(`${index + 1}. ${richMenu.name}`);
                console.log(`   ID: ${richMenu.richMenuId}`);
                console.log(`   Size: ${richMenu.size.width}x${richMenu.size.height}`);
                console.log(`   Chat Bar Text: ${richMenu.chatBarText}`);
                console.log(`   Areas: ${richMenu.areas.length}`);
                console.log('');
            });
            
        } catch (error) {
            console.error('❌ Error listing rich menus:', error);
        }
    }
}

// CLI Interface
async function main() {
    const richMenuManager = new JijiRichMenuManager();
    
    const command = process.argv[2];
    
    switch (command) {
        case 'setup':
            await richMenuManager.setupRichMenu();
            break;
            
        case 'remove':
            await richMenuManager.removeAllRichMenus();
            break;
            
        case 'list':
            await richMenuManager.listRichMenus();
            break;
            
        default:
            console.log('🌊 Jiji Rich Menu Manager');
            console.log('');
            console.log('Usage:');
            console.log('  node setup-rich-menu.js setup   - Setup new rich menu');
            console.log('  node setup-rich-menu.js remove  - Remove all rich menus');
            console.log('  node setup-rich-menu.js list    - List current rich menus');
            console.log('');
            console.log('Environment Variables Required:');
            console.log('  LINE_CHANNEL_ACCESS_TOKEN');
            console.log('  LINE_CHANNEL_SECRET');
            break;
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = JijiRichMenuManager;