import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  PublicProfileLink,
  PublicSentenceCard,
  PublicWebShell
} from "../../../src/components/PublicWeb";
import { fetchPublicPost, isPublicNotFound } from "../../../src/lib/public-api";
import {
  absoluteUrl,
  appPostPath,
  normalizeSeoText,
  publicPostPath,
  siteDescription,
  siteName
} from "../../../src/lib/seo";

type PublicPostPageProps = {
  params: Promise<{
    postId: string;
  }>;
};

async function loadPost(postId: string) {
  try {
    return await fetchPublicPost(postId);
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

export async function generateMetadata({ params }: PublicPostPageProps): Promise<Metadata> {
  const { postId } = await params;

  try {
    const post = await fetchPublicPost(postId);
    const firstCard = post.cards[0];
    const description = normalizeSeoText(firstCard?.text || siteDescription);
    const path = publicPostPath(post.post.id);
    const title = `${post.post.title} - ${siteName}`;

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
            url: `${path}/opengraph-image`,
            width: 1200,
            height: 630,
            alt: `${post.post.title} 카드`
          }
        ]
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`${path}/opengraph-image`]
      }
    };
  } catch (error) {
    if (isPublicNotFound(error)) {
      return {
        title: `글을 찾을 수 없어요 - ${siteName}`,
        robots: {
          index: false,
          follow: false
        }
      };
    }

    throw error;
  }
}

export default async function PublicPostPage({ params }: PublicPostPageProps) {
  const { postId } = await params;
  const post = await loadPost(postId);
  const firstCard = post.cards[0];
  const tags = [...new Set(post.cards.flatMap((card) => card.tags).filter(Boolean))];
  const sourceItems = post.cards
    .map((card) => [card.source.work, card.source.author].filter(Boolean).join(" · "))
    .filter((value, index, values): value is string => Boolean(value) && values.indexOf(value) === index);
  const path = publicPostPath(post.post.id);
  const description = normalizeSeoText(firstCard?.text || siteDescription);
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.post.title,
    description,
    datePublished: post.post.createdAt,
    dateModified: post.post.updatedAt,
    mainEntityOfPage: absoluteUrl(path),
    image: absoluteUrl(`${path}/opengraph-image`),
    author: {
      "@type": "Person",
      name: post.author.displayName,
      url: absoluteUrl(`/u/${post.author.handle}`)
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
      url: absoluteUrl("/")
    }
  };

  return (
    <PublicWebShell appHref={appPostPath(post.post.id)}>
      <article className="public-post-page">
        <section className="public-hero">
          <span className="public-kicker">글 · {post.post.cardCount}장</span>
          <h1>{post.post.title}</h1>
          <p>{description}</p>
          <PublicProfileLink account={post.author} />
        </section>

        <div className="public-card-stack" aria-label="글 카드">
          {post.cards.map((card, index) => (
            <PublicSentenceCard card={card} index={index} key={card.id} />
          ))}
        </div>

        <section className="public-meta-section" aria-label="글 정보">
          <div>
            <span>공감</span>
            <strong>{(post.viewerState?.likeCount ?? 0).toLocaleString("ko-KR")}</strong>
          </div>
          <div>
            <span>댓글</span>
            <strong>{(post.viewerState?.commentCount ?? 0).toLocaleString("ko-KR")}</strong>
          </div>
          <div>
            <span>작성자</span>
            <Link href={`/u/${post.author.handle}`}>@{post.author.handle}</Link>
          </div>
        </section>

        {sourceItems.length > 0 || tags.length > 0 ? (
          <section className="public-text-section">
            {sourceItems.length > 0 ? (
              <>
                <h2>출처</h2>
                {sourceItems.map((source) => (
                  <p key={source}>{source}</p>
                ))}
              </>
            ) : null}
            {tags.length > 0 ? (
              <div className="public-tag-row" aria-label="태그">
                {tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleJsonLd) }}
      />
    </PublicWebShell>
  );
}
