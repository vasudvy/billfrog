import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { Receipt } from 'lucide-react';

const ReceiptsContainer = styled.div`
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

function Receipts() {
  return (
    <ReceiptsContainer>
      <Card
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Receipt size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
        <h3>Receipts Component</h3>
        <p>Download receipts as PDF or TXT files</p>
      </Card>
    </ReceiptsContainer>
  );
}

export default Receipts;