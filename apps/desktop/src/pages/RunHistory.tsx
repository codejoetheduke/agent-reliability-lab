import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import { apiRequest } from '../api/client';
import { formatRate, formatTime } from '../api/evaluation';
import { Panel, EmptyState } from '../components/Panel';
import { RunDetails } from '../components/RunDetails';
import { useRuns } from '../hooks/useRuns';

export function RunHistory() {
  const history = useRuns();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  async function remove() {
    try {
      await apiRequest('/history', { method: 'DELETE' });
      setConfirm(false);
      setError('');
      history.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'History could not be deleted.');
    }
  }
  return (
    <>
      <Panel
        title="All experiments"
        action={
          <Chip
            label={`${history.overview?.run_count ?? '—'} runs`}
            size="small"
            variant="outlined"
          />
        }
      >
        {(history.error || error) && (
          <Alert severity="error" sx={{ m: 3 }}>
            {error || history.error}
          </Alert>
        )}
        {!history.loading && !history.error && history.runs.length === 0 ? (
          <EmptyState icon={HistoryRounded} title="No recorded runs">
            Start an evaluation to record reproducible experiments and inspect individual results.
          </EmptyState>
        ) : (
          <Box sx={{ overflowX: 'auto', p: 2 }}>
            <Table aria-label="Run history">
              <TableHead>
                <TableRow>
                  <TableCell>Experiment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Labeled pass rate</TableCell>
                  <TableCell>Median latency</TableCell>
                  <TableCell>Inspect</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Typography variant="subtitle2">{run.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(run.created_at).toLocaleString()} ·{' '}
                        {run.simulated ? 'Simulated' : 'Hosted'} · {run.model}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={run.status} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{formatRate(run.summary?.pass_rate)}</TableCell>
                    <TableCell>{formatTime(run.summary?.latency_ms.median)}</TableCell>
                    <TableCell>
                      <Button
                        aria-label={`Inspect ${run.label}`}
                        onClick={() => setSelected(run.id)}
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 3,
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Showing the latest 100 runs. Raw outcomes stay on this computer.
          </Typography>
          <Button
            color="error"
            variant="outlined"
            disabled={
              !history.runs.length ||
              history.runs.some((run) => ['queued', 'running'].includes(run.status))
            }
            onClick={() => setConfirm(true)}
          >
            Delete run history
          </Button>
        </Stack>
      </Panel>
      <RunDetails runId={selected} onClose={() => setSelected(null)} />
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        aria-labelledby="delete-history-title"
      >
        <DialogTitle id="delete-history-title">Delete local run history?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This deletes recorded runs and test outcomes from the local history database. This
            cannot be undone.
          </DialogContentText>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(false)}>Cancel</Button>
          <Button color="error" onClick={() => void remove()}>
            Delete history
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
