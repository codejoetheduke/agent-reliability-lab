import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { z } from 'zod';
import { apiRequest } from '../api/client';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { Panel } from '../components/Panel';
import { useConfig } from '../hooks/useConfig';

export function Settings({ statusText }: { statusText: string }) {
  const { config, error } = useConfig();
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectionError, setConnectionError] = useState('');
  const [busy, setBusy] = useState(false);
  async function checkNotion() {
    setBusy(true);
    setConnectionError('');
    try {
      const result = z
        .object({
          connected: z.boolean(),
          record_count: z.number(),
          root_count: z.number(),
          read_only: z.boolean(),
          api_version: z.string(),
        })
        .parse(await apiRequest('/notion/check', { method: 'POST', timeoutMs: 95000 }));
      setConnectionMessage(
        `Read-only connection verified: ${result.record_count} page records in ${result.root_count} selected scope(s). API ${result.api_version}.`,
      );
    } catch (failure) {
      setConnectionError(failure instanceof Error ? failure.message : 'Notion connection failed.');
    } finally {
      setBusy(false);
    }
  }
  async function clearCache() {
    try {
      await apiRequest('/notion/clear-cache', { method: 'POST' });
      setConnectionMessage('Notion memory cache cleared.');
      setConnectionError('');
    } catch (failure) {
      setConnectionError(
        failure instanceof Error ? failure.message : 'Cache could not be cleared.',
      );
    }
  }
  const rows = [
    ['Local backend', statusText],
    ['Mock provider', 'Available · simulated answers'],
    ['OpenAI', config ? (config.openai_configured ? 'Configured' : 'Not configured') : 'Loading…'],
    ['Configured model', config?.openai_model ?? '—'],
    [
      'Cost estimates',
      config?.pricing_configured
        ? 'Configured flat token rates'
        : 'Unavailable until pricing is configured',
    ],
    [
      'Notion',
      config?.notion_configured
        ? `${config.notion_scope_count} selected root page(s) · read only`
        : 'Not connected',
    ],
    ['Experiment storage', 'SQLite · local history'],
    ['Credentials', 'Secret values stay in the backend; they are never displayed here.'],
  ];
  return (
    <Panel title="Connection configuration" action={<SettingsOutlined color="secondary" />}>
      {error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {error}
        </Alert>
      )}
      <Box component="dl" className="settings-list">
        {rows.map(([label, value]) => (
          <Box key={label}>
            <Typography component="dt" variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ px: 3, pb: 3 }}>
        {connectionMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {connectionMessage}
          </Alert>
        )}
        {connectionError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {connectionError}
          </Alert>
        )}
        <Stack direction="row" sx={{ gap: 1, mb: 3, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            disabled={!config?.notion_configured || busy}
            onClick={() => void checkNotion()}
          >
            {busy ? 'Checking Notion…' : 'Check Notion connection'}
          </Button>
          <Button disabled={!config?.notion_configured || busy} onClick={() => void clearCache()}>
            Clear Notion memory cache
          </Button>
        </Stack>
        <Chip label="No training or fine-tuning" size="small" variant="outlined" />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          To enable OpenAI, configure OPENAI_API_KEY and optionally OPENAI_MODEL in the backend
          environment. Flat input/output prices per million tokens are optional. Never use VITE_
          variables for provider credentials.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Notion is restricted to explicitly selected test pages. Real workspace content is excluded
          from benchmark datasets. Read-only connector setup is described in the project README.
        </Typography>
      </Box>
    </Panel>
  );
}
