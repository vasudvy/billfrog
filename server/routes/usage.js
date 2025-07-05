const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const database = require('../database');
const aiProviders = require('../services/ai-providers');
const safetyFilters = require('../services/safety-filters');
const tokenCounter = require('../utils/token-counter');

// Create new usage session
router.post('/session', async (req, res) => {
  try {
    const { user_id, team_id, name } = req.body;
    const session_id = uuidv4();
    
    // Store session info in memory or database if needed
    res.json({ session_id, message: 'Session created successfully' });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Track AI usage
router.post('/track', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const {
      user_id,
      team_id,
      session_id,
      model_provider,
      model_name,
      prompt,
      api_key,
      options = {}
    } = req.body;
    
    // Validate required fields
    if (!model_provider || !model_name || !prompt || !api_key) {
      return res.status(400).json({ 
        error: 'Missing required fields: model_provider, model_name, prompt, api_key' 
      });
    }
    
    // Check safety filters before making the call
    const safetyCheck = await safetyFilters.checkFilters({
      user_id,
      team_id,
      model_provider,
      model_name,
      prompt,
      options
    });
    
    if (!safetyCheck.allowed) {
      return res.status(403).json({
        error: 'Request blocked by safety filters',
        reasons: safetyCheck.reasons
      });
    }
    
    // Get model pricing
    const pricing = await database.getModelPricing(model_provider, model_name);
    
    let usageData = {
      user_id,
      team_id,
      session_id,
      model_provider,
      model_name,
      prompt,
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
      cost_per_input_token: pricing ? pricing.input_cost_per_1k_tokens / 1000 : 0,
      cost_per_output_token: pricing ? pricing.output_cost_per_1k_tokens / 1000 : 0,
      total_cost: 0,
      status: 'processing',
      retry_count: 0,
      response_time_ms: 0,
      safety_flags: safetyCheck.flags || {},
      metadata: {
        user_agent: req.get('User-Agent'),
        ip_address: req.ip,
        timestamp: new Date().toISOString(),
        ...options
      }
    };
    
    try {
      // Make the AI API call
      const aiResponse = await aiProviders.makeRequest(
        model_provider,
        api_key,
        {
          model: model_name,
          prompt,
          ...options
        }
      );
      
      // Count tokens
      const inputTokens = tokenCounter.countTokens(prompt, model_provider);
      const outputTokens = tokenCounter.countTokens(aiResponse.response, model_provider);
      
      // Calculate costs
      const inputCost = inputTokens * usageData.cost_per_input_token;
      const outputCost = outputTokens * usageData.cost_per_output_token;
      
      // Update usage data
      usageData.response = aiResponse.response;
      usageData.input_tokens = inputTokens;
      usageData.output_tokens = outputTokens;
      usageData.total_tokens = inputTokens + outputTokens;
      usageData.total_cost = inputCost + outputCost;
      usageData.status = 'success';
      usageData.response_time_ms = Date.now() - startTime;
      usageData.metadata.actual_model = aiResponse.model || model_name;
      usageData.metadata.finish_reason = aiResponse.finish_reason;
      
      // Check for potential hallucinations or issues
      const qualityCheck = await safetyFilters.checkResponseQuality(prompt, aiResponse.response);
      if (qualityCheck.flags.length > 0) {
        usageData.status = 'hallucination';
        usageData.safety_flags.quality_issues = qualityCheck.flags;
      }
      
    } catch (aiError) {
      console.error('AI API Error:', aiError);
      usageData.status = 'failure';
      usageData.error_message = aiError.message;
      usageData.response_time_ms = Date.now() - startTime;
    }
    
    // Log the usage to database
    const logId = await database.insertUsageLog(usageData);
    
    // Send real-time update via WebSocket
    const wss = req.app.locals.wss;
    if (wss) {
      wss.clients.forEach(client => {
        if (client.readyState === client.OPEN) {
          client.send(JSON.stringify({
            type: 'usage_update',
            data: { ...usageData, id: logId }
          }));
        }
      });
    }
    
    // Return response
    res.json({
      id: logId,
      response: usageData.response,
      usage: {
        input_tokens: usageData.input_tokens,
        output_tokens: usageData.output_tokens,
        total_tokens: usageData.total_tokens,
        cost: usageData.total_cost
      },
      status: usageData.status,
      response_time_ms: usageData.response_time_ms,
      safety_flags: usageData.safety_flags
    });
    
  } catch (error) {
    console.error('Error tracking usage:', error);
    res.status(500).json({ error: 'Failed to track usage' });
  }
});

// Get usage logs
router.get('/logs', async (req, res) => {
  try {
    const {
      user_id,
      team_id,
      start_date,
      end_date,
      model_provider,
      model_name,
      status,
      limit = 100,
      offset = 0
    } = req.query;
    
    const filters = {
      user_id,
      team_id,
      start_date,
      end_date,
      model_provider,
      model_name,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });
    
    const logs = await database.getUsageLogs(filters);
    
    // Parse JSON fields
    const parsedLogs = logs.map(log => ({
      ...log,
      safety_flags: JSON.parse(log.safety_flags || '{}'),
      metadata: JSON.parse(log.metadata || '{}')
    }));
    
    res.json(parsedLogs);
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    res.status(500).json({ error: 'Failed to fetch usage logs' });
  }
});

// Get usage summary
router.get('/summary', async (req, res) => {
  try {
    const {
      user_id,
      team_id,
      start_date,
      end_date,
      group_by = 'day' // day, week, month, model, provider
    } = req.query;
    
    let query = `
      SELECT 
        DATE(created_at) as date,
        model_provider,
        model_name,
        COUNT(*) as total_calls,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failure_count,
        COUNT(CASE WHEN status = 'hallucination' THEN 1 END) as hallucination_count
      FROM usage_logs
      WHERE 1=1
    `;
    
    const params = [];
    
    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }
    
    if (team_id) {
      query += ' AND team_id = ?';
      params.push(team_id);
    }
    
    if (start_date) {
      query += ' AND created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND created_at <= ?';
      params.push(end_date);
    }
    
    // Group by clause
    switch (group_by) {
      case 'week':
        query += ' GROUP BY strftime("%Y-%W", created_at), model_provider, model_name';
        break;
      case 'month':
        query += ' GROUP BY strftime("%Y-%m", created_at), model_provider, model_name';
        break;
      case 'model':
        query += ' GROUP BY model_provider, model_name';
        break;
      case 'provider':
        query += ' GROUP BY model_provider';
        break;
      default:
        query += ' GROUP BY DATE(created_at), model_provider, model_name';
    }
    
    query += ' ORDER BY date DESC, total_cost DESC';
    
    const summary = await database.allQuery(query, params);
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

// Retry failed request
router.post('/retry/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { api_key } = req.body;
    
    // Get the original request
    const originalLog = await database.getQuery('SELECT * FROM usage_logs WHERE id = ?', [id]);
    
    if (!originalLog) {
      return res.status(404).json({ error: 'Usage log not found' });
    }
    
    if (originalLog.status === 'success') {
      return res.status(400).json({ error: 'Cannot retry successful request' });
    }
    
    // Create new tracking request with retry count
    const retryData = {
      user_id: originalLog.user_id,
      team_id: originalLog.team_id,
      session_id: originalLog.session_id,
      model_provider: originalLog.model_provider,
      model_name: originalLog.model_name,
      prompt: originalLog.prompt,
      api_key,
      options: {
        retry_of: id,
        retry_count: originalLog.retry_count + 1
      }
    };
    
    // Forward to the track endpoint
    req.body = retryData;
    return router.handle(req, res);
    
  } catch (error) {
    console.error('Error retrying request:', error);
    res.status(500).json({ error: 'Failed to retry request' });
  }
});

// Get real-time usage metrics
router.get('/metrics/realtime', async (req, res) => {
  try {
    const metrics = await database.allQuery(`
      SELECT 
        COUNT(*) as calls_last_hour,
        SUM(total_cost) as cost_last_hour,
        SUM(total_tokens) as tokens_last_hour,
        AVG(response_time_ms) as avg_response_time_last_hour
      FROM usage_logs
      WHERE created_at >= datetime('now', '-1 hour')
    `);
    
    const activeModels = await database.allQuery(`
      SELECT 
        model_provider,
        model_name,
        COUNT(*) as calls,
        SUM(total_cost) as cost
      FROM usage_logs
      WHERE created_at >= datetime('now', '-1 hour')
      GROUP BY model_provider, model_name
      ORDER BY calls DESC
    `);
    
    res.json({
      metrics: metrics[0],
      activeModels
    });
  } catch (error) {
    console.error('Error fetching real-time metrics:', error);
    res.status(500).json({ error: 'Failed to fetch real-time metrics' });
  }
});

module.exports = router;