import type { Config } from 'tailwindcss'

const config = {
  darkMode: "class", // Use 'class' strategy for dark mode (shadcn/ui default)
  safelist: [
    'bg-rail-task',
    'bg-rail-decision',
    'bg-rail-loop',
    'bg-rail-end',
  ],
  content: {
    files: [
      './app/**/*.{js,ts,jsx,tsx,mdx}', // For App Router pages and components
      './components/**/*.{js,ts,jsx,tsx,mdx}', // For components, including shadcn/ui in components/ui
      './src/**/*.{ts,tsx}', // Common practice, good to include
    ],
    safelist: [
      'bg-rail-task',
      'bg-rail-decision',
      'bg-rail-loop',
      'bg-rail-end',
    ],
  },
  theme: {
    container: { // From shadcn/ui docs
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Designer's colors
        rail: { task: '#3A7AFE', decision: '#FDBA38', loop: '#7C3AED', end: '#9CA3AF' },
        // shadcn/ui colors (usually from CSS variables, but defined here for completeness if needed)
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
      },
      fontSize: {
        // Designer's font sizes
        xs: ['0.688rem', '1.2'],
        sm: ['0.813rem', '1.35'],
        base: ['0.9375rem', '1.5'],
        lg: ['1.125rem', '1.4'],
      },
      borderRadius: { // From shadcn/ui docs
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: { // From shadcn/ui docs
        "accordion-down": {
          from: { height: "0px" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0px" },
        },
      },
      animation: { // From shadcn/ui docs
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
export default config