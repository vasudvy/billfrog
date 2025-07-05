const axios = require('axios');

// AI Provider configurations
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4-1106-preview'],
    headers: (apiKey) => ({
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    })
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
    headers: (apiKey) => ({
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    })
  },
  google: {
    name: 'Google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    models: ['gemini-pro', 'gemini-pro-vision'],
    headers: (apiKey) => ({
      'Content-Type': 'application/json'
    })
  }
};

// Test API key for a provider
async function testApiKey(provider, apiKey, modelName) {
  try {
    const providerConfig = PROVIDERS[provider.toLowerCase()];
    if (!providerConfig) {
      return { success: false, message: 'Unsupported provider' };
    }
    
    const testPrompt = 'Hello, this is a test message. Please respond with "Test successful".';
    
    const response = await makeRequest(provider, apiKey, {
      model: modelName || providerConfig.models[0],
      prompt: testPrompt,
      max_tokens: 50
    });
    
    return {
      success: true,
      message: 'API key is valid',
      modelInfo: {
        provider: providerConfig.name,
        model: modelName || providerConfig.models[0],
        response: response.response
      }
    };
  } catch (error) {
    return {
      success: false,
      message: `API key test failed: ${error.message}`
    };
  }
}

// Make request to AI provider
async function makeRequest(provider, apiKey, options) {
  const providerConfig = PROVIDERS[provider.toLowerCase()];
  if (!providerConfig) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  
  const { model, prompt, max_tokens = 1000, temperature = 0.7 } = options;
  
  try {
    let response;
    
    switch (provider.toLowerCase()) {
      case 'openai':
        response = await makeOpenAIRequest(apiKey, model, prompt, max_tokens, temperature);
        break;
      case 'anthropic':
        response = await makeAnthropicRequest(apiKey, model, prompt, max_tokens, temperature);
        break;
      case 'google':
        response = await makeGoogleRequest(apiKey, model, prompt, max_tokens, temperature);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    return response;
  } catch (error) {
    throw new Error(`${provider} API error: ${error.message}`);
  }
}

// OpenAI API request
async function makeOpenAIRequest(apiKey, model, prompt, maxTokens, temperature) {
  const url = `${PROVIDERS.openai.baseUrl}/chat/completions`;
  
  const payload = {
    model: model,
    messages: [
      { role: 'user', content: prompt }
    ],
    max_tokens: maxTokens,
    temperature: temperature
  };
  
  const response = await axios.post(url, payload, {
    headers: PROVIDERS.openai.headers(apiKey)
  });
  
  const choice = response.data.choices[0];
  const usage = response.data.usage;
  
  return {
    response: choice.message.content,
    model: response.data.model,
    finish_reason: choice.finish_reason,
    usage: {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens
    }
  };
}

// Anthropic API request
async function makeAnthropicRequest(apiKey, model, prompt, maxTokens, temperature) {
  const url = `${PROVIDERS.anthropic.baseUrl}/messages`;
  
  const payload = {
    model: model,
    max_tokens: maxTokens,
    temperature: temperature,
    messages: [
      { role: 'user', content: prompt }
    ]
  };
  
  const response = await axios.post(url, payload, {
    headers: PROVIDERS.anthropic.headers(apiKey)
  });
  
  const content = response.data.content[0];
  const usage = response.data.usage;
  
  return {
    response: content.text,
    model: response.data.model,
    finish_reason: response.data.stop_reason,
    usage: {
      prompt_tokens: usage.input_tokens,
      completion_tokens: usage.output_tokens,
      total_tokens: usage.input_tokens + usage.output_tokens
    }
  };
}

// Google API request
async function makeGoogleRequest(apiKey, model, prompt, maxTokens, temperature) {
  const url = `${PROVIDERS.google.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: temperature
    }
  };
  
  const response = await axios.post(url, payload, {
    headers: PROVIDERS.google.headers(apiKey)
  });
  
  const candidate = response.data.candidates[0];
  const usage = response.data.usageMetadata;
  
  return {
    response: candidate.content.parts[0].text,
    model: model,
    finish_reason: candidate.finishReason,
    usage: {
      prompt_tokens: usage.promptTokenCount,
      completion_tokens: usage.candidatesTokenCount,
      total_tokens: usage.totalTokenCount
    }
  };
}

// Get available models for a provider
async function getAvailableModels(provider) {
  const providerConfig = PROVIDERS[provider.toLowerCase()];
  if (!providerConfig) {
    throw new Error(`Unsupported provider: ${provider}`);
  }
  
  return {
    provider: providerConfig.name,
    models: providerConfig.models.map(model => ({
      id: model,
      name: model,
      description: `${providerConfig.name} ${model}`
    }))
  };
}

// Get all supported providers
function getAllProviders() {
  return Object.keys(PROVIDERS).map(key => ({
    id: key,
    name: PROVIDERS[key].name,
    models: PROVIDERS[key].models
  }));
}

// Estimate token count for a provider
function estimateTokenCount(text, provider) {
  // Simple estimation based on word count
  // This is a rough estimation - for production use, implement proper tokenization
  const wordCount = text.split(/\s+/).length;
  
  switch (provider.toLowerCase()) {
    case 'openai':
      return Math.ceil(wordCount * 1.3); // OpenAI tokens are roughly 1.3x words
    case 'anthropic':
      return Math.ceil(wordCount * 1.2); // Anthropic tokens are roughly 1.2x words
    case 'google':
      return Math.ceil(wordCount * 1.1); // Google tokens are roughly 1.1x words
    default:
      return Math.ceil(wordCount * 1.25); // Default estimation
  }
}

module.exports = {
  testApiKey,
  makeRequest,
  getAvailableModels,
  getAllProviders,
  estimateTokenCount,
  PROVIDERS
};