import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import styled, { ThemeProvider, createGlobalStyle } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  BarChart3, 
  Settings, 
  FileText, 
  Shield, 
  Menu, 
  X,
  Sun,
  Moon
} from 'lucide-react';

// Components
import Dashboard from './components/Dashboard';
import UsageTracker from './components/UsageTracker';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Receipts from './components/Receipts';
import ApiKeyManager from './components/ApiKeyManager';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Theme configuration
const lightTheme = {
  colors: {
    primary: '#0088cc',
    primaryHover: '#006ba6',
    secondary: '#54a9eb',
    background: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    backgroundTertiary: '#e8e8e8',
    text: '#000000',
    textSecondary: '#666666',
    textLight: '#999999',
    border: '#e0e0e0',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
    shadow: 'rgba(0, 0, 0, 0.1)',
    gradient: 'linear-gradient(135deg, #0088cc 0%, #54a9eb 100%)',
  },
  shadows: {
    small: '0 2px 4px rgba(0, 0, 0, 0.1)',
    medium: '0 4px 8px rgba(0, 0, 0, 0.15)',
    large: '0 8px 16px rgba(0, 0, 0, 0.2)',
  },
  borderRadius: {
    small: '4px',
    medium: '8px',
    large: '12px',
    round: '50%',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
};

const darkTheme = {
  ...lightTheme,
  colors: {
    ...lightTheme.colors,
    primary: '#54a9eb',
    primaryHover: '#0088cc',
    background: '#1e1e1e',
    backgroundSecondary: '#2d2d2d',
    backgroundTertiary: '#3d3d3d',
    text: '#ffffff',
    textSecondary: '#cccccc',
    textLight: '#999999',
    border: '#404040',
    shadow: 'rgba(255, 255, 255, 0.1)',
  },
};

// Global styles
const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: ${props => props.theme.colors.background};
    color: ${props => props.theme.colors.text};
    transition: background-color 0.3s ease, color 0.3s ease;
    line-height: 1.6;
  }

  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${props => props.theme.colors.backgroundSecondary};
  }

  ::-webkit-scrollbar-thumb {
    background: ${props => props.theme.colors.textLight};
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${props => props.theme.colors.textSecondary};
  }
`;

// Styled components
const AppContainer = styled.div`
  display: flex;
  height: 100vh;
  overflow: hidden;
`;

const Sidebar = styled(motion.div)`
  width: 280px;
  background: ${props => props.theme.colors.backgroundSecondary};
  border-right: 1px solid ${props => props.theme.colors.border};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  z-index: 10;

  @media (max-width: 768px) {
    position: fixed;
    left: 0;
    top: 0;
    height: 100vh;
    z-index: 1000;
    box-shadow: ${props => props.theme.shadows.large};
  }
`;

const SidebarHeader = styled.div`
  padding: ${props => props.theme.spacing.lg};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  font-size: 1.5rem;
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
`;

const ThemeToggle = styled.button`
  background: none;
  border: none;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.medium};
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${props => props.theme.colors.backgroundTertiary};
    color: ${props => props.theme.colors.text};
  }
`;

const Navigation = styled.nav`
  flex: 1;
  padding: ${props => props.theme.spacing.md};
  overflow-y: auto;
`;

const NavItem = styled(motion.button)`
  width: 100%;
  padding: ${props => props.theme.spacing.md};
  border: none;
  background: ${props => props.active ? props.theme.colors.primary : 'transparent'};
  color: ${props => props.active ? '#ffffff' : props.theme.colors.text};
  border-radius: ${props => props.theme.borderRadius.medium};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${props => props.theme.spacing.md};
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: ${props => props.theme.spacing.sm};
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.active ? props.theme.colors.primaryHover : props.theme.colors.backgroundTertiary};
  }

  &:last-child {
    margin-bottom: 0;
  }
`;

const MainContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  padding: ${props => props.theme.spacing.lg};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: ${props => props.theme.colors.background};
  position: relative;
  z-index: 5;

  @media (max-width: 768px) {
    padding: ${props => props.theme.spacing.md};
  }
`;

const HeaderTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 600;
  color: ${props => props.theme.colors.text};
  margin: 0;
`;

const MobileMenuButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: ${props => props.theme.colors.text};
  cursor: pointer;
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.medium};
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.theme.colors.backgroundSecondary};
  }

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  overflow: auto;
  padding: ${props => props.theme.spacing.lg};
  background: ${props => props.theme.colors.background};

  @media (max-width: 768px) {
    padding: ${props => props.theme.spacing.md};
  }
`;

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  display: none;

  @media (max-width: 768px) {
    display: block;
  }
`;

const CloseButton = styled.button`
  display: none;
  background: none;
  border: none;
  color: ${props => props.theme.colors.textSecondary};
  cursor: pointer;
  padding: ${props => props.theme.spacing.sm};
  border-radius: ${props => props.theme.borderRadius.medium};
  transition: all 0.2s ease;
  position: absolute;
  top: ${props => props.theme.spacing.md};
  right: ${props => props.theme.spacing.md};

  &:hover {
    background: ${props => props.theme.colors.backgroundTertiary};
    color: ${props => props.theme.colors.text};
  }

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

// Navigation items
const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3, path: '/dashboard' },
  { id: 'tracker', label: 'Usage Tracker', icon: Brain, path: '/tracker' },
  { id: 'reports', label: 'Reports', icon: FileText, path: '/reports' },
  { id: 'receipts', label: 'Receipts', icon: FileText, path: '/receipts' },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' },
];

function App() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });
  
  const [activeRoute, setActiveRoute] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(isDark));
  }, [isDark]);

  useEffect(() => {
    const path = window.location.pathname;
    const route = navigationItems.find(item => item.path === path);
    if (route) {
      setActiveRoute(route.id);
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleNavigation = (item) => {
    setActiveRoute(item.id);
    setIsMobileMenuOpen(false);
    window.history.pushState({}, '', item.path);
  };

  const currentTheme = isDark ? darkTheme : lightTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={currentTheme}>
        <GlobalStyle />
        <Router>
          <AppContainer>
            <AnimatePresence>
              {isMobileMenuOpen && (
                <Overlay
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={toggleMobileMenu}
                />
              )}
            </AnimatePresence>
            
            <AnimatePresence>
              {(window.innerWidth > 768 || isMobileMenuOpen) && (
                <Sidebar
                  initial={window.innerWidth <= 768 ? { x: -280 } : false}
                  animate={window.innerWidth <= 768 ? { x: 0 } : {}}
                  exit={window.innerWidth <= 768 ? { x: -280 } : {}}
                  transition={{ type: 'tween', duration: 0.3 }}
                >
                  <CloseButton onClick={toggleMobileMenu}>
                    <X size={20} />
                  </CloseButton>
                  
                  <SidebarHeader>
                    <Logo>
                      <Brain size={24} />
                      AI Tracker
                    </Logo>
                    <ThemeToggle onClick={toggleTheme}>
                      {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </ThemeToggle>
                  </SidebarHeader>
                  
                  <Navigation>
                    {navigationItems.map((item) => (
                      <NavItem
                        key={item.id}
                        active={activeRoute === item.id}
                        onClick={() => handleNavigation(item)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <item.icon size={20} />
                        {item.label}
                      </NavItem>
                    ))}
                  </Navigation>
                </Sidebar>
              )}
            </AnimatePresence>

            <MainContent>
              <Header>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <MobileMenuButton onClick={toggleMobileMenu}>
                    <Menu size={20} />
                  </MobileMenuButton>
                  <HeaderTitle>
                    {navigationItems.find(item => item.id === activeRoute)?.label || 'Dashboard'}
                  </HeaderTitle>
                </div>
              </Header>
              
              <ContentArea>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/tracker" element={<UsageTracker />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/receipts" element={<Receipts />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/api-keys" element={<ApiKeyManager />} />
                </Routes>
              </ContentArea>
            </MainContent>
          </AppContainer>
        </Router>
        
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: isDark ? '#2d2d2d' : '#ffffff',
              color: isDark ? '#ffffff' : '#000000',
              border: `1px solid ${isDark ? '#404040' : '#e0e0e0'}`,
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;