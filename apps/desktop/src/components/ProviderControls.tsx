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
import { useEffect, useRef } from 'react';

import { providerLabel, type ExecutionConfig, type ProviderName } from '../api/execution';
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
  const initialized = useRef(false);
  useEffect(() => {
    if (!config || initialized.current) return;
    initialized.current = true;
    onChange({ ...value, provider: config.default_provider, model: '', consent: false });
    onModeChange(config.default_provider);
  }, [config, onChange, onModeChange, value]);
  const label = providerLabel(value.provider);
  const configured =
    value.provider === 'gemini' ? config?.gemini_configured : config?.openai_configured;
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
        <MenuItem value="gemini">Gemini · live hosted model</MenuItem>
        <MenuItem value="openai">OpenAI · hosted model</MenuItem>
      </TextField>
      {value.provider !== 'mock' && (
        <>
          {!configured && (
            <Alert severity="warning">
              {label} is not configured. Add its API key to private backend settings. Live mode
              never falls back to simulated answers.
            </Alert>
          )}
          <TextField
            label="Model override (optional)"
            value={value.model}
            onChange={(event) => onChange({ ...value, model: event.target.value })}
            placeholder={
              (value.provider === 'gemini' ? config?.gemini_model : config?.openai_model) ??
              'Configured backend model'
            }
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
            label={`I allow this question and retrieved test evidence to be sent to ${label}.`}
          />
          <Typography variant="caption" color="text.secondary">
            Only submitted questions and retrieved excerpts are sent. Request storage is disabled
            where supported. Token usage is reported when available; cost needs configured pricing.
          </Typography>
          {value.provider === 'gemini' && (
            <Alert severity="info">
              Google may use Gemini free-tier submissions to improve its products. Use fictional or
              explicitly permitted test content. Free-tier quotas and availability depend on your
              project.
            </Alert>
          )}
        </>
      )}
    </Stack>
  );
}
