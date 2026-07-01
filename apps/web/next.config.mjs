/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  output: "standalone",
  transpilePackages: ["@saegim/domain"]
};

export default nextConfig;
