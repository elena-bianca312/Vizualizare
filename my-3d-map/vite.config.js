import { defineConfig } from 'vite';
import http from 'http';

export default defineConfig({
  server: {
    proxy: {
      '/get_markers': {
        target: 'http://127.0.0.1:8051', // Use explicit IPv4 address
        changeOrigin: true,
        agent: new http.Agent({ family: 4 }), // Force IPv4
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[PROXY ERROR]', err);
          });
        }
      },
      '/download_daily_graph': {
        target: 'http://127.0.0.1:8051', // Use explicit IPv4 address
        changeOrigin: true,
        agent: new http.Agent({ family: 4 }), // Force IPv4
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[PROXY ERROR]', err);
          });
        }
      },
      '/indoor_sensors': {
        target: 'http://127.0.0.1:8051', // Use explicit IPv4 address
        changeOrigin: true,
        agent: new http.Agent({ family: 4 }), // Force IPv4
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[PROXY ERROR]', err);
          });
        }
      }
    }
  },
  assetsInclude: ['**/*.geojson']
});
