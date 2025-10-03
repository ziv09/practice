import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1f2937",
        secondary: "#4b5563",
        accent: "#a855f7"
      }
    }
  },
  plugins: []
} satisfies Config;
