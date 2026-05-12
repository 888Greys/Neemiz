import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0b1326",
        surface: "#0b1326",
        "surface-dim": "#0b1326",
        "surface-container-lowest": "#060e20",
        "surface-container-low": "#131b2e",
        "surface-container": "#171f33",
        "surface-container-high": "#222a3d",
        "surface-container-highest": "#2d3449",
        "surface-variant": "#2d3449",
        "surface-bright": "#31394d",
        outline: "#86948a",
        "outline-variant": "#3c4a42",
        primary: "#4edea3",
        "primary-container": "#10b981",
        "primary-fixed": "#6ffbbe",
        "primary-fixed-dim": "#4edea3",
        secondary: "#4fdbc8",
        "secondary-container": "#04b4a2",
        tertiary: "#b9c7e0",
        "tertiary-container": "#95a4bb",
        error: "#ffb4ab",
        "error-container": "#93000a",
        "on-background": "#dae2fd",
        "on-surface": "#dae2fd",
        "on-surface-variant": "#bbcabf",
        "on-primary": "#003824",
        "on-primary-container": "#00422b",
        "on-secondary-container": "#003f38",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem",
      },
      fontFamily: {
        body: ["var(--font-inter)", "sans-serif"],
        headline: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
