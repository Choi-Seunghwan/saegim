import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PublicAccountName,
  PublicAvatar,
  PublicPostPreview,
  PublicWebShell
} from "../../../src/components/PublicWeb";
import { fetchPublicAccount, isPublicNotFound } from "../../../src/lib/public-api";
import {
  absoluteUrl,
  normalizeSeoText,
  publicProfilePath,
  siteDescription,
  siteName
} from "../../../src/lib/seo";

type ProfilePageProps = {
  params: Promise<{
    handle: string;
  }>;
};

async function loadAccount(handle: string) {
  try {
    return await fetchPublicAccount(handle);
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

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { handle } = await params;

  try {
    const detail = await fetchPublicAccount(handle);
    const account = detail.account;
    const description = normalizeSeoText(account.bio || account.tagline || siteDescription);
    const path = publicProfilePath(account.handle);
    const title = `${account.displayName} (@${account.handle}) - ${siteName}`;
    const imageUrl = account.photoUrl?.startsWith("http") ? account.photoUrl : "/icons/icon-512.png";

    return {
      title,
      description,
      alternates: {
        canonical: path
      },
      openGraph: {
        type: "profile",
        title,
        description,
        url: path,
        siteName,
        images: [
          {
            url: imageUrl,
            width: 512,
            height: 512,
            alt: `${account.displayName} 프로필`
          }
        ]
      },
      twitter: {
        card: "summary",
        title,
        description,
        images: [imageUrl]
      }
    };
  } catch (error) {
    if (isPublicNotFound(error)) {
      return {
        title: `프로필을 찾을 수 없어요 - ${siteName}`,
        robots: {
          index: false,
          follow: false
        }
      };
    }

    throw error;
  }
}

export default async function PublicProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const detail = await loadAccount(handle);
  const account = detail.account;
  const description = normalizeSeoText(account.bio || account.tagline || siteDescription);
  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: account.displayName,
    description,
    url: absoluteUrl(publicProfilePath(account.handle)),
    mainEntity: {
      "@type": "Person",
      name: account.displayName,
      identifier: account.handle,
      description,
      image: account.photoUrl?.startsWith("http") ? account.photoUrl : undefined
    }
  };

  return (
    <PublicWebShell>
      <section className="public-profile-page">
        <div className="public-profile-hero">
          <PublicAvatar account={account} size="large" />
          <div>
            <span className="public-kicker">@{account.handle}</span>
            <h1>
              <PublicAccountName account={account} />
            </h1>
            {account.tagline ? <p>{account.tagline}</p> : null}
            <small>
              글 {account.postCount.toLocaleString("ko-KR")}개 · 글벗{" "}
              {account.writingFriendCount.toLocaleString("ko-KR")}
            </small>
          </div>
        </div>

        {account.bio && account.bio !== account.tagline ? (
          <section className="public-text-section">
            <h2>소개</h2>
            <p>{account.bio}</p>
          </section>
        ) : null}

        <section className="public-post-list">
          <div className="public-section-head">
            <h2>공개 글</h2>
            <span>{detail.posts.length.toLocaleString("ko-KR")}</span>
          </div>
          {detail.posts.length > 0 ? (
            <div className="masonry public-masonry">
              {detail.posts.map((post) => (
                <PublicPostPreview hideAuthor key={post.post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="public-empty">아직 공개된 글이 없어요.</p>
          )}
        </section>
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(profileJsonLd) }}
      />
    </PublicWebShell>
  );
}
