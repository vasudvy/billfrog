const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const dbPath = path.join(__dirname, 'ai_usage_tracker.db');
let db;

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('📊 Connected to SQLite database');
        createTables()
          .then(() => {
            console.log('✅ Database tables initialized');
            resolve();
          })
          .catch(reject);
      }
    });
  });
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    const queries = [
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT,
        api_keys TEXT, -- JSON string of API keys
        team_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Teams table
      `CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // AI Usage tracking table
      `CREATE TABLE IF NOT EXISTS usage_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        team_id TEXT,
        session_id TEXT,
        model_provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', etc.
        model_name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        response TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        cost_per_input_token REAL DEFAULT 0,
        cost_per_output_token REAL DEFAULT 0,
        total_cost REAL DEFAULT 0,
        status TEXT DEFAULT 'success', -- 'success', 'failure', 'retry', 'hallucination'
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        response_time_ms INTEGER,
        safety_flags TEXT, -- JSON string of safety flags
        metadata TEXT, -- JSON string for additional metadata
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )`,
      
      // Receipts table
      `CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        team_id TEXT,
        period_start DATETIME,
        period_end DATETIME,
        total_calls INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        breakdown TEXT, -- JSON string of cost breakdown
        file_path TEXT, -- Path to generated PDF/TXT file
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )`,
      
      // Safety filters table
      `CREATE TABLE IF NOT EXISTS safety_filters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        filter_type TEXT NOT NULL, -- 'content', 'cost', 'rate', 'model'
        rules TEXT NOT NULL, -- JSON string of filter rules
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // API Keys table (encrypted storage)
      `CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        provider TEXT NOT NULL, -- 'openai', 'anthropic', 'google', etc.
        key_name TEXT,
        key_hash TEXT NOT NULL, -- Hashed version for security
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`,
      
      // Model pricing table
      `CREATE TABLE IF NOT EXISTS model_pricing (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        model_name TEXT NOT NULL,
        input_cost_per_1k_tokens REAL NOT NULL,
        output_cost_per_1k_tokens REAL NOT NULL,
        currency TEXT DEFAULT 'USD',
        effective_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true
      )`,
      
      // System settings table
      `CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];
    
    let completed = 0;
    const total = queries.length;
    
    queries.forEach(query => {
      db.run(query, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
        } else {
          completed++;
          if (completed === total) {
            insertDefaultData().then(resolve).catch(reject);
          }
        }
      });
    });
  });
};

const insertDefaultData = async () => {
  // Insert default model pricing
  const defaultPricing = [
    // OpenAI GPT-4
    { provider: 'openai', model_name: 'gpt-4', input_cost: 0.03, output_cost: 0.06 },
    { provider: 'openai', model_name: 'gpt-4-turbo', input_cost: 0.01, output_cost: 0.03 },
    { provider: 'openai', model_name: 'gpt-3.5-turbo', input_cost: 0.001, output_cost: 0.002 },
    
    // Anthropic Claude
    { provider: 'anthropic', model_name: 'claude-3-opus', input_cost: 0.015, output_cost: 0.075 },
    { provider: 'anthropic', model_name: 'claude-3-sonnet', input_cost: 0.003, output_cost: 0.015 },
    { provider: 'anthropic', model_name: 'claude-3-haiku', input_cost: 0.00025, output_cost: 0.00125 },
    
    // Google Gemini
    { provider: 'google', model_name: 'gemini-pro', input_cost: 0.00025, output_cost: 0.0005 },
    { provider: 'google', model_name: 'gemini-pro-vision', input_cost: 0.00025, output_cost: 0.0005 }
  ];
  
  for (const pricing of defaultPricing) {
    await insertModelPricing(pricing);
  }
  
  // Insert default safety filters
  const defaultFilters = [
    {
      name: 'Cost Alert',
      description: 'Alert when single call exceeds $1',
      filter_type: 'cost',
      rules: JSON.stringify({ max_cost_per_call: 1.0, action: 'alert' })
    },
    {
      name: 'Rate Limit',
      description: 'Limit to 1000 calls per hour',
      filter_type: 'rate',
      rules: JSON.stringify({ max_calls_per_hour: 1000, action: 'block' })
    }
  ];
  
  for (const filter of defaultFilters) {
    await insertSafetyFilter(filter);
  }
};

// Database query functions
const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const getQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const allQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Usage tracking functions
const insertUsageLog = async (usageData) => {
  const id = uuidv4();
  const query = `
    INSERT INTO usage_logs (
      id, user_id, team_id, session_id, model_provider, model_name, prompt, response,
      input_tokens, output_tokens, total_tokens, cost_per_input_token, cost_per_output_token,
      total_cost, status, error_message, retry_count, response_time_ms, safety_flags, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const params = [
    id, usageData.user_id, usageData.team_id, usageData.session_id,
    usageData.model_provider, usageData.model_name, usageData.prompt, usageData.response,
    usageData.input_tokens, usageData.output_tokens, usageData.total_tokens,
    usageData.cost_per_input_token, usageData.cost_per_output_token, usageData.total_cost,
    usageData.status, usageData.error_message, usageData.retry_count, usageData.response_time_ms,
    JSON.stringify(usageData.safety_flags || {}), JSON.stringify(usageData.metadata || {})
  ];
  
  await runQuery(query, params);
  return id;
};

const getUsageLogs = async (filters = {}) => {
  let query = 'SELECT * FROM usage_logs';
  let params = [];
  let whereClause = [];
  
  if (filters.user_id) {
    whereClause.push('user_id = ?');
    params.push(filters.user_id);
  }
  
  if (filters.team_id) {
    whereClause.push('team_id = ?');
    params.push(filters.team_id);
  }
  
  if (filters.start_date) {
    whereClause.push('created_at >= ?');
    params.push(filters.start_date);
  }
  
  if (filters.end_date) {
    whereClause.push('created_at <= ?');
    params.push(filters.end_date);
  }
  
  if (whereClause.length > 0) {
    query += ' WHERE ' + whereClause.join(' AND ');
  }
  
  query += ' ORDER BY created_at DESC';
  
  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }
  
  return await allQuery(query, params);
};

const insertModelPricing = async (pricingData) => {
  const id = uuidv4();
  const query = `
    INSERT INTO model_pricing (id, provider, model_name, input_cost_per_1k_tokens, output_cost_per_1k_tokens, currency)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  
  await runQuery(query, [
    id, pricingData.provider, pricingData.model_name,
    pricingData.input_cost, pricingData.output_cost, 'USD'
  ]);
  
  return id;
};

const getModelPricing = async (provider, modelName) => {
  const query = `
    SELECT * FROM model_pricing 
    WHERE provider = ? AND model_name = ? AND is_active = true
    ORDER BY effective_date DESC LIMIT 1
  `;
  
  return await getQuery(query, [provider, modelName]);
};

const insertSafetyFilter = async (filterData) => {
  const id = uuidv4();
  const query = `
    INSERT INTO safety_filters (id, name, description, filter_type, rules)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  await runQuery(query, [
    id, filterData.name, filterData.description, filterData.filter_type, filterData.rules
  ]);
  
  return id;
};

const getSafetyFilters = async () => {
  return await allQuery('SELECT * FROM safety_filters WHERE is_active = true');
};

const insertReceipt = async (receiptData) => {
  const id = uuidv4();
  const query = `
    INSERT INTO receipts (id, user_id, team_id, period_start, period_end, total_calls, total_tokens, total_cost, breakdown, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  await runQuery(query, [
    id, receiptData.user_id, receiptData.team_id, receiptData.period_start, receiptData.period_end,
    receiptData.total_calls, receiptData.total_tokens, receiptData.total_cost,
    JSON.stringify(receiptData.breakdown), receiptData.file_path
  ]);
  
  return id;
};

const getDatabase = () => db;

module.exports = {
  initializeDatabase,
  getDatabase,
  insertUsageLog,
  getUsageLogs,
  insertModelPricing,
  getModelPricing,
  insertSafetyFilter,
  getSafetyFilters,
  insertReceipt,
  runQuery,
  getQuery,
  allQuery
};