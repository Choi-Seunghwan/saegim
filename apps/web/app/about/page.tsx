import type { Metadata } from "next";
import Link from "next/link";
import { PublicWebShell } from "../../src/components/PublicWeb";
import { absoluteUrl, siteDescription, siteName } from "../../src/lib/seo";

export const metadata: Metadata = {
  title: `새김 소개 - ${siteName}`,
  description: siteDescription,
  alternates: {
    canonical: "/about"
  },
  openGraph: {
    type: "website",
    title: `새김 소개 - ${siteName}`,
    description: siteDescription,
    url: "/about",
    siteName,
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: siteName
      }
    ]
  },
  twitter: {
    card: "summary",
    title: `새김 소개 - ${siteName}`,
    description: siteDescription,
    images: ["/icons/icon-512.png"]
  }
};

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export default function AboutPage() {
  const appJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteName,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "Web",
    url: absoluteUrl("/about"),
    description: siteDescription,
    privacyPolicy: absoluteUrl("/privacy"),
    termsOfService: absoluteUrl("/terms"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KRW"
    }
  };

  return (
    <PublicWebShell>
      <article className="public-editorial-page public-about-page">
        <section className="public-hero">
          <span className="public-kicker">서비스 소개</span>
          <h1>문장을 카드로 만들어, 발견하고 새겨 간직하는 곳</h1>
          <p>{siteDescription}</p>
        </section>

        <section className="public-text-section">
          <h2>새김이 제공하는 것</h2>
          <p>
            새김은 사용자가 좋은 문장을 글 카드로 남기고, 공개된 글을 발견하며,
            마음에 남는 글을 새김 서랍에 비공개로 보관할 수 있게 돕습니다.
          </p>
          <p>
            독서, 문구, 카피, 일상의 한 줄을 좋아하는 사람들이 문장을 조용히
            기록하고 다시 꺼내 볼 수 있는 모바일 웹 서비스입니다.
          </p>
        </section>

        <section className="public-text-section">
          <h2>로그인 사용 목적</h2>
          <p>
            Google 로그인은 사용자의 계정을 만들고, 작성한 글과 새김 서랍,
            좋아요, 댓글, 구독 상태를 본인 계정에 안전하게 연결하기 위해
            사용됩니다.
          </p>
        </section>

        <div className="public-tag-row" aria-label="새김 주요 기능">
          <span>문장 카드 기록</span>
          <span>글 발견</span>
          <span>비공개 서랍 보관</span>
          <span>글벗 구독</span>
        </div>

        <Link className="public-primary-link" href="/">
          새김 앱 열기
        </Link>

        <nav className="public-legal-links" aria-label="새김 정책 문서">
          <Link href="/privacy">개인정보 처리방침</Link>
          <Link href="/terms">이용약관</Link>
        </nav>
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(appJsonLd) }}
      />
    </PublicWebShell>
  );
}
