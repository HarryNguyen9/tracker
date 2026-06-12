import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13201b",
        mint: "#e8fff4",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(19, 32, 27, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
