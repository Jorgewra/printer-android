import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.xeggo.print',
  appName: 'Printer',
  webDir: 'dist',
  plugins: {
    BackgroundMode: {
      enabled: true,
      title: 'Zacksys Print Service',
      text: 'Monitorando impressoras',
      silent: false
    }
  },
  server: {
    androidScheme: 'https'
  }
};

export default config;
