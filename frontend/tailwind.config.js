/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        // Neutral elevation scale — near-black, warm-neutral (no blue/indigo cast)
        base: {
          950: "#0A0A0B",
          900: "#0F0F11",
          850: "#141416",
          800: "#1A1A1D",
          700: "#242427",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Single warm accent (amber/gold) — the TinkerHub "maker" accent.
        // Used sparingly: active states, key numbers, primary actions.
        primary: {
          DEFAULT: "#D9A75B",
          foreground: "#171310",
        },
        // Muted dusty blue — a secondary tonal color, desaturated, never neon.
        secondary: {
          DEFAULT: "#7C8B99",
          foreground: "#F2F4F5",
        },
        // Muted sage — used for tonal tags/highlights distinct from primary.
        accent: {
          DEFAULT: "#8FA98C",
          foreground: "#10140F",
        },
        muted: {
          DEFAULT: "#1A1A1D",
          foreground: "#9A9A9F",
        },
        destructive: {
          DEFAULT: "#C1584A",
          foreground: "#FBEEEC",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // Muted, desaturated urgency palette — same family as the rest of the UI.
        urgency: {
          critical: "#C1584A",
          high: "#D9915A",
          medium: "#D9C15A",
          low: "#7FA872",
          none: "#6B6B70",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 6px)",
        "2xl": "calc(var(--radius) + 12px)",
      },
      boxShadow: {
        // Dim, warm-toned glow — a restrained accent, not a neon halo.
        glow: "0 0 20px -8px rgba(217, 167, 91, 0.35)",
        "glow-blue": "0 0 20px -8px rgba(217, 167, 91, 0.35)",
        "glow-cyan": "0 0 20px -8px rgba(217, 167, 91, 0.35)",
        // Flat elevation shadow for cards — soft, neutral, not glassy.
        glass: "0 1px 2px 0 rgba(0, 0, 0, 0.3), 0 8px 20px -8px rgba(0, 0, 0, 0.35)",
      },
      backgroundImage: {
        // Very low-opacity, single-hue vignette — optional texture, not a rainbow glow.
        "grid-glow": "radial-gradient(circle at top left, rgba(217,167,91,0.06), transparent 45%), radial-gradient(circle at bottom right, rgba(217,167,91,0.04), transparent 45%)",
        // Warm monochrome gradient (amber → deeper gold), replacing the violet/blue/cyan aurora.
        "aurora": "linear-gradient(135deg, #E2B673 0%, #D9A75B 55%, #C4903F 100%)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.7 },
        },
        "ring-fill": {
          from: { strokeDashoffset: "var(--ring-start, 283)" },
          to: { strokeDashoffset: "var(--ring-end, 0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
        "ring-fill": "ring-fill 1s ease-out forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
