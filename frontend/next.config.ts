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
 * The NestJS backend listens on port 3000 (see backend/src/main.ts), so that
 * is the default here too. `127.0.0.1` rather than `localhost` on purpose:
 * Node 17+ resolves `localhost` to `::1` first, and a backend bound to IPv4
 * only would then look unreachable during SSR.
 */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';

const nextConfig: NextConfig = {
  // The sandbox preview is served from a different host — allow it explicitly.
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],

  // Covers come from Cloudinary; its host is deployment-specific, so allow any.
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
