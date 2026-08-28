
import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Manga Wave Design Tokens
        manga: {
          dark: "#080c14",
          surface: "#0f1520",
          surface2: "#162030",
          purple: "#7c5cfc",
          "purple-light": "#a07fff",
          pink: "#f43f8e",
          "pink-light": "#f87dba",
          cyan: "#00d4ff",
          gold: "#f5a623",
          success: "#22d3a5",
          error: "#ff4d6a",
        },
        wave: {
          bg: "#080c14",
          card: "#0f1520",
          hover: "#162030",
          border: "rgba(255,255,255,0.06)",
          "border-glow": "rgba(124,92,252,0.3)",
        },
      },
      fontFamily: {
        outfit: ["'Outfit'", "sans-serif"],
        inter: ["'Inter'", "sans-serif"],
        japanese: ["'Noto Sans JP'", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 24px -4px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        "glow-purple": "0 0 24px -4px rgba(124,92,252,0.5), 0 0 0 1px rgba(124,92,252,0.2)",
        "glow-pink": "0 0 24px -4px rgba(244,63,142,0.45), 0 0 0 1px rgba(244,63,142,0.2)",
        "glow-cyan": "0 0 24px -4px rgba(0,212,255,0.4), 0 0 0 1px rgba(0,212,255,0.15)",
        "card-hover": "0 16px 48px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(124,92,252,0.25)",
        "inner-glow": "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "shine": "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        "card-gradient": "linear-gradient(135deg, rgba(124,92,252,0.08) 0%, transparent 50%)",
        "hero-overlay": "linear-gradient(to bottom, rgba(8,12,20,0.3) 0%, rgba(8,12,20,0.7) 50%, rgba(8,12,20,1) 100%)",
        "cover-overlay": "linear-gradient(to top, rgba(8,12,20,1) 0%, rgba(8,12,20,0.6) 50%, transparent 100%)",
        "purple-glow": "radial-gradient(ellipse at center, rgba(124,92,252,0.15) 0%, transparent 70%)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(24px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-blur-in": {
          from: { opacity: "0", filter: "blur(8px)" },
          to: { opacity: "1", filter: "blur(0)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "float-glow": {
          "0%, 100%": { transform: "translateY(0px)", opacity: "0.6" },
          "50%": { transform: "translateY(-8px)", opacity: "1" },
        },
        "glow-pulse": {
          "0%, 100%": { filter: "brightness(1) drop-shadow(0 0 8px rgba(124,92,252,0.4))" },
          "50%": { filter: "brightness(1.15) drop-shadow(0 0 20px rgba(124,92,252,0.8))" },
        },
        "shine-sweep": {
          from: { backgroundPosition: "-200% center" },
          to: { backgroundPosition: "200% center" },
        },
        "pop": {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "70%": { transform: "scale(1.04)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)", opacity: "0" },
          to: { transform: "translateX(0)", opacity: "1" },
        },
        "ticker": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "badge-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34,211,165,0.4)" },
          "50%": { boxShadow: "0 0 0 6px rgba(34,211,165,0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "shimmer": "shimmer 2s linear infinite",
        "slide-up-fade": "slide-up-fade 0.5s cubic-bezier(0.16,1,0.3,1) forwards",
        "fade-blur-in": "fade-blur-in 0.6s ease-out forwards",
        "float": "float 6s ease-in-out infinite",
        "float-glow": "float-glow 4s ease-in-out infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        "shine-sweep": "shine-sweep 3s linear infinite",
        "pop": "pop 0.4s cubic-bezier(0.16,1,0.3,1) forwards",
        "slide-in-right": "slide-in-right 0.35s cubic-bezier(0.16,1,0.3,1)",
        "ticker": "ticker 30s linear infinite",
        "gradient-shift": "gradient-shift 6s ease infinite",
        "badge-pulse": "badge-pulse 2s ease-in-out infinite",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.16, 1, 0.3, 1)",
        "smooth": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
