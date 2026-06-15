import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13201b",
        mint: "#e8fff4",
        card: "#ffffff",
      },
      boxShadow: {
        soft: "0 4px 24px rgba(19, 32, 27, 0.06)",
        card: "0 2px 12px rgba(19, 32, 27, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
