import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import { apiRequest } from '../api/client';
import { detailSchema, formatRate, formatTime, type RunDetail } from '../api/evaluation';

export function RunDetails({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!runId) return;
    const controller = new AbortController();
    async function load() {
      try {
        const value = detailSchema.parse(
          await apiRequest(`/runs/${runId}`, { signal: controller.signal }),
        );
        if (!controller.signal.aborted) {
          setDetail(value);
          setError('');
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(failure instanceof Error ? failure.message : 'Run unavailable.');
      }
    }
    void load();
    const timer = window.setInterval(() => void load(), 2000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [runId]);
  const current = detail?.id === runId ? detail : null;
  return (
    <Dialog
      open={runId !== null}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      aria-labelledby="run-detail-title"
    >
      <DialogTitle id="run-detail-title" sx={{ pr: 7 }}>
        Experiment details
        <IconButton
          aria-label="Close experiment details"
          onClick={onClose}
          sx={{ position: 'absolute', right: 12, top: 8 }}
        >
          <CloseRounded />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!current && !error && <CircularProgress aria-label="Loading run" />}
        {current && (
          <>
            <Typography variant="h2">{current.label}</Typography>
            <Stack direction="row" sx={{ gap: 1, my: 2, flexWrap: 'wrap' }}>
              <Chip label={current.status} />
              <Chip label={current.simulated ? 'Simulated' : 'Hosted model'} variant="outlined" />
              <Chip
                label={`${current.dataset_id} · ${current.dataset_version}`}
                variant="outlined"
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {current.model} · {current.summary?.tests_completed ?? 0}/{current.total_tests} tests
              · {formatRate(current.summary?.pass_rate)} labeled checks passed · median{' '}
              {formatTime(current.summary?.latency_ms.median)}
            </Typography>
            {current.error && (
              <Alert severity="error" sx={{ my: 2 }}>
                {current.error}
              </Alert>
            )}
            {current.summary && (
              <Box sx={{ overflowX: 'auto', my: 3 }}>
                <Table size="small" aria-label="Metric denominators">
                  <TableHead>
                    <TableRow>
                      <TableCell>Metric</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Numerator / denominator</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(current.summary.metrics).map(([name, rate]) => (
                      <TableRow key={name}>
                        <TableCell>{name.replaceAll('_', ' ')}</TableCell>
                        <TableCell>{formatRate(rate)}</TableCell>
                        <TableCell>
                          {rate.numerator} / {rate.denominator}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Extractive support checks exact quoted text. Labeled checks are dataset-specific;
              neither is a semantic accuracy claim. Unreported tokens and costs remain unavailable.
            </Typography>
            {current.results.map((result) => (
              <Accordion key={result.test_id} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreRounded />}>
                  <Stack direction="row" sx={{ alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={result.passed ? 'Passed' : 'Failed'}
                      color={result.passed ? 'success' : 'error'}
                      size="small"
                    />
                    <Typography variant="subtitle2">{result.test_id}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {result.category} · {formatTime(result.latency_ms)}
                    </Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography sx={{ mb: 2 }}>{result.question}</Typography>
                  {result.error && <Alert severity="error">{result.error}</Alert>}
                  <Typography sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                    {result.answer?.answer}
                  </Typography>
                  <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    {Object.entries(result.checks).map(([name, passed]) => (
                      <Chip
                        key={name}
                        label={`${name.replaceAll('_', ' ')}: ${passed ? 'pass' : 'fail'}`}
                        color={passed ? 'default' : 'error'}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                  <Typography variant="subtitle2">Raw outcome and expected criteria</Typography>
                  <Box
                    component="pre"
                    sx={{
                      p: 2,
                      bgcolor: 'background.default',
                      overflow: 'auto',
                      fontSize: 12,
                      maxHeight: 400,
                      borderRadius: 2,
                    }}
                  >
                    {JSON.stringify(result, null, 2)}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
