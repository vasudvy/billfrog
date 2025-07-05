const database = require('../database');

// Check safety filters before making a request
async function checkFilters(requestData) {
  const { user_id, team_id, model_provider, model_name, prompt, options } = requestData;
  
  try {
    // Get all active safety filters
    const filters = await database.getSafetyFilters();
    
    const result = {
      allowed: true,
      reasons: [],
      flags: {}
    };
    
    for (const filter of filters) {
      const rules = JSON.parse(filter.rules);
      const filterResult = await applyFilter(filter, rules, requestData);
      
      if (!filterResult.allowed) {
        result.allowed = false;
        result.reasons.push({
          filter: filter.name,
          reason: filterResult.reason
        });
      }
      
      // Collect flags for monitoring
      if (filterResult.flags) {
        result.flags[filter.name] = filterResult.flags;
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error checking safety filters:', error);
    return {
      allowed: true, // Default to allowing if there's an error
      reasons: [],
      flags: { error: 'Safety filter check failed' }
    };
  }
}

// Apply a specific filter
async function applyFilter(filter, rules, requestData) {
  const { user_id, team_id, model_provider, model_name, prompt, options } = requestData;
  
  switch (filter.filter_type) {
    case 'content':
      return await applyContentFilter(rules, requestData);
    case 'cost':
      return await applyCostFilter(rules, requestData);
    case 'rate':
      return await applyRateFilter(rules, requestData);
    case 'model':
      return await applyModelFilter(rules, requestData);
    default:
      return { allowed: true, reason: 'Unknown filter type' };
  }
}

// Content-based filtering
async function applyContentFilter(rules, requestData) {
  const { prompt } = requestData;
  
  const result = {
    allowed: true,
    reason: '',
    flags: {}
  };
  
  // Check for blocked keywords
  if (rules.blocked_keywords && rules.blocked_keywords.length > 0) {
    const blockedWords = rules.blocked_keywords.map(word => word.toLowerCase());
    const promptLower = prompt.toLowerCase();
    
    for (const word of blockedWords) {
      if (promptLower.includes(word)) {
        result.allowed = false;
        result.reason = `Contains blocked keyword: ${word}`;
        result.flags.blocked_keyword = word;
        break;
      }
    }
  }
  
  // Check prompt length
  if (rules.max_prompt_length && prompt.length > rules.max_prompt_length) {
    result.allowed = false;
    result.reason = `Prompt too long: ${prompt.length} > ${rules.max_prompt_length}`;
    result.flags.prompt_too_long = true;
  }
  
  // Check for PII patterns
  if (rules.check_pii) {
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/, // SSN
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}-\d{3}-\d{4}\b/ // Phone number
    ];
    
    for (const pattern of piiPatterns) {
      if (pattern.test(prompt)) {
        result.flags.potential_pii = true;
        if (rules.block_pii) {
          result.allowed = false;
          result.reason = 'Contains potential PII';
        }
        break;
      }
    }
  }
  
  return result;
}

// Cost-based filtering
async function applyCostFilter(rules, requestData) {
  const { model_provider, model_name, prompt } = requestData;
  
  const result = {
    allowed: true,
    reason: '',
    flags: {}
  };
  
  try {
    // Get model pricing
    const pricing = await database.getModelPricing(model_provider, model_name);
    
    if (!pricing) {
      result.flags.no_pricing_info = true;
      return result;
    }
    
    // Estimate cost
    const estimatedTokens = estimateTokenCount(prompt);
    const estimatedCost = (estimatedTokens * pricing.input_cost_per_1k_tokens) / 1000;
    
    // Check maximum cost per call
    if (rules.max_cost_per_call && estimatedCost > rules.max_cost_per_call) {
      result.allowed = false;
      result.reason = `Estimated cost too high: $${estimatedCost.toFixed(6)} > $${rules.max_cost_per_call}`;
      result.flags.cost_too_high = true;
    }
    
    // Check daily spending limit
    if (rules.daily_spending_limit) {
      const today = new Date().toISOString().split('T')[0];
      const dailySpending = await database.getQuery(`
        SELECT SUM(total_cost) as total_cost 
        FROM usage_logs 
        WHERE DATE(created_at) = ? AND user_id = ?
      `, [today, requestData.user_id]);
      
      const currentSpending = dailySpending ? dailySpending.total_cost || 0 : 0;
      
      if (currentSpending + estimatedCost > rules.daily_spending_limit) {
        result.allowed = false;
        result.reason = `Daily spending limit exceeded: $${currentSpending.toFixed(6)} + $${estimatedCost.toFixed(6)} > $${rules.daily_spending_limit}`;
        result.flags.daily_limit_exceeded = true;
      }
    }
    
    result.flags.estimated_cost = estimatedCost;
    
  } catch (error) {
    console.error('Error applying cost filter:', error);
    result.flags.cost_filter_error = true;
  }
  
  return result;
}

// Rate-based filtering
async function applyRateFilter(rules, requestData) {
  const { user_id, team_id } = requestData;
  
  const result = {
    allowed: true,
    reason: '',
    flags: {}
  };
  
  try {
    const now = new Date();
    
    // Check calls per minute
    if (rules.max_calls_per_minute) {
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
      const recentCalls = await database.getQuery(`
        SELECT COUNT(*) as count 
        FROM usage_logs 
        WHERE created_at >= ? AND user_id = ?
      `, [oneMinuteAgo.toISOString(), user_id]);
      
      if (recentCalls.count >= rules.max_calls_per_minute) {
        result.allowed = false;
        result.reason = `Rate limit exceeded: ${recentCalls.count} calls per minute`;
        result.flags.rate_limit_exceeded = true;
      }
    }
    
    // Check calls per hour
    if (rules.max_calls_per_hour) {
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const recentCalls = await database.getQuery(`
        SELECT COUNT(*) as count 
        FROM usage_logs 
        WHERE created_at >= ? AND user_id = ?
      `, [oneHourAgo.toISOString(), user_id]);
      
      if (recentCalls.count >= rules.max_calls_per_hour) {
        result.allowed = false;
        result.reason = `Hourly rate limit exceeded: ${recentCalls.count} calls per hour`;
        result.flags.hourly_limit_exceeded = true;
      }
    }
    
    // Check calls per day
    if (rules.max_calls_per_day) {
      const today = new Date().toISOString().split('T')[0];
      const dailyCalls = await database.getQuery(`
        SELECT COUNT(*) as count 
        FROM usage_logs 
        WHERE DATE(created_at) = ? AND user_id = ?
      `, [today, user_id]);
      
      if (dailyCalls.count >= rules.max_calls_per_day) {
        result.allowed = false;
        result.reason = `Daily rate limit exceeded: ${dailyCalls.count} calls per day`;
        result.flags.daily_limit_exceeded = true;
      }
    }
    
  } catch (error) {
    console.error('Error applying rate filter:', error);
    result.flags.rate_filter_error = true;
  }
  
  return result;
}

// Model-based filtering
async function applyModelFilter(rules, requestData) {
  const { model_provider, model_name } = requestData;
  
  const result = {
    allowed: true,
    reason: '',
    flags: {}
  };
  
  // Check allowed models
  if (rules.allowed_models && rules.allowed_models.length > 0) {
    const modelKey = `${model_provider}/${model_name}`;
    if (!rules.allowed_models.includes(modelKey)) {
      result.allowed = false;
      result.reason = `Model not allowed: ${modelKey}`;
      result.flags.model_not_allowed = true;
    }
  }
  
  // Check blocked models
  if (rules.blocked_models && rules.blocked_models.length > 0) {
    const modelKey = `${model_provider}/${model_name}`;
    if (rules.blocked_models.includes(modelKey)) {
      result.allowed = false;
      result.reason = `Model blocked: ${modelKey}`;
      result.flags.model_blocked = true;
    }
  }
  
  return result;
}

// Check response quality for potential issues
async function checkResponseQuality(prompt, response) {
  const flags = [];
  
  // Check for potential hallucinations
  if (checkForHallucination(prompt, response)) {
    flags.push('potential_hallucination');
  }
  
  // Check for repetitive responses
  if (checkForRepetition(response)) {
    flags.push('repetitive_response');
  }
  
  // Check for incomplete responses
  if (checkForIncompleteResponse(response)) {
    flags.push('incomplete_response');
  }
  
  // Check for inappropriate content
  if (checkForInappropriateContent(response)) {
    flags.push('inappropriate_content');
  }
  
  return { flags };
}

// Simple hallucination detection
function checkForHallucination(prompt, response) {
  // Basic heuristics for hallucination detection
  const responseLength = response.length;
  const promptLength = prompt.length;
  
  // If response is significantly longer than prompt, might be hallucination
  if (responseLength > promptLength * 5) {
    return true;
  }
  
  // Check for common hallucination patterns
  const hallucinationPatterns = [
    /I don't have access to/i,
    /I cannot browse the internet/i,
    /As an AI, I don't have/i,
    /I'm not able to access/i
  ];
  
  for (const pattern of hallucinationPatterns) {
    if (pattern.test(response)) {
      return false; // These are actually honest responses
    }
  }
  
  // Check for made-up specific facts
  const suspiciousPatterns = [
    /\d{4}-\d{2}-\d{2}/g, // Specific dates
    /\$\d+\.\d{2}/g, // Specific prices
    /\b\d{3}-\d{3}-\d{4}\b/g // Phone numbers
  ];
  
  let suspiciousCount = 0;
  for (const pattern of suspiciousPatterns) {
    const matches = response.match(pattern);
    if (matches) {
      suspiciousCount += matches.length;
    }
  }
  
  return suspiciousCount > 3;
}

// Check for repetitive content
function checkForRepetition(response) {
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const uniqueSentences = new Set(sentences.map(s => s.trim().toLowerCase()));
  
  return sentences.length > 3 && uniqueSentences.size < sentences.length * 0.7;
}

// Check for incomplete responses
function checkForIncompleteResponse(response) {
  const incompletePatterns = [
    /\.\.\.$/, // Ends with ellipsis
    /\[incomplete\]/i,
    /\[truncated\]/i,
    /\[cut off\]/i
  ];
  
  return incompletePatterns.some(pattern => pattern.test(response));
}

// Check for inappropriate content
function checkForInappropriateContent(response) {
  const inappropriatePatterns = [
    /\b(hate|racist|sexist|discriminatory)\b/i,
    /\b(violence|violent|kill|murder)\b/i,
    /\b(illegal|crime|criminal)\b/i
  ];
  
  return inappropriatePatterns.some(pattern => pattern.test(response));
}

// Simple token estimation
function estimateTokenCount(text) {
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

module.exports = {
  checkFilters,
  checkResponseQuality,
  applyFilter,
  applyContentFilter,
  applyCostFilter,
  applyRateFilter,
  applyModelFilter
};