import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Key } from 'lucide-react';

const ApiKeyContainer = styled.div`
  padding: ${props => props.theme.spacing.lg};
`;

const Card = styled(motion.div)`
  background: ${props => props.theme.colors.backgroundSecondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.large};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: ${props => props.theme.shadows.small};
  text-align: center;
`;

function ApiKeyManager() {
  return (
    <ApiKeyContainer>
      <Card
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Key size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3>API Key Manager</h3>
        <p>Manage your AI provider API keys</p>
      </Card>
    </ApiKeyContainer>
  );
}

export default ApiKeyManager;