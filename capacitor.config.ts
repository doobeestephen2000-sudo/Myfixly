import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myfixly.ng',
  appName: 'MyFixly',
  // This project is a TanStack Start SSR app, which emits the browser bundle under dist/client.
  // The root dist folder does not contain a static index.html, so Capacitor must target the client output.
  webDir: 'dist/client'
};

export default config;
