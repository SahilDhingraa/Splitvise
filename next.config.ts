import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Testing on a phone means the browser's origin is http://192.168.1.7:3000, not
  // localhost. Next distrusts that by default:
  //   - dev assets / HMR are refused for unlisted origins
  //   - Server Actions check Origin against Host and reject a mismatch
  // Both need the LAN origin allowlisted, or every mutation fails on the phone.
  //
  // Dev convenience only. Do not add public hosts here.
  allowedDevOrigins: ['192.168.1.7', '*.trycloudflare.com'],

  experimental: {
    serverActions: {
      allowedOrigins: ['192.168.1.7:3000', '*.trycloudflare.com'],
    },
  },
};

export default nextConfig;
