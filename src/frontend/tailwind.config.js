/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary green color
        primary: '#22C55E',
        // Light/Dark theme colors
        'background-light': '#F3F4F6',
        'background-dark': '#0D1117',
        'card-light': '#FFFFFF',
        'card-dark': '#161B22',
        'text-light': '#1F2937',
        'text-dark': '#E5E7EB',
        'subtext-light': '#6B7280',
        'subtext-dark': '#9CA3AF',
        'border-light': '#E5E7EB',
        'border-dark': '#30363D',
        // Dark theme color palette (keeping for compatibility)
        background: {
          DEFAULT: '#0D1117',
          secondary: '#161B22',
          tertiary: '#21262D',
        },
        foreground: {
          DEFAULT: '#E5E7EB',
          secondary: '#9CA3AF',
          muted: '#6B7280',
        },
        // Enhanced gray scale for dark theme
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#0a0f1c',
        },
        // Card colors
        card: {
          bg: '#161B22',
          'bg-hover': '#21262D',
          border: '#30363D',
          'border-hover': '#3FB950',
        },
        // Surface colors
        surface: {
          DEFAULT: '#21262D',
          hover: '#30363D',
        },
        // Accent colors
        accent: {
          orange: '#f59e0b',
          yellow: '#eab308',
          green: '#22C55E',
          red: '#ef4444',
          blue: '#3b82f6',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Oxygen',
          'Ubuntu',
          'Cantarell',
          'sans-serif',
        ],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      // Enhanced animations
      animation: {
        'fade-in': 'fadeIn 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        'fade-in-up': 'fadeInUp 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-down': 'slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
        'background-shift': 'backgroundShift 20s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(16, 185, 129, 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(16, 185, 129, 0.5)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        backgroundShift: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      // Enhanced backdrop blur
      backdropBlur: {
        xs: '2px',
        '4xl': '72px',
      },
      // Enhanced shadows
      boxShadow: {
        'glow': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-lg': '0 0 40px rgba(16, 185, 129, 0.4)',
        'glow-xl': '0 0 60px rgba(16, 185, 129, 0.5)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-lg': '0 20px 40px 0 rgba(31, 38, 135, 0.4)',
        'dark': '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
        'dark-lg': '0 35px 60px -12px rgba(0, 0, 0, 0.5)',
      },
      // Background gradients
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #0a0f1c 0%, #111827 25%, #1f2937 50%, #0f172a 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)',
        'gradient-button': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-text': 'linear-gradient(135deg, #ffffff 0%, #10b981 100%)',
      },
      // Enhanced border radius
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}