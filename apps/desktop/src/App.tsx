import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  CssBaseline,
  Drawer,
  IconButton,
  Stack,
  ThemeProvider,
  Typography,
} from '@mui/material';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import RefreshRounded from '@mui/icons-material/RefreshRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import LockOutlined from '@mui/icons-material/LockOutlined';
import { Navigation, type Page } from './components/Navigation';
import { Overview } from './pages/Overview';
import { WorkspacePage } from './pages/WorkspacePage';
import { useHealth } from './hooks/useHealth';
import { theme, md3 } from './theme';
import type { ProviderName } from './api/execution';
import './App.css';

const descriptions: Record<Page, string> = {
  Overview: 'A clearer view of how your agents behave.',
  'Agent Playground': 'Ask, inspect, and trace answers back to their sources.',
  Evaluations: 'Repeatable experiments. Inspectable evidence.',
  'Model Comparison': 'Understand the differences between completed runs.',
  'Run History': 'Every experiment, with its context intact.',
  Settings: 'Your local environment and connection status.',
};

function Shell() {
  const [providerMode, setProviderMode] = useState<ProviderName>('mock');
  const [page, setPage] = useState<Page>('Overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const { connection, refresh } = useHealth();
  const online = connection.status === 'connected';
  const statusText = online
    ? 'Backend connected'
    : connection.status === 'checking'
      ? 'Checking backend…'
      : 'Backend offline';
  function navigate(next: Page) {
    setPage(next);
    setProviderMode('mock');
    setMenuOpen(false);
    document.getElementById('main')?.focus();
  }
  return (
    <Box className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Box component="aside" className="sidebar">
        <Navigation page={page} onNavigate={navigate} />
      </Box>
      <Drawer
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{
          paper: {
            sx: { width: 300, bgcolor: md3.surfaceContainerLow, borderRadius: '0 28px 28px 0' },
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 1 }}>
          <IconButton aria-label="Close navigation" onClick={() => setMenuOpen(false)}>
            <CloseRounded />
          </IconButton>
        </Box>
        <Navigation expanded page={page} onNavigate={navigate} />
      </Drawer>
      <Box className="main-shell">
        <Box component="header" className="topbar">
          <IconButton
            className="mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMenuOpen(true)}
          >
            <MenuRounded />
          </IconButton>
          <Stack direction="row" className="topbar-context" sx={{ alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              Workspace
            </Typography>
            <Typography color="text.secondary" aria-hidden="true">
              /
            </Typography>
            <Typography variant="body2">{page}</Typography>
          </Stack>
          <Chip
            icon={<ScienceOutlined />}
            label={providerMode === 'mock' ? 'MOCK MODE' : 'OPENAI SELECTED'}
            size="small"
            sx={{
              ml: 'auto',
              bgcolor: md3.secondaryContainer,
              color: md3.onSecondaryContainer,
              '& .MuiChip-icon': { color: 'inherit' },
            }}
          />
        </Box>
        <Box component="main" id="main" tabIndex={-1}>
          <Box className="page-heading">
            <Box>
              <Typography variant="overline" color="primary">
                Agent Reliability Lab
              </Typography>
              <Typography component="h1" variant="h1" sx={{ mt: 0.75 }}>
                {page}
              </Typography>
              <Typography color="text.secondary" variant="body1" sx={{ mt: 1 }}>
                {descriptions[page]}
              </Typography>
            </Box>
            <Button
              variant="outlined"
              startIcon={
                connection.status === 'checking' ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <RefreshRounded />
                )
              }
              disabled={connection.status === 'checking'}
              onClick={refresh}
            >
              Check connection
            </Button>
          </Box>
          <Box className="mock-banner">
            <Box className="banner-icon">
              <ScienceOutlined sx={{ fontSize: 30 }} />
            </Box>
            <Box>
              <Typography variant="h3">
                {providerMode === 'mock'
                  ? 'Inspectable answers. Controlled actions.'
                  : 'Hosted model selected'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                {providerMode === 'mock'
                  ? 'Mock answers are simulated. No hosted model requests are made.'
                  : 'Submitted questions and evidence go to OpenAI only with explicit consent.'}
              </Typography>
            </Box>
            <Chip label="LOCAL LAB" variant="outlined" size="small" className="milestone-chip" />
          </Box>
          <Stack
            direction="row"
            className="connection-bar"
            role="status"
            aria-live="polite"
            sx={{
              alignItems: 'center',
              gap: 1,
              color: connection.status === 'offline' ? md3.error : md3.onSurfaceVariant,
            }}
          >
            {online ? (
              <CheckCircleOutlineRounded sx={{ fontSize: 18, color: md3.primary }} />
            ) : connection.status === 'checking' ? (
              <CircularProgress size={16} />
            ) : (
              <ErrorOutlineRounded sx={{ fontSize: 18 }} />
            )}
            <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
              {statusText}
            </Typography>
            <Typography
              component="span"
              variant="caption"
              color="text.secondary"
              className="connection-detail"
            >
              {online
                ? 'FastAPI · 127.0.0.1:8765 · /health'
                : connection.status === 'offline'
                  ? 'Start the local services with npm run dev, then check again.'
                  : 'Contacting your local Python service'}
            </Typography>
          </Stack>
          {page === 'Overview' ? (
            <Overview connection={connection} onNavigate={navigate} />
          ) : (
            <WorkspacePage page={page} statusText={statusText} onModeChange={setProviderMode} />
          )}
          <Box component="footer">
            <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
              <LockOutlined sx={{ fontSize: 16 }} />
              <Typography variant="caption">Personal development · synthetic data only</Typography>
            </Stack>
            <Typography variant="caption" className="footer-motto">
              Built for evidence, not assumptions.
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Shell />
    </ThemeProvider>
  );
}
