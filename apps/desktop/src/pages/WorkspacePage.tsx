import { Evaluations } from './Evaluations';
import { RunHistory } from './RunHistory';
import { Playground } from './Playground';
import { Settings } from './Settings';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import { EmptyState, Panel } from '../components/Panel';
import type { Page } from '../components/Navigation';
import type { ProviderName } from '../api/execution';

export function WorkspacePage({
  page,
  statusText,
  onModeChange,
}: {
  page: Exclude<Page, 'Overview'>;
  statusText: string;
  onModeChange: (provider: ProviderName) => void;
}) {
  if (page === 'Agent Playground') return <Playground onModeChange={onModeChange} />;
  if (page === 'Evaluations') return <Evaluations onModeChange={onModeChange} />;
  if (page === 'Run History') return <RunHistory />;
  if (page === 'Settings') return <Settings statusText={statusText} />;
  return (
    <Panel title="Compare completed runs" action={<CompareArrowsRounded color="secondary" />}>
      <EmptyState icon={CompareArrowsRounded} title="Two comparable runs needed">
        Dataset versions, metric definitions, and test conditions must match before results can be
        compared.
      </EmptyState>
    </Panel>
  );
}
