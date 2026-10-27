import { Evaluations } from './Evaluations';
import { RunHistory } from './RunHistory';
import { Playground } from './Playground';
import { Box, Typography } from '@mui/material';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import { EmptyState, Panel } from '../components/Panel';
import type { Page } from '../components/Navigation';

export function WorkspacePage({
  page,
  statusText,
}: {
  page: Exclude<Page, 'Overview'>;
  statusText: string;
}) {
  if (page === 'Agent Playground') return <Playground />;
  if (page === 'Evaluations') return <Evaluations />;
  if (page === 'Model Comparison')
    return (
      <Panel title="Compare completed runs" action={<CompareArrowsRounded color="secondary" />}>
        <EmptyState icon={CompareArrowsRounded} title="Two comparable runs needed">
          Dataset versions, metric definitions, and test conditions must match before results can be
          compared.
        </EmptyState>
      </Panel>
    );
  if (page === 'Run History') return <RunHistory />;
  const settings = [
    ['Application mode', 'Mock · no external calls'],
    ['Local backend', statusText],
    ['LLM provider', 'Not configured · available in Milestone 4'],
    ['Notion', 'Not connected · available in Milestone 6'],
    ['Credentials', 'Not loaded or required in this milestone'],
    ['Experiment storage', 'Not initialized · available in Milestone 3'],
  ];
  return (
    <Panel title="Connection configuration" action={<SettingsOutlined color="secondary" />}>
      <Box component="dl" className="settings-list">
        {settings.map(([label, value]) => (
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
      <Typography variant="body2" color="text.secondary" sx={{ p: 3, pt: 0 }}>
        Credentials belong in backend-only secure configuration. Secret values are never displayed
        here.
      </Typography>
    </Panel>
  );
}
