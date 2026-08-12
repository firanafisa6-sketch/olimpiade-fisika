/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@seleksi/ui", "@seleksi/validation", "@seleksi/database"],
  serverExternalPackages: ["@prisma/client", "prisma"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  reactStrictMode: true
};

export default nextConfig;
