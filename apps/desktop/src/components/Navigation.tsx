import {
  Avatar,
  Box,
  Chip,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import ChatBubbleOutlineRounded from '@mui/icons-material/ChatBubbleOutlineRounded';
import ScienceOutlined from '@mui/icons-material/ScienceOutlined';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import HistoryRounded from '@mui/icons-material/HistoryRounded';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import { md3 } from '../theme';

const pages = [
  { name: 'Overview', label: 'Overview', icon: DashboardOutlined },
  { name: 'Agent Playground', label: 'Playground', icon: ChatBubbleOutlineRounded },
  { name: 'Evaluations', label: 'Evaluations', icon: ScienceOutlined },
  { name: 'Model Comparison', label: 'Compare', icon: CompareArrowsRounded },
  { name: 'Run History', label: 'History', icon: HistoryRounded },
  { name: 'Settings', label: 'Settings', icon: SettingsOutlined },
] as const;
export type Page = (typeof pages)[number]['name'];

export function Navigation({
  page,
  onNavigate,
  expanded = false,
}: {
  page: Page;
  onNavigate: (page: Page) => void;
  expanded?: boolean;
}) {
  return (
    <Box className={`navigation-content ${expanded ? 'expanded' : ''}`}>
      <Stack direction="row" className="brand" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Box className="brand-mark">
          <ScienceOutlined sx={{ fontSize: 27 }} />
        </Box>
        <Box className="drawer-label">
          <Typography variant="h3">Reliability Lab</Typography>
          <Typography variant="caption" color="text.secondary">
            Personal workspace
          </Typography>
        </Box>
      </Stack>
      <Box className="workspace-card drawer-label">
        <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              bgcolor: md3.primaryContainer,
              color: md3.onPrimaryContainer,
              width: 40,
              height: 40,
              fontSize: 14,
            }}
          >
            AR
          </Avatar>
          <Box>
            <Typography variant="subtitle2">Development</Typography>
            <Typography variant="caption" color="text.secondary">
              Local environment
            </Typography>
          </Box>
        </Stack>
      </Box>
      <Typography
        className="drawer-label"
        variant="overline"
        color="text.secondary"
        sx={{ px: 2, mb: 1 }}
      >
        Workspace
      </Typography>
      <List component="nav" aria-label="Main navigation" sx={{ p: 0 }}>
        {pages.map(({ name, label, icon: Icon }) => (
          <ListItemButton
            key={name}
            component="button"
            aria-label={name}
            aria-current={page === name ? 'page' : undefined}
            selected={page === name}
            onClick={() => onNavigate(name)}
            className="nav-item"
          >
            <ListItemIcon className="nav-icon" sx={{ minWidth: 40, color: 'inherit' }}>
              <Icon />
            </ListItemIcon>
            <ListItemText
              className="drawer-label"
              primary={name}
              slotProps={{ primary: { variant: 'subtitle2' } }}
            />
            <Typography className="rail-label" variant="caption">
              {label}
            </Typography>
          </ListItemButton>
        ))}
      </List>
      <Box className="nav-bottom drawer-label">
        <Divider sx={{ mb: 2.5 }} />
        <Stack direction="row" sx={{ gap: 1.5, alignItems: 'center' }}>
          <VerifiedUserOutlined sx={{ color: md3.primary }} />
          <Box>
            <Typography variant="subtitle2">Local by design</Typography>
            <Typography variant="caption" color="text.secondary">
              No external connections
            </Typography>
          </Box>
        </Stack>
        <Stack
          direction="row"
          sx={{ justifyContent: 'space-between', alignItems: 'center', mt: 3 }}
        >
          <Typography variant="caption" color="text.secondary">
            Desktop workspace
          </Typography>
          <Chip label="v0.1.0" size="small" variant="outlined" />
        </Stack>
      </Box>
    </Box>
  );
}
