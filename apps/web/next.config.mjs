/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@focal/shared"],
  async redirects() {
    return [{ source: "/prviacy", destination: "/privacy", permanent: true }];
  },
};

export default nextConfig;
