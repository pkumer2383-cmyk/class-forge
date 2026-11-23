import './scripts/node-readlink-eisdir-shim.cjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The open version has no accounts. Old sign-in links land on the app.
  async redirects() {
    return [
      { source: '/login', destination: '/', permanent: false },
      { source: '/auth/callback', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
