import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useQuery } from 'react-query';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts';
import {
  Activity,
  DollarSign,
  Zap,
  Clock,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import axios from 'axios';
import moment from 'moment';

// Styled components
const DashboardContainer = styled.div`
  padding: 0;
  max-width: 100%;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${props => props.theme.spacing.lg};
  margin-bottom: ${props => props.theme.spacing.xl};
`;

const StatCard = styled(motion.div)`
  background: ${props => props.theme.colors.backgroundSecondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.large};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: ${props => props.theme.shadows.small};
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: ${props => props.color || props.theme.colors.primary};
  }
`;

const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${props => props.theme.spacing.md};
`;

const StatIcon = styled.div`
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.medium};
  background: ${props => props.color || props.theme.colors.primary}20;
  color: ${props => props.color || props.theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StatTitle = styled.h3`
  font-size: 0.9rem;
  font-weight: 500;
  color: ${props => props.theme.colors.textSecondary};
  margin: 0;
`;

const StatValue = styled.div`
  font-size: 2rem;
  font-weight: 700;
  color: ${props => props.theme.colors.text};
  margin-bottom: ${props => props.theme.spacing.sm};
`;

const StatChange = styled.div`
  font-size: 0.8rem;
  color: ${props => props.positive ? props.theme.colors.success : props.theme.colors.error};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.xs};
`;

const ChartsGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: ${props => props.theme.spacing.lg};
  margin-bottom: ${props => props.theme.spacing.xl};

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ChartCard = styled(motion.div)`
  background: ${props => props.theme.colors.backgroundSecondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.large};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: ${props => props.theme.shadows.small};
`;

const ChartTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin-bottom: ${props => props.theme.spacing.lg};
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
`;

const RecentActivity = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${props => props.theme.spacing.lg};

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

const ActivityCard = styled(motion.div)`
  background: ${props => props.theme.colors.backgroundSecondary};
  border: 1px solid ${props => props.theme.colors.border};
  border-radius: ${props => props.theme.borderRadius.large};
  padding: ${props => props.theme.spacing.lg};
  box-shadow: ${props => props.theme.shadows.small};
`;

const ActivityItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  padding: ${props => props.theme.spacing.md};
  border-radius: ${props => props.theme.borderRadius.medium};
  margin-bottom: ${props => props.theme.spacing.sm};
  border: 1px solid ${props => props.theme.colors.border};
  background: ${props => props.theme.colors.background};

  &:last-child {
    margin-bottom: 0;
  }
`;

const StatusBadge = styled.span`
  padding: ${props => props.theme.spacing.xs} ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.small};
  font-size: 0.75rem;
  font-weight: 500;
  background: ${props => {
    switch (props.status) {
      case 'success': return props.theme.colors.success + '20';
      case 'failure': return props.theme.colors.error + '20';
      case 'hallucination': return props.theme.colors.warning + '20';
      default: return props.theme.colors.textLight + '20';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'success': return props.theme.colors.success;
      case 'failure': return props.theme.colors.error;
      case 'hallucination': return props.theme.colors.warning;
      default: return props.theme.colors.textLight;
    }
  }};
`;

const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 3px solid ${props => props.theme.colors.border};
  border-top: 3px solid ${props => props.theme.colors.primary};
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 20px auto;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ErrorMessage = styled.div`
  text-align: center;
  color: ${props => props.theme.colors.error};
  padding: ${props => props.theme.spacing.lg};
`;

// Custom colors for charts
const CHART_COLORS = ['#0088cc', '#54a9eb', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4'];

function Dashboard() {
  const [timeRange, setTimeRange] = useState('7d');

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery(
    'dashboardStats',
    async () => {
      const response = await axios.get('/api/stats');
      return response.data;
    },
    { refetchInterval: 30000 }
  );

  // Fetch usage summary
  const { data: usageSummary, isLoading: usageLoading } = useQuery(
    ['usageSummary', timeRange],
    async () => {
      const endDate = moment().toISOString();
      const startDate = moment().subtract(parseInt(timeRange), 'days').toISOString();
      const response = await axios.get(`/api/usage/summary?start_date=${startDate}&end_date=${endDate}&group_by=day`);
      return response.data;
    },
    { refetchInterval: 30000 }
  );

  // Fetch recent usage logs
  const { data: recentUsage, isLoading: recentLoading } = useQuery(
    'recentUsage',
    async () => {
      const response = await axios.get('/api/usage/logs?limit=10');
      return response.data;
    },
    { refetchInterval: 10000 }
  );

  // Fetch real-time metrics
  const { data: realtimeMetrics } = useQuery(
    'realtimeMetrics',
    async () => {
      const response = await axios.get('/api/usage/metrics/realtime');
      return response.data;
    },
    { 
      refetchInterval: 5000,
      refetchIntervalInBackground: true
    }
  );

  if (statsLoading) {
    return <LoadingSpinner />;
  }

  if (statsError) {
    return <ErrorMessage>Failed to load dashboard data</ErrorMessage>;
  }

  const overview = stats?.overview || {};
  const recentActivity = stats?.recentActivity || [];
  const errorStats = stats?.errorStats || [];

  // Prepare chart data
  const dailyUsageData = usageSummary?.map(item => ({
    date: moment(item.date).format('MMM DD'),
    calls: item.total_calls,
    cost: parseFloat(item.total_cost || 0),
    tokens: item.total_tokens
  })) || [];

  const modelUsageData = recentActivity.map((item, index) => ({
    name: `${item.model_provider}/${item.model_name}`,
    calls: item.call_count,
    cost: parseFloat(item.total_cost || 0),
    color: CHART_COLORS[index % CHART_COLORS.length]
  }));

  const statusData = errorStats.map(item => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    value: item.count,
    color: item.status === 'success' ? '#4caf50' : 
           item.status === 'failure' ? '#f44336' : 
           item.status === 'hallucination' ? '#ff9800' : '#999999'
  }));

  return (
    <DashboardContainer>
      {/* Stats Cards */}
      <StatsGrid>
        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          color="#0088cc"
        >
          <StatHeader>
            <StatTitle>Total Calls</StatTitle>
            <StatIcon color="#0088cc">
              <Activity size={20} />
            </StatIcon>
          </StatHeader>
          <StatValue>{overview.total_calls?.toLocaleString() || '0'}</StatValue>
          <StatChange positive={true}>
            <TrendingUp size={14} />
            {realtimeMetrics?.metrics?.calls_last_hour || 0} calls in last hour
          </StatChange>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          color="#4caf50"
        >
          <StatHeader>
            <StatTitle>Total Cost</StatTitle>
            <StatIcon color="#4caf50">
              <DollarSign size={20} />
            </StatIcon>
          </StatHeader>
          <StatValue>${parseFloat(overview.total_cost || 0).toFixed(4)}</StatValue>
          <StatChange positive={false}>
            <TrendingUp size={14} />
            ${parseFloat(realtimeMetrics?.metrics?.cost_last_hour || 0).toFixed(4)} last hour
          </StatChange>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          color="#ff9800"
        >
          <StatHeader>
            <StatTitle>Total Tokens</StatTitle>
            <StatIcon color="#ff9800">
              <Zap size={20} />
            </StatIcon>
          </StatHeader>
          <StatValue>{parseInt(overview.total_tokens || 0).toLocaleString()}</StatValue>
          <StatChange positive={true}>
            <TrendingUp size={14} />
            {parseInt(realtimeMetrics?.metrics?.tokens_last_hour || 0).toLocaleString()} last hour
          </StatChange>
        </StatCard>

        <StatCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          color="#9c27b0"
        >
          <StatHeader>
            <StatTitle>Avg Response Time</StatTitle>
            <StatIcon color="#9c27b0">
              <Clock size={20} />
            </StatIcon>
          </StatHeader>
          <StatValue>{parseInt(overview.avg_response_time || 0)}ms</StatValue>
          <StatChange positive={true}>
            <TrendingUp size={14} />
            {parseInt(realtimeMetrics?.metrics?.avg_response_time_last_hour || 0)}ms last hour
          </StatChange>
        </StatCard>
      </StatsGrid>

      {/* Charts */}
      <ChartsGrid>
        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <ChartTitle>
            <BarChart size={20} />
            Daily Usage Trend
          </ChartTitle>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyUsageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--background-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="calls" 
                stroke="#0088cc" 
                strokeWidth={2}
                dot={{ fill: '#0088cc', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <ChartTitle>
            <PieChart size={20} />
            Request Status
          </ChartTitle>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </ChartsGrid>

      {/* Recent Activity */}
      <RecentActivity>
        <ActivityCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <ChartTitle>
            <Activity size={20} />
            Recent API Calls
          </ChartTitle>
          {recentLoading ? (
            <LoadingSpinner />
          ) : (
            recentUsage?.slice(0, 5).map((usage, index) => (
              <ActivityItem key={usage.id}>
                <StatusBadge status={usage.status}>
                  {usage.status === 'success' && <CheckCircle size={12} />}
                  {usage.status === 'failure' && <XCircle size={12} />}
                  {usage.status === 'hallucination' && <AlertCircle size={12} />}
                </StatusBadge>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>
                    {usage.model_provider}/{usage.model_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {usage.total_tokens} tokens • ${parseFloat(usage.total_cost || 0).toFixed(4)}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-light)' }}>
                  {moment(usage.created_at).fromNow()}
                </div>
              </ActivityItem>
            ))
          )}
        </ActivityCard>

        <ActivityCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <ChartTitle>
            <BarChart size={20} />
            Top Models (7 days)
          </ChartTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={modelUsageData.slice(0, 5)} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={80} fontSize={12} />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'var(--background-secondary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="calls" fill="#0088cc" />
            </BarChart>
          </ResponsiveContainer>
        </ActivityCard>
      </RecentActivity>
    </DashboardContainer>
  );
}

export default Dashboard;