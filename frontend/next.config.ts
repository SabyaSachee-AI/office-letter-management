import type { NextConfig } from "next";

/** Where the FastAPI app runs; used only by dev/prod rewrites (not sent to the browser). */
const apiProxyTarget =
  (process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(
    /\/$/,
    ""
  );

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiProxyTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
