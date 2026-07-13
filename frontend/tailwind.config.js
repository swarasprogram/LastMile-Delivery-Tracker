/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Trace brand accent — signal lime
        brand: {
          DEFAULT: "#A3E635",
          hover:   "#B9F14A",
          soft:    "rgba(163, 230, 53, 0.12)",
        },
        // Near-black surfaces layered on a pure-black page
        ink: {
          DEFAULT: "#0C0C0E", // cards
          raised:  "#161619", // inputs / inner tiles
          hover:   "#1C1C20", // hover state
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        brand: "0 8px 30px -8px rgba(163, 230, 53, 0.35)",
      },
    },
  },
  plugins: [],
}
