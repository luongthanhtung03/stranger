import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@stranger/shared"],
  // Lets friends load the dev server through a Cloudflare quick tunnel
  // (`npm run tunnel`); Next blocks foreign origins in dev otherwise.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
