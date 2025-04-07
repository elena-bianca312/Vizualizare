import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/get_markers': 'http://localhost:8051',
      '/download_daily_graph': 'http://localhost:8051'
    }
  },
  assetsInclude: ['**/*.geojson']
});
