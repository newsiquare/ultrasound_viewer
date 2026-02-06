import { Buffer } from 'node:buffer';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const orthancTarget = env.ORTHANC_TARGET ?? 'http://localhost:8042';
  const orthancUser = env.VITE_DICOMWEB_USERNAME ?? 'admin';
  const orthancPassword = env.VITE_DICOMWEB_PASSWORD ?? 'sonocloud2024';
  const proxyAuth = `Basic ${Buffer.from(`${orthancUser}:${orthancPassword}`).toString('base64')}`;

  return {
    plugins: [react()],
    optimizeDeps: {
      include: [
        'dicom-parser',
        'globalthis',
        '@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs',
        '@cornerstonejs/codec-openjpeg/decodewasmjs',
        '@cornerstonejs/codec-charls/decodewasmjs',
        '@cornerstonejs/codec-openjph/wasmjs',
      ],
      needsInterop: [
        'dicom-parser',
        'globalthis',
        '@cornerstonejs/codec-libjpeg-turbo-8bit/decodewasmjs',
        '@cornerstonejs/codec-openjpeg/decodewasmjs',
        '@cornerstonejs/codec-charls/decodewasmjs',
        '@cornerstonejs/codec-openjph/wasmjs',
      ],
      exclude: ['@cornerstonejs/dicom-image-loader'],
    },
    server: {
      port: 5173,
      proxy: {
        '/dicom-web': {
          target: orthancTarget,
          changeOrigin: true,
          headers: {
            Authorization: proxyAuth,
          },
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              // Prevent browser basic-auth popup when upstream returns 401.
              if (proxyRes.statusCode === 401) {
                delete proxyRes.headers['www-authenticate'];
              }
            });
          },
        },
        '/orthanc': {
          target: orthancTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/orthanc/, ''),
          headers: {
            Authorization: proxyAuth,
          },
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              if (proxyRes.statusCode === 401) {
                delete proxyRes.headers['www-authenticate'];
              }
            });
          },
        },
      },
    },
    worker: {
      format: 'es',
    },
  };
});
