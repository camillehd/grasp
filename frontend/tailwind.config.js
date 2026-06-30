/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          0: "#0d0d0f",
          1: "#17171a",
          2: "#202024",
          3: "#2a2a2f",
        },
        accent: {
          purple: "#8b7cf6",
          blue: "#60a5fa",
          teal: "#2dd4bf",
          amber: "#fbbf24",
          coral: "#fb7185",
          gray: "#9ca3af",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
