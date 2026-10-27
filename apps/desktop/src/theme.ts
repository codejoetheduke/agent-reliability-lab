import { createTheme } from '@mui/material/styles';

// Material Design 3 baseline light color roles. Keep component choices semantic.
export const md3 = {
  primary: '#6750A4',
  onPrimary: '#FFFFFF',
  primaryContainer: '#EADDFF',
  onPrimaryContainer: '#21005D',
  secondary: '#625B71',
  secondaryContainer: '#E8DEF8',
  onSecondaryContainer: '#1D192B',
  tertiary: '#7D5260',
  tertiaryContainer: '#FFD8E4',
  surface: '#FEF7FF',
  surfaceContainerLowest: '#FFFFFF',
  surfaceContainerLow: '#F7F2FA',
  surfaceContainer: '#F3EDF7',
  surfaceContainerHigh: '#ECE6F0',
  onSurface: '#1D1B20',
  onSurfaceVariant: '#49454F',
  outline: '#79747E',
  outlineVariant: '#CAC4D0',
  error: '#B3261E',
  errorContainer: '#F9DEDC',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: md3.primary, contrastText: md3.onPrimary },
    secondary: { main: md3.secondary },
    error: { main: md3.error },
    background: { default: md3.surface, paper: md3.surfaceContainerLow },
    text: { primary: md3.onSurface, secondary: md3.onSurfaceVariant },
    divider: md3.outlineVariant,
  },
  typography: {
    fontFamily: 'Roboto, "Segoe UI", sans-serif',
    h1: { fontSize: '2.25rem', lineHeight: 1.22, fontWeight: 400, letterSpacing: 0 },
    h2: { fontSize: '1.375rem', lineHeight: 1.3, fontWeight: 400 },
    h3: { fontSize: '1rem', lineHeight: 1.5, fontWeight: 500 },
    body1: { fontSize: '1rem', lineHeight: 1.5 },
    body2: { fontSize: '.875rem', lineHeight: 1.5, letterSpacing: '.25px' },
    subtitle2: { fontSize: '.875rem', lineHeight: 1.4, fontWeight: 500 },
    caption: { fontSize: '.75rem', lineHeight: 1.5, letterSpacing: '.4px' },
    overline: { fontSize: '.6875rem', lineHeight: 1.5, fontWeight: 500, letterSpacing: '1.5px' },
    button: {
      fontSize: '.875rem',
      lineHeight: 1.4,
      fontWeight: 500,
      textTransform: 'none',
      letterSpacing: '.1px',
    },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': { colorScheme: 'light', fontSynthesis: 'none' },
        body: { margin: 0, WebkitFontSmoothing: 'antialiased' },
        '*:focus-visible': { outline: `3px solid ${md3.primary}`, outlineOffset: 3 },
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            transitionDuration: '0.01ms !important',
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 100, minHeight: 40, paddingInline: 24 },
        outlined: { borderColor: md3.outline },
      },
    },
    MuiIconButton: { styleOverrides: { root: { minWidth: 48, minHeight: 48 } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none', borderRadius: 24 } },
    },
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 500 },
        outlined: { borderColor: md3.outlineVariant },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 100,
          minHeight: 56,
          '&.Mui-selected': {
            backgroundColor: md3.secondaryContainer,
            color: md3.onSecondaryContainer,
          },
          '&.Mui-selected:hover': { backgroundColor: '#DFD4EE' },
        },
      },
    },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
  },
});
