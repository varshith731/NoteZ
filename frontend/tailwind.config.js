export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      boxShadow: {
        floating: '0 10px 30px rgba(0,0,0,0.35)',
      },
      keyframes: {
        wave: {
          '0%': { transform: 'scaleY(0.5)' },
          '50%': { transform: 'scaleY(1)' },
          '100%': { transform: 'scaleY(0.5)' },
        },
      },
      animation: {
        wave: 'wave 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};


