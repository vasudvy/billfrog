const express = require('express');
const router = express.Router();
const database = require('../database');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const moment = require('moment');

// Generate usage report
router.get('/usage', async (req, res) => {
  try {
    const {
      user_id,
      team_id,
      start_date,
      end_date,
      format = 'json',
      group_by = 'day',
      include_details = false
    } = req.query;
    
    // Build query
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
    
    const reportData = await database.allQuery(query, params);
    
    // Include detailed logs if requested
    let detailedLogs = [];
    if (include_details === 'true') {
      let detailQuery = 'SELECT * FROM usage_logs WHERE 1=1';
      const detailParams = [];
      
      if (user_id) {
        detailQuery += ' AND user_id = ?';
        detailParams.push(user_id);
      }
      
      if (team_id) {
        detailQuery += ' AND team_id = ?';
        detailParams.push(team_id);
      }
      
      if (start_date) {
        detailQuery += ' AND created_at >= ?';
        detailParams.push(start_date);
      }
      
      if (end_date) {
        detailQuery += ' AND created_at <= ?';
        detailParams.push(end_date);
      }
      
      detailQuery += ' ORDER BY created_at DESC';
      detailedLogs = await database.allQuery(detailQuery, detailParams);
    }
    
    const report = {
      metadata: {
        generated_at: new Date().toISOString(),
        period: {
          start: start_date,
          end: end_date
        },
        filters: {
          user_id,
          team_id,
          group_by
        }
      },
      summary: reportData,
      details: detailedLogs
    };
    
    // Return in requested format
    switch (format.toLowerCase()) {
      case 'csv':
        return await generateCsvReport(res, report, 'usage-report');
      case 'pdf':
        return await generatePdfReport(res, report, 'usage-report');
      default:
        res.json(report);
    }
    
  } catch (error) {
    console.error('Error generating usage report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Generate billing report
router.get('/billing', async (req, res) => {
  try {
    const {
      user_id,
      team_id,
      start_date,
      end_date,
      format = 'json'
    } = req.query;
    
    // Get billing summary
    let query = `
      SELECT 
        user_id,
        team_id,
        model_provider,
        model_name,
        COUNT(*) as total_calls,
        SUM(total_tokens) as total_tokens,
        SUM(total_cost) as total_cost,
        MIN(created_at) as first_call,
        MAX(created_at) as last_call
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
    
    query += ' GROUP BY user_id, team_id, model_provider, model_name ORDER BY total_cost DESC';
    
    const billingData = await database.allQuery(query, params);
    
    // Calculate totals
    const totals = {
      total_calls: billingData.reduce((sum, item) => sum + item.total_calls, 0),
      total_tokens: billingData.reduce((sum, item) => sum + item.total_tokens, 0),
      total_cost: billingData.reduce((sum, item) => sum + item.total_cost, 0)
    };
    
    const report = {
      metadata: {
        generated_at: new Date().toISOString(),
        period: {
          start: start_date,
          end: end_date
        },
        filters: {
          user_id,
          team_id
        }
      },
      totals,
      breakdown: billingData
    };
    
    // Return in requested format
    switch (format.toLowerCase()) {
      case 'csv':
        return await generateCsvReport(res, report, 'billing-report');
      case 'pdf':
        return await generatePdfReport(res, report, 'billing-report');
      default:
        res.json(report);
    }
    
  } catch (error) {
    console.error('Error generating billing report:', error);
    res.status(500).json({ error: 'Failed to generate billing report' });
  }
});

// Generate performance report
router.get('/performance', async (req, res) => {
  try {
    const {
      user_id,
      team_id,
      start_date,
      end_date,
      format = 'json'
    } = req.query;
    
    let query = `
      SELECT 
        model_provider,
        model_name,
        COUNT(*) as total_calls,
        AVG(response_time_ms) as avg_response_time,
        MIN(response_time_ms) as min_response_time,
        MAX(response_time_ms) as max_response_time,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'failure' THEN 1 END) as failure_count,
        COUNT(CASE WHEN status = 'hallucination' THEN 1 END) as hallucination_count,
        (COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*)) as success_rate
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
    
    query += ' GROUP BY model_provider, model_name ORDER BY total_calls DESC';
    
    const performanceData = await database.allQuery(query, params);
    
    const report = {
      metadata: {
        generated_at: new Date().toISOString(),
        period: {
          start: start_date,
          end: end_date
        },
        filters: {
          user_id,
          team_id
        }
      },
      performance: performanceData
    };
    
    // Return in requested format
    switch (format.toLowerCase()) {
      case 'csv':
        return await generateCsvReport(res, report, 'performance-report');
      case 'pdf':
        return await generatePdfReport(res, report, 'performance-report');
      default:
        res.json(report);
    }
    
  } catch (error) {
    console.error('Error generating performance report:', error);
    res.status(500).json({ error: 'Failed to generate performance report' });
  }
});

// Generate CSV report
async function generateCsvReport(res, report, filename) {
  const csvPath = path.join(__dirname, '../temp', `${filename}-${Date.now()}.csv`);
  
  // Ensure temp directory exists
  const tempDir = path.dirname(csvPath);
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  let csvData = [];
  
  // Flatten the report data for CSV
  if (report.summary) {
    csvData = report.summary;
  } else if (report.breakdown) {
    csvData = report.breakdown;
  } else if (report.performance) {
    csvData = report.performance;
  }
  
  if (csvData.length === 0) {
    return res.status(400).json({ error: 'No data to export' });
  }
  
  // Create CSV writer
  const csvWriter = createCsvWriter({
    path: csvPath,
    header: Object.keys(csvData[0]).map(key => ({ id: key, title: key }))
  });
  
  try {
    await csvWriter.writeRecords(csvData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    
    const fileStream = fs.createReadStream(csvPath);
    fileStream.pipe(res);
    
    fileStream.on('end', () => {
      // Clean up temp file
      fs.unlinkSync(csvPath);
    });
    
  } catch (error) {
    console.error('Error generating CSV:', error);
    res.status(500).json({ error: 'Failed to generate CSV report' });
  }
}

// Generate PDF report
async function generatePdfReport(res, report, filename) {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    // Generate HTML for the report
    const html = generateReportHtml(report, filename);
    
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
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
}

// Generate HTML for PDF report
function generateReportHtml(report, reportType) {
  const title = reportType.replace('-', ' ').toUpperCase();
  const generatedAt = moment(report.metadata.generated_at).format('YYYY-MM-DD HH:mm:ss');
  
  let tableHtml = '';
  let data = [];
  
  if (report.summary) {
    data = report.summary;
  } else if (report.breakdown) {
    data = report.breakdown;
  } else if (report.performance) {
    data = report.performance;
  }
  
  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    
    tableHtml = `
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${header.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.map(row => `
            <tr>
              ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          color: #333;
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
        .header p {
          margin: 5px 0;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
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
        .totals {
          background-color: #e8f4f8;
          margin: 20px 0;
          padding: 15px;
          border-radius: 5px;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>AI Usage Tracker</h1>
        <h2>${title}</h2>
        <p>Generated on: ${generatedAt}</p>
        ${report.metadata.period.start ? `<p>Period: ${report.metadata.period.start} to ${report.metadata.period.end}</p>` : ''}
      </div>
      
      ${report.totals ? `
        <div class="totals">
          <h3>Summary</h3>
          <p><strong>Total Calls:</strong> ${report.totals.total_calls}</p>
          <p><strong>Total Tokens:</strong> ${report.totals.total_tokens}</p>
          <p><strong>Total Cost:</strong> $${report.totals.total_cost.toFixed(4)}</p>
        </div>
      ` : ''}
      
      ${tableHtml}
      
      <div class="footer">
        <p>This report was generated by AI Usage Tracker</p>
      </div>
    </body>
    </html>
  `;
}

module.exports = router;