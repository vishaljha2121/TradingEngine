export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        ui: ['Inter', 'SF Pro', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'IBM Plex Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        // Backgrounds
        app: '#08071A',
        panel: '#111027',
        'panel-secondary': '#17162F',
        'panel-tertiary': '#0D0B22',
        divider: '#252343',
        // Text
        'txt-primary': '#F3F4FF',
        'txt-secondary': '#A7A9D2',
        'txt-muted': '#6E7199',
        'txt-label': '#8E91BD',
        // Semantic
        positive: '#5E7DFF',
        negative: '#FF6B7E',
        warning: '#F3A14A',
        info: '#4F7DFF',
        // Order book
        'ask-dark': '#2A1A18',
        'ask-mid': '#6C3822',
        'ask-best': '#F28D3A',
        'bid-dark': '#111B3F',
        'bid-mid': '#253C8F',
        'bid-best': '#5E7DFF',
        // Chart
        'chart-spread': '#5E7DFF',
        'chart-mid': '#F28D3A',
        'chart-lag': '#FF6B7E',
        'chart-ref': '#38365B',
        // Status pills
        'status-competitive-bg': '#103220',
        'status-competitive-text': '#6EE7A8',
        'status-behind-bg': '#3A2B10',
        'status-behind-text': '#FFD36E',
        'status-far-behind-bg': '#3A1616',
        'status-far-behind-text': '#FF8585',
        'status-advantage-bg': '#0E2E2E',
        'status-advantage-text': '#6EE7D2',
      },
    },
  },
  plugins: [],
}
