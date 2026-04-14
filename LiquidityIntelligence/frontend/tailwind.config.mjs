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
        app: '#060B14',
        panel: '#0B1220',
        'panel-secondary': '#0E1728',
        'panel-tertiary': '#0A1322',
        divider: '#1F2A3A',
        // Text
        'txt-primary': '#E5EDF7',
        'txt-secondary': '#A8B3C2',
        'txt-muted': '#6F7C8E',
        'txt-label': '#8EA0B8',
        // Semantic
        positive: '#18C37E',
        negative: '#FF5C5C',
        warning: '#F5B942',
        info: '#4DA3FF',
        // Order book
        'ask-dark': '#2A1111',
        'ask-mid': '#5E1F1F',
        'ask-best': '#B33A3A',
        'bid-dark': '#102319',
        'bid-mid': '#1D6A43',
        'bid-best': '#1FAE68',
        // Chart
        'chart-spread': '#4DA3FF',
        'chart-mid': '#F5B942',
        'chart-lag': '#FF5C5C',
        'chart-ref': '#39465A',
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
