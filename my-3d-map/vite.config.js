export default {
    server: {
      proxy: {
        '/get_markers': 'http://localhost:8051/',
        '/download_daily_graph': 'http://localhost:8051/'
      }
    }
  }