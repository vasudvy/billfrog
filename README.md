# 🧠 AI Usage Tracker

A self-hostable dashboard for AI usage bill tracking with receipts-like format. Track prompts, responses, token usage, costs, and generate detailed billing reports across multiple AI providers.

## ✨ Features

### 📊 Core Tracking
- **Multi-Provider Support**: OpenAI, Anthropic (Claude), Google (Gemini)
- **Real-time Usage Tracking**: Prompts, responses, tokens, costs
- **Detailed Metadata**: Response times, retry counts, safety flags
- **Per-user/Team Breakdown**: Organize usage by users and teams

### 🧾 Billing & Receipts
- **Downloadable Receipts**: PDF and TXT formats
- **Detailed Cost Breakdown**: Input/output tokens with pricing
- **Exportable Reports**: CSV, JSON, PDF formats
- **Period-based Billing**: Daily, weekly, monthly summaries

### 🛡️ Safety & Monitoring
- **Safety Filters**: Content, cost, rate, and model-based filtering
- **Failure Tracking**: Retry attempts, error logging
- **Hallucination Detection**: Basic quality checks
- **Real-time Monitoring**: WebSocket updates

### 🎨 Modern UI
- **Telegram-inspired Design**: Clean, intuitive interface
- **Stripe-like Events**: Professional billing presentation
- **Dark/Light Mode**: User preference themes
- **Responsive Design**: Mobile and desktop optimized
- **Real-time Updates**: Live dashboard metrics

### 🔐 Security & Privacy
- **No Authentication Required**: Simple API key input
- **Local Data Storage**: SQLite database
- **Rate Limiting**: Configurable request limits
- **Input Validation**: Comprehensive data validation

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-usage-tracker
   ```

2. **Install dependencies**
   ```bash
   npm run install-deps
   ```

3. **Configure environment**
   ```bash
   cp server/.env.example server/.env
   # Edit server/.env with your preferences
   ```

4. **Start the application**
   ```bash
   npm run dev
   ```

5. **Access the dashboard**
   - Open http://localhost:3000 in your browser
   - The API runs on http://localhost:5000

### Production Deployment

1. **Build the client**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   npm start
   ```

## 📖 Usage Guide

### Getting Started

1. **Navigate to Usage Tracker**
   - Enter your AI provider API key
   - Select the provider and model
   - Configure request parameters

2. **Make Your First Request**
   - Enter a prompt
   - Click "Send Request"
   - View response and usage metrics

3. **Download Receipt**
   - Click "Receipt" button after successful request
   - Choose PDF or TXT format

### API Key Management

The application supports API keys from:

- **OpenAI**: `sk-...` format keys
- **Anthropic**: `sk-ant-...` format keys  
- **Google**: Standard API keys

API keys are stored locally in browser storage and never transmitted to external servers except the AI providers.

### Dashboard Features

- **Real-time Metrics**: Live updates every 5 seconds
- **Usage Trends**: 7-day rolling charts
- **Cost Tracking**: Detailed breakdowns by model
- **Recent Activity**: Latest API calls and status

### Reports & Exports

Generate comprehensive reports in multiple formats:

- **Usage Reports**: Detailed API call logs
- **Billing Reports**: Cost summaries and breakdowns
- **Performance Reports**: Response times and success rates

Export formats:
- **JSON**: Machine-readable data
- **CSV**: Spreadsheet compatibility
- **PDF**: Professional presentation

## 🏗️ Architecture

### Backend (Node.js/Express)
```
server/
├── index.js              # Main server file
├── database.js           # SQLite database layer
├── routes/               # API route handlers
│   ├── api.js           # General API routes
│   ├── usage.js         # Usage tracking
│   ├── reports.js       # Report generation
│   └── receipts.js      # Receipt management
├── services/            # Business logic
│   ├── ai-providers.js  # AI provider integrations
│   └── safety-filters.js # Safety and filtering
└── utils/               # Utilities
    ├── token-counter.js # Token counting
    └── validator.js     # Input validation
```

### Frontend (React)
```
client/src/
├── App.js               # Main application
├── components/          # React components
│   ├── Dashboard.js     # Overview dashboard
│   ├── UsageTracker.js  # Core tracking interface
│   ├── Reports.js       # Report generation
│   ├── Receipts.js      # Receipt management
│   └── Settings.js      # Configuration
└── index.js            # Application entry point
```

### Database Schema

SQLite database with tables for:
- `usage_logs`: API call tracking
- `receipts`: Generated receipts
- `safety_filters`: Configurable filters
- `model_pricing`: Current pricing data
- `system_settings`: Application configuration

## 🔧 Configuration

### Environment Variables

```bash
# Server Configuration
PORT=5000
NODE_ENV=production

# Database
DATABASE_PATH=./ai_usage_tracker.db

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

### Safety Filters

Configure automatic filtering for:
- **Content Filters**: Keyword blocking, PII detection
- **Cost Filters**: Maximum spend limits per call/day
- **Rate Filters**: Request frequency limits
- **Model Filters**: Allowed/blocked model lists

### Model Pricing

Pricing is automatically configured for major models but can be customized:
- OpenAI GPT models
- Anthropic Claude models  
- Google Gemini models

## 📊 API Reference

### Core Endpoints

- `POST /api/usage/track` - Track AI usage
- `GET /api/usage/logs` - Retrieve usage logs
- `GET /api/usage/summary` - Usage summaries
- `GET /api/reports/usage` - Generate usage reports
- `GET /api/receipts/usage/:id` - Download receipts
- `GET /api/stats` - Dashboard statistics

### WebSocket Events

Real-time updates via WebSocket:
- `usage_update`: New API call logged
- `metrics_update`: Updated dashboard metrics

## 🛡️ Security Considerations

### API Key Security
- API keys stored locally in browser
- Keys only sent to respective AI providers
- No server-side key storage

### Rate Limiting
- Configurable request limits
- IP-based throttling
- Provider-specific limits

### Data Privacy
- All data stored locally
- No external analytics by default
- SQLite database file

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Setup

```bash
# Install dependencies
npm run install-deps

# Start development servers
npm run dev

# Run tests (if available)
npm test
```

## 📄 License

MIT License - see LICENSE file for details.

## 🔗 Links

- **Documentation**: [GitHub Wiki](link-to-wiki)
- **Issues**: [GitHub Issues](link-to-issues)
- **Discussions**: [GitHub Discussions](link-to-discussions)

## 🆘 Support

For support and questions:
1. Check the documentation
2. Search existing issues
3. Create a new issue with details
4. Join community discussions

---

**Made with ❤️ for the AI community**

Self-host your AI usage tracking with complete control over your data and privacy.
