import { defineEcConfig } from 'astro-expressive-code';

// Lives outside astro.config.mjs because the <Code> component re-loads its
// settings from JSON, and the inline config there contains a function
// (themeCssSelector) that isn't serializable. Astro Expressive Code looks
// for ec.config.mjs at the project root automatically.
export default defineEcConfig({
  themes: ['github-light', 'github-dark-default'],
  themeCssSelector: (theme) => `[data-theme='${theme.name === 'github-light' ? 'light' : 'dark'}']`,
  defaultProps: { wrap: true },
  styleOverrides: {
    borderRadius: '6px',
    codeFontSize: 'calc(var(--text-step-0) * 0.95)',
  },
});
