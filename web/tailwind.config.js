const here = new URL('.', import.meta.url).pathname;

/** @type {import('tailwindcss').Config} */
export default {
  content: [`${here}index.html`, `${here}src/**/*.{ts,tsx}`],
  theme: { extend: {} },
  plugins: [],
};
