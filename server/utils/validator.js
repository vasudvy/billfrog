const Joi = require('joi');

// Validation schemas
const schemas = {
  // Usage tracking validation
  usageTrack: Joi.object({
    user_id: Joi.string().uuid().optional(),
    team_id: Joi.string().uuid().optional(),
    session_id: Joi.string().uuid().optional(),
    model_provider: Joi.string().valid('openai', 'anthropic', 'google').required(),
    model_name: Joi.string().required(),
    prompt: Joi.string().min(1).max(50000).required(),
    api_key: Joi.string().min(10).required(),
    options: Joi.object({
      max_tokens: Joi.number().integer().min(1).max(8000).optional(),
      temperature: Joi.number().min(0).max(2).optional(),
      top_p: Joi.number().min(0).max(1).optional(),
      frequency_penalty: Joi.number().min(-2).max(2).optional(),
      presence_penalty: Joi.number().min(-2).max(2).optional(),
      stop: Joi.array().items(Joi.string()).max(4).optional(),
      stream: Joi.boolean().optional(),
      retry_count: Joi.number().integer().min(0).max(5).optional(),
      retry_of: Joi.string().uuid().optional()
    }).optional()
  }),

  // Safety filter validation
  safetyFilter: Joi.object({
    name: Joi.string().min(1).max(100).required(),
    description: Joi.string().max(500).optional(),
    filter_type: Joi.string().valid('content', 'cost', 'rate', 'model').required(),
    rules: Joi.object().required(),
    is_active: Joi.boolean().optional()
  }),

  // Model pricing validation
  modelPricing: Joi.object({
    provider: Joi.string().valid('openai', 'anthropic', 'google').required(),
    model_name: Joi.string().required(),
    input_cost: Joi.number().min(0).max(1).required(),
    output_cost: Joi.number().min(0).max(1).required(),
    currency: Joi.string().valid('USD', 'EUR', 'GBP').optional().default('USD')
  }),

  // Report generation validation
  reportGeneration: Joi.object({
    user_id: Joi.string().uuid().optional(),
    team_id: Joi.string().uuid().optional(),
    start_date: Joi.date().iso().required(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
    format: Joi.string().valid('json', 'csv', 'pdf').optional().default('json'),
    group_by: Joi.string().valid('day', 'week', 'month', 'model', 'provider').optional().default('day'),
    include_details: Joi.boolean().optional().default(false)
  }),

  // Receipt generation validation
  receiptGeneration: Joi.object({
    user_id: Joi.string().uuid().optional(),
    team_id: Joi.string().uuid().optional(),
    start_date: Joi.date().iso().required(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).required(),
    format: Joi.string().valid('json', 'pdf', 'txt').optional().default('pdf')
  }),

  // API key test validation
  apiKeyTest: Joi.object({
    provider: Joi.string().valid('openai', 'anthropic', 'google').required(),
    apiKey: Joi.string().min(10).required(),
    modelName: Joi.string().optional()
  }),

  // Query parameters validation
  queryParams: {
    pagination: Joi.object({
      limit: Joi.number().integer().min(1).max(1000).optional().default(100),
      offset: Joi.number().integer().min(0).optional().default(0)
    }),
    
    dateRange: Joi.object({
      start_date: Joi.date().iso().optional(),
      end_date: Joi.date().iso().optional()
    }),
    
    filtering: Joi.object({
      user_id: Joi.string().uuid().optional(),
      team_id: Joi.string().uuid().optional(),
      model_provider: Joi.string().valid('openai', 'anthropic', 'google').optional(),
      model_name: Joi.string().optional(),
      status: Joi.string().valid('success', 'failure', 'hallucination', 'retry').optional()
    })
  }
};

// Validation functions
function validateUsageTrack(data) {
  return schemas.usageTrack.validate(data);
}

function validateSafetyFilter(data) {
  return schemas.safetyFilter.validate(data);
}

function validateModelPricing(data) {
  return schemas.modelPricing.validate(data);
}

function validateReportGeneration(data) {
  return schemas.reportGeneration.validate(data);
}

function validateReceiptGeneration(data) {
  return schemas.receiptGeneration.validate(data);
}

function validateApiKeyTest(data) {
  return schemas.apiKeyTest.validate(data);
}

function validateQueryParams(data, type) {
  const schema = schemas.queryParams[type];
  if (!schema) {
    throw new Error(`Unknown query parameter type: ${type}`);
  }
  return schema.validate(data);
}

// Generic validation middleware
function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    req.body = value;
    next();
  };
}

// Query parameter validation middleware
function validateQuery(schemaType) {
  return (req, res, next) => {
    const { error, value } = validateQueryParams(req.query, schemaType);
    if (error) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    req.query = { ...req.query, ...value };
    next();
  };
}

// Sanitize input data
function sanitizeInput(data) {
  if (typeof data === 'string') {
    // Remove potentially harmful characters
    return data.replace(/[<>]/g, '').trim();
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
}

// Validate UUID format
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

// Validate API key format (basic check)
function isValidApiKey(apiKey, provider) {
  if (!apiKey || typeof apiKey !== 'string') {
    return false;
  }
  
  switch (provider?.toLowerCase()) {
    case 'openai':
      return apiKey.startsWith('sk-') && apiKey.length >= 40;
    case 'anthropic':
      return apiKey.startsWith('sk-ant-') && apiKey.length >= 40;
    case 'google':
      return apiKey.length >= 20; // Google API keys are typically 39 characters
    default:
      return apiKey.length >= 10;
  }
}

// Validate date range
function isValidDateRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return false;
  }
  
  return start <= end;
}

// Validate cost value
function isValidCost(cost) {
  return typeof cost === 'number' && cost >= 0 && cost <= 1000;
}

// Validate token count
function isValidTokenCount(tokens) {
  return typeof tokens === 'number' && tokens >= 0 && tokens <= 1000000;
}

// Comprehensive validation for usage logs
function validateUsageLog(data) {
  const errors = [];
  
  // Required fields
  if (!data.model_provider) errors.push('model_provider is required');
  if (!data.model_name) errors.push('model_name is required');
  if (!data.prompt) errors.push('prompt is required');
  
  // Optional UUID fields
  if (data.user_id && !isValidUUID(data.user_id)) {
    errors.push('user_id must be a valid UUID');
  }
  if (data.team_id && !isValidUUID(data.team_id)) {
    errors.push('team_id must be a valid UUID');
  }
  if (data.session_id && !isValidUUID(data.session_id)) {
    errors.push('session_id must be a valid UUID');
  }
  
  // Token counts
  if (data.input_tokens !== undefined && !isValidTokenCount(data.input_tokens)) {
    errors.push('input_tokens must be a valid number');
  }
  if (data.output_tokens !== undefined && !isValidTokenCount(data.output_tokens)) {
    errors.push('output_tokens must be a valid number');
  }
  
  // Cost validation
  if (data.total_cost !== undefined && !isValidCost(data.total_cost)) {
    errors.push('total_cost must be a valid number');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Rate limiting validation
function validateRateLimit(requestCount, limit, window) {
  return requestCount <= limit;
}

module.exports = {
  schemas,
  validateUsageTrack,
  validateSafetyFilter,
  validateModelPricing,
  validateReportGeneration,
  validateReceiptGeneration,
  validateApiKeyTest,
  validateQueryParams,
  validateBody,
  validateQuery,
  sanitizeInput,
  isValidUUID,
  isValidEmail,
  isValidApiKey,
  isValidDateRange,
  isValidCost,
  isValidTokenCount,
  validateUsageLog,
  validateRateLimit
};