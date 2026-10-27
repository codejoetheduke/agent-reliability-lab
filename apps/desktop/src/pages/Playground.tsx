import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SendRounded from '@mui/icons-material/SendRounded';
import StorageRounded from '@mui/icons-material/StorageRounded';
import { EmptyState, Panel } from '../components/Panel';
import { apiRequest } from '../api/client';
import { answerSchema, recordSchema, type AgentAnswer, type SourceRecord } from '../api/contracts';
import { z } from 'zod';
import { useConfig } from '../hooks/useConfig';
import { md3 } from '../theme';
import { ProviderControls } from '../components/ProviderControls';
import { defaultExecution, providerLabel, type ProviderName } from '../api/execution';
import { ActionWorkbench } from '../components/ActionWorkbench';

type Message = { question: string; result: AgentAnswer };
const examples = [
  'Who owns Atlas?',
  'What are Atlas release and blockers?',
  'What is Cedar budget?',
];

export function Playground({ onModeChange }: { onModeChange: (provider: ProviderName) => void }) {
  const [execution, setExecution] = useState(defaultExecution);
  const [sourceChoice, setSource] = useState<'synthetic' | 'notion' | null>(null);
  const { config } = useConfig();
  const source =
    sourceChoice ??
    (config?.notion_configured && config.default_provider !== 'mock' ? 'notion' : 'synthetic');
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function send() {
    if (!question.trim() || busy) return;
    const submitted = question.trim();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    try {
      const result = answerSchema.parse(
        await apiRequest('/agent/query', {
          method: 'POST',
          body: JSON.stringify({
            question: submitted,
            source,
            provider: execution.provider,
            model: execution.model || null,
            allow_external_transmission: execution.consent,
          }),
          signal: controller.signal,
          timeoutMs: 130000,
        }),
      );
      if (controller.signal.aborted) return;
      setMessages((previous) => [...previous, { question: submitted, result }]);
      setSources(result.sources);
      setSelected(null);
      setQuestion('');
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'The query failed.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function inspectNotion() {
    setBusy(true);
    setError('');
    const controller = new AbortController();
    pending.current = controller;
    try {
      const records = z
        .array(recordSchema)
        .parse(
          await apiRequest('/notion/records', { signal: controller.signal, timeoutMs: 95000 }),
        );
      if (!controller.signal.aborted) {
        setSources(records);
        setSelected(null);
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(failure instanceof Error ? failure.message : 'Source inspection failed.');
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <Box className="playground-grid">
      <Panel
        title="Conversation"
        action={
          <Chip
            label={`${source === 'synthetic' ? 'Synthetic' : 'Notion read-only'} · ${providerLabel(execution.provider)}`}
            size="small"
            variant="outlined"
          />
        }
      >
        <Box sx={{ p: 3, pb: 0 }}>
          <TextField
            select
            label="Workspace source"
            value={source}
            fullWidth
            disabled={busy}
            sx={{ mb: 2 }}
            onChange={(event) => {
              setSource(event.target.value as typeof source);
              setMessages([]);
              setSources([]);
              setError('');
              setExecution((previous) => ({ ...previous, consent: false }));
            }}
          >
            <MenuItem value="synthetic">Synthetic workspace fixtures</MenuItem>
            <MenuItem value="notion" disabled={!config?.notion_configured}>
              Selected Notion test pages · read only
            </MenuItem>
          </TextField>
          <ProviderControls value={execution} onChange={setExecution} onModeChange={onModeChange} />
          {source === 'notion' && (
            <>
              <Alert severity="info" sx={{ mt: 2 }}>
                Only selected pages and contained descendants are read. Notion content stays out of
                evaluation history. The mock provider can inspect sources but abstains without
                labeled fixture facts.
              </Alert>
              <Button
                variant="outlined"
                sx={{ mt: 2 }}
                disabled={busy}
                onClick={() => void inspectNotion()}
              >
                Inspect selected Notion pages
              </Button>
            </>
          )}
        </Box>
        <Box className="conversation-messages" aria-live="polite">
          {messages.length === 0 && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h3">Ask a question. Follow the evidence.</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                Ask about your selected Notion pages or try the fictional project fixtures. Live
                answers are selected by the configured model and validated against retrieved
                evidence.
              </Typography>
              <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
                {examples.map((example) => (
                  <Button
                    key={example}
                    variant="outlined"
                    size="small"
                    onClick={() => setQuestion(example)}
                  >
                    {example}
                  </Button>
                ))}
              </Stack>
            </Box>
          )}
          {messages.map(({ question: asked, result }, index) => (
            <Box key={index} sx={{ px: 3, py: 2 }}>
              <Box sx={{ bgcolor: md3.primaryContainer, p: 2, borderRadius: 3, mb: 2 }}>
                <Typography variant="caption">You</Typography>
                <Typography sx={{ mt: 0.5 }}>{asked}</Typography>
              </Box>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography variant="subtitle2">Agent</Typography>
                <Chip
                  size="small"
                  label={
                    result.provider === 'policy'
                      ? 'Local policy · no model call'
                      : result.simulated
                        ? 'Simulated'
                        : `${result.provider} · live`
                  }
                  variant="outlined"
                />
                <Typography variant="caption" color="text.secondary">
                  {result.latency_ms.toFixed(1)} ms
                </Typography>
              </Stack>
              {result.abstained ? (
                <Alert severity={result.reason === 'conflicting_evidence' ? 'warning' : 'info'}>
                  {result.answer}
                </Alert>
              ) : (
                <Typography sx={{ whiteSpace: 'pre-line' }}>{result.answer}</Typography>
              )}
              <Stack direction="row" sx={{ gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                {[
                  ...new Set(
                    result.claims.flatMap((claim) =>
                      claim.citations.map((citation) => citation.record_id),
                    ),
                  ),
                ].map((id) => (
                  <Chip
                    key={id}
                    component="button"
                    clickable
                    label={id}
                    size="small"
                    onClick={() => {
                      setSources(result.sources);
                      setSelected(id);
                    }}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          sx={{ p: 3, borderTop: 1, borderColor: 'divider' }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Ask your workspace"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: 4000 } }}
            helperText={
              source === 'notion'
                ? 'Ask about facts in your selected Notion pages. Read-only access never executes workspace changes.'
                : 'Try Atlas, Beacon, or Cedar. Workspace actions require a separate confirmation.'
            }
          />
          <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
            <Button
              type="submit"
              variant="contained"
              disabled={
                !question.trim() || busy || (execution.provider !== 'mock' && !execution.consent)
              }
              endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <SendRounded />}
            >
              {busy ? 'Retrieving evidence…' : 'Send question'}
            </Button>
          </Stack>
        </Box>
      </Panel>
      <Panel title="Sources" action={<StorageRounded color="secondary" />}>
        {sources.length === 0 ? (
          <EmptyState icon={StorageRounded} title="No sources retrieved">
            Supporting excerpts and source identifiers will appear here after a query.
          </EmptyState>
        ) : (
          <Stack spacing={2} sx={{ p: 3 }}>
            {sources.map((record) => (
              <Box
                key={record.id}
                sx={{
                  p: 2,
                  border: 1,
                  borderColor: selected === record.id ? 'primary.main' : 'divider',
                  borderRadius: 3,
                  bgcolor: selected === record.id ? md3.primaryContainer : undefined,
                }}
              >
                <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="h3">{record.title}</Typography>
                  <Chip label={record.kind} size="small" variant="outlined" />
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {record.id}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1.5, whiteSpace: 'pre-line' }}>
                  {record.body}
                </Typography>
                {record.url && (
                  <Link
                    href={record.url}
                    target="_blank"
                    rel="noreferrer"
                    sx={{ display: 'inline-block', mt: 1 }}
                  >
                    Open source
                  </Link>
                )}
              </Box>
            ))}
          </Stack>
        )}
      </Panel>
      <Box sx={{ gridColumn: '1 / -1' }}>
        {execution.provider === 'mock' ? (
          <ActionWorkbench />
        ) : (
          <Alert severity="info">
            Notion access is read only. Live workspace mutations are not enabled; local task
            simulations are available only when you explicitly select Mock.
          </Alert>
        )}
      </Box>
    </Box>
  );
}
