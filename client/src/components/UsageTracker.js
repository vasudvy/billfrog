import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from 'react-query';
import { 
  Send, 
  Key, 
  Brain, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  DollarSign,
  Zap,
  Settings,
  Eye,
  EyeOff,
  RefreshCw,
  Download
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import moment from 'moment';
import { saveAs } from 'file-saver';

// Styled components
const TrackerContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${props => props.theme.spacing.xl};
  height: calc(100vh - 200px);

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    height: auto;
  }
`;

const LeftPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.lg};
`;

const RightPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.lg};
`;

const Card = styled(motion.div)`
  background: ${props => props.theme.colors.backgroundSecondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.large};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: ${props => props.theme.shadows.small};
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${props => props.theme.spacing.lg};
`;

const CardTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.md};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${props => props.theme.spacing.sm};
`;

const Label = styled.label`
  font-size: 0.9rem;
  font-weight: 500;
  color: ${props => props.theme.colors.textSecondary};
`;

const Select = styled.select`
  padding: ${props => props.theme.spacing.md};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.medium};
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-size: 1rem;
  outline: none;
  transition: all 0.2s ease;

  &:focus {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary}20;
  }
`;

const Input = styled.input`
  padding: ${props => props.theme.spacing.md};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.medium};
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-size: 1rem;
  outline: none;
  transition: all 0.2s ease;

  &:focus {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary}20;
  }

  &::placeholder {
    color: ${props => props.theme.colors.textLight};
  }
`;

const TextArea = styled.textarea`
  padding: ${props => props.theme.spacing.md};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.medium};
  background: ${props => props.theme.colors.background};
  color: ${props => props.theme.colors.text};
  font-size: 1rem;
  outline: none;
  transition: all 0.2s ease;
  resize: vertical;
  min-height: 100px;
  font-family: inherit;

  &:focus {
    border-color: ${props => props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.theme.colors.primary}20;
  }

  &::placeholder {
    color: ${props => props.theme.colors.textLight};
  }
`;

const Button = styled.button`
  padding: ${props => props.theme.spacing.md} ${props => props.theme.spacing.lg};
  background: ${props => props.variant === 'secondary' ? 'transparent' : props.theme.colors.primary};
  color: ${props => props.variant === 'secondary' ? props.theme.colors.text : '#ffffff'};
  border: 1px solid ${props => props.variant === 'secondary' ? props.theme.colors.border : props.theme.colors.primary};
  border-radius: ${props => props.theme.borderRadius.medium};
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${props => props.theme.spacing.sm};
  min-height: 44px;

  &:hover {
    background: ${props => props.variant === 'secondary' ? props.theme.colors.backgroundTertiary : props.theme.colors.primaryHover};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const ApiKeyInput = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const ToggleButton = styled.button`
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${props => props.theme.colors.text};
  }
`;

const ResponseContainer = styled(motion.div)`
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.medium};
  background: ${props => props.theme.colors.background};
`;

const ResponseHeader = styled.div`
  padding: ${props => props.theme.spacing.md};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.backgroundSecondary};
  display: flex;
  align-items: center;
  justify-content: between;
  gap: ${props => props.theme.spacing.md};
`;

const ResponseBody = styled.div`
  padding: ${props => props.theme.spacing.md};
  white-space: pre-wrap;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.9rem;
  line-height: 1.5;
  color: ${props => props.theme.colors.text};
`;

const MetricsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: ${props => props.theme.spacing.md};
  margin-top: ${props => props.theme.spacing.md};
`;

const MetricCard = styled.div`
  background: ${props => props.theme.colors.backgroundSecondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.medium};
  padding: ${props => props.theme.spacing.md};
  text-align: center;
`;

const MetricValue = styled.div`
  font-size: 1.2rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin-bottom: ${props => props.theme.spacing.xs};
`;

const MetricLabel = styled.div`
  font-size: 0.8rem;
  color: ${props => props.theme.colors.textSecondary};
`;

const StatusBadge = styled.span`
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.small};
  font-size: 0.8rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'success': return props.theme.colors.success + '20';
      case 'failure': return props.theme.colors.error + '20';
      case 'processing': return props.theme.colors.info + '20';
      default: return props.theme.colors.textLight + '20';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'success': return props.theme.colors.success;
      case 'failure': return props.theme.colors.error;
      case 'processing': return props.theme.colors.info;
      default: return props.theme.colors.textLight;
    }
  }};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
`;

const LoadingSpinner = styled.div`
  width: 20px;
  height: 20px;
  border: 2px solid ${props => props.theme.colors.border};
  border-top: 2px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.error};
  font-size: 0.9rem;
  margin-top: ${props => props.theme.spacing.sm};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.sm};
`;

// AI Provider models
const PROVIDERS = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-4-1106-preview']
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  },
  google: {
    name: 'Google',
    models: ['gemini-pro', 'gemini-pro-vision']
  }
};

function UsageTracker() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [currentResponse, setCurrentResponse] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [savedSettings, setSavedSettings] = useState(() => {
    const saved = localStorage.getItem('aiTrackerSettings');
    return saved ? JSON.parse(saved) : {};
  });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      model_provider: 'openai',
      model_name: 'gpt-3.5-turbo',
      prompt: '',
      api_key: savedSettings.api_key || '',
      max_tokens: 1000,
      temperature: 0.7
    }
  });

  const selectedProvider = watch('model_provider');
  const currentApiKey = watch('api_key');

  // Test API key mutation
  const testApiKeyMutation = useMutation(
    async (data) => {
      const response = await axios.post('/api/test-api-key', data);
      return response.data;
    },
    {
      onSuccess: (data) => {
        toast.success('API key is valid!');
      },
      onError: (error) => {
        toast.error(`API key test failed: ${error.response?.data?.message || error.message}`);
      }
    }
  );

  // Track usage mutation
  const trackUsageMutation = useMutation(
    async (data) => {
      const response = await axios.post('/api/usage/track', data);
      return response.data;
    },
    {
      onSuccess: (data) => {
        setCurrentResponse(data);
        setIsProcessing(false);
        toast.success('Request completed successfully!');
      },
      onError: (error) => {
        setIsProcessing(false);
        setCurrentResponse({
          error: error.response?.data?.error || error.message,
          status: 'failure'
        });
        toast.error(`Request failed: ${error.response?.data?.error || error.message}`);
      }
    }
  );

  // Update model options when provider changes
  useEffect(() => {
    const provider = PROVIDERS[selectedProvider];
    if (provider && provider.models.length > 0) {
      setValue('model_name', provider.models[0]);
    }
  }, [selectedProvider, setValue]);

  // Save settings to localStorage
  useEffect(() => {
    const settings = { api_key: currentApiKey };
    setSavedSettings(settings);
    localStorage.setItem('aiTrackerSettings', JSON.stringify(settings));
  }, [currentApiKey]);

  const onSubmit = async (data) => {
    if (!data.api_key) {
      toast.error('Please enter an API key');
      return;
    }

    if (!data.prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsProcessing(true);
    setCurrentResponse(null);

    trackUsageMutation.mutate({
      ...data,
      user_id: 'default-user', // Since no auth required
      session_id: `session-${Date.now()}`
    });
  };

  const testApiKey = () => {
    const provider = watch('model_provider');
    const apiKey = watch('api_key');
    const modelName = watch('model_name');

    if (!apiKey) {
      toast.error('Please enter an API key');
      return;
    }

    testApiKeyMutation.mutate({
      provider,
      apiKey,
      modelName
    });
  };

  const downloadReceipt = async () => {
    if (!currentResponse || !currentResponse.id) {
      toast.error('No completed request to download receipt for');
      return;
    }

    try {
      const response = await axios.get(`/api/receipts/usage/${currentResponse.id}?format=pdf`, {
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      saveAs(blob, `receipt-${currentResponse.id}.pdf`);
      toast.success('Receipt downloaded successfully!');
    } catch (error) {
      toast.error('Failed to download receipt');
    }
  };

  return (
    <TrackerContainer>
      <LeftPanel>
        <Card
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <CardHeader>
            <CardTitle>
              <Brain size={20} />
              AI Request Configuration
            </CardTitle>
          </CardHeader>

          <Form onSubmit={handleSubmit(onSubmit)}>
            <FormGroup>
              <Label>AI Provider</Label>
              <Select {...register('model_provider', { required: true })}>
                {Object.entries(PROVIDERS).map(([key, provider]) => (
                  <option key={key} value={key}>
                    {provider.name}
                  </option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>Model</Label>
              <Select {...register('model_name', { required: true })}>
                {PROVIDERS[selectedProvider]?.models.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>API Key</Label>
              <ApiKeyInput>
                <Input
                  type={showApiKey ? 'text' : 'password'}
                  placeholder={`Enter your ${PROVIDERS[selectedProvider]?.name} API key`}
                  {...register('api_key', { required: true })}
                  style={{ paddingRight: '40px' }}
                />
                <ToggleButton 
                  type="button" 
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </ToggleButton>
              </ApiKeyInput>
              {errors.api_key && (
                <ErrorMessage>
                  <AlertCircle size={16} />
                  API key is required
                </ErrorMessage>
              )}
            </FormGroup>

            <div style={{ display: 'flex', gap: '12px' }}>
              <FormGroup style={{ flex: 1 }}>
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  min="1"
                  max="8000"
                  {...register('max_tokens', { valueAsNumber: true })}
                />
              </FormGroup>
              <FormGroup style={{ flex: 1 }}>
                <Label>Temperature</Label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  {...register('temperature', { valueAsNumber: true })}
                />
              </FormGroup>
            </div>

            <FormGroup>
              <Label>Prompt</Label>
              <TextArea
                placeholder="Enter your prompt here..."
                {...register('prompt', { required: true })}
                rows={6}
              />
              {errors.prompt && (
                <ErrorMessage>
                  <AlertCircle size={16} />
                  Prompt is required
                </ErrorMessage>
              )}
            </FormGroup>

            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                type="button"
                variant="secondary"
                onClick={testApiKey}
                disabled={testApiKeyMutation.isLoading}
              >
                {testApiKeyMutation.isLoading ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Key size={16} />
                    Test API Key
                  </>
                )}
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || trackUsageMutation.isLoading}
                style={{ flex: 1 }}
              >
                {isProcessing ? (
                  <LoadingSpinner />
                ) : (
                  <>
                    <Send size={16} />
                    Send Request
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card>
      </LeftPanel>

      <RightPanel>
        <Card
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CardHeader>
            <CardTitle>
              <Clock size={20} />
              Response & Metrics
            </CardTitle>
            {currentResponse && currentResponse.id && (
              <Button
                variant="secondary"
                onClick={downloadReceipt}
                style={{ padding: '8px 12px', fontSize: '0.9rem' }}
              >
                <Download size={16} />
                Receipt
              </Button>
            )}
          </CardHeader>

          <AnimatePresence mode="wait">
            {isProcessing ? (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  textAlign: 'center'
                }}
              >
                <LoadingSpinner style={{ width: '40px', height: '40px', marginBottom: '16px' }} />
                <div>Processing your request...</div>
              </motion.div>
            ) : currentResponse ? (
              <motion.div
                key="response"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <ResponseContainer>
                  <ResponseHeader>
                    <StatusBadge status={currentResponse.status || 'success'}>
                      {currentResponse.status === 'success' && <CheckCircle size={12} />}
                      {currentResponse.status === 'failure' && <AlertCircle size={12} />}
                      {currentResponse.status || 'success'}
                    </StatusBadge>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Response time: {currentResponse.response_time_ms}ms
                    </div>
                  </ResponseHeader>
                  <ResponseBody>
                    {currentResponse.error || currentResponse.response || 'No response received'}
                  </ResponseBody>
                </ResponseContainer>

                {currentResponse.usage && (
                  <MetricsGrid>
                    <MetricCard>
                      <MetricValue>{currentResponse.usage.input_tokens}</MetricValue>
                      <MetricLabel>Input Tokens</MetricLabel>
                    </MetricCard>
                    <MetricCard>
                      <MetricValue>{currentResponse.usage.output_tokens}</MetricValue>
                      <MetricLabel>Output Tokens</MetricLabel>
                    </MetricCard>
                    <MetricCard>
                      <MetricValue>{currentResponse.usage.total_tokens}</MetricValue>
                      <MetricLabel>Total Tokens</MetricLabel>
                    </MetricCard>
                    <MetricCard>
                      <MetricValue>${parseFloat(currentResponse.usage.cost || 0).toFixed(6)}</MetricValue>
                      <MetricLabel>Cost</MetricLabel>
                    </MetricCard>
                  </MetricsGrid>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '40px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)'
                }}
              >
                <Brain size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                <div>Enter your prompt and send a request to see the response here</div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </RightPanel>
    </TrackerContainer>
  );
}

export default UsageTracker;