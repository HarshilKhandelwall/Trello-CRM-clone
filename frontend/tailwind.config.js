/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary Brand (Updated to match Stitch design)
        'trello-blue': '#0690e0',
        'trello-dark-blue': '#0C3953',

        // Blue Shades (Updated to match Stitch design)
        'blue': {
          50: '#e6f4fb',
          100: '#c0e3f5',
          200: '#96d1ef',
          300: '#6cbfe9',
          400: '#4db1e5',
          500: '#0690e0',
          600: '#0582cd',
          700: '#0470b3',
          800: '#035f9a',
          900: '#024371',
        },

        // Label Colors
        'label': {
          green: '#6fc25f',
          'green-light': '#d3f1a7',
          yellow: '#f2d918',
          'yellow-light': '#fef3c0',
          orange: '#fea72f',
          'orange-light': '#fedec8',
          red: '#ec6957',
          'red-light': '#f5d3ce',
          purple: '#c883e2',
          'purple-light': '#ead5f9',
          blue: '#1885c4',
          'blue-light': '#c2e0f4',
          sky: '#18c7e2',
          'sky-light': '#c6edfb',
          lime: '#61e9a1',
          'lime-light': '#d4f4dd',
          pink: '#fe84cf',
          'pink-light': '#fdd0ec',
          black: '#486271',
          'black-light': '#dfe1e6',
        },

        // Neutral Colors
        'neutral': {
          0: '#ffffff',
          50: '#fafbfc',
          100: '#f4f5f7',
          200: '#ebecf0',
          300: '#dfe1e6',
          400: '#c1c7d0',
          500: '#a5adba',
          600: '#7a869a',
          700: '#5e6c84',
          800: '#42526e',
          900: '#172b4d',
        },
      },

      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Noto Sans"', 'Ubuntu', '"Droid Sans"', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"SFMono-Regular"', 'Consolas', '"Liberation Mono"', 'Menlo', 'Courier', 'monospace'],
      },

      fontSize: {
        'xs': '11px',
        'sm': '12px',
        'base': '14px',
        'md': '16px',
        'lg': '18px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '28px',
      },

      spacing: {
        '0': '0',
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
        '16': '64px',
        '20': '80px',
      },

      borderRadius: {
        'none': '0',
        'sm': '0.125rem',      // 2px
        'DEFAULT': '0.25rem',  // 4px - Stitch default
        'md': '0.375rem',      // 6px
        'lg': '0.5rem',        // 8px
        'xl': '0.75rem',       // 12px
        '2xl': '1rem',         // 16px
        'full': '9999px',
      },

      boxShadow: {
        'card': '0 1px 0 rgba(9, 30, 66, 0.13)',
        'card-hover': '0 4px 8px rgba(9, 30, 66, 0.25)',
        'card-active': '0 1px 2px rgba(9, 30, 66, 0.25)',
        'modal': '0 8px 16px rgba(9, 30, 66, 0.25)',
        'dropdown': '0 8px 16px -4px rgba(9, 30, 66, 0.25)',
        'popover': '0 8px 16px -4px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)',
        'overlay': '0 12px 24px -6px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)',
      },

      transitionDuration: {
        'instant': '0ms',
        'fast': '85ms',
        'normal': '150ms',
        'slow': '200ms',
        'slower': '300ms',
      },

      transitionTimingFunction: {
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.23, 1, 0.32, 1)',
      },

      zIndex: {
        'base': '0',
        'dropdown': '100',
        'sticky': '200',
        'fixed': '300',
        'modal-backdrop': '900',
        'modal': '1000',
        'popover': '1100',
        'tooltip': '1200',
      },
    },
  },
  plugins: [],
};

