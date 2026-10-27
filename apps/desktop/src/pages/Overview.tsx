import { useRuns } from '../hooks/useRuns';
import { useConfig } from '../hooks/useConfig';
import { formatRate, formatTime } from '../api/evaluation';
import { Alert, Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/material';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import SpeedRounded from '@mui/icons-material/SpeedRounded';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded';
import TerminalRounded from '@mui/icons-material/TerminalRounded';
import CheckCircleOutlineRounded from '@mui/icons-material/CheckCircleOutlineRounded';
import { Panel, EmptyState } from '../components/Panel';
import type { Page } from '../components/Navigation';
import type { Connection } from '../hooks/useHealth';
import { md3 } from '../theme';

const metricDefinitions = [
  {
    label: 'Evaluation runs',
    value: '0',
    detail: 'No experiments recorded',
    icon: ScienceOutlined,
  },
  { label: 'Pass rate', value: '—', detail: 'Awaiting your first run', icon: VerifiedUserOutlined },
  { label: 'Median latency', value: '—', detail: 'No recorded measurements', icon: SpeedRounded },
  { label: 'Estimated cost', value: '—', detail: 'Usage data unavailable', icon: PaymentsOutlined },
];

export function Overview({
  connection,
  onNavigate,
}: {
  connection: Connection;
  onNavigate: (page: Page) => void;
}) {
  const history = useRuns();
  const { config } = useConfig();
  const stats = history.overview;
  const summary = stats?.metric_run?.summary;
  const metrics = metricDefinitions.map((item, index) => ({
    ...item,
    value:
      index === 0
        ? stats
          ? String(stats.run_count)
          : '—'
        : index === 1
          ? formatRate(summary?.pass_rate)
          : index === 2
            ? formatTime(summary?.latency_ms.median)
            : summary?.estimated_cost_usd == null
              ? '—'
              : `$${summary.estimated_cost_usd.toFixed(4)}`,
    detail:
      index === 0
        ? 'Recorded experiments'
        : index === 1
          ? summary
            ? `${summary.pass_rate.numerator}/${summary.pass_rate.denominator} labeled checks`
            : 'Awaiting your first run'
          : index === 2
            ? 'Latest completed run'
            : 'Estimated when pricing is configured',
  }));
  const environment = [
    ['Operating mode', 'Mock / isolated'],
    [
      'Local API',
      connection.status === 'connected'
        ? 'Connected'
        : connection.status === 'checking'
          ? 'Checking…'
          : 'Offline',
    ],
    [
      'Model provider',
      config ? (config.openai_configured ? 'OpenAI configured' : 'Mock available') : 'Checking…',
    ],
    [
      'Notion workspace',
      config
        ? config.notion_configured
          ? `${config.notion_scope_count} selected root(s)`
          : 'Not configured'
        : 'Checking…',
    ],
  ];
  return (
    <>
      {history.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {history.error}
        </Alert>
      )}
      <Box className="metrics-grid" component="section" aria-label="Recorded metrics">
        {metrics.map(({ label, value, detail, icon: Icon }, index) => (
          <Card
            key={label}
            className="metric-card"
            sx={{ bgcolor: index === 0 ? md3.primaryContainer : md3.surfaceContainerLow }}
          >
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">{label}</Typography>
              <Icon sx={{ color: md3.primary, fontSize: 22 }} />
            </Stack>
            <Typography
              component="p"
              sx={{
                fontSize: 44,
                lineHeight: 1.2,
                my: 2,
                color: index === 0 ? md3.onPrimaryContainer : md3.onSurface,
              }}
            >
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {detail}
            </Typography>
          </Card>
        ))}
      </Box>
      <Box className="content-grid">
        <Panel
          title="Recent experiments"
          action={
            <Chip label={`${stats?.run_count ?? '—'} runs`} variant="outlined" size="small" />
          }
        >
          {history.runs.length ? (
            <Box sx={{ p: 3 }}>
              {history.runs.slice(0, 3).map((run) => (
                <Box key={run.id} sx={{ py: 1.5 }}>
                  <Typography variant="h3">{run.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {run.status} · {run.summary?.tests_completed ?? 0}/{run.total_tests} cases ·{' '}
                    {run.simulated ? 'Simulated' : 'Hosted model'}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : (
            <EmptyState icon={ScienceOutlined} title="Your experiments start here">
              Run the synthetic dataset to record measured outcomes and inspect failures.
            </EmptyState>
          )}
          <Divider sx={{ mx: 3 }} />
          <Stack
            className="panel-footer"
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2, py: 1 }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
              {stats?.latest_run
                ? `Most recent: ${stats.latest_run.label}`
                : stats
                  ? 'No most recent run'
                  : 'Loading history…'}
            </Typography>
            <Button endIcon={<ArrowForwardRounded />} onClick={() => onNavigate('Run History')}>
              View run history
            </Button>
          </Stack>
        </Panel>
        <Panel title="Environment" action={<TerminalRounded sx={{ color: 'text.secondary' }} />}>
          <Box component="dl" sx={{ m: 0, px: 3, pt: 2 }}>
            {environment.map(([label, value]) => (
              <Stack
                key={label}
                direction="row"
                sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 1.25 }}
              >
                <Typography component="dt" variant="body2" color="text.secondary">
                  {label}
                </Typography>
                <Typography
                  component="dd"
                  variant="body2"
                  sx={{
                    m: 0,
                    fontWeight: 500,
                    color: label === 'Operating mode' ? md3.primary : undefined,
                  }}
                >
                  {value}
                </Typography>
              </Stack>
            ))}
          </Box>
          <Box sx={{ m: 3, mt: 2, p: 2, bgcolor: md3.surfaceContainerHigh, borderRadius: 3 }}>
            <Typography variant="body2" color="text.secondary">
              Hosted queries require explicit consent. Notion access is read only and limited to
              selected test pages.
            </Typography>
          </Box>
        </Panel>
      </Box>
      <Card className="failure-card">
        <Box className="failure-icon">
          <CheckCircleOutlineRounded />
        </Box>
        <Box>
          <Typography variant="h3">Recent failures</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {stats?.recent_failures.length
              ? stats.recent_failures.map((item) => `${item.test_id} (${item.category})`).join(', ')
              : stats?.metric_run
                ? 'No failed labeled checks in the latest completed run.'
                : 'No test outcomes yet. Failure categories will appear after an evaluation.'}
          </Typography>
        </Box>
        <Chip
          label={stats?.metric_run ? `${stats.recent_failures.length} recent` : 'No data'}
          variant="outlined"
          size="small"
          sx={{ ml: 'auto' }}
        />
      </Card>
      <Box className="next-step">
        <Box className="next-step-number">02</Box>
        <Box>
          <Typography variant="overline" color="primary">
            Up next
          </Typography>
          <Typography variant="h3">Inspect a repeatable experiment</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Run the labeled synthetic dataset and inspect each recorded outcome.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          endIcon={<ArrowForwardRounded />}
          onClick={() => onNavigate('Evaluations')}
          sx={{ ml: 'auto' }}
        >
          Run evaluations
        </Button>
      </Box>
    </>
  );
}
