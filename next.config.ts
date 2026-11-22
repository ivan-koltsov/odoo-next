import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Odoo images are served pre-resized (image_128 / image_256 / image_512)
    // through our authenticated /api/odoo/image proxy route.
    unoptimized: true,
  },
};

export default nextConfig;
