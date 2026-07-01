import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { AccountProfile, CardComposition, PostBundle, SentenceCard } from "@saegim/domain";
import { publicPostPath, publicProfilePath } from "../lib/seo";

const cardFontFamily: Record<CardComposition["font"], string> = {
  gothic: "var(--font-ui)",
  serif: "var(--font-card)",
  round: "var(--font-round)",
  pen: "var(--font-pen)",
  black: "var(--font-black)"
};

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function bgWithDim(background: string, dim: number) {
  if (dim <= 0) return background;
  return `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), ${background}`;
}

function cssImageUrl(url: string) {
  return url.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n|\r/g, "");
}

function cardSurfaceStyle(card: SentenceCard): CSSProperties {
  const image = card.comp.bgImage;
  const style = {
    "--cv-text": card.comp.textColor,
    background: bgWithDim(card.comp.bg, image ? 0 : card.comp.dim),
    color: card.comp.textColor
  } as CSSProperties;

  if (image?.url) {
    style.backgroundImage = `linear-gradient(rgba(0,0,0,${card.comp.dim}), rgba(0,0,0,${card.comp.dim})), url("${cssImageUrl(
      image.url
    )}")`;
    style.backgroundPosition = `center, ${clampNumber(image.focalX, 0, 100)}% ${clampNumber(image.focalY, 0, 100)}%`;
    style.backgroundSize = "auto, cover";
    style.backgroundRepeat = "repeat, no-repeat";
  }

  return style;
}

function cardTextStyle(comp: CardComposition, scale = 1, includePosition = false): CSSProperties {
  const style: CSSProperties = {
    fontFamily: cardFontFamily[comp.font],
    fontSize: `${Math.round(comp.size * scale)}px`,
    fontWeight: comp.weight,
    textAlign: comp.align
  };

  if (includePosition && comp.textPos) {
    style.left = `${comp.textPos.xp}%`;
    style.top = `${comp.textPos.yp}%`;
  }

  return style;
}

function cardSourceStyle(comp: CardComposition): CSSProperties | undefined {
  if (!comp.sourcePos) return undefined;

  return {
    left: `${comp.sourcePos.xp}%`,
    top: `${comp.sourcePos.yp}%`,
    bottom: "auto",
    transform: "translate(-50%, -50%)"
  };
}

function cardBackgroundImageStyle(comp: CardComposition): CSSProperties | undefined {
  const image = comp.bgImage;

  if (!image?.url) {
    return undefined;
  }

  const focalX = clampNumber(image.focalX, 0, 100);
  const focalY = clampNumber(image.focalY, 0, 100);

  return {
    objectPosition: `${focalX}% ${focalY}%`,
    transform: `scale(${clampNumber(image.zoom, 1, 2.5)})`,
    transformOrigin: `${focalX}% ${focalY}%`
  };
}

function PublicCardBackgroundImageLayer({ comp }: { comp: CardComposition }) {
  const image = comp.bgImage;

  if (!image?.url) {
    return null;
  }

  return (
    <>
      <div className="card-bg-photo" aria-hidden="true">
        <img alt="" draggable={false} src={image.url} style={cardBackgroundImageStyle(comp)} />
      </div>
      {comp.dim > 0 ? (
        <div className="card-bg-dim" aria-hidden="true" style={{ background: `rgba(0,0,0,${comp.dim})` }} />
      ) : null}
    </>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatSource(source: SentenceCard["source"]) {
  const author = source.author?.trim();
  const work = source.work?.trim();

  if (work && work !== "직접 새김") {
    if (source.kind === "book") {
      return author ? `『${work}』 · ${author}` : `『${work}』`;
    }

    return author ? `${work} · ${author}` : work;
  }

  if (author) {
    return author;
  }

  return work || "직접 새김";
}

function cardSourceLabel(card: SentenceCard) {
  if (card.source.kind === "direct") return "";
  const formatted = formatSource(card.source);
  return formatted === "직접 새김" ? "" : formatted;
}

export function PublicWebShell({ children }: { children: ReactNode }) {
  return (
    <main className="public-web-shell">
      <div className="public-web-page">
        <PublicHeader />
        {children}
      </div>
    </main>
  );
}

export function PublicHeader() {
  return (
    <header className="public-header">
      <Link className="public-wordmark" href="/" aria-label="새김 홈">
        새김
      </Link>
      <Link className="public-open-link" href="/">
        앱 열기
      </Link>
    </header>
  );
}

export function PublicAccountName({ account }: { account: AccountProfile }) {
  return (
    <span className="public-account-name">
      <span>{account.displayName}</span>
      {account.verification === "official" ? (
        <span className="public-official-mark" aria-label="공식 계정">
          ✓
        </span>
      ) : null}
    </span>
  );
}

export function PublicAvatar({ account, size = "regular" }: { account: AccountProfile; size?: "regular" | "large" }) {
  const initial = account.displayName.trim().slice(0, 1) || "새";

  if (account.photoUrl) {
    return (
      <img
        className={`public-avatar is-${size}`}
        src={account.photoUrl}
        alt={`${account.displayName} 프로필 사진`}
      />
    );
  }

  return <span className={`public-avatar is-${size}`}>{initial}</span>;
}

export function PublicSentenceCard({ card, index }: { card: SentenceCard; index: number }) {
  const sourceLabel = cardSourceLabel(card);

  return (
    <article className="sentence-card public-sentence-card" style={cardSurfaceStyle(card)}>
      <PublicCardBackgroundImageLayer comp={card.comp} />
      <div className="cv-grain" aria-hidden="true" />
      <div className="cmp-layer">
        <p className="cmp-text" style={cardTextStyle(card.comp, 1, true)}>
          {card.text}
        </p>
        {sourceLabel ? (
          <div className="cmp-src" style={cardSourceStyle(card.comp)}>
            {sourceLabel}
          </div>
        ) : null}
      </div>
      <span className="public-card-index">{index + 1}</span>
    </article>
  );
}

export function PublicPostPreview({ post, hideAuthor = false }: { post: PostBundle; hideAuthor?: boolean }) {
  const card = post.cards[0];

  if (!card) {
    return null;
  }

  return (
    <Link
      className={post.post.cardCount > 1 ? "shelf-card has-page-badge public-post-preview" : "shelf-card public-post-preview"}
      href={publicPostPath(post.post.id)}
      style={cardSurfaceStyle(card)}
    >
      {post.post.cardCount > 1 ? <span className="page-badge">{post.post.cardCount}장</span> : null}
      <p className="sq" style={cardTextStyle(card.comp, 0.58)}>
        {card.text}
      </p>
      <footer className="sfoot">
        <strong className="st2">{post.post.title}</strong>
        <span className="sm2">
          {hideAuthor ? null : (
            <span className="sby">
              <PublicAccountName account={post.author} />
            </span>
          )}
          <span className="mtr">♡ {formatCount(post.viewerState?.likeCount ?? 0)}</span>
        </span>
      </footer>
    </Link>
  );
}

export function PublicProfileLink({ account }: { account: AccountProfile }) {
  return (
    <Link className="public-profile-link" href={publicProfilePath(account.handle)}>
      <PublicAvatar account={account} />
      <span>
        <PublicAccountName account={account} />
        <small>@{account.handle}</small>
      </span>
    </Link>
  );
}
