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
        lumen: {
          bg: "#0B0B0B",
          dark: "#5A1F14",
          mid: "#A43A1C",
          accent: "#F45A3C",
        },
      },
    },
  },
  plugins: [],
};

export default config;
