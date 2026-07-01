import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicWebShell } from "../../../src/components/PublicWeb";
import { fetchPublicEditorialPage, isPublicNotFound } from "../../../src/lib/public-api";
import {
  absoluteUrl,
  normalizeSeoText,
  publicEditorialPath,
  siteName
} from "../../../src/lib/seo";

type EditorialPageProps = {
  params: Promise<{
    pageId: string;
  }>;
};

async function loadEditorialPage(pageId: string) {
  try {
    return await fetchPublicEditorialPage(pageId);
  } catch (error) {
    if (isPublicNotFound(error)) {
      notFound();
    }

    throw error;
  }
}

function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function pageDateToIso(date: string) {
  return date.replaceAll(".", "-");
}

export async function generateMetadata({ params }: EditorialPageProps): Promise<Metadata> {
  const { pageId } = await params;

  try {
    const page = await fetchPublicEditorialPage(pageId);
    const description = normalizeSeoText(page.summary || page.body.join(" "));
    const path = publicEditorialPath(page.id);
    const title = `${page.title} - ${siteName}`;

    return {
      title,
      description,
      alternates: {
        canonical: path
      },
      openGraph: {
        type: "article",
        title,
        description,
        url: path,
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
        title,
        description,
        images: ["/icons/icon-512.png"]
      }
    };
  } catch (error) {
    if (isPublicNotFound(error)) {
      return {
        title: `소식을 찾을 수 없어요 - ${siteName}`,
        robots: {
          index: false,
          follow: false
        }
      };
    }

    throw error;
  }
}

export default async function PublicEditorialPage({ params }: EditorialPageProps) {
  const { pageId } = await params;
  const page = await loadEditorialPage(pageId);
  const path = publicEditorialPath(page.id);
  const description = normalizeSeoText(page.summary || page.body.join(" "));
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: page.title,
    description,
    datePublished: pageDateToIso(page.date),
    dateModified: pageDateToIso(page.date),
    mainEntityOfPage: absoluteUrl(path),
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: absoluteUrl("/")
    }
  };

  return (
    <PublicWebShell>
      <article className="public-editorial-page">
        <section className="public-hero">
          <span className="public-kicker">{page.label}</span>
          <h1>{page.title}</h1>
          <time dateTime={pageDateToIso(page.date)}>{page.date}</time>
          {page.summary ? <p>{page.summary}</p> : null}
        </section>

        <section className="public-text-section">
          {page.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>

        {page.cta ? (
          <Link className="public-primary-link" href={page.cta.action === "discover" ? "/discover" : "/"}>
            {page.cta.action === "contact" ? `${page.cta.label} 준비 중` : page.cta.label}
          </Link>
        ) : null}
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleJsonLd) }}
      />
    </PublicWebShell>
  );
}
