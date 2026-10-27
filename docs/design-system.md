# Material Design 3

The interface uses **Material UI 9 components with an explicit Material Design 3 theme**. MUI's default visual language remains Material Design 2, so installing the library alone does not establish an M3 design. The application applies its color roles, typography, component shapes, interaction states, and adaptive navigation through `src/theme.ts` and a layout-only stylesheet.

References: [MUI overview](https://mui.com/material-ui/getting-started/), [MUI theming](https://mui.com/material-ui/customization/theming/), [Material 3 color roles](https://m3.material.io/styles/color/roles), [Material 3 typography](https://m3.material.io/styles/typography/applying-type), [MUI 9 styling migration](https://mui.com/system/migration/upgrade-to-v9/).

## Implementation

- **Color:** baseline light scheme with primary `#6750A4`, primary container `#EADDFF`, secondary container `#E8DEF8`, surface `#FEF7FF`, and tonal surface containers. Colors are assigned by semantic role, including paired foreground colors.
- **Typography:** locally bundled Roboto, 36px page headlines, 22px section titles, 16px body, 14px secondary text, and 12px labels. No remote font requests are needed.
- **Shape:** pill-shaped buttons and selected drawer destinations, 24px cards, 28px prominent containers, 16px icon containers, and 8px chips. Flat tonal surfaces distinguish sections without heavy shadows.
- **Controls:** MUI buttons, chips, list buttons, text fields, drawer, focus trap, icons, loading indicators, and disabled states. MUI 9 layout styling uses `sx`; removed system props are not forwarded to the DOM.
- **Navigation:** expanded desktop drawer at 1200px and above; a labeled navigation rail at 700–1199px; a modal drawer below 700px. Destinations keep full accessible names at every size.
- **Accessibility:** visible focus indicators, 48px icon-button targets, 56px drawer rows, semantic headings, main-content skip link, live connection status, Escape dismissal and focus restoration for the mobile drawer, reduced-motion support, and responsive layouts without horizontal overflow at tested sizes.

## Modules

`theme.ts` defines design roles and component defaults. `components/Navigation.tsx` owns navigation presentation. `components/Panel.tsx` supplies shared panel and empty-state components. `pages/Overview.tsx` and `pages/WorkspacePage.tsx` own section layouts. `App.tsx` composes these with the existing connection hook. Agent orchestration remains outside presentation code.

The design covers conversations, sources, evaluation progress/details, comparison charts and equivalent tables, action review dialogs, and retention controls. Loading states and unavailable measurements stay explicit. Recharts uses primary/tertiary roles, legends, labeled axes, keyboard accessibility, and fixed-height responsive containers. Feature pages load lazily. The palette is light-only; dark mode is not implemented.

## Verification

The browser suite covers 1280px desktop, 820px compact, and 390px mobile layouts with the real backend. It rejects browser console errors in the primary workflow and checks mobile drawer keyboard behavior, absence of overflow, and absence of external runtime requests. Screenshots are in `docs/screenshots/`.
