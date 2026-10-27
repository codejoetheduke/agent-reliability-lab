import { Alert, Box, Chip, Typography } from '@mui/material';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { Panel } from '../components/Panel';
import { useConfig } from '../hooks/useConfig';

export function Settings({ statusText }: { statusText: string }) {
  const { config, error } = useConfig();
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
