import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "quick-actions-sheet-in": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" },
        },
        "quick-actions-sheet-out": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" },
        },
        "quick-actions-overlay-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "quick-actions-overlay-out": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "quick-actions-item-in": {
          from: { opacity: "0", transform: "translateY(0.5rem)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "quick-actions-sheet-in":
          "quick-actions-sheet-in 280ms cubic-bezier(0.32, 0.72, 0, 1) both",
        "quick-actions-sheet-out":
          "quick-actions-sheet-out 220ms cubic-bezier(0.32, 0.72, 0, 1) both",
        "quick-actions-overlay-in":
          "quick-actions-overlay-in 200ms ease-out both",
        "quick-actions-overlay-out":
          "quick-actions-overlay-out 180ms ease-in both",
        "quick-actions-item-in":
          "quick-actions-item-in 220ms ease-out both",
      },
    },
  },
  plugins: [],
}

export default config

