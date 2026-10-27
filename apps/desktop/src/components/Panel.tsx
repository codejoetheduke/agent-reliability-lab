import type { ReactNode } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';
import type { SvgIconComponent } from '@mui/icons-material';
import { md3 } from '../theme';

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card component="section" className={className}>
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 3, pt: 3 }}
      >
        <Typography variant="h2" sx={{ fontSize: '1.125rem', fontWeight: 500 }}>
          {title}
        </Typography>
        {action}
      </Stack>
      {children}
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: SvgIconComponent;
  title: string;
  children: ReactNode;
}) {
  return (
    <Stack sx={{ alignItems: 'center', textAlign: 'center', px: 3, py: 4.5, gap: 1 }}>
      <Box
        className="empty-state-icon"
        sx={{ bgcolor: md3.secondaryContainer, color: md3.secondary }}
      >
        <Icon sx={{ fontSize: 28 }} />
      </Box>
      <Typography component="h3" variant="h3" sx={{ mt: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 370 }}>
        {children}
      </Typography>
    </Stack>
  );
}
