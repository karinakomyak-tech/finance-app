// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // чтобы Next 16 не ругался и не чудил с "root inference"
  turbopack: {},
};

export default nextConfig;
