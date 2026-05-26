import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        sand: "#f4efe6",
        ink: "#10212b",
        accent: "#d96c3c",
        teal: "#2e6f73",
        moss: "#758b5c"
      },
      boxShadow: {
        panel: "0 20px 55px rgba(16, 33, 43, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
