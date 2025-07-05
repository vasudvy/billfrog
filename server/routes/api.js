const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const database = require('../database');
const aiProviders = require('../services/ai-providers');
const validator = require('../utils/validator');

// Get system stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await database.allQuery(`
      SELECT 
        COUNT(*) as total_calls,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        AVG(response_time_ms) as avg_response_time,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT model_provider) as unique_providers
      FROM usage_logs
      WHERE DATE(created_at) >= DATE('now', '-30 days')
    `);
    
    const recentActivity = await database.allQuery(`
      SELECT 
        model_provider,
        model_name,
        COUNT(*) as call_count,
        SUM(total_cost) as total_cost
      FROM usage_logs
      WHERE DATE(created_at) >= DATE('now', '-7 days')
      GROUP BY model_provider, model_name
      ORDER BY call_count DESC
      LIMIT 10
    `);
    
    const errorStats = await database.allQuery(`
      SELECT 
        status,
        COUNT(*) as count
      FROM usage_logs
      WHERE DATE(created_at) >= DATE('now', '-30 days')
      GROUP BY status
    `);
    
    res.json({
      overview: stats[0],
      recentActivity,
      errorStats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Get model pricing
router.get('/pricing', async (req, res) => {
  try {
    const pricing = await database.allQuery(`
      SELECT * FROM model_pricing 
      WHERE is_active = true
      ORDER BY provider, model_name
    `);
    
    res.json(pricing);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: 'Failed to fetch pricing' });
  }
});

// Update model pricing
router.post('/pricing', async (req, res) => {
  try {
    const { provider, model_name, input_cost, output_cost } = req.body;
    
    // Validate input
    if (!provider || !model_name || input_cost === undefined || output_cost === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Deactivate existing pricing for this model
    await database.runQuery(`
      UPDATE model_pricing 
      SET is_active = false 
      WHERE provider = ? AND model_name = ?
    `, [provider, model_name]);
    
    // Insert new pricing
    const id = await database.insertModelPricing({
      provider,
      model_name,
      input_cost,
      output_cost
    });
    
    res.json({ id, message: 'Pricing updated successfully' });
  } catch (error) {
    console.error('Error updating pricing:', error);
    res.status(500).json({ error: 'Failed to update pricing' });
  }
});

// Get safety filters
router.get('/safety-filters', async (req, res) => {
  try {
    const filters = await database.getSafetyFilters();
    res.json(filters);
  } catch (error) {
    console.error('Error fetching safety filters:', error);
    res.status(500).json({ error: 'Failed to fetch safety filters' });
  }
});

// Create safety filter
router.post('/safety-filters', async (req, res) => {
  try {
    const { name, description, filter_type, rules } = req.body;
    
    // Validate input
    if (!name || !filter_type || !rules) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const id = await database.insertSafetyFilter({
      name,
      description,
      filter_type,
      rules: JSON.stringify(rules)
    });
    
    res.json({ id, message: 'Safety filter created successfully' });
  } catch (error) {
    console.error('Error creating safety filter:', error);
    res.status(500).json({ error: 'Failed to create safety filter' });
  }
});

// Update safety filter
router.put('/safety-filters/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, filter_type, rules, is_active } = req.body;
    
    const query = `
      UPDATE safety_filters 
      SET name = ?, description = ?, filter_type = ?, rules = ?, is_active = ?
      WHERE id = ?
    `;
    
    await database.runQuery(query, [
      name, description, filter_type, JSON.stringify(rules), is_active, id
    ]);
    
    res.json({ message: 'Safety filter updated successfully' });
  } catch (error) {
    console.error('Error updating safety filter:', error);
    res.status(500).json({ error: 'Failed to update safety filter' });
  }
});

// Test API key
router.post('/test-api-key', async (req, res) => {
  try {
    const { provider, apiKey, modelName } = req.body;
    
    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API key are required' });
    }
    
    // Test the API key with a simple request
    const testResult = await aiProviders.testApiKey(provider, apiKey, modelName);
    
    res.json({
      success: testResult.success,
      message: testResult.message,
      modelInfo: testResult.modelInfo
    });
  } catch (error) {
    console.error('Error testing API key:', error);
    res.status(500).json({ error: 'Failed to test API key' });
  }
});

// Get available models for a provider
router.get('/models/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const models = await aiProviders.getAvailableModels(provider);
    res.json(models);
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// System settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await database.allQuery('SELECT * FROM system_settings');
    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.key] = setting.value;
    });
    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const settings = req.body;
    
    for (const [key, value] of Object.entries(settings)) {
      await database.runQuery(`
        INSERT OR REPLACE INTO system_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `, [key, value]);
    }
    
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;