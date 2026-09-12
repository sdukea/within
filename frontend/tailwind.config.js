/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["\"Source Serif 4\"", "ui-serif", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        paper: {
          DEFAULT: "#F5F5F3",
          raised: "#FFFFFF",
        },
        ink: {
          950: "#1D1D1F",
          700: "#48484A",
          500: "#6E6E73",
          300: "#B4B4B8",
          200: "#DCDCDE",
          100: "#EBEBE9",
        },
        accent: {
          DEFAULT: "#A15C34",
          soft: "#F4E9E0",
        },
      },
      fontSize: {
        base: ["15px", { lineHeight: "1.55" }],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: 0, transform: "translateY(6px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        breathe: {
          "0%, 100%": { opacity: 0.25, transform: "scale(0.85)" },
          "50%": { opacity: 1, transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up": "fade-up .5s cubic-bezier(0.16,1,0.3,1)",
        "fade-in": "fade-in .4s ease-out",
        breathe: "breathe 1.4s ease-in-out infinite",
      },
      transitionTimingFunction: {
        quiet: "cubic-bezier(0.32,0.72,0,1)",
      },
    },
  },
  plugins: [],
};
