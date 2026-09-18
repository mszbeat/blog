import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

/**
 * The next-intl plugin is REQUIRED: it injects the path to our request config
 * (i18n/request.ts) into the build so server components can resolve messages.
 * Without it, prerendering fails with "Couldn't find next-intl config file".
 */
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * All browser requests go to /api/* and are proxied to the backend.
 * This completely avoids the missing CORS configuration in the NestJS app
 * (main.ts has no app.enableCors()).
 *
 * API_ORIGIN defaults to the bundled mock server (port 3000).
 * Point it at the real NestJS backend with:  API_ORIGIN=http://localhost:3000
 */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';

const nextConfig: NextConfig = {
  // The sandbox preview is served from a different host — allow it explicitly.
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],

  // Covers come from Cloudinary in production; allow any host in dev/mock.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
