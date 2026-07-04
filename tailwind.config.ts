import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        smoke: "rgb(var(--color-smoke) / <alpha-value>)",
        steel: "rgb(var(--color-steel) / <alpha-value>)",
        brass: "rgb(var(--color-brass) / <alpha-value>)",
        clay: "rgb(var(--color-clay) / <alpha-value>)",
        sage: "rgb(var(--color-sage) / <alpha-value>)",
      },
      boxShadow: {
        soft: "0 18px 45px rgba(23, 23, 23, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
