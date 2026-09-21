import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  content: [],
  theme: {
    extend: {
      colors: {
        roxo: {
          50: '#f4f1fb',
          100: '#e6ddf7',
          200: '#cdbaef',
          300: '#ac8ee3',
          400: '#8b5fd4',
          500: '#6f3fc2',
          600: '#5a2fa3',
          700: '#4a2685',
          800: '#3c1f6b',
          900: '#2e1852'
        },
        amarelo: {
          50: '#fffdf2',
          100: '#fff9d6',
          200: '#fff0a3',
          300: '#ffe36b',
          400: '#ffd23f',
          500: '#ffc107',
          600: '#e0a300',
          700: '#b37e00',
          800: '#8a6100',
          900: '#664800'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
