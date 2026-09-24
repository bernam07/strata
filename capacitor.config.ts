import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.strata.app',
  appName: 'Strata',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#0a0908',
      style: 'DARK',
    },
  },
};

export default config;
