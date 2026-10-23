import type { NextConfig } from "next";

// Printle is a fully client-side app: documents and OCR never leave the device,
// so it ships as a static export that any static host (or a Capacitor shell) can serve.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
