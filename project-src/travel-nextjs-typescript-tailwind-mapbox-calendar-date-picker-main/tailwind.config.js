/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Deepened orange so white text on buttons and orange links meet WCAG
        // contrast on white. Applied globally via the existing utility classes.
        orange: {
          500: "#ea580c",
          600: "#c2410c",
          700: "#9a3412",
        },
      },
    },
  },
  plugins: [require("tailwind-scrollbar"), require("@tailwindcss/typography")],
};
