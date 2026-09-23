import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
    ],
    // Supabase di-resolve ke NAT64 (64:ff9b::) sehingga Next 16 menganggapnya IP privat.
    // remotePatterns tetap membatasi host hanya *.supabase.co, jadi aman.
    dangerouslyAllowLocalIP: true,
  },
};

export default nextConfig;
