const express = require('express');
const router = express.Router();
const database = require('../database');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

// Generate receipt for a specific usage log
router.get('/usage/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { format = 'pdf' } = req.query;
    
    // Get usage log
    const usageLog = await database.getQuery('SELECT * FROM usage_logs WHERE id = ?', [id]);
    
    if (!usageLog) {
      return res.status(404).json({ error: 'Usage log not found' });
    }
    
    // Parse JSON fields
    const parsedLog = {
      ...usageLog,
      safety_flags: JSON.parse(usageLog.safety_flags || '{}'),
      metadata: JSON.parse(usageLog.metadata || '{}')
    };
    
    // Generate receipt
    const receipt = {
      id: uuidv4(),
      type: 'usage',
      usage_log: parsedLog,
      generated_at: new Date().toISOString(),
      receipt_number: `RCP-${Date.now()}-${id.substring(0, 8)}`
    };
    
    // Return in requested format
    switch (format.toLowerCase()) {
      case 'txt':
        return generateTxtReceipt(res, receipt);
      case 'json':
        return res.json(receipt);
      default:
        return generatePdfReceipt(res, receipt);
    }
    
  } catch (error) {
    console.error('Error generating usage receipt:', error);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

// Generate receipt for a date range
router.get('/period', async (req, res) => {
  try {
    const {
      user_id,
      team_id,
      start_date,
      end_date,
      format = 'pdf'
    } = req.query;
    
    // Validate required parameters
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    
    // Get usage logs for the period
    const filters = {
      user_id,
      team_id,
      start_date,
      end_date
    };
    
    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });
    
    const usageLogs = await database.getUsageLogs(filters);
    
    if (usageLogs.length === 0) {
      return res.status(404).json({ error: 'No usage data found for the specified period' });
    }
    
    // Parse JSON fields
    const parsedLogs = usageLogs.map(log => ({
      ...log,
      safety_flags: JSON.parse(log.safety_flags || '{}'),
      metadata: JSON.parse(log.metadata || '{}')
    }));
    
    // Calculate totals
    const totals = {
      total_calls: parsedLogs.length,
      total_tokens: parsedLogs.reduce((sum, log) => sum + log.total_tokens, 0),
      total_input_tokens: parsedLogs.reduce((sum, log) => sum + log.input_tokens, 0),
      total_output_tokens: parsedLogs.reduce((sum, log) => sum + log.output_tokens, 0),
      total_cost: parsedLogs.reduce((sum, log) => sum + log.total_cost, 0),
      success_count: parsedLogs.filter(log => log.status === 'success').length,
      failure_count: parsedLogs.filter(log => log.status === 'failure').length,
      hallucination_count: parsedLogs.filter(log => log.status === 'hallucination').length
    };
    
    // Group by model
    const modelBreakdown = {};
    parsedLogs.forEach(log => {
      const key = `${log.model_provider}-${log.model_name}`;
      if (!modelBreakdown[key]) {
        modelBreakdown[key] = {
          provider: log.model_provider,
          model: log.model_name,
          calls: 0,
          tokens: 0,
          cost: 0
        };
      }
      modelBreakdown[key].calls++;
      modelBreakdown[key].tokens += log.total_tokens;
      modelBreakdown[key].cost += log.total_cost;
    });
    
    // Generate receipt
    const receipt = {
      id: uuidv4(),
      type: 'period',
      period: {
        start: start_date,
        end: end_date
      },
      user_id,
      team_id,
      totals,
      breakdown: Object.values(modelBreakdown),
      usage_logs: parsedLogs,
      generated_at: new Date().toISOString(),
      receipt_number: `RCP-${Date.now()}-PERIOD`
    };
    
    // Save receipt to database
    const receiptId = await database.insertReceipt({
      user_id,
      team_id,
      period_start: start_date,
      period_end: end_date,
      total_calls: totals.total_calls,
      total_tokens: totals.total_tokens,
      total_cost: totals.total_cost,
      breakdown: modelBreakdown,
      file_path: null // Will be updated if file is generated
    });
    
    // Return in requested format
    switch (format.toLowerCase()) {
      case 'txt':
        return generateTxtReceipt(res, receipt);
      case 'json':
        return res.json(receipt);
      default:
        return generatePdfReceipt(res, receipt);
    }
    
  } catch (error) {
    console.error('Error generating period receipt:', error);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});

// Get all receipts
router.get('/list', async (req, res) => {
  try {
    const {
      user_id,
      team_id,
      limit = 50,
      offset = 0
    } = req.query;
    
    let query = 'SELECT * FROM receipts WHERE 1=1';
    const params = [];
    
    if (user_id) {
      query += ' AND user_id = ?';
      params.push(user_id);
    }
    
    if (team_id) {
      query += ' AND team_id = ?';
      params.push(team_id);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const receipts = await database.allQuery(query, params);
    
    // Parse JSON fields
    const parsedReceipts = receipts.map(receipt => ({
      ...receipt,
      breakdown: JSON.parse(receipt.breakdown || '{}')
    }));
    
    res.json(parsedReceipts);
  } catch (error) {
    console.error('Error fetching receipts:', error);
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// Generate PDF receipt
async function generatePdfReceipt(res, receipt) {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Generate HTML for the receipt
    const html = generateReceiptHtml(receipt);
    
    await page.setContent(html);
    
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    await browser.close();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receipt_number}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating PDF receipt:', error);
    res.status(500).json({ error: 'Failed to generate PDF receipt' });
  }
}

// Generate TXT receipt
function generateTxtReceipt(res, receipt) {
  try {
    const txtContent = generateReceiptTxt(receipt);
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receipt.receipt_number}.txt"`);
    res.send(txtContent);
    
  } catch (error) {
    console.error('Error generating TXT receipt:', error);
    res.status(500).json({ error: 'Failed to generate TXT receipt' });
  }
}

// Generate HTML for PDF receipt
function generateReceiptHtml(receipt) {
  const generatedAt = moment(receipt.generated_at).format('YYYY-MM-DD HH:mm:ss');
  
  let contentHtml = '';
  
  if (receipt.type === 'usage') {
    const log = receipt.usage_log;
    contentHtml = `
      <div class="section">
        <h3>Usage Details</h3>
        <div class="details">
          <p><strong>Model:</strong> ${log.model_provider} / ${log.model_name}</p>
          <p><strong>Status:</strong> <span class="status ${log.status}">${log.status.toUpperCase()}</span></p>
          <p><strong>Date:</strong> ${moment(log.created_at).format('YYYY-MM-DD HH:mm:ss')}</p>
          <p><strong>Response Time:</strong> ${log.response_time_ms}ms</p>
        </div>
      </div>
      
      <div class="section">
        <h3>Token Usage</h3>
        <table>
          <tr>
            <td>Input Tokens</td>
            <td>${log.input_tokens}</td>
          </tr>
          <tr>
            <td>Output Tokens</td>
            <td>${log.output_tokens}</td>
          </tr>
          <tr>
            <td>Total Tokens</td>
            <td><strong>${log.total_tokens}</strong></td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h3>Cost Breakdown</h3>
        <table>
          <tr>
            <td>Input Cost (${log.input_tokens} × $${log.cost_per_input_token.toFixed(6)})</td>
            <td>$${(log.input_tokens * log.cost_per_input_token).toFixed(6)}</td>
          </tr>
          <tr>
            <td>Output Cost (${log.output_tokens} × $${log.cost_per_output_token.toFixed(6)})</td>
            <td>$${(log.output_tokens * log.cost_per_output_token).toFixed(6)}</td>
          </tr>
          <tr class="total">
            <td><strong>Total Cost</strong></td>
            <td><strong>$${log.total_cost.toFixed(6)}</strong></td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h3>Request Details</h3>
        <div class="request-content">
          <p><strong>Prompt:</strong></p>
          <div class="content-box">${log.prompt}</div>
          ${log.response ? `
            <p><strong>Response:</strong></p>
            <div class="content-box">${log.response}</div>
          ` : ''}
        </div>
      </div>
    `;
  } else if (receipt.type === 'period') {
    const breakdown = receipt.breakdown || [];
    contentHtml = `
      <div class="section">
        <h3>Period Summary</h3>
        <div class="details">
          <p><strong>Period:</strong> ${moment(receipt.period.start).format('YYYY-MM-DD')} to ${moment(receipt.period.end).format('YYYY-MM-DD')}</p>
          <p><strong>Total Calls:</strong> ${receipt.totals.total_calls}</p>
          <p><strong>Success Rate:</strong> ${((receipt.totals.success_count / receipt.totals.total_calls) * 100).toFixed(1)}%</p>
        </div>
      </div>
      
      <div class="section">
        <h3>Usage Summary</h3>
        <table>
          <tr>
            <td>Total Calls</td>
            <td>${receipt.totals.total_calls}</td>
          </tr>
          <tr>
            <td>Total Tokens</td>
            <td>${receipt.totals.total_tokens}</td>
          </tr>
          <tr>
            <td>Successful Calls</td>
            <td>${receipt.totals.success_count}</td>
          </tr>
          <tr>
            <td>Failed Calls</td>
            <td>${receipt.totals.failure_count}</td>
          </tr>
          <tr>
            <td>Hallucination Flags</td>
            <td>${receipt.totals.hallucination_count}</td>
          </tr>
          <tr class="total">
            <td><strong>Total Cost</strong></td>
            <td><strong>$${receipt.totals.total_cost.toFixed(6)}</strong></td>
          </tr>
        </table>
      </div>
      
      <div class="section">
        <h3>Model Breakdown</h3>
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Model</th>
              <th>Calls</th>
              <th>Tokens</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            ${breakdown.map(item => `
              <tr>
                <td>${item.provider}</td>
                <td>${item.model}</td>
                <td>${item.calls}</td>
                <td>${item.tokens}</td>
                <td>$${item.cost.toFixed(6)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>AI Usage Receipt - ${receipt.receipt_number}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: 20px;
          color: #333;
          background-color: #f9f9f9;
        }
        .receipt {
          background: white;
          max-width: 800px;
          margin: 0 auto;
          padding: 30px;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #007bff;
          padding-bottom: 20px;
        }
        .header h1 {
          color: #007bff;
          margin: 0;
          font-size: 24px;
        }
        .header h2 {
          color: #666;
          margin: 10px 0;
          font-size: 18px;
        }
        .header p {
          margin: 5px 0;
          color: #888;
        }
        .section {
          margin-bottom: 25px;
        }
        .section h3 {
          color: #007bff;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
          margin-bottom: 15px;
        }
        .details p {
          margin: 8px 0;
          line-height: 1.4;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .total {
          background-color: #e8f4f8;
          font-weight: bold;
        }
        .status {
          padding: 3px 8px;
          border-radius: 3px;
          font-size: 12px;
        }
        .status.success {
          background-color: #d4edda;
          color: #155724;
        }
        .status.failure {
          background-color: #f8d7da;
          color: #721c24;
        }
        .status.hallucination {
          background-color: #fff3cd;
          color: #856404;
        }
        .content-box {
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 5px;
          padding: 15px;
          margin: 10px 0;
          font-size: 14px;
          line-height: 1.4;
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          color: #666;
          font-size: 12px;
          border-top: 1px solid #eee;
          padding-top: 15px;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h1>🧠 AI Usage Tracker</h1>
          <h2>Receipt</h2>
          <p><strong>Receipt Number:</strong> ${receipt.receipt_number}</p>
          <p><strong>Generated:</strong> ${generatedAt}</p>
        </div>
        
        ${contentHtml}
        
        <div class="footer">
          <p>This receipt was generated by AI Usage Tracker</p>
          <p>For support, visit our documentation or contact your system administrator</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Generate TXT receipt
function generateReceiptTxt(receipt) {
  const generatedAt = moment(receipt.generated_at).format('YYYY-MM-DD HH:mm:ss');
  
  let content = `
=====================================
    AI USAGE TRACKER - RECEIPT
=====================================

Receipt Number: ${receipt.receipt_number}
Generated: ${generatedAt}

`;
  
  if (receipt.type === 'usage') {
    const log = receipt.usage_log;
    content += `
USAGE DETAILS
-------------
Model: ${log.model_provider} / ${log.model_name}
Status: ${log.status.toUpperCase()}
Date: ${moment(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
Response Time: ${log.response_time_ms}ms

TOKEN USAGE
-----------
Input Tokens: ${log.input_tokens}
Output Tokens: ${log.output_tokens}
Total Tokens: ${log.total_tokens}

COST BREAKDOWN
--------------
Input Cost: $${(log.input_tokens * log.cost_per_input_token).toFixed(6)}
Output Cost: $${(log.output_tokens * log.cost_per_output_token).toFixed(6)}
Total Cost: $${log.total_cost.toFixed(6)}

REQUEST DETAILS
---------------
Prompt:
${log.prompt}

${log.response ? `Response:
${log.response}` : ''}
`;
  } else if (receipt.type === 'period') {
    const breakdown = receipt.breakdown || [];
    content += `
PERIOD SUMMARY
--------------
Period: ${moment(receipt.period.start).format('YYYY-MM-DD')} to ${moment(receipt.period.end).format('YYYY-MM-DD')}
Total Calls: ${receipt.totals.total_calls}
Success Rate: ${((receipt.totals.success_count / receipt.totals.total_calls) * 100).toFixed(1)}%

USAGE SUMMARY
-------------
Total Calls: ${receipt.totals.total_calls}
Total Tokens: ${receipt.totals.total_tokens}
Successful Calls: ${receipt.totals.success_count}
Failed Calls: ${receipt.totals.failure_count}
Hallucination Flags: ${receipt.totals.hallucination_count}
Total Cost: $${receipt.totals.total_cost.toFixed(6)}

MODEL BREAKDOWN
---------------
${breakdown.map(item => 
  `${item.provider}/${item.model}: ${item.calls} calls, ${item.tokens} tokens, $${item.cost.toFixed(6)}`
).join('\n')}
`;
  }
  
  content += `

=====================================
Generated by AI Usage Tracker
=====================================
`;
  
  return content;
}

module.exports = router;