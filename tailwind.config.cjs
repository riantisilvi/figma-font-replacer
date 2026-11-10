/** @type {import('tailwindcss').Config} */
// Colors map to Figma theme variables (figma.showUI themeColors: true),
// so the plugin follows light and dark mode in Figma.
module.exports = {
  content: ["./src/ui/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        xs: ["11px", "16px"],
        sm: ["12px", "16px"],
        base: ["13px", "20px"],
      },
      colors: {
        bg: {
          DEFAULT: "var(--figma-color-bg)",
          secondary: "var(--figma-color-bg-secondary)",
          hover: "var(--figma-color-bg-hover)",
          brand: "var(--figma-color-bg-brand)",
          "brand-hover": "var(--figma-color-bg-brand-hover)",
          // Figma brand blue with white text is about 3.5:1. Darken it for text buttons (5:1 or more).
          action: "color-mix(in srgb, var(--figma-color-bg-brand) 75%, black)",
          "action-hover": "color-mix(in srgb, var(--figma-color-bg-brand) 65%, black)",
          danger: "var(--figma-color-bg-danger-tertiary)",
          warning: "var(--figma-color-bg-warning-tertiary)",
          success: "var(--figma-color-bg-success-tertiary)",
          selected: "var(--figma-color-bg-selected)",
        },
        fg: {
          DEFAULT: "var(--figma-color-text)",
          // Figma text-secondary (50% alpha) is below 4.5:1 at 11 to 12 px.
          // Mix from the main text color instead, so it passes WCAG AA in both themes.
          secondary: "color-mix(in srgb, var(--figma-color-text) 68%, transparent)",
          tertiary: "color-mix(in srgb, var(--figma-color-text) 50%, transparent)",
          onbrand: "var(--figma-color-text-onbrand)",
          brand: "var(--figma-color-text-brand)",
          danger: "var(--figma-color-text-danger)",
          warning: "var(--figma-color-text-warning)",
          success: "var(--figma-color-text-success)",
        },
        border: {
          DEFAULT: "var(--figma-color-border)",
          strong: "var(--figma-color-border-strong)",
          selected: "var(--figma-color-border-selected)",
        },
      },
    },
  },
  plugins: [],
};
