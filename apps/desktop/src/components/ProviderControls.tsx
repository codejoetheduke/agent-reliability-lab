import {
  Alert,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useConfig } from '../hooks/useConfig';

import type { ExecutionConfig, ProviderName } from '../api/execution';
export function ProviderControls({
  value,
  onChange,
  onModeChange,
}: {
  value: ExecutionConfig;
  onChange: (config: ExecutionConfig) => void;
  onModeChange: (provider: ProviderName) => void;
}) {
  const { config, error } = useConfig();
  return (
    <Stack spacing={2}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        select
        label="Answer provider"
        value={value.provider}
        onChange={(event) => {
          const provider = event.target.value as ProviderName;
          onChange({ ...value, provider, consent: false });
          onModeChange(provider);
        }}
      >
        <MenuItem value="mock">Mock · simulated extractive answers</MenuItem>
        <MenuItem value="openai">OpenAI · hosted model</MenuItem>
      </TextField>
      {value.provider === 'openai' && (
        <>
          {!config?.openai_configured && (
            <Alert severity="warning">
              OpenAI is not configured. Set OPENAI_API_KEY in backend-only configuration and restart
              the local service.
            </Alert>
          )}
          <TextField
            label="Model override (optional)"
            value={value.model}
            onChange={(event) => onChange({ ...value, model: event.target.value })}
            placeholder={config?.openai_model ?? 'Configured backend model'}
            helperText="Use an exact snapshot identifier for reproducible comparisons."
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={value.consent}
                onChange={(event) => onChange({ ...value, consent: event.target.checked })}
              />
            }
            label="I allow this question and retrieved test evidence to be sent to OpenAI."
          />
          <Typography variant="caption" color="text.secondary">
            Only submitted questions are sent. Response storage is disabled in the API request.
            Token usage is reported when available; cost needs configured pricing.
          </Typography>
        </>
      )}
    </Stack>
  );
}
