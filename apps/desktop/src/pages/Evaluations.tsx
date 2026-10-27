import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import { z } from 'zod';
import { apiRequest } from '../api/client';
import { datasetSchema, runSchema, type Dataset } from '../api/evaluation';
import { Panel } from '../components/Panel';
import { RunDetails } from '../components/RunDetails';
import { useRuns } from '../hooks/useRuns';
import { ProviderControls } from '../components/ProviderControls';
import { defaultExecution, type ProviderName } from '../api/execution';

export function Evaluations({ onModeChange }: { onModeChange: (provider: ProviderName) => void }) {
  const [execution, setExecution] = useState(defaultExecution);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dataset, setDataset] = useState('synthetic-v1');
  const [label, setLabel] = useState('Mock baseline');
  const [topK, setTopK] = useState(4);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const history = useRuns();
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/datasets', { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setDatasets(z.array(datasetSchema).parse(value));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Evaluation datasets could not be loaded.');
      });
    return () => controller.abort();
  }, []);
  async function start() {
    setBusy(true);
    setError('');
    try {
      const run = runSchema.parse(
        await apiRequest('/runs', {
          method: 'POST',
          body: JSON.stringify({
            dataset_id: dataset,
            label,
            top_k: topK,
            provider: execution.provider,
            model: execution.model || null,
            allow_external_transmission: execution.consent,
          }),
        }),
      );
      history.refresh();
      setSelected(run.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Run could not start.');
    } finally {
      setBusy(false);
    }
  }
  const active = history.runs.filter((run) => ['queued', 'running'].includes(run.status));
  return (
    <>
      <Panel
        title="Evaluation datasets"
        action={<Chip label="Synthetic data only" size="small" variant="outlined" />}
      >
        <Box sx={{ p: 3 }}>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Run repeatable labeled cases over fictional workspace fixtures. All results from the
            extractive mock provider are simulated.
          </Typography>
          {(error || history.error) && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error || history.error}
            </Alert>
          )}
          <Stack spacing={3}>
            <ProviderControls
              value={execution}
              onChange={setExecution}
              onModeChange={onModeChange}
            />
            <TextField
              select
              label="Dataset"
              value={datasets.length ? dataset : ''}
              onChange={(event) => setDataset(event.target.value)}
            >
              {datasets.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.id} · v{item.version} · {item.test_count} cases
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Run label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 80 } }}
            />
            <TextField
              type="number"
              label="Retrieval k"
              value={topK}
              onChange={(event) => setTopK(Number(event.target.value))}
              slotProps={{ htmlInput: { min: 1, max: 10 } }}
              helperText="Changing k makes runs incomparable to runs with a different k."
            />
            <Box>
              <Button
                variant="contained"
                onClick={() => void start()}
                startIcon={<PlayArrowRounded />}
                disabled={
                  busy ||
                  !datasets.length ||
                  !label.trim() ||
                  topK < 1 ||
                  topK > 10 ||
                  (execution.provider === 'openai' && !execution.consent)
                }
              >
                {busy ? 'Starting…' : 'Run evaluation'}
              </Button>
            </Box>
          </Stack>
          {active.map((run) => (
            <Box key={run.id} sx={{ mt: 3 }}>
              <Typography variant="body2">
                {run.label}: {run.summary?.tests_completed ?? 0}/{run.total_tests} cases
              </Typography>
              <LinearProgress
                sx={{ mt: 1 }}
                variant="determinate"
                value={(100 * (run.summary?.tests_completed ?? 0)) / run.total_tests}
              />
            </Box>
          ))}
        </Box>
      </Panel>
      <RunDetails runId={selected} onClose={() => setSelected(null)} />
    </>
  );
}
