import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon } from 'lucide-react';

const SettingsContainer = styled.div`
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

function Settings() {
  return (
    <SettingsContainer>
      <Card
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <SettingsIcon size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3>Settings Component</h3>
        <p>Configure safety filters, pricing, and system settings</p>
      </Card>
    </SettingsContainer>
  );
}

export default Settings;