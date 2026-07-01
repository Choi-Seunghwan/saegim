export const siteName = "새김";
export const siteDescription =
  "새김은 좋은 문장을 카드로 기록하고 발견하며, 마음에 남는 글을 비공개 서랍에 간직하는 모바일 웹 서비스입니다.";

export function getSiteUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const rawUrl = explicitUrl || (vercelUrl ? `https://${vercelUrl}` : "http://127.0.0.1:3000");

  return rawUrl.replace(/\/+$/, "");
}

export function absoluteUrl(path = "/") {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalizedPath}`;
}

export function normalizeSeoText(value: string, maxLength = 150) {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

export function publicPostPath(postId: string) {
  return `/p/${encodeURIComponent(postId)}`;
}

export function appPostPath(postId: string) {
  return `/posts/${encodeURIComponent(postId)}`;
}

export function publicProfilePath(handle: string) {
  return `/u/${encodeURIComponent(handle)}`;
}

export function publicEditorialPath(pageId: string) {
  return `/editorial/${encodeURIComponent(pageId)}`;
}
