/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'enrollment-api.ui.ac.id' },
      { protocol: 'https', hostname: 'scele.cs.ui.ac.id' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/py/:path*',
        destination: 'http://localhost:8000/py/:path*',
      },
      {
        source: '/storage/:path*',
        destination: 'http://localhost:8000/storage/:path*',
      },
    ];
  },
};

export default nextConfig;
