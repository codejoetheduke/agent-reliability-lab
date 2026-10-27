import { Playground } from './Playground';
import { Box, Chip, Typography } from '@mui/material';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
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
  if (page === 'Evaluations')
    return (
      <Panel
        title="Evaluation datasets"
        action={<Chip label="Milestone 3" variant="outlined" size="small" />}
      >
        <EmptyState icon={ScienceOutlined} title="No datasets installed">
          Versioned synthetic cases and the evaluation runner arrive in Milestone 3.
        </EmptyState>
      </Panel>
    );
  if (page === 'Model Comparison')
    return (
      <Panel title="Compare completed runs" action={<CompareArrowsRounded color="secondary" />}>
        <EmptyState icon={CompareArrowsRounded} title="Two comparable runs needed">
          Dataset versions, metric definitions, and test conditions must match before results can be
          compared.
        </EmptyState>
      </Panel>
    );
  if (page === 'Run History')
    return (
      <Panel
        title="All experiments"
        action={<Chip label="0 runs" variant="outlined" size="small" />}
      >
        <EmptyState icon={HistoryRounded} title="No recorded runs">
          This workspace has no experiments yet. Nothing has been simulated or executed.
        </EmptyState>
      </Panel>
    );
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
