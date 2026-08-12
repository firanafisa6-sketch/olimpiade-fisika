/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@seleksi/ui",
    "@seleksi/question-renderer",
    "@seleksi/validation",
    "@seleksi/database"
  ],
  serverExternalPackages: ["@prisma/client", "prisma", "xlsx"],
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
  reactStrictMode: true
};

export default nextConfig;
