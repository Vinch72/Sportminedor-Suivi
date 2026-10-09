/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind 2 (postcss7-compat) : "content" est ignoré → "purge" + mode JIT.
  // JIT = seules les classes utilisées sont générées, y compris text-[10px],
  // max-h-[85vh]… (auparavant ignorées) ; CSS ~3 Mo → quelques dizaines de Ko.
  mode: "jit",
  purge: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
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