import { lazy, Suspense } from 'react';
import { LinearProgress } from '@mui/material';
import type { Page } from '../components/Navigation';
import type { ProviderName } from '../api/execution';

const Evaluations = lazy(() => import('./Evaluations').then((m) => ({ default: m.Evaluations })));
const RunHistory = lazy(() => import('./RunHistory').then((m) => ({ default: m.RunHistory })));
const Playground = lazy(() => import('./Playground').then((m) => ({ default: m.Playground })));
const Settings = lazy(() => import('./Settings').then((m) => ({ default: m.Settings })));
const Comparison = lazy(() => import('./Comparison').then((m) => ({ default: m.Comparison })));

export function WorkspacePage({
  page,
  statusText,
  onModeChange,
}: {
  page: Exclude<Page, 'Overview'>;
  statusText: string;
  onModeChange: (provider: ProviderName) => void;
}) {
  return (
    <Suspense fallback={<LinearProgress aria-label="Loading page" />}>
      {page === 'Agent Playground' ? (
        <Playground onModeChange={onModeChange} />
      ) : page === 'Evaluations' ? (
        <Evaluations onModeChange={onModeChange} />
      ) : page === 'Run History' ? (
        <RunHistory />
      ) : page === 'Settings' ? (
        <Settings statusText={statusText} />
      ) : (
        <Comparison />
      )}
    </Suspense>
  );
}
