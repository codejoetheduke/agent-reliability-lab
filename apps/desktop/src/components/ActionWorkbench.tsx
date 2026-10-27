import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { z } from 'zod';
import { apiRequest } from '../api/client';
import { Panel } from './Panel';

const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  owner: z.string(),
  due: z.string().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']),
  version: z.number(),
  created_at: z.string(),
});
const proposalSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  request: z.object({
    operation: z.enum(['create_task', 'update_task']),
    source: z.string(),
    title: z.string(),
    owner: z.string(),
    due: z.string().nullable(),
    status: z.string(),
    task_id: z.string().nullable(),
    expected_version: z.number().nullable(),
    idempotency_key: z.string(),
  }),
  fingerprint: z.string(),
  status: z.enum(['proposed', 'executed', 'failed', 'cancelled']),
  resource_id: z.string().nullable(),
  error: z.string().nullable(),
  attempts: z.number(),
  simulated: z.boolean(),
});
type Task = z.infer<typeof taskSchema>;
type Proposal = z.infer<typeof proposalSchema>;

export function ActionWorkbench() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [operation, setOperation] = useState<'create_task' | 'update_task'>('create_task');
  const [taskId, setTaskId] = useState('');
  const [title, setTitle] = useState('');
  const [owner, setOwner] = useState('');
  const [due, setDue] = useState('');
  const [status, setStatus] = useState<Task['status']>('todo');
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  async function reload() {
    setTasks(z.array(taskSchema).parse(await apiRequest('/actions/tasks')));
  }
  useEffect(() => {
    const controller = new AbortController();
    apiRequest('/actions/tasks', { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setTasks(z.array(taskSchema).parse(value));
      })
      .catch(() => {
        if (!controller.signal.aborted) setError('Mock task state could not be loaded.');
      });
    return () => controller.abort();
  }, []);
  function selectTask(id: string) {
    setTaskId(id);
    const task = tasks.find((item) => item.id === id);
    if (task) {
      setTitle(task.title);
      setOwner(task.owner);
      setDue(task.due ?? '');
      setStatus(task.status);
    }
  }
  async function propose() {
    setBusy(true);
    setError('');
    setOutcome('');
    try {
      const task = tasks.find((item) => item.id === taskId);
      setProposal(
        proposalSchema.parse(
          await apiRequest('/actions/proposals', {
            method: 'POST',
            body: JSON.stringify({
              operation,
              source: 'synthetic',
              title,
              owner,
              due: due || null,
              status,
              task_id: operation === 'update_task' ? taskId : null,
              expected_version: operation === 'update_task' ? task?.version : null,
              idempotency_key: crypto.randomUUID(),
            }),
          }),
        ),
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Proposal could not be created.');
    } finally {
      setBusy(false);
    }
  }
  async function execute() {
    if (!proposal) return;
    setBusy(true);
    setError('');
    try {
      const result = proposalSchema.parse(
        await apiRequest(`/actions/proposals/${proposal.id}/execute`, {
          method: 'POST',
          body: JSON.stringify({ confirmed: true, retry_failed: proposal.status === 'failed' }),
        }),
      );
      setProposal(result);
      if (result.status === 'executed') {
        setOutcome(`Mock action executed. Resource: ${result.resource_id}`);
        setProposal(null);
        await reload();
      } else setError(result.error ?? 'The operation did not execute.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Execution failed.');
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!proposal || busy) return;
    try {
      await apiRequest(`/actions/proposals/${proposal.id}/cancel`, { method: 'POST' });
      setProposal(null);
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Cancellation failed.');
    }
  }
  async function reset() {
    setBusy(true);
    try {
      await apiRequest('/actions', { method: 'DELETE', body: JSON.stringify({ confirmed: true }) });
      await reload();
      setResetOpen(false);
      setTaskId('');
      setOutcome('Mock task and proposal data cleared.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Reset failed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel
      title="Controlled task actions"
      action={<Chip label="Mock task store" variant="outlined" size="small" />}
    >
      <Box sx={{ p: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Propose an immutable task operation, inspect every parameter, then confirm it. These
          actions affect only local mock tasks. Notion mutations are disabled.
        </Typography>
        {error && !proposal && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {outcome && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {outcome}
          </Alert>
        )}
        <Stack
          spacing={2}
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            void propose();
          }}
        >
          <TextField
            select
            label="Task operation"
            value={operation}
            onChange={(event) => setOperation(event.target.value as typeof operation)}
          >
            <MenuItem value="create_task">Create task</MenuItem>
            <MenuItem value="update_task">Update task</MenuItem>
          </TextField>
          {operation === 'update_task' && (
            <TextField
              select
              label="Existing mock task"
              value={taskId}
              onChange={(event) => selectTask(event.target.value)}
            >
              {tasks.map((task) => (
                <MenuItem key={task.id} value={task.id}>
                  {task.title} · v{task.version}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Task title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            label="Task owner"
            value={owner}
            onChange={(event) => setOwner(event.target.value)}
            required
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          <TextField
            label="Task deadline"
            type="date"
            value={due}
            onChange={(event) => setDue(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label="Task status"
            value={status}
            onChange={(event) => setStatus(event.target.value as Task['status'])}
          >
            <MenuItem value="todo">To do</MenuItem>
            <MenuItem value="in_progress">In progress</MenuItem>
            <MenuItem value="done">Done</MenuItem>
          </TextField>
          <Box>
            <Button
              type="submit"
              variant="outlined"
              disabled={
                busy || !title.trim() || !owner.trim() || (operation === 'update_task' && !taskId)
              }
            >
              Review task proposal
            </Button>
          </Box>
        </Stack>
        {tasks.length > 0 && (
          <Box sx={{ overflowX: 'auto', mt: 3 }}>
            <Table size="small" aria-label="Mock tasks">
              <TableHead>
                <TableRow>
                  <TableCell>Task</TableCell>
                  <TableCell>Owner</TableCell>
                  <TableCell>Deadline</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell>
                      {task.title}
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        v{task.version}
                      </Typography>
                    </TableCell>
                    <TableCell>{task.owner}</TableCell>
                    <TableCell>{task.due ?? '—'}</TableCell>
                    <TableCell>{task.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
        <Button
          color="error"
          size="small"
          sx={{ mt: 2 }}
          disabled={!tasks.length || busy}
          onClick={() => setResetOpen(true)}
        >
          Clear mock tasks and proposals
        </Button>
      </Box>
      <Dialog
        open={proposal !== null}
        onClose={() => void cancel()}
        fullWidth
        maxWidth="sm"
        aria-labelledby="confirm-action-title"
      >
        <DialogTitle id="confirm-action-title">Confirm mock task action</DialogTitle>
        <DialogContent>
          {proposal && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Only the local mock task store will change. No external workspace will be mutated.
              </Alert>
              <Box component="dl" className="settings-list" sx={{ mx: 0 }}>
                {Object.entries({
                  operation: proposal.request.operation,
                  title: proposal.request.title,
                  owner: proposal.request.owner,
                  deadline: proposal.request.due ?? 'None',
                  status: proposal.request.status,
                  task: proposal.request.task_id ?? 'New mock task',
                  version: proposal.request.expected_version ?? 'New',
                }).map(([key, value]) => (
                  <Box key={key}>
                    <Typography component="dt" variant="body2" color="text.secondary">
                      {key}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="body2"
                      sx={{ m: 0, overflowWrap: 'anywhere' }}
                    >
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {error && <Alert severity="error">{error}</Alert>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void cancel()} disabled={busy}>
            Cancel proposal
          </Button>
          <Button variant="contained" onClick={() => void execute()} disabled={busy}>
            {proposal?.status === 'failed' ? 'Confirm retry' : 'Confirm execution'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        aria-labelledby="reset-actions-title"
      >
        <DialogTitle id="reset-actions-title">Clear mock tasks and proposals?</DialogTitle>
        <DialogContent>
          <Typography>
            This removes local mock tasks and their action audit records. Evaluation history is
            retained.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)}>Cancel</Button>
          <Button color="error" disabled={busy} onClick={() => void reset()}>
            Clear mock data
          </Button>
        </DialogActions>
      </Dialog>
    </Panel>
  );
}
