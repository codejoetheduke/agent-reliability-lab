import { Box, Button, Card, Chip, Divider, Stack, Typography } from '@mui/material';
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

const metrics = [
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
    ['Model provider', 'Not connected'],
    ['Notion workspace', 'Not connected'],
  ];
  return (
    <>
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
          action={<Chip label="0 runs" variant="outlined" size="small" />}
        >
          <EmptyState icon={ScienceOutlined} title="Your experiments start here">
            Run history and measured results will appear here once the evaluation engine is
            available.
          </EmptyState>
          <Divider sx={{ mx: 3 }} />
          <Stack
            className="panel-footer"
            direction="row"
            sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1, px: 2, py: 1 }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ pl: 1 }}>
              No most recent run
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
              External connections are introduced in later milestones.
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
            No test outcomes yet. Failure categories will appear after an evaluation.
          </Typography>
        </Box>
        <Chip label="No data" variant="outlined" size="small" sx={{ ml: 'auto' }} />
      </Card>
      <Box className="next-step">
        <Box className="next-step-number">02</Box>
        <Box>
          <Typography variant="overline" color="primary">
            Up next
          </Typography>
          <Typography variant="h3">Build the evidence trail</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Synthetic workspace retrieval and a source inspection playground.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          endIcon={<ArrowForwardRounded />}
          onClick={() => onNavigate('Agent Playground')}
          sx={{ ml: 'auto' }}
        >
          Explore playground
        </Button>
      </Box>
    </>
  );
}
