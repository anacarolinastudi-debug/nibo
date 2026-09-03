/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#142019',      // verde-petróleo bem escuro — texto principal e sidebar
        paper: '#F7F5F0',    // fundo levemente amarelado, lembra papel de relatório
        brand: {
          50: '#EAF4F0',
          100: '#CFE6DC',
          400: '#3E9C7C',
          500: '#1F7A5C',    // verde principal da marca
          600: '#175E46',
          700: '#114633',
        },
        amber: {
          500: '#C8862B',    // acento para alertas/urgência (lembra carimbo/selo fiscal)
        },
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        sans: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
