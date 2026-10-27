import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Panel } from '../components/Panel';
import { useRuns } from '../hooks/useRuns';
import { apiRequest } from '../api/client';
import { comparisonSchema, type ComparisonResult } from '../api/comparison';
import { formatRate, formatTime, type Rate } from '../api/evaluation';
import { md3 } from '../theme';

const rateText = (rate: Rate | null) =>
  rate ? `${formatRate(rate)} (${rate.numerator}/${rate.denominator})` : 'Unavailable';
const label = (name: string) => name.replaceAll('_', ' ');
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export function Comparison() {
  const { runs, error: historyError } = useRuns();
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const completed = runs.filter((run) => run.status === 'completed');
  async function compare() {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(
        comparisonSchema.parse(
          await apiRequest(
            `/comparisons?${new URLSearchParams({ left_id: left, right_id: right })}`,
          ),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Comparison is unavailable.');
    } finally {
      setBusy(false);
    }
  }
  const metrics =
    result?.metrics.map((item) => ({
      name: label(item.name),
      A: item.left?.value == null ? null : item.left.value * 100,
      B: item.right?.value == null ? null : item.right.value * 100,
    })) ?? [];
  const bins =
    result?.latency_histogram.map((bin) => ({
      range: `${bin.start_ms.toFixed(1)}–${bin.end_ms.toFixed(1)}`,
      A: bin.left_count,
      B: bin.right_count,
    })) ?? [];
  return (
    <Stack spacing={3}>
      <Panel title="Compare completed runs">
        <Stack spacing={2} sx={{ p: 3 }}>
          <Typography color="text.secondary">
            Select runs with matching datasets, metric definitions, retrieval settings, and
            execution conditions. A is the baseline; changes are B minus A.
          </Typography>
          {completed.length < 2 && (
            <Alert severity="info">
              Two completed runs are needed. Run the synthetic evaluation twice to compare measured
              outcomes.
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {(['A', 'B'] as const).map((name) => (
              <TextField
                key={name}
                select
                fullWidth
                label={`Run ${name}`}
                value={name === 'A' ? left : right}
                onChange={(event) => {
                  (name === 'A' ? setLeft : setRight)(event.target.value);
                  setResult(null);
                }}
              >
                {completed.map((run) => (
                  <MenuItem key={run.id} value={run.id}>
                    {run.label} · {new Date(run.created_at).toLocaleString()} · {run.id.slice(0, 8)}
                  </MenuItem>
                ))}
              </TextField>
            ))}
          </Stack>
          <Button
            variant="contained"
            onClick={() => void compare()}
            disabled={busy || !left || !right || left === right}
            sx={{ alignSelf: 'flex-start' }}
          >
            {busy ? 'Comparing…' : 'Compare runs'}
          </Button>
          {(error || historyError) && <Alert severity="error">{error || historyError}</Alert>}
        </Stack>
      </Panel>
      {result && !result.comparable && (
        <Alert severity="warning">
          <Typography variant="subtitle2">These runs cannot be compared</Typography>
          {result.reasons.join(' ')}
        </Alert>
      )}
      {result?.comparable && (
        <>
          {result.warnings.map((warning) => (
            <Alert key={warning} severity="info">
              {warning}
            </Alert>
          ))}
          <Panel title="Recorded outcomes">
            <TableContainer>
              <Table size="small" aria-label="Run comparison summary">
                <TableHead>
                  <TableRow>
                    <TableCell>Measurement</TableCell>
                    <TableCell>A · {result.left.label}</TableCell>
                    <TableCell>B · {result.right.label}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    [
                      'Configuration',
                      `${result.left.provider} / ${result.left.model}`,
                      `${result.right.provider} / ${result.right.model}`,
                    ],
                    [
                      'Tests completed',
                      result.left.summary?.tests_completed,
                      result.right.summary?.tests_completed,
                    ],
                    [
                      'Pass rate',
                      rateText(result.left.summary?.pass_rate ?? null),
                      rateText(result.right.summary?.pass_rate ?? null),
                    ],
                    [
                      'Pass rate · Wilson 95% interval',
                      result.left_pass_interval
                        ? `${percent(result.left_pass_interval.lower)}–${percent(result.left_pass_interval.upper)}`
                        : 'Unavailable',
                      result.right_pass_interval
                        ? `${percent(result.right_pass_interval.lower)}–${percent(result.right_pass_interval.upper)}`
                        : 'Unavailable',
                    ],
                    [
                      'Median latency',
                      formatTime(result.left.summary?.latency_ms.median),
                      formatTime(result.right.summary?.latency_ms.median),
                    ],
                    [
                      'P95 latency',
                      formatTime(result.left.summary?.latency_ms.p95),
                      formatTime(result.right.summary?.latency_ms.p95),
                    ],
                    [
                      'Input / output tokens',
                      `${result.left.summary?.input_tokens ?? 'Unavailable'} / ${result.left.summary?.output_tokens ?? 'Unavailable'}`,
                      `${result.right.summary?.input_tokens ?? 'Unavailable'} / ${result.right.summary?.output_tokens ?? 'Unavailable'}`,
                    ],
                    [
                      'Estimated cost (USD)',
                      result.left.summary?.estimated_cost_usd == null
                        ? 'Unavailable'
                        : `$${result.left.summary.estimated_cost_usd.toFixed(6)}`,
                      result.right.summary?.estimated_cost_usd == null
                        ? 'Unavailable'
                        : `$${result.right.summary.estimated_cost_usd.toFixed(6)}`,
                    ],
                  ].map(([name, a, b]) => (
                    <TableRow key={String(name)}>
                      <TableCell>{name}</TableCell>
                      <TableCell>{a}</TableCell>
                      <TableCell>{b}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography sx={{ p: 3 }}>
              {result.improved} improved · {result.regressed} regressed · {result.unchanged}{' '}
              unchanged test outcomes
            </Typography>
          </Panel>
          <Panel title="Metric rates and denominators">
            <Box sx={{ height: 420, minWidth: 0, p: 2 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart
                  data={metrics}
                  layout="vertical"
                  margin={{ left: 5, right: 25 }}
                  accessibilityLayer
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis type="category" dataKey="name" width={165} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) =>
                      value == null ? 'Unavailable' : `${Number(value).toFixed(1)}%`
                    }
                  />
                  <Legend />
                  <Bar dataKey="A" fill={md3.primary} />
                  <Bar dataKey="B" fill={md3.tertiary} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <TableContainer>
              <Table size="small" aria-label="Metric comparison">
                <TableHead>
                  <TableRow>
                    <TableCell>Metric</TableCell>
                    <TableCell>A</TableCell>
                    <TableCell>B</TableCell>
                    <TableCell>Change (pp)</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.metrics.map((item) => (
                    <TableRow key={item.name}>
                      <TableCell>{label(item.name)}</TableCell>
                      <TableCell>{rateText(item.left)}</TableCell>
                      <TableCell>{rateText(item.right)}</TableCell>
                      <TableCell>
                        {item.delta == null
                          ? 'Unavailable'
                          : `${item.delta > 0 ? '+' : ''}${(item.delta * 100).toFixed(1)}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Panel>
          <Panel title="Latency distribution">
            <Typography sx={{ px: 3, pt: 2 }} color="text.secondary">
              Measured local elapsed time per test, including simulated fault and action cases. Both
              runs use the same bins.
            </Typography>
            <Box sx={{ height: 300, minWidth: 0, p: 2 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <BarChart data={bins} accessibilityLayer>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="range"
                    label={{ value: 'Milliseconds', position: 'insideBottom', offset: -3 }}
                    height={50}
                  />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="A" fill={md3.primary} />
                  <Bar dataKey="B" fill={md3.tertiary} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <TableContainer>
              <Table size="small" aria-label="Latency histogram data">
                <TableHead>
                  <TableRow>
                    <TableCell>Range (ms)</TableCell>
                    <TableCell>A cases</TableCell>
                    <TableCell>B cases</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bins.map((bin) => (
                    <TableRow key={bin.range}>
                      <TableCell>{bin.range}</TableCell>
                      <TableCell>{bin.A}</TableCell>
                      <TableCell>{bin.B}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Panel>
          <Panel title="Failure behavior">
            <TableContainer>
              <Table size="small" aria-label="Failures by category">
                <TableHead>
                  <TableRow>
                    <TableCell>Category</TableCell>
                    <TableCell>A failures</TableCell>
                    <TableCell>B failures</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    ...new Set([
                      ...Object.keys(result.left.summary?.failures_by_category ?? {}),
                      ...Object.keys(result.right.summary?.failures_by_category ?? {}),
                    ]),
                  ].map((category) => (
                    <TableRow key={category}>
                      <TableCell>{label(category)}</TableCell>
                      <TableCell>
                        {result.left.summary?.failures_by_category[category] ?? 0}
                      </TableCell>
                      <TableCell>
                        {result.right.summary?.failures_by_category[category] ?? 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack spacing={1} sx={{ p: 3 }}>
              {result.case_differences.length ? (
                result.case_differences.map((item) => (
                  <Alert key={item.test_id} severity={item.right_passed ? 'success' : 'warning'}>
                    {item.test_id} ({item.category}): A {item.left_passed ? 'passed' : 'failed'}{' '}
                    {item.left_error ?? ''} → B {item.right_passed ? 'passed' : 'failed'}{' '}
                    {item.right_error ?? ''}
                  </Alert>
                ))
              ) : (
                <Typography>No differences in pass/fail outcomes or error codes.</Typography>
              )}
            </Stack>
          </Panel>
        </>
      )}
    </Stack>
  );
}
