/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          red:  "#E10600", // rouge Sportminedor (approx du logo)
          dark: "#111111", // quasi noir
          gray: "#F3F4F6", // fond app
        },
      },
      boxShadow: {
        card: "0 6px 20px rgba(0,0,0,0.06)",
      },
      borderRadius: {
        xl: "14px",
      },
    },
  },
  plugins: [],
};