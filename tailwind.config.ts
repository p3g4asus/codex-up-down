import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        "surface-strong": "var(--surface-strong)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        muted: "var(--muted)",
      },
      boxShadow: {
        panel: "0 24px 60px rgba(25, 39, 32, 0.12)",
      },
      borderRadius: {
        xl: "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
