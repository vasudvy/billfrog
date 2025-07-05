// Token counting utility for different AI providers
// This provides a simple estimation - for production use, consider using provider-specific tokenizers

const TOKEN_MULTIPLIERS = {
  openai: 1.3,     // OpenAI tokens are roughly 1.3x words
  anthropic: 1.2,  // Anthropic tokens are roughly 1.2x words
  google: 1.1,     // Google tokens are roughly 1.1x words
  default: 1.25    // Default estimation
};

// Count tokens for a given text and provider
function countTokens(text, provider = 'default') {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  // Basic word-based estimation
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  const wordCount = words.length;
  
  // Apply provider-specific multiplier
  const multiplier = TOKEN_MULTIPLIERS[provider.toLowerCase()] || TOKEN_MULTIPLIERS.default;
  
  return Math.ceil(wordCount * multiplier);
}

// Count tokens with more sophisticated estimation
function countTokensAdvanced(text, provider = 'default') {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  
  const cleanText = text.trim();
  let tokenCount = 0;
  
  // Handle different text patterns
  const patterns = [
    // URLs and emails count as single tokens
    /https?:\/\/[^\s]+/g,
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    // Numbers with decimals
    /\d+\.\d+/g,
    // Punctuation clusters
    /[!@#$%^&*(),.?":{}|<>]+/g,
    // Contractions
    /\b\w+'\w+\b/g,
    // Regular words
    /\b\w+\b/g
  ];
  
  const processedText = cleanText;
  const words = processedText.split(/\s+/).filter(word => word.length > 0);
  
  // Count different types of tokens
  for (const word of words) {
    if (word.match(/https?:\/\/[^\s]+/)) {
      tokenCount += 1; // URLs are single tokens
    } else if (word.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)) {
      tokenCount += 1; // Emails are single tokens
    } else if (word.match(/\d+\.\d+/)) {
      tokenCount += 1; // Decimal numbers are single tokens
    } else if (word.match(/[!@#$%^&*(),.?":{}|<>]+/)) {
      tokenCount += Math.ceil(word.length / 2); // Punctuation clusters
    } else if (word.match(/\b\w+'\w+\b/)) {
      tokenCount += 2; // Contractions are usually 2 tokens
    } else {
      // Regular words - longer words might be multiple tokens
      if (word.length > 8) {
        tokenCount += Math.ceil(word.length / 4);
      } else {
        tokenCount += 1;
      }
    }
  }
  
  // Apply provider-specific adjustment
  const multiplier = TOKEN_MULTIPLIERS[provider.toLowerCase()] || TOKEN_MULTIPLIERS.default;
  
  return Math.ceil(tokenCount * multiplier);
}

// Estimate cost based on token count and pricing
function estimateCost(inputTokens, outputTokens, pricing) {
  if (!pricing) {
    return 0;
  }
  
  const inputCost = (inputTokens * pricing.input_cost_per_1k_tokens) / 1000;
  const outputCost = (outputTokens * pricing.output_cost_per_1k_tokens) / 1000;
  
  return inputCost + outputCost;
}

// Count tokens for prompt and response separately
function countTokensForRequest(prompt, response, provider = 'default') {
  const inputTokens = countTokens(prompt, provider);
  const outputTokens = response ? countTokens(response, provider) : 0;
  
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens
  };
}

// Provider-specific token counting (more accurate when available)
function countTokensProviderSpecific(text, provider) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return countTokensOpenAI(text);
    case 'anthropic':
      return countTokensAnthropic(text);
    case 'google':
      return countTokensGoogle(text);
    default:
      return countTokens(text, provider);
  }
}

// OpenAI-specific token counting (simplified)
function countTokensOpenAI(text) {
  if (!text) return 0;
  
  // OpenAI uses byte-pair encoding
  // This is a simplified approximation
  const words = text.split(/\s+/);
  let tokenCount = 0;
  
  for (const word of words) {
    if (word.length <= 4) {
      tokenCount += 1;
    } else if (word.length <= 8) {
      tokenCount += 2;
    } else {
      tokenCount += Math.ceil(word.length / 4);
    }
  }
  
  // Add extra tokens for special characters and formatting
  const specialCharCount = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  tokenCount += Math.ceil(specialCharCount / 4);
  
  return tokenCount;
}

// Anthropic-specific token counting (simplified)
function countTokensAnthropic(text) {
  if (!text) return 0;
  
  // Anthropic uses a similar approach to OpenAI but with slight differences
  const words = text.split(/\s+/);
  let tokenCount = 0;
  
  for (const word of words) {
    if (word.length <= 5) {
      tokenCount += 1;
    } else if (word.length <= 10) {
      tokenCount += 2;
    } else {
      tokenCount += Math.ceil(word.length / 5);
    }
  }
  
  // Anthropic tends to be slightly more efficient with special characters
  const specialCharCount = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  tokenCount += Math.ceil(specialCharCount / 5);
  
  return tokenCount;
}

// Google-specific token counting (simplified)
function countTokensGoogle(text) {
  if (!text) return 0;
  
  // Google's tokenization is generally more efficient
  const words = text.split(/\s+/);
  let tokenCount = 0;
  
  for (const word of words) {
    if (word.length <= 6) {
      tokenCount += 1;
    } else {
      tokenCount += Math.ceil(word.length / 6);
    }
  }
  
  // Google handles special characters more efficiently
  const specialCharCount = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
  tokenCount += Math.ceil(specialCharCount / 8);
  
  return tokenCount;
}

// Validate token count against actual usage (for calibration)
function validateTokenCount(estimatedTokens, actualTokens, provider) {
  if (actualTokens === 0) return 1; // Perfect accuracy if no actual tokens
  
  const accuracy = 1 - Math.abs(estimatedTokens - actualTokens) / actualTokens;
  
  // Log for calibration purposes
  console.log(`Token estimation accuracy for ${provider}: ${(accuracy * 100).toFixed(1)}%`);
  
  return accuracy;
}

// Get token statistics for a text
function getTokenStats(text, provider = 'default') {
  const basicCount = countTokens(text, provider);
  const advancedCount = countTokensAdvanced(text, provider);
  const providerSpecific = countTokensProviderSpecific(text, provider);
  
  return {
    basic: basicCount,
    advanced: advancedCount,
    provider_specific: providerSpecific,
    recommended: providerSpecific, // Use provider-specific as default
    text_length: text.length,
    word_count: text.split(/\s+/).length,
    provider: provider
  };
}

module.exports = {
  countTokens,
  countTokensAdvanced,
  countTokensProviderSpecific,
  countTokensForRequest,
  estimateCost,
  validateTokenCount,
  getTokenStats,
  TOKEN_MULTIPLIERS
};