import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    /*
     * 공고의 회사 이미지는 수집 원천(사이트)의 CDN에 산다 — 앱이 호스팅하지 않는다.
     * `next/image`는 허용한 호스트만 최적화하므로 원천마다 여기에 적는다
     * (지금 수집 대상은 wanted·jumpit 둘이다 — 원천이 늘면 이 목록도 는다).
     */
    remotePatterns: [
      { protocol: "https", hostname: "static.wanted.co.kr" },
      { protocol: "https", hostname: "cdn.jumpit.co.kr" },
    ],
  },
};

export default nextConfig;
