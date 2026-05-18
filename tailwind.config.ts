import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      transitionDuration: {
        fast: "120ms",
        base: "200ms",
        slow: "300ms",
      },
      transitionTimingFunction: {
        spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "ease-out": "cubic-bezier(0, 0, 0.2, 1)",
      },
      colors: {
        background: "#08080c",
        surface: "#0e0e14",
        "surface-dim": "#08080c",
        "surface-container-lowest": "#060609",
        "surface-container-low": "#111118",
        "surface-container": "#16161f",
        "surface-container-high": "#1e1e2a",
        "surface-container-highest": "#252534",
        "surface-variant": "#1a1a26",
        "surface-bright": "#22223a",
        outline: "#4a4a6a",
        "outline-variant": "#1e1e30",
        primary: "#8b5cf6",
        "primary-container": "#7c3aed",
        "primary-fixed": "#a78bfa",
        "primary-fixed-dim": "#8b5cf6",
        secondary: "#f59e0b",
        "secondary-container": "#d97706",
        tertiary: "#6366f1",
        "tertiary-container": "#4f46e5",
        error: "#f87171",
        "error-container": "#7f1d1d",
        "on-background": "#f1f0ff",
        "on-surface": "#f1f0ff",
        "on-surface-variant": "#9999bb",
        "on-primary": "#ffffff",
        "on-primary-container": "#ffffff",
        "on-secondary-container": "#fff7ed",
        accent: {
          sports:  "#087cff",
          casino:  "#ff1979",
          finance: "#05b957",
          gold:    "#f59e0b",
        },
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        full: "9999px",
      },
      fontFamily: {
        body: ["var(--font-jakarta)", "sans-serif"],
        headline: ["var(--font-jakarta)", "sans-serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
