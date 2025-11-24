import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        port: "",
        pathname: "**",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
  // Development optimizations for instant HMR
  ...(process.env.NODE_ENV === "development" && {
    onDemandEntries: {
      // Keep pages in memory for faster HMR
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),
  // Performance optimizations
  compress: true, // Enable gzip compression
  poweredByHeader: false, // Remove X-Powered-By header for security and performance

  // Optimize production builds
  productionBrowserSourceMaps: false, // Disable source maps in production for faster builds

  // React optimization
  reactStrictMode: true,

  // Experimental features for better performance
  experimental: {
    // Enable optimized package imports to reduce bundle size
    optimizePackageImports: [
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-avatar",
      "lucide-react",
      "recharts",
      "date-fns",
    ],
    // Enable turbo mode for faster builds
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
  },

  // Headers for better caching and performance
  async headers() {
    const isDevelopment = process.env.NODE_ENV === "development";

    return [
      {
        // Apply headers to all routes
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // Prevent browser caching in development for instant HMR
          ...(isDevelopment
            ? [
                {
                  key: "Cache-Control",
                  value: "no-cache, no-store, must-revalidate, max-age=0",
                },
              ]
            : []),
        ],
      },
      {
        // Cache static assets aggressively (only in production)
        source:
          "/(.*)\\.(jpg|jpeg|png|gif|ico|webp|svg|woff|woff2|ttf|otf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: isDevelopment
              ? "no-cache, no-store, must-revalidate"
              : "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache JavaScript and CSS (only in production)
        source: "/(.*)\\.(js|css|mjs)",
        headers: [
          {
            key: "Cache-Control",
            value: isDevelopment
              ? "no-cache, no-store, must-revalidate"
              : "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // API routes - enable compression and caching hints
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, must-revalidate",
          },
          {
            key: "Vary",
            value: "Accept-Encoding",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
