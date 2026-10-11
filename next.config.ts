import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // @react-pdf/renderer ships ESM/CJS dual; mark it server-external for the route handler
  // and let the client bundle import the React shim directly.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
