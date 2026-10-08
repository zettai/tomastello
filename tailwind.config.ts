import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-space-mono)", "Courier New", "monospace"],
      },
      colors: {
        background: "var(--background)",
        "background-secondary": "var(--background-secondary)",
        "background-tertiary": "var(--background-tertiary)",
        foreground: "var(--foreground)",
        "foreground-secondary": "var(--foreground-secondary)",
        "foreground-tertiary": "var(--foreground-tertiary)",
        primary: "var(--color-primary)",
        "primary-hover": "var(--color-primary-hover)",
        "primary-light": "var(--color-primary-light)",
        "primary-lighter": "var(--color-primary-lighter)",
        border: "var(--border)",
        "border-focus": "var(--border-focus)",
      },
      typography: {
        DEFAULT: {
          css: {
            color: "var(--foreground)",
            a: {
              color: "var(--color-primary)",
              "&:hover": {
                color: "var(--color-primary-hover)",
              },
            },
          },
        },
        invert: {
          css: {
            color: "var(--foreground)",
            a: {
              color: "var(--color-primary-light)",
              "&:hover": {
                color: "var(--color-primary-lighter)",
              },
            },
          },
        },
      },
    },
  },
  plugins: [typography],
};

export default config;
