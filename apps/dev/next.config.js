/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@preciso/types', '@preciso/schemas', '@preciso/utils'],
};

module.exports = nextConfig;
