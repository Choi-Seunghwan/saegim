"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ChangeEvent as ReactChangeEvent,
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from "react";
import { DEFAULT_CARD_COMP } from "@saegim/domain";
import {
  CURRENT_LEGAL_VERSIONS,
  LEGAL_DOCUMENTS,
} from "@saegim/domain";
import type {
  AccountProfile,
  CardBackgroundImage,
  CardComposition,
  CreatePostInput,
  EditorialPage,
  LegalAgreementInput,
  LegalDocument,
  LegalDocumentKind,
  PageInfo,
  PostBundle,
  PostComment,
  SentenceCard,
  UpdateAccountInput,
} from "@saegim/domain";
import {
  carvePost,
  createPost,
  createPostComment,
  fetchAccountDetail,
  fetchAccountPosts,
  fetchPostComments,
  fetchCurrentAccount,
  fetchDrawer,
  fetchEditorialPages,
  fetchFeed,
  fetchFollowingAccounts,
  fetchPost,
  fetchRecommendedAccounts,
  fetchSearch,
  fetchShelf,
  fetchAuthSession,
  followAccount,
  getGoogleOAuthStartUrl,
  likePost,
  loginWithEmail,
  logoutSession,
  signupWithEmail,
  uncarvePost,
  unlikePost,
  unfollowAccount,
  updateCurrentAccount,
} from "../lib/api";
import {
  identifyAnalyticsAccount,
  resetAnalyticsIdentity,
  trackAnalyticsEvent,
  trackAnalyticsPageView,
  type AnalyticsProperties,
} from "../lib/analytics";

type TabKey = "home" | "discover" | "capture" | "shelf" | "me";
type EntryState = "guest" | "signed-in";
type InitialLoadState = "loading" | "ready" | "error";
type InfoSheetState = { postId: string };
type AuthSheetIntent = "default" | "capture" | "profile";
type AuthMode = "login" | "signup";
type AuthSubmitInput = {
  mode: AuthMode;
  displayName: string;
  email: string;
  password: string;
  agreements?: LegalAgreementInput;
};
type EditorialPageOrigin = "home" | "settings" | "notice-list";
type MainReturnTab = Exclude<TabKey, "capture">;
type CaptureToolKey = "title" | "background" | "source" | "tag";
type CaptureSheetKey = CaptureToolKey | "text";
type CaptureDraftCard = {
  text: string;
  comp: CardComposition;
};
type CaptureConfirmState =
  | {
      kind: "publish";
      input: CreatePostInput;
      cardCount: number;
      skippedEmptyCardCount: number;
    }
  | { kind: "delete"; index: number; cardNumber: number };
type CaptureDragTarget = "text" | "source" | "resize";
type CapturePointerDrag = {
  pointerId: number;
  target: CaptureDragTarget;
  startX: number;
  startY: number;
  baseXp: number;
  baseYp: number;
  baseSize: number;
  moved: boolean;
  rect: DOMRect;
  minXp: number;
  maxXp: number;
  minYp: number;
  maxYp: number;
};
type CaptureImageCropDrag = {
  pointerId: number;
  startX: number;
  startY: number;
  baseFocalX: number;
  baseFocalY: number;
  zoom: number;
  rect: DOMRect;
};
type DetailReturnTarget =
  | { surface: "tab"; tab: MainReturnTab }
  | { surface: "search"; tab: MainReturnTab }
  | { surface: "drawer" };
type ProfileReturnTarget =
  | { surface: "tab"; tab: MainReturnTab }
  | { surface: "search"; tab: MainReturnTab }
  | { surface: "discover" }
  | { surface: "drawer"; drawerReturnSurface: DrawerReturnSurface }
  | { surface: "following" }
  | { surface: "settings" };
type AppRoute =
  | { surface: "tab"; tab: TabKey }
  | { surface: "post"; postId: string }
  | { surface: "profile"; handle: string };
type AppRouteHistoryState = {
  saegimDetailReturnTarget?: DetailReturnTarget | null;
  saegimProfileReturnTarget?: ProfileReturnTarget | null;
  saegimRoute?: AppRoute;
};
type DrawerReturnSurface = "profile" | "settings";
type DetailDragState = {
  x: number;
  y: number;
  axis: "x" | "y" | null;
  isAnimating: boolean;
};
type EditorialPageState = { pageId: string; origin: EditorialPageOrigin };
type AnalyticsViewState = {
  key: string;
  name: string;
  properties: AnalyticsProperties;
};

const tabLabels: Record<TabKey, string> = {
  home: "홈",
  discover: "발견",
  capture: "포착",
  shelf: "둘러보기",
  me: "나",
};
const tabUrlParam = "tab";
const tabKeys = [
  "home",
  "discover",
  "capture",
  "shelf",
  "me",
] as const satisfies readonly TabKey[];
const tabPaths: Record<TabKey, string> = {
  home: "/",
  discover: "/discover",
  capture: "/capture",
  shelf: "/shelf",
  me: "/me",
};

function isTabKey(value: string | null): value is TabKey {
  return tabKeys.includes(value as TabKey);
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function readAppRouteFromLocation(): AppRoute | null {
  if (typeof window === "undefined") {
    return null;
  }

  const url = new URL(window.location.href);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const legacyTab = url.searchParams.get(tabUrlParam);

  if (url.pathname === "/" && isTabKey(legacyTab)) {
    return { surface: "tab", tab: legacyTab };
  }

  if (pathParts[0] === "posts" && pathParts.length === 2) {
    const postId = pathParts[1];
    if (!postId) {
      return null;
    }

    return {
      surface: "post",
      postId: decodePathSegment(postId),
    };
  }

  if (pathParts[0] === "u" && pathParts.length === 2) {
    const handle = pathParts[1];
    if (!handle) {
      return null;
    }

    return {
      surface: "profile",
      handle: decodePathSegment(handle),
    };
  }

  const pathTab = tabKeys.find((tab) => tabPaths[tab] === url.pathname);
  if (pathTab) {
    return { surface: "tab", tab: pathTab };
  }

  return null;
}

function appRoutePath(route: AppRoute) {
  if (route.surface === "post") {
    return `/posts/${encodeURIComponent(route.postId)}`;
  }

  if (route.surface === "profile") {
    return `/u/${encodeURIComponent(route.handle)}`;
  }

  return tabPaths[route.tab];
}

function writeAppRouteToHistory(
  route: AppRoute,
  mode: "push" | "replace" = "push",
  state: AppRouteHistoryState = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.pathname = appRoutePath(route);
  url.searchParams.delete(tabUrlParam);

  const nextPath = `${url.pathname}${url.search}${url.hash}`;
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextPath === currentPath) {
    return;
  }

  const nextState: AppRouteHistoryState = {
    ...window.history.state,
    ...state,
    saegimRoute: route,
  };

  if (mode === "replace") {
    window.history.replaceState(nextState, "", nextPath);
    return;
  }

  window.history.pushState(nextState, "", nextPath);
}

function readRouteHistoryState(): AppRouteHistoryState {
  if (typeof window === "undefined" || !window.history.state) {
    return {};
  }

  return window.history.state as AppRouteHistoryState;
}

const topbarCopy: Record<
  Exclude<TabKey, "discover">,
  { title: string; subtitle: string }
> = {
  home: { title: "새김", subtitle: "마음에 새길 한 줄" },
  capture: { title: "포착", subtitle: "한 줄을 카드로 남기기" },
  shelf: { title: "둘러보기", subtitle: "엮어 둔 글 모음" },
  me: { title: "나", subtitle: "내가 남긴 글과 서랍" },
};

const editorialHeroBackgrounds: Record<EditorialPage["kind"], string> = {
  notice: "linear-gradient(150deg,#4A4651,#38323F)",
  event: "linear-gradient(150deg,#5A5466,#3C3652)",
  ad: "linear-gradient(150deg,#6E6A74,#4A4651)",
};

const guestAccount: AccountProfile = {
  id: "guest",
  handle: "guest",
  displayName: "게스트",
  tagline: "마음에 새길 한 줄을 둘러보는 중",
  verification: "none",
  postCount: 0,
  writingFriendCount: 0,
};
const discoverGestureHintStorageKey = "saegim_discover_gesture_hint_seen_v1";

function makePostAnalyticsProperties(
  post: PostBundle,
  properties: AnalyticsProperties = {},
): AnalyticsProperties {
  const uniqueTags = new Set<string>();
  post.cards.forEach((card) => {
    card.tags.forEach((tag) => uniqueTags.add(tag));
  });

  return {
    author_id: post.author.id,
    card_count: post.post.cardCount,
    comment_count: post.viewerState?.commentCount ?? null,
    creation_type: post.post.creationType,
    has_image_background: post.cards.some((card) =>
      Boolean(card.comp.bgImage?.url || card.comp.bgImage?.objectKey),
    ),
    has_source_detail: post.cards.some((card) =>
      Boolean(card.source.author || card.source.work || card.source.url),
    ),
    like_count: post.viewerState?.likeCount ?? null,
    loaded_card_count: post.cards.length,
    post_id: post.post.id,
    tag_count: uniqueTags.size,
    viewer_carved: post.viewerState?.carved ?? null,
    viewer_liked: post.viewerState?.liked ?? null,
    visibility: post.post.visibility,
    ...properties,
  };
}

function makeAccountAnalyticsProperties(
  account: AccountProfile,
  prefix: string,
): AnalyticsProperties {
  return {
    [`${prefix}_account_id`]: account.id,
    [`${prefix}_handle`]: account.handle,
    [`${prefix}_post_count`]: account.postCount,
    [`${prefix}_verification`]: account.verification,
    [`${prefix}_writing_friend_count`]: account.writingFriendCount,
  };
}

const captureToolLabels: Record<CaptureSheetKey, string> = {
  text: "문구",
  title: "제목",
  background: "배경",
  source: "출처",
  tag: "태그",
};

const captureBackgroundOptions = [
  {
    id: "fog",
    label: "안개",
    bg: "linear-gradient(150deg,#EEF0F3,#E6E9F0 55%,#ECE8F1)",
    dim: 0,
    textColor: "#38323F",
  },
  {
    id: "dawn",
    label: "새벽",
    bg: "linear-gradient(150deg,#EAF0F7,#DDE6F0 60%,#EFEAF4)",
    dim: 0,
    textColor: "#38323F",
  },
  {
    id: "sunset",
    label: "노을",
    bg: "linear-gradient(150deg,#F7D9C7,#F1BFA7 56%,#DBA3B1)",
    dim: 0,
    textColor: "#38323F",
  },
  {
    id: "apricot",
    label: "살구",
    bg: "linear-gradient(150deg,#F9E1D0,#F4C7AF 58%,#E7B7A9)",
    dim: 0,
    textColor: "#38323F",
  },
  {
    id: "lavender",
    label: "라벤더",
    bg: "linear-gradient(150deg,#EDE7F5,#D8D0EA 58%,#C8C7E1)",
    dim: 0,
    textColor: "#38323F",
  },
  {
    id: "night",
    label: "밤",
    bg: "linear-gradient(150deg,#3C3652,#241F38)",
    dim: 0.16,
    textColor: "#FBF8FC",
  },
] as const;

const captureSolidColorOptions = [
  "#F6F5F6",
  "#ECE8F1",
  "#EAF0F7",
  "#F9E1D0",
  "#353039",
  "#241F38",
] as const;
const captureTextColorOptions = [
  "#38323F",
  "#1F1C24",
  "#6E6A74",
  "#9A8E86",
  "#A7A2AC",
  "#FFFFFF",
  "#F4EFF6",
] as const;
const captureImageAcceptedTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const captureImageMaxBytes = 5 * 1024 * 1024;
const maxCaptureDraftCards = 10;
const profilePhotoMaxBytes = 5 * 1024 * 1024;
const profilePhotoSize = 512;
const captureFontOptions: { id: CardComposition["font"]; label: string }[] = [
  { id: "gothic", label: "고딕" },
  { id: "serif", label: "명조" },
  { id: "round", label: "둥근" },
  { id: "pen", label: "손글씨" },
  { id: "black", label: "진한" },
];
const captureWeightOptions: {
  value: CardComposition["weight"];
  label: string;
}[] = [
  { value: 300, label: "가늘게" },
  { value: 400, label: "보통" },
  { value: 700, label: "굵게" },
  { value: 800, label: "두껍게" },
];
const captureAlignOptions: {
  value: CardComposition["align"];
  label: string;
}[] = [
  { value: "left", label: "왼쪽" },
  { value: "center", label: "가운데" },
  { value: "right", label: "오른쪽" },
];
const listInitialCount = 8;
const listLoadStep = 8;
const emptyPageInfo: PageInfo = {
  nextCursor: null,
  hasNextPage: false,
  limit: listInitialCount,
};

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function sourceKindLabel(source: PostBundle["cards"][number]["source"]) {
  if (source.kind === "book") return "책";
  if (source.kind === "web") return "웹";
  if (source.kind === "publisher") return "출판사";
  if (source.author?.trim() || source.work?.trim()) return "직접 입력";
  return "직접 새김";
}

function formatSource(source: PostBundle["cards"][number]["source"]) {
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

function bgWithDim(background: string, dim: number) {
  if (dim <= 0) return background;
  return `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), ${background}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function cssImageUrl(url: string) {
  return url.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n|\r/g, "");
}

function cardBackgroundImageStyle(image: CardBackgroundImage): CSSProperties {
  const focalX = clampNumber(image.focalX, 0, 100);
  const focalY = clampNumber(image.focalY, 0, 100);

  return {
    objectPosition: `${focalX}% ${focalY}%`,
    transform: `scale(${clampNumber(image.zoom, 1, 2.5)})`,
    transformOrigin: `${focalX}% ${focalY}%`,
  };
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("사진을 읽을 수 없어요."));
    };

    reader.onerror = () => reject(new Error("사진을 읽을 수 없어요."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("사진을 읽을 수 없어요."));
    image.src = src;
  });
}

async function createProfilePhotoDataUrl(file: File) {
  const sourceUrl = await readImageFileAsDataUrl(file);
  const image = await loadImageElement(sourceUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("사진을 다듬을 수 없어요.");
  }

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2);
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2);

  canvas.width = profilePhotoSize;
  canvas.height = profilePhotoSize;
  context.fillStyle = "#F6F5F6";
  context.fillRect(0, 0, profilePhotoSize, profilePhotoSize);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    profilePhotoSize,
    profilePhotoSize,
  );

  return canvas.toDataURL("image/jpeg", 0.82);
}

function useProgressiveItems<T>(
  items: T[],
  resetKey: string,
  initialCount = listInitialCount,
) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(initialCount);
  }, [initialCount, resetKey]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (
      !target ||
      visibleCount >= items.length ||
      typeof IntersectionObserver === "undefined"
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setVisibleCount((currentCount) =>
          Math.min(currentCount + listLoadStep, items.length),
        );
      },
      { rootMargin: "220px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [items.length, visibleCount]);

  return {
    hasMore: visibleCount < items.length,
    loadMoreRef,
    visibleItems: items.slice(0, Math.min(visibleCount, items.length)),
  };
}

function useServerLoadMore(
  hasMore: boolean,
  isLoading: boolean,
  onLoadMore: () => void,
) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (
      !target ||
      !hasMore ||
      isLoading ||
      typeof IntersectionObserver === "undefined"
    ) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: "220px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return loadMoreRef;
}

function postListKey(posts: PostBundle[]) {
  return posts.map((post) => post.post.id).join("|");
}

function accountListKey(accounts: AccountProfile[]) {
  return accounts.map((account) => account.id).join("|");
}

function LoadMoreSentinel({
  hasMore,
  innerRef,
}: {
  hasMore: boolean;
  innerRef: RefObject<HTMLDivElement | null>;
}) {
  if (!hasMore) {
    return null;
  }

  return (
    <div className="list-load-sentinel" ref={innerRef} aria-live="polite">
      더 불러오는 중
    </div>
  );
}

function isLightHexColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return true;
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return 0.299 * red + 0.587 * green + 0.114 * blue > 150;
}

function solidColorFromBackground(background: string) {
  return /^#[0-9a-fA-F]{6}$/.test(background) ? background : null;
}

function createCaptureDraftComp(baseComp?: CardComposition): CardComposition {
  const baseBackground = captureBackgroundOptions[0];
  return {
    ...DEFAULT_CARD_COMP,
    ...(baseComp ?? {}),
    bg: baseComp?.bg ?? baseBackground.bg,
    dim: baseComp?.dim ?? baseBackground.dim,
    textColor: baseComp?.textColor ?? baseBackground.textColor,
    textPos: null,
    sourcePos: null,
  };
}

function createCaptureDraftCard(baseComp?: CardComposition): CaptureDraftCard {
  return {
    text: "",
    comp: createCaptureDraftComp(baseComp),
  };
}

function isSameBackgroundOption(
  option: (typeof captureBackgroundOptions)[number],
  comp: CardComposition,
) {
  return !comp.bgImage && option.bg === comp.bg && option.dim === comp.dim;
}

const cardFontFamily: Record<CardComposition["font"], string> = {
  gothic: "var(--font-ui)",
  serif: "var(--font-card)",
  round: "var(--font-round)",
  pen: "var(--font-pen)",
  black: "var(--font-black)",
};

function cardCompositionSurfaceStyle(comp: CardComposition): CSSProperties {
  const image = comp.bgImage;
  const style = {
    "--cv-text": comp.textColor,
    background: bgWithDim(comp.bg, image ? 0 : comp.dim),
    color: comp.textColor,
  } as CSSProperties;

  if (image?.url) {
    style.backgroundImage = `linear-gradient(rgba(0,0,0,${comp.dim}), rgba(0,0,0,${comp.dim})), url("${cssImageUrl(
      image.url,
    )}")`;
    style.backgroundPosition = `center, ${clampNumber(image.focalX, 0, 100)}% ${clampNumber(image.focalY, 0, 100)}%`;
    style.backgroundSize = "auto, cover";
    style.backgroundRepeat = "repeat, no-repeat";
  }

  return style;
}

function cardSurfaceStyle(card: SentenceCard): CSSProperties {
  return cardCompositionSurfaceStyle(card.comp);
}

function CardBackgroundImageLayer({ comp }: { comp: CardComposition }) {
  const image = comp.bgImage;

  if (!image?.url) {
    return null;
  }

  return (
    <>
      <div className="card-bg-photo" aria-hidden="true">
        <img
          alt=""
          draggable={false}
          src={image.url}
          style={cardBackgroundImageStyle(image)}
        />
      </div>
      {comp.dim > 0 ? (
        <div
          className="card-bg-dim"
          aria-hidden="true"
          style={{ background: `rgba(0,0,0,${comp.dim})` }}
        />
      ) : null}
    </>
  );
}

function cardTextStyle(
  comp: CardComposition,
  scale = 1,
  includePosition = false,
): CSSProperties {
  const style: CSSProperties = {
    fontFamily: cardFontFamily[comp.font],
    fontSize: `${Math.round(comp.size * scale)}px`,
    fontWeight: comp.weight,
    textAlign: comp.align,
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
    transform: "translate(-50%, -50%)",
  };
}

function cardSourceLabel(card: SentenceCard) {
  if (card.source.kind === "direct") return "";
  const formatted = formatSource(card.source);
  return formatted === "직접 새김" ? "" : formatted;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4-4" />
    </svg>
  );
}

function TabIcon({ tab }: { tab: Exclude<TabKey, "capture" | "me"> }) {
  if (tab === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    );
  }

  if (tab === "discover") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M15.6 8.4l-2.1 5.1-5.1 2.1 2.1-5.1 5.1-2.1z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
    >
      <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-3.6L6 21V4z" />
    </svg>
  );
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <path d="M21 11.5a8.4 8.4 0 0 1-12 7.6L3 21l1.9-6A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <circle cx="6.5" cy="12" r="1.35" />
      <circle cx="12" cy="12" r="1.35" />
      <circle cx="17.5" cy="12" r="1.35" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 14h10l1-14" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}

function CaptureToolIcon({ tool }: { tool: CaptureToolKey }) {
  if (tool === "title") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14M12 6v13" />
      </svg>
    );
  }

  if (tool === "background") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
        <path d="M4 16l4.2-4.1 4.2 4.1M13.5 12.5 16 10l4 4" />
        <circle cx="8.5" cy="8.5" r="1.4" />
      </svg>
    );
  }

  if (tool === "source") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 5.2v14.2a1 1 0 0 0 1.4.9L12 17.5l6.1 2.8a1 1 0 0 0 1.4-.9V5.2A2.2 2.2 0 0 0 17.3 3H6.7a2.2 2.2 0 0 0-2.2 2.2z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.6 13.4 11 3.8a2 2 0 0 0-1.4-.6H4.5A1.5 1.5 0 0 0 3 4.7v5.1a2 2 0 0 0 .6 1.4l9.6 9.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.8z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4.4L20 8.4 15.6 4 4 15.6V20z" />
      <path d="M13.8 5.8l4.4 4.4" />
    </svg>
  );
}

function Avatar({
  displayName,
  photoUrl,
  size,
}: {
  displayName: string;
  photoUrl?: string | null | undefined;
  size?: "large" | "mini" | "tab";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const cleanPhotoUrl = photoUrl?.trim();
  const initial = displayName.trim().slice(0, 1) || "새";
  const showImage = Boolean(cleanPhotoUrl && !imageFailed);

  useEffect(() => {
    setImageFailed(false);
  }, [cleanPhotoUrl]);

  const className =
    size === "tab" ? "avatar avatar-tab" : size ? `avatar ${size}` : "avatar";

  return (
    <div className={className}>
      {showImage ? (
        <img src={cleanPhotoUrl} alt="" onError={() => setImageFailed(true)} />
      ) : (
        initial
      )}
    </div>
  );
}

function GuestTabAvatar() {
  return (
    <div className="guest-tab-avatar" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8.5" r="3.2" />
        <path d="M5.8 19.2c.9-3.3 3.1-5 6.2-5s5.3 1.7 6.2 5" />
      </svg>
    </div>
  );
}

function OfficialMark({
  verification,
}: {
  verification: AccountProfile["verification"];
}) {
  if (verification !== "official") return null;

  return (
    <span className="official-mark" aria-label="공식 계정" title="공식 계정">
      ✓
    </span>
  );
}

function AccountName({ account }: { account: AccountProfile }) {
  return (
    <span className="account-name">
      <span>{account.displayName}</span>
      <OfficialMark verification={account.verification} />
    </span>
  );
}

export function SaegimShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [captureReturnTab, setCaptureReturnTab] =
    useState<Exclude<TabKey, "capture">>("home");
  const [entryState, setEntryState] = useState<EntryState>("guest");
  const [initialLoadState, setInitialLoadState] =
    useState<InitialLoadState>("loading");
  const [initialLoadRetryKey, setInitialLoadRetryKey] = useState(0);
  const [authSheetIntent, setAuthSheetIntent] =
    useState<AuthSheetIntent | null>(null);
  const [authSheetInitialMode, setAuthSheetInitialMode] =
    useState<AuthMode>("login");
  const [isSearching, setIsSearching] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isViewingDrawer, setIsViewingDrawer] = useState(false);
  const [drawerReturnSurface, setDrawerReturnSurface] =
    useState<DrawerReturnSurface>("profile");
  const [isViewingFollowing, setIsViewingFollowing] = useState(false);
  const [isViewingSettings, setIsViewingSettings] = useState(false);
  const [isViewingNoticeList, setIsViewingNoticeList] = useState(false);
  const [legalDocumentKind, setLegalDocumentKind] =
    useState<LegalDocumentKind | null>(null);
  const [editorialPageState, setEditorialPageState] =
    useState<EditorialPageState | null>(null);
  const [commentPost, setCommentPost] = useState<PostBundle | null>(null);
  const [infoSheet, setInfoSheet] = useState<InfoSheetState | null>(null);
  const [detailReturnTarget, setDetailReturnTarget] =
    useState<DetailReturnTarget | null>(null);
  const [profileReturnTarget, setProfileReturnTarget] =
    useState<ProfileReturnTarget | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [posts, setPosts] = useState<PostBundle[]>([]);
  const [feedPageInfo, setFeedPageInfo] = useState<PageInfo>(emptyPageInfo);
  const [isLoadingMoreFeed, setIsLoadingMoreFeed] = useState(false);
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [editorialPages, setEditorialPages] = useState<EditorialPage[]>([]);
  const [currentAccount, setCurrentAccount] =
    useState<AccountProfile>(guestAccount);
  const featuredPost = posts[0] ?? null;
  const activePost =
    posts.find((post) => post.post.id === activePostId) ?? featuredPost;
  const selectedProfile =
    selectedProfileId === currentAccount.id
      ? currentAccount
      : (accounts.find((account) => account.id === selectedProfileId) ??
        posts.find((post) => post.author.id === selectedProfileId)?.author ??
        currentAccount);
  const isOwnProfile = selectedProfile.id === currentAccount.id;
  const infoSheetPost = infoSheet
    ? posts.find((post) => post.post.id === infoSheet.postId)
    : null;
  const selectedEditorialPage = editorialPageState
    ? (editorialPages.find((page) => page.id === editorialPageState.pageId) ??
      null)
    : null;
  const noticePages = editorialPages.filter((page) => page.kind === "notice");
  const isFullPage =
    isSearching ||
    activeTab === "capture" ||
    isEditingProfile ||
    isViewingDrawer ||
    isViewingFollowing ||
    isViewingSettings ||
    isViewingNoticeList ||
    Boolean(legalDocumentKind) ||
    Boolean(editorialPageState);
  const isDiscoverMode = activeTab === "discover" && !isFullPage;
  const isProfileTab = activeTab === "me" && !isFullPage;
  const activeNavTab =
    isProfileTab && !isOwnProfile ? null : activeTab;
  const frameClassName = [
    "mobile-frame",
    isDiscoverMode ? "is-discover" : "",
    isFullPage ? "is-full" : "",
    isProfileTab ? "is-profile" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const topbar =
    activeTab === "discover" ? topbarCopy.home : topbarCopy[activeTab];
  const activePostIndex = activePost
    ? Math.max(
        0,
        posts.findIndex((post) => post.post.id === activePost.post.id),
      )
    : 0;
  const hasAppliedInitialUrlTabRef = useRef(false);
  const skipNextTabUrlWriteRef = useRef(false);
  const lastTrackedPageViewKeyRef = useRef<string | null>(null);
  const analyticsView = useMemo<AnalyticsViewState>(() => {
    const baseProperties: AnalyticsProperties = {
      active_tab: activeTab,
      current_account_id:
        currentAccount.id === guestAccount.id ? null : currentAccount.id,
      entry_state: entryState,
      initial_load_state: initialLoadState,
      signed_in: entryState === "signed-in",
    };

    if (legalDocumentKind) {
      return {
        key: `legal:${legalDocumentKind}`,
        name: "Legal Document",
        properties: {
          ...baseProperties,
          legal_document_kind: legalDocumentKind,
          legal_document_version: LEGAL_DOCUMENTS[legalDocumentKind].version,
        },
      };
    }

    if (selectedEditorialPage) {
      return {
        key: `editorial:${selectedEditorialPage.id}:${editorialPageState?.origin ?? "unknown"}`,
        name: "Editorial Page",
        properties: {
          ...baseProperties,
          editorial_page_id: selectedEditorialPage.id,
          editorial_page_kind: selectedEditorialPage.kind,
          origin: editorialPageState?.origin ?? "unknown",
        },
      };
    }

    if (isViewingNoticeList) {
      return {
        key: "notice-list",
        name: "Notice List",
        properties: {
          ...baseProperties,
          notice_count: noticePages.length,
        },
      };
    }

    if (isSearching) {
      return {
        key: `search:${activeTab}`,
        name: "Search",
        properties: {
          ...baseProperties,
          origin_tab: activeTab,
        },
      };
    }

    if (activeTab === "discover") {
      return {
        key: `discover:${activePost?.post.id ?? "empty"}:${activeCardIndex}:${detailReturnTarget?.surface ?? "main"}`,
        name: activePost ? "Discover" : "Discover Empty",
        properties: {
          ...baseProperties,
          active_card_index: activeCardIndex,
          card_number: activeCardIndex + 1,
          detail_origin: detailReturnTarget?.surface ?? "main",
          post_index: activePostIndex,
          ...(activePost
            ? makePostAnalyticsProperties(activePost)
            : { post_id: null }),
        },
      };
    }

    if (activeTab === "capture") {
      return {
        key: `capture:${captureReturnTab}`,
        name: "Capture",
        properties: {
          ...baseProperties,
          return_tab: captureReturnTab,
        },
      };
    }

    if (activeTab === "shelf") {
      return {
        key: "shelf",
        name: "Shelf",
        properties: baseProperties,
      };
    }

    if (activeTab === "me") {
      if (isViewingSettings) {
        return {
          key: "settings",
          name: "Settings",
          properties: baseProperties,
        };
      }

      if (isViewingFollowing) {
        return {
          key: "following",
          name: "Following",
          properties: baseProperties,
        };
      }

      if (isViewingDrawer) {
        return {
          key: `drawer:${drawerReturnSurface}`,
          name: "Drawer",
          properties: {
            ...baseProperties,
            return_surface: drawerReturnSurface,
          },
        };
      }

      if (isEditingProfile) {
        return {
          key: "profile-edit",
          name: "Profile Edit",
          properties: baseProperties,
        };
      }

      return {
        key: `profile:${selectedProfile.id}:${isOwnProfile ? "own" : "other"}`,
        name: "Profile",
        properties: {
          ...baseProperties,
          is_own_profile: isOwnProfile,
          ...makeAccountAnalyticsProperties(selectedProfile, "profile"),
        },
      };
    }

    return {
      key: "home",
      name: "Home",
      properties: {
        ...baseProperties,
        editorial_page_count: editorialPages.length,
        post_count: posts.length,
        recommended_account_count: accounts.length,
      },
    };
  }, [
    accounts.length,
    activeCardIndex,
    activePost,
    activePostIndex,
    activeTab,
    captureReturnTab,
    currentAccount.id,
    detailReturnTarget?.surface,
    drawerReturnSurface,
    editorialPageState?.origin,
    editorialPages.length,
    entryState,
    initialLoadState,
    isEditingProfile,
    isOwnProfile,
    isSearching,
    isViewingDrawer,
    isViewingFollowing,
    isViewingNoticeList,
    isViewingSettings,
    legalDocumentKind,
    noticePages.length,
    posts.length,
    selectedEditorialPage,
    selectedProfile,
  ]);

  function currentAnalyticsSurface() {
    if (legalDocumentKind) return "legal";
    if (selectedEditorialPage) return "editorial";
    if (isViewingNoticeList) return "notice_list";
    if (isSearching) return "search";
    if (activeTab === "discover") return "discover";
    if (activeTab === "capture") return "capture";
    if (activeTab === "shelf") return "shelf";
    if (activeTab === "me" && isViewingSettings) return "settings";
    if (activeTab === "me" && isViewingFollowing) return "following";
    if (activeTab === "me" && isViewingDrawer) return "drawer";
    if (activeTab === "me" && isEditingProfile) return "profile_edit";
    if (activeTab === "me") return "profile";
    return "home";
  }

  function makeSessionAnalyticsProperties(): AnalyticsProperties {
    return {
      active_tab: activeTab,
      current_account_id:
        currentAccount.id === guestAccount.id ? null : currentAccount.id,
      entry_state: entryState,
      initial_load_state: initialLoadState,
      signed_in: isSignedIn(),
      surface: currentAnalyticsSurface(),
    };
  }

  function trackSaegimEvent(
    eventName: string,
    properties: AnalyticsProperties = {},
  ) {
    trackAnalyticsEvent(eventName, {
      ...makeSessionAnalyticsProperties(),
      ...properties,
    });
  }

  function handlePostPublished(post: PostBundle) {
    trackSaegimEvent(
      "Post Published",
      makePostAnalyticsProperties(post, { surface: "capture" }),
    );
    setPosts((currentPosts) => [
      post,
      ...currentPosts.filter((item) => item.post.id !== post.post.id),
    ]);
    setActivePostId(post.post.id);
    setActiveCardIndex(0);
    setIsSearching(false);
    setIsViewingNoticeList(false);
    setIsViewingFollowing(false);
    setEditorialPageState(null);
    setInfoSheet(null);
    setActiveTab("discover");
  }

  function replacePost(post: PostBundle) {
    setPosts((currentPosts) =>
      currentPosts.map((item) => (item.post.id === post.post.id ? post : item)),
    );
    setCommentPost((currentPost) =>
      currentPost?.post.id === post.post.id ? post : currentPost,
    );
  }

  function mergePosts(nextPosts: PostBundle[]) {
    setPosts((currentPosts) => {
      const nextPostMap = new Map(
        nextPosts.map((post) => [post.post.id, post]),
      );
      const currentPostIds = new Set(currentPosts.map((post) => post.post.id));
      const mergedPosts = currentPosts.map(
        (post) => nextPostMap.get(post.post.id) ?? post,
      );
      const newPosts = nextPosts.filter(
        (post) => !currentPostIds.has(post.post.id),
      );

      return [...mergedPosts, ...newPosts];
    });
  }

  async function loadMoreFeed() {
    if (
      !feedPageInfo.hasNextPage ||
      !feedPageInfo.nextCursor ||
      isLoadingMoreFeed
    ) {
      return [] as PostBundle[];
    }

    try {
      setIsLoadingMoreFeed(true);
      const page = await fetchFeed({
        cursor: feedPageInfo.nextCursor,
        limit: listLoadStep,
      });
      setFeedPageInfo(page.pageInfo);
      mergePosts(page.items);
      return page.items;
    } catch {
      return [] as PostBundle[];
    } finally {
      setIsLoadingMoreFeed(false);
    }
  }

  function upsertAccount(account: AccountProfile) {
    setAccounts((currentAccounts) => {
      const exists = currentAccounts.some((item) => item.id === account.id);

      if (!exists) {
        return [account, ...currentAccounts];
      }

      return currentAccounts.map((item) =>
        item.id === account.id ? account : item,
      );
    });
  }

  function replaceAccount(account: AccountProfile) {
    setAccounts((currentAccounts) =>
      currentAccounts.map((item) => (item.id === account.id ? account : item)),
    );
    setPosts((currentPosts) =>
      currentPosts.map((post) =>
        post.author.id === account.id
          ? {
              ...post,
              author: account,
              viewerState: {
                ...post.viewerState,
                liked: post.viewerState?.liked ?? false,
                carved: post.viewerState?.carved ?? false,
                subscribed: account.viewerState?.subscribed ?? false,
                likeCount: post.viewerState?.likeCount ?? 0,
                commentCount: post.viewerState?.commentCount ?? 0,
              },
            }
          : post,
      ),
    );
  }

  function isSignedIn() {
    return entryState === "signed-in";
  }

  function openAuthSheet(
    intent: AuthSheetIntent = "default",
    mode: AuthMode = "login",
  ) {
    trackSaegimEvent("Auth Sheet Opened", {
      auth_intent: intent,
      auth_mode: mode,
    });
    setCommentPost(null);
    setInfoSheet(null);
    setAuthSheetInitialMode(mode);
    setAuthSheetIntent(intent);
  }

  function requireSignedIn(intent: AuthSheetIntent = "default") {
    if (isSignedIn()) {
      return true;
    }

    openAuthSheet(intent);
    return false;
  }

  function retryInitialLoad() {
    setInitialLoadState("loading");
    setInitialLoadRetryKey((currentKey) => currentKey + 1);
  }

  async function enterApp(input: AuthSubmitInput) {
    const intent = authSheetIntent;
    const nextAccount =
      input.mode === "signup"
        ? await signupWithEmail({
            displayName: input.displayName,
            email: input.email,
            password: input.password,
            ...(input.agreements ? { agreements: input.agreements } : {}),
          })
        : await loginWithEmail({
            email: input.email,
            password: input.password,
          });

    setCurrentAccount(nextAccount);
    replaceAccount(nextAccount);
    setEntryState("signed-in");
    setSelectedProfileId(nextAccount.id);
    setAuthSheetIntent(null);
    identifyAnalyticsAccount(nextAccount);
    trackAnalyticsEvent(
      input.mode === "signup" ? "Sign Up Completed" : "Login Completed",
      {
        ...makeSessionAnalyticsProperties(),
        account_id: nextAccount.id,
        auth_intent: intent ?? "default",
        entry_state: "signed-in",
        method: "email",
        signed_in: true,
      },
    );

    if (intent === "capture") {
      setCaptureReturnTab(activeTab === "capture" ? "home" : activeTab);
      setIsSearching(false);
      setIsEditingProfile(false);
      setIsViewingDrawer(false);
      setDrawerReturnSurface("profile");
      setIsViewingFollowing(false);
      setIsViewingSettings(false);
      setIsViewingNoticeList(false);
      setEditorialPageState(null);
      setCommentPost(null);
      setInfoSheet(null);
      setDetailReturnTarget(null);
      setProfileReturnTarget(null);
      setActiveTab("capture");
      return;
    }

    if (intent === "profile") {
      setIsSearching(false);
      setIsEditingProfile(false);
      setIsViewingDrawer(false);
      setDrawerReturnSurface("profile");
      setIsViewingFollowing(false);
      setIsViewingSettings(false);
      setIsViewingNoticeList(false);
      setEditorialPageState(null);
      setCommentPost(null);
      setInfoSheet(null);
      setDetailReturnTarget(null);
      setProfileReturnTarget(null);
      setActiveTab("me");
    }
  }

  function leaveApp() {
    trackSaegimEvent("Logout Completed");
    void logoutSession().catch(() => undefined);
    resetAnalyticsIdentity();
    setActiveTab("home");
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setDrawerReturnSurface("profile");
    setIsViewingFollowing(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setDetailReturnTarget(null);
    setProfileReturnTarget(null);
    setCurrentAccount(guestAccount);
    setSelectedProfileId(null);
    setEntryState("guest");
    setAuthSheetIntent(null);
  }

  function activateTab(tab: TabKey) {
    setActiveTab(tab);
    setIsSearching(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setDetailReturnTarget(null);
    setProfileReturnTarget(null);

    if (tab === "discover") {
      setActivePostId(
        (currentPostId) => currentPostId ?? featuredPost?.post.id ?? null,
      );
      setActiveCardIndex(0);
    }

    if (tab !== "me") {
      setIsEditingProfile(false);
      setIsViewingDrawer(false);
      setDrawerReturnSurface("profile");
      setIsViewingFollowing(false);
      setIsViewingSettings(false);
      return;
    }

    setSelectedProfileId(currentAccount.id);
  }

  function activateTabFromUrl(tab: TabKey) {
    if (tab === "capture" && !isSignedIn()) {
      openAuthSheet("capture");
      return;
    }

    if (tab === "me" && !isSignedIn()) {
      openAuthSheet("profile");
      return;
    }

    if (tab === "capture" && activeTab !== "capture") {
      setCaptureReturnTab(activeTab);
    }

    activateTab(tab);
  }

  async function activatePostRouteFromUrl(
    postId: string,
    returnTarget?: DetailReturnTarget | null,
  ) {
    let nextPost =
      posts.find((post) => post.post.id === postId) ?? null;

    if (!nextPost) {
      try {
        nextPost = await fetchPost(postId);
        mergePosts([nextPost]);
      } catch {
        activateTab("discover");
        return;
      }
    }

    setActivePostId(nextPost.post.id);
    setActiveCardIndex(0);
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setDrawerReturnSurface("profile");
    setIsViewingFollowing(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setProfileReturnTarget(null);
    setDetailReturnTarget(
      returnTarget === undefined
        ? { surface: "tab", tab: "discover" }
        : returnTarget,
    );
    setActiveTab("discover");
  }

  async function activateProfileRouteFromUrl(
    handle: string,
    returnTarget?: ProfileReturnTarget | null,
  ) {
    let nextAccount =
      currentAccount.handle === handle
        ? currentAccount
        : (accounts.find((account) => account.handle === handle) ??
          posts.find((post) => post.author.handle === handle)?.author ??
          null);

    if (!nextAccount) {
      try {
        const detail = await fetchAccountDetail(handle);
        nextAccount = detail.account;
        upsertAccount(detail.account);
        mergePosts(detail.posts);
      } catch {
        activateTab("discover");
        return;
      }
    }

    setSelectedProfileId(nextAccount.id);
    setProfileReturnTarget(
      nextAccount.id === currentAccount.id
        ? null
        : returnTarget === undefined
          ? { surface: "tab", tab: "discover" }
          : returnTarget,
    );
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setDrawerReturnSurface("profile");
    setIsViewingFollowing(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setDetailReturnTarget(null);
    setActiveTab("me");
  }

  function activateAppRouteFromUrl(
    route: AppRoute,
    routeState: AppRouteHistoryState = {},
  ) {
    if (route.surface === "tab") {
      activateTabFromUrl(route.tab);
      return;
    }

    if (route.surface === "post") {
      void activatePostRouteFromUrl(
        route.postId,
        routeState.saegimDetailReturnTarget,
      );
      return;
    }

    void activateProfileRouteFromUrl(
      route.handle,
      routeState.saegimProfileReturnTarget,
    );
  }

  function currentAppRouteForState(): {
    route: AppRoute;
    state?: AppRouteHistoryState;
  } {
    if (activeTab === "discover" && activePost && detailReturnTarget) {
      return {
        route: { surface: "post", postId: activePost.post.id },
        state: { saegimDetailReturnTarget: detailReturnTarget },
      };
    }

    if (
      activeTab === "me" &&
      !isOwnProfile &&
      !isSearching &&
      !isEditingProfile &&
      !isViewingDrawer &&
      !isViewingFollowing &&
      !isViewingSettings &&
      !isViewingNoticeList &&
      !editorialPageState
    ) {
      return {
        route: { surface: "profile", handle: selectedProfile.handle },
        state: { saegimProfileReturnTarget: profileReturnTarget },
      };
    }

    return { route: { surface: "tab", tab: activeTab } };
  }

  function selectTab(tab: TabKey) {
    if (tab === "capture" && !requireSignedIn("capture")) {
      return;
    }

    if (tab === "me" && !requireSignedIn("profile")) {
      return;
    }

    if (tab === "capture" && activeTab !== "capture") {
      setCaptureReturnTab(activeTab);
    }
    activateTab(tab);
  }

  function startGoogleOAuth(agreements: LegalAgreementInput) {
    trackSaegimEvent("Login Started", {
      auth_intent: authSheetIntent ?? "default",
      method: "google",
    });
    window.location.assign(getGoogleOAuthStartUrl(agreements));
  }

  function openEditorialPage(page: EditorialPage, origin: EditorialPageOrigin) {
    setCommentPost(null);
    setInfoSheet(null);
    setIsSearching(false);
    setIsViewingNoticeList(false);
    setIsViewingFollowing(false);
    setEditorialPageState({ pageId: page.id, origin });
  }

  function closeEditorialPage() {
    const origin = editorialPageState?.origin;
    setEditorialPageState(null);

    if (origin === "notice-list") {
      setIsViewingNoticeList(true);
      setIsViewingSettings(false);
      setActiveTab("me");
      return;
    }

    if (origin === "settings") {
      setIsViewingSettings(true);
      setActiveTab("me");
      return;
    }

    setActiveTab("home");
  }

  function openNoticeList() {
    setIsViewingSettings(false);
    setIsViewingFollowing(false);
    setIsViewingNoticeList(true);
    setEditorialPageState(null);
    setActiveTab("me");
  }

  async function handleToggleLike(post: PostBundle) {
    if (!requireSignedIn()) {
      return;
    }

    try {
      const nextLiked = !post.viewerState?.liked;
      const updatedPost = post.viewerState?.liked
        ? await unlikePost(post.post.id)
        : await likePost(post.post.id);
      replacePost(updatedPost);
      trackSaegimEvent(
        nextLiked ? "Post Liked" : "Post Unliked",
        makePostAnalyticsProperties(updatedPost),
      );
    } catch {
      // 네트워크 실패 시 현재 화면 상태를 유지한다.
    }
  }

  async function handleToggleCarve(post: PostBundle) {
    if (!requireSignedIn()) {
      return;
    }

    try {
      const nextCarved = !post.viewerState?.carved;
      const updatedPost = post.viewerState?.carved
        ? await uncarvePost(post.post.id)
        : await carvePost(post.post.id);
      replacePost(updatedPost);
      trackSaegimEvent(
        nextCarved ? "Post Carved" : "Post Uncarved",
        makePostAnalyticsProperties(updatedPost),
      );
    } catch {
      // 네트워크 실패 시 현재 화면 상태를 유지한다.
    }
  }

  async function handleUpdateProfile(input: UpdateAccountInput) {
    if (!requireSignedIn("profile")) {
      return;
    }

    const updatedAccount = await updateCurrentAccount(input);

    setCurrentAccount(updatedAccount);
    replaceAccount(updatedAccount);
    setIsEditingProfile(false);
    identifyAnalyticsAccount(updatedAccount);
    trackSaegimEvent("Profile Updated", {
      account_id: updatedAccount.id,
      has_bio: Boolean(updatedAccount.bio?.trim()),
      has_photo: Boolean(updatedAccount.photoUrl),
      has_tagline: Boolean(updatedAccount.tagline.trim()),
    });
  }

  async function handleToggleFollow(accountId: string, subscribed: boolean) {
    if (!requireSignedIn()) {
      return null;
    }

    try {
      const updatedAccount = subscribed
        ? await unfollowAccount(accountId)
        : await followAccount(accountId);
      replaceAccount(updatedAccount);
      trackSaegimEvent(subscribed ? "Account Unfollowed" : "Account Followed", {
        subscribed: !subscribed,
        ...makeAccountAnalyticsProperties(updatedAccount, "target"),
      });
      return updatedAccount;
    } catch {
      return null;
    }
  }

  function openPost(post: PostBundle) {
    const sourceSurface = currentAnalyticsSurface();
    const returnTarget: DetailReturnTarget | null = isViewingDrawer
      ? { surface: "drawer" }
      : isSearching
        ? {
            surface: "search",
            tab: activeTab === "capture" ? "home" : activeTab,
          }
        : activeTab !== "discover" && activeTab !== "capture"
          ? { surface: "tab", tab: activeTab }
          : null;

    trackSaegimEvent(
      "Post Opened",
      makePostAnalyticsProperties(post, {
        source_surface: sourceSurface,
      }),
    );
    setPosts((currentPosts) => {
      const exists = currentPosts.some((item) => item.post.id === post.post.id);

      if (!exists) {
        return [post, ...currentPosts];
      }

      return currentPosts.map((item) =>
        item.post.id === post.post.id ? post : item,
      );
    });
    setActivePostId(post.post.id);
    setActiveCardIndex(0);
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setDrawerReturnSurface("profile");
    setIsViewingFollowing(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setDetailReturnTarget(returnTarget);
    setActiveTab("discover");
  }

  function closePostDetail() {
    if (!detailReturnTarget) {
      return;
    }

    const target = detailReturnTarget;
    setDetailReturnTarget(null);
    setCommentPost(null);
    setInfoSheet(null);
    setEditorialPageState(null);
    setIsEditingProfile(false);
    setIsViewingNoticeList(false);
    setIsViewingSettings(false);
    setIsViewingFollowing(false);

    if (target.surface === "drawer") {
      setActiveTab("me");
      setIsSearching(false);
      setIsViewingDrawer(true);
      return;
    }

    setActiveTab(target.tab);
    setIsViewingDrawer(false);
    setIsViewingFollowing(false);
    setIsSearching(target.surface === "search");
  }

  function makeProfileReturnTarget(): ProfileReturnTarget | null {
    if (isViewingFollowing) {
      return { surface: "following" };
    }

    if (isViewingSettings) {
      return { surface: "settings" };
    }

    if (isViewingDrawer) {
      return { surface: "drawer", drawerReturnSurface };
    }

    if (isSearching) {
      return {
        surface: "search",
        tab: activeTab === "capture" ? "home" : activeTab,
      };
    }

    if (activeTab === "discover") {
      return { surface: "discover" };
    }

    if (activeTab !== "me" && activeTab !== "capture") {
      return { surface: "tab", tab: activeTab };
    }

    return null;
  }

  function closeProfile() {
    const target = profileReturnTarget;
    setProfileReturnTarget(null);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setIsViewingFollowing(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);

    if (!target) {
      setSelectedProfileId(currentAccount.id);
      return;
    }

    if (target.surface === "discover") {
      setActiveTab("discover");
      setIsSearching(false);
      return;
    }

    if (target.surface === "search") {
      setActiveTab(target.tab);
      setIsSearching(true);
      return;
    }

    if (target.surface === "drawer") {
      setActiveTab("me");
      setDrawerReturnSurface(target.drawerReturnSurface);
      setIsViewingDrawer(true);
      setIsSearching(false);
      return;
    }

    if (target.surface === "following") {
      setActiveTab("me");
      setIsViewingFollowing(true);
      setIsSearching(false);
      return;
    }

    if (target.surface === "settings") {
      setActiveTab("me");
      setIsViewingSettings(true);
      setIsSearching(false);
      return;
    }

    setActiveTab(target.tab);
    setIsSearching(false);
  }

  async function openProfile(account: AccountProfile) {
    trackSaegimEvent("Profile Opened", {
      is_own_profile: account.id === currentAccount.id,
      source_surface: currentAnalyticsSurface(),
      ...makeAccountAnalyticsProperties(account, "profile"),
    });

    if (account.id === currentAccount.id && !isSignedIn()) {
      setSelectedProfileId(currentAccount.id);
      setIsSearching(false);
      setIsEditingProfile(false);
      setIsViewingDrawer(false);
      setDrawerReturnSurface("profile");
      setIsViewingFollowing(false);
      setIsViewingSettings(false);
      setIsViewingNoticeList(false);
      setEditorialPageState(null);
      setCommentPost(null);
      setInfoSheet(null);
      setProfileReturnTarget(null);
      setActiveTab("me");
      return;
    }

    const returnTarget = makeProfileReturnTarget();
    upsertAccount(account);
    setSelectedProfileId(account.id);
    setProfileReturnTarget(returnTarget);
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setIsViewingFollowing(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setActiveTab("me");

    try {
      const detail = await fetchAccountDetail(account.handle);
      upsertAccount(detail.account);
      mergePosts(detail.posts);
    } catch {
      // 계정 상세 API가 실패해도 이미 가진 계정 정보로 프로필을 유지한다.
    }
  }

  async function movePost(direction: -1 | 1) {
    const nextIndex = activePostIndex + direction;
    const nextPost = posts[nextIndex];

    if (!nextPost && direction === 1) {
      const fetchedPosts = await loadMoreFeed();
      const firstFetchedPost = fetchedPosts[0];

      if (firstFetchedPost) {
        setActivePostId(firstFetchedPost.post.id);
        setActiveCardIndex(0);
        setCommentPost(null);
        setInfoSheet(null);
      }

      return;
    }

    if (!nextPost) {
      return;
    }

    setActivePostId(nextPost.post.id);
    setActiveCardIndex(0);
    setCommentPost(null);
    setInfoSheet(null);
  }

  function selectCard(index: number) {
    if (!activePost) {
      return;
    }

    setActiveCardIndex(
      Math.min(Math.max(index, 0), activePost.cards.length - 1),
    );
  }

  function openComments(post: PostBundle) {
    if (!requireSignedIn()) {
      return;
    }

    trackSaegimEvent(
      "Comments Opened",
      makePostAnalyticsProperties(post, {
        active_card_index: activeCardIndex,
        card_number: activeCardIndex + 1,
      }),
    );
    setInfoSheet(null);
    setCommentPost(post);
  }

  function openInfoSheet(post: PostBundle, cardIndex = activeCardIndex) {
    trackSaegimEvent(
      "Post Info Opened",
      makePostAnalyticsProperties(post, {
        active_card_index: cardIndex,
        card_number: cardIndex + 1,
      }),
    );
    setCommentPost(null);
    setInfoSheet({ postId: post.post.id });
  }

  useEffect(() => {
    const controller = new AbortController();

    async function restoreSession() {
      try {
        const session = await fetchAuthSession(controller.signal);
        if (session.authenticated) {
          setEntryState("signed-in");
        }
      } catch {
        // 세션이 없거나 API가 꺼져 있어도 게스트 탐색은 유지한다.
      }
    }

    void restoreSession();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      try {
        const [nextPostPage, nextAccountPage, nextEditorialPages] =
          await Promise.all([
            fetchFeed({ limit: listInitialCount }, controller.signal),
            fetchRecommendedAccounts({ limit: 12 }, controller.signal),
            fetchEditorialPages(controller.signal),
          ]);

        setPosts(nextPostPage.items);
        setFeedPageInfo(nextPostPage.pageInfo);
        setAccounts(nextAccountPage.items);
        setEditorialPages(nextEditorialPages);

        if (entryState === "signed-in") {
          try {
            const nextCurrentAccount = await fetchCurrentAccount(
              controller.signal,
            );
            setCurrentAccount(nextCurrentAccount);
            setSelectedProfileId(nextCurrentAccount.id);
          } catch {
            setCurrentAccount(guestAccount);
            setSelectedProfileId(null);
            setEntryState("guest");
          }
        }

        setInitialLoadState("ready");
      } catch {
        if (!controller.signal.aborted) {
          setPosts([]);
          setFeedPageInfo(emptyPageInfo);
          setAccounts([]);
          setEditorialPages([]);
          setInitialLoadState("error");
        }
      }
    }

    void loadInitialData();
    return () => controller.abort();
  }, [entryState, initialLoadRetryKey]);

  useEffect(() => {
    if (!activePost) {
      setActiveCardIndex(0);
      return;
    }

    setActiveCardIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(activePost.cards.length - 1, 0)),
    );
  }, [activePost?.cards.length, activePost?.post.id]);

  useEffect(() => {
    if (initialLoadState !== "ready" || hasAppliedInitialUrlTabRef.current) {
      return;
    }

    hasAppliedInitialUrlTabRef.current = true;
    skipNextTabUrlWriteRef.current = true;

    const initialRoute = readAppRouteFromLocation();
    if (initialRoute) {
      const routeState = readRouteHistoryState();
      activateAppRouteFromUrl(initialRoute, routeState);
      writeAppRouteToHistory(initialRoute, "replace", routeState);
    }
  }, [entryState, initialLoadState]);

  useEffect(() => {
    if (
      initialLoadState !== "ready" ||
      !hasAppliedInitialUrlTabRef.current
    ) {
      return;
    }

    if (skipNextTabUrlWriteRef.current) {
      skipNextTabUrlWriteRef.current = false;
      return;
    }

    const { route, state } = currentAppRouteForState();
    writeAppRouteToHistory(route, "push", state);
  }, [
    activePost?.post.id,
    activeTab,
    detailReturnTarget,
    editorialPageState,
    initialLoadState,
    isEditingProfile,
    isOwnProfile,
    isSearching,
    isViewingDrawer,
    isViewingFollowing,
    isViewingNoticeList,
    isViewingSettings,
    profileReturnTarget,
    selectedProfile.handle,
  ]);

  useEffect(() => {
    if (initialLoadState !== "ready") {
      return undefined;
    }

    function handlePopState() {
      const nextRoute = readAppRouteFromLocation() ?? {
        surface: "tab",
        tab: "home",
      };
      skipNextTabUrlWriteRef.current = true;
      activateAppRouteFromUrl(nextRoute, readRouteHistoryState());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    activeTab,
    currentAccount.id,
    entryState,
    featuredPost?.post.id,
    initialLoadState,
  ]);

  useEffect(() => {
    if (initialLoadState === "loading") {
      return;
    }

    if (entryState === "signed-in") {
      identifyAnalyticsAccount(currentAccount);
      return;
    }

    resetAnalyticsIdentity();
  }, [
    currentAccount.handle,
    currentAccount.id,
    currentAccount.postCount,
    currentAccount.verification,
    currentAccount.writingFriendCount,
    entryState,
    initialLoadState,
  ]);

  useEffect(() => {
    if (initialLoadState !== "ready") {
      return;
    }

    if (lastTrackedPageViewKeyRef.current === analyticsView.key) {
      return;
    }

    lastTrackedPageViewKeyRef.current = analyticsView.key;
    trackAnalyticsPageView(analyticsView.name, analyticsView.properties);
  }, [analyticsView, initialLoadState]);

  const content = useMemo(() => {
    if (legalDocumentKind) {
      return (
        <LegalDocumentView
          document={LEGAL_DOCUMENTS[legalDocumentKind]}
          onBack={() => {
            setLegalDocumentKind(null);
            setIsViewingSettings(true);
            setActiveTab("me");
          }}
        />
      );
    }

    if (selectedEditorialPage) {
      return (
        <EditorialPageView
          page={selectedEditorialPage}
          onBack={closeEditorialPage}
          onOpenDiscover={() => {
            if (featuredPost) {
              openPost(featuredPost);
              return;
            }

            setEditorialPageState(null);
            setActiveTab("discover");
          }}
        />
      );
    }

    if (isViewingNoticeList) {
      return (
        <NoticeListView
          onBack={() => {
            setIsViewingNoticeList(false);
            setIsViewingSettings(true);
            setActiveTab("me");
          }}
          onOpenPage={(page) => openEditorialPage(page, "notice-list")}
          pages={noticePages}
        />
      );
    }

    if (isSearching) {
      return (
        <SearchView
          onClose={() => setIsSearching(false)}
          onOpenPost={openPost}
          onOpenProfile={openProfile}
        />
      );
    }

    if (activeTab === "discover") {
      if (!activePost) {
        return <EmptyDiscoverView />;
      }

      return (
        <DiscoverView
          activeCardIndex={activeCardIndex}
          currentAccountId={currentAccount.id}
          nextPost={posts[activePostIndex + 1] ?? null}
          post={activePost}
          postCount={posts.length}
          postIndex={activePostIndex}
          previousPost={posts[activePostIndex - 1] ?? null}
          {...(detailReturnTarget ? { onBack: closePostDetail } : {})}
          onNextCard={() => selectCard(activeCardIndex + 1)}
          onNextPost={() => movePost(1)}
          onPreviousCard={() => selectCard(activeCardIndex - 1)}
          onPreviousPost={() => movePost(-1)}
          onSelectCard={selectCard}
          onToggleCarve={handleToggleCarve}
          onOpenComments={openComments}
          onOpenInfo={openInfoSheet}
          onOpenProfile={openProfile}
          onToggleFollow={handleToggleFollow}
          onToggleLike={handleToggleLike}
        />
      );
    }
    if (activeTab === "capture") {
      return (
        <CaptureView
          onClose={() => selectTab(captureReturnTab)}
          onPublished={handlePostPublished}
        />
      );
    }
    if (activeTab === "shelf") return <ShelfView onOpenPost={openPost} />;
    if (activeTab === "me") {
      if (isViewingSettings) {
        return (
          <SettingsView
            onBack={() => setIsViewingSettings(false)}
            onEditProfile={() => {
              if (!requireSignedIn("profile")) {
                return;
              }

              setIsViewingSettings(false);
              setIsEditingProfile(true);
            }}
            onLogout={leaveApp}
            onOpenDrawer={() => {
              setDrawerReturnSurface("settings");
              setIsViewingSettings(false);
              setIsViewingDrawer(true);
            }}
            onOpenFollowing={() => {
              setIsViewingSettings(false);
              setIsViewingFollowing(true);
            }}
            onOpenLegal={(kind) => setLegalDocumentKind(kind)}
            onOpenNotices={openNoticeList}
          />
        );
      }

      if (isViewingFollowing) {
        return (
          <FollowingView
            onBack={() => {
              setIsViewingFollowing(false);
              setIsViewingSettings(true);
            }}
            onOpenProfile={openProfile}
          />
        );
      }

      if (isViewingDrawer) {
        return (
          <DrawerView
            onBack={() => {
              setIsViewingDrawer(false);
              if (drawerReturnSurface === "settings") {
                setIsViewingSettings(true);
              } else {
                setDrawerReturnSurface("profile");
              }
            }}
            onOpenPost={openPost}
          />
        );
      }

      return isEditingProfile ? (
        <ProfileEditView
          account={currentAccount}
          onCancel={() => setIsEditingProfile(false)}
          onSubmit={handleUpdateProfile}
        />
      ) : (
        <ProfileView
          account={selectedProfile}
          onEdit={() => {
            if (requireSignedIn("profile")) {
              setIsEditingProfile(true);
            }
          }}
          isOwnProfile={isOwnProfile}
          onOpenPost={openPost}
          onBack={closeProfile}
          onOpenDrawer={() => {
            if (!requireSignedIn("profile")) {
              return;
            }

            setDrawerReturnSurface("profile");
            setIsViewingDrawer(true);
          }}
          onOpenSettings={() => {
            if (requireSignedIn("profile")) {
              setIsViewingSettings(true);
            }
          }}
          onToggleFollow={handleToggleFollow}
        />
      );
    }
    return (
      <HomeView
        posts={posts}
        accounts={accounts}
        currentAccountId={currentAccount.id}
        editorialPages={editorialPages}
        onOpenPost={openPost}
        onOpenAllPosts={() => selectTab("shelf")}
        onOpenEditorialPage={(page) => openEditorialPage(page, "home")}
        onOpenProfile={openProfile}
        onToggleFollow={handleToggleFollow}
      />
    );
  }, [
    accounts,
    activeCardIndex,
    activePost,
    activePostIndex,
    activeTab,
    captureReturnTab,
    currentAccount,
    detailReturnTarget,
    drawerReturnSurface,
    entryState,
    editorialPages,
    feedPageInfo,
    featuredPost,
    isEditingProfile,
    isLoadingMoreFeed,
    isSearching,
    isViewingDrawer,
    isViewingFollowing,
    isViewingNoticeList,
    isViewingSettings,
    isOwnProfile,
    legalDocumentKind,
    noticePages,
    posts,
    selectedEditorialPage,
    selectedProfile,
  ]);

  return (
    <main className="app-shell" aria-label="새김 앱">
      <section className={frameClassName}>
        {isDiscoverMode || isFullPage || isProfileTab ? null : (
          <header className="topbar">
            <div>
              <div
                className={activeTab === "home" ? "wordmark brand" : "wordmark"}
              >
                {topbar.title}
              </div>
              <p>{topbar.subtitle}</p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="검색"
              onClick={() => {
                trackSaegimEvent("Search Opened", {
                  source_surface: currentAnalyticsSurface(),
                });
                setCommentPost(null);
                setInfoSheet(null);
                setEditorialPageState(null);
                setIsViewingNoticeList(false);
                setIsViewingSettings(false);
                setIsSearching(true);
              }}
            >
              <SearchIcon />
            </button>
          </header>
        )}

        <div className="screen">{content}</div>

        {commentPost ? (
          <CommentSheet
            post={commentPost}
            onClose={() => setCommentPost(null)}
            onCommentSubmitted={(post, commentLength) => {
              trackSaegimEvent(
                "Comment Submitted",
                makePostAnalyticsProperties(post, {
                  comment_length: commentLength,
                }),
              );
            }}
            onPostChange={replacePost}
          />
        ) : null}

        {infoSheet && infoSheetPost ? (
          <PostInfoSheet
            onClose={() => setInfoSheet(null)}
            post={infoSheetPost}
          />
        ) : null}

        {isFullPage ? null : (
          <>
            <nav className="tabbar" aria-label="주요 메뉴">
              {(["home", "discover"] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  className={tabKey === activeNavTab ? "tab is-active" : "tab"}
                  type="button"
                  onClick={() => selectTab(tabKey)}
                  aria-label={tabLabels[tabKey]}
                  aria-current={tabKey === activeNavTab ? "page" : undefined}
                >
                  <TabIcon tab={tabKey} />
                </button>
              ))}
              <span className="tab tab-spacer" aria-hidden="true" />
              {(["shelf", "me"] as const).map((tabKey) => (
                <button
                  key={tabKey}
                  className={tabKey === activeNavTab ? "tab is-active" : "tab"}
                  type="button"
                  onClick={() => selectTab(tabKey)}
                  aria-label={
                    tabKey === "me" && !isSignedIn()
                      ? "나, 게스트"
                      : tabLabels[tabKey]
                  }
                  aria-current={tabKey === activeNavTab ? "page" : undefined}
                >
                  {tabKey === "me" ? (
                    isSignedIn() ? (
                      <Avatar
                        displayName={currentAccount.displayName}
                        photoUrl={currentAccount.photoUrl}
                        size="tab"
                      />
                    ) : (
                      <GuestTabAvatar />
                    )
                  ) : (
                    <TabIcon tab={tabKey} />
                  )}
                </button>
              ))}
            </nav>
            <button
              className="fab"
              type="button"
              aria-label={tabLabels.capture}
              onClick={() => selectTab("capture")}
            >
              <PlusIcon />
            </button>
          </>
        )}
        {authSheetIntent ? (
          <AuthSheet
            initialMode={authSheetInitialMode}
            onClose={() => setAuthSheetIntent(null)}
            onEnter={enterApp}
            onGoogleLogin={startGoogleOAuth}
          />
        ) : null}
        {initialLoadState !== "ready" ? (
          <AppLoadingOverlay
            state={initialLoadState}
            onRetry={retryInitialLoad}
          />
        ) : null}
      </section>
    </main>
  );
}

function AppLoadingOverlay({
  state,
  onRetry,
}: {
  state: Exclude<InitialLoadState, "ready">;
  onRetry: () => void;
}) {
  const isError = state === "error";

  return (
    <div className="app-loading-overlay" role="status" aria-live="polite">
      <div className="app-loading-content">
        <div className="app-loading-brand">새김</div>
        {isError ? (
          <>
            <strong>잠시 연결이 고르지 않아요.</strong>
            <p>화면을 다시 불러오면 이어서 둘러볼 수 있어요.</p>
            <button type="button" onClick={onRetry}>
              다시 불러오기
            </button>
          </>
        ) : (
          <>
            <span className="app-loading-line" aria-hidden="true" />
            <p>문장을 불러오고 있어요.</p>
          </>
        )}
      </div>
    </div>
  );
}

function AuthSheet({
  initialMode,
  onClose,
  onEnter,
  onGoogleLogin,
}: {
  initialMode: AuthMode;
  onClose: () => void;
  onEnter: (input: AuthSubmitInput) => Promise<void>;
  onGoogleLogin: (agreements: LegalAgreementInput) => void;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignup = mode === "signup";
  const submitLabel = isSubmitting
    ? "확인 중"
    : isSignup
      ? "가입하기"
      : "로그인";
  const passwordRuleText = "8자 이상, 영문과 숫자를 함께 입력해 주세요.";
  const currentAgreement: LegalAgreementInput = {
    terms: true,
    privacy: true,
    termsVersion: CURRENT_LEGAL_VERSIONS.terms,
    privacyVersion: CURRENT_LEGAL_VERSIONS.privacy,
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanDisplayName = displayName.trim();

    if (!cleanEmail) {
      setSubmitError("이메일을 입력해 주세요.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSubmitError("이메일 형식을 확인해 주세요.");
      return;
    }

    if (!cleanPassword) {
      setSubmitError("비밀번호를 입력해 주세요.");
      return;
    }

    if (isSignup && !isValidSignupPassword(cleanPassword)) {
      setSubmitError(`비밀번호는 ${passwordRuleText}`);
      return;
    }

    if (isSignup && !agreed) {
      setSubmitError("약관 동의가 필요해요.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onEnter({
        mode,
        displayName: cleanDisplayName,
        email: cleanEmail,
        password: cleanPassword,
        ...(isSignup ? { agreements: currentAgreement } : {}),
      });
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "로그인을 다시 시도해 주세요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleGoogleLogin() {
    setSubmitError("");

    if (!agreed) {
      setSubmitError("Google로 계속하려면 필수 약관 동의가 필요해요.");
      return;
    }

    onGoogleLogin(currentAgreement);
  }

  const agreementText = (
    <span>
      <a href="/terms" target="_blank" rel="noreferrer">
        이용약관
      </a>
      {" 및 "}
      <a href="/privacy" target="_blank" rel="noreferrer">
        개인정보 처리방침
      </a>
      에 동의합니다
    </span>
  );

  return (
    <>
      <button
        className="auth-sheet-backdrop"
        type="button"
        aria-label="로그인 패널 닫기"
        onClick={onClose}
      />
      <section className="auth-sheet" aria-label="로그인">
        <div className="sheet-grip" aria-hidden="true">
          <span />
        </div>
        <div className="auth-sheet-intro">
          <div className="auth-brand">새김</div>
        </div>

        <form className="auth-panel" noValidate onSubmit={handleSubmit}>
          <h3>{isSignup ? "계정 만들기" : "로그인"}</h3>

          {isSignup ? (
            <input
              aria-label="닉네임"
              className="auth-in"
              maxLength={20}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="닉네임"
              value={displayName}
            />
          ) : null}
          <input
            aria-label="이메일"
            autoComplete="email"
            className="auth-in"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일"
            type="email"
            value={email}
          />
          <input
            aria-label="비밀번호"
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="auth-in"
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isSignup ? "비밀번호" : "비밀번호"}
            type="password"
            value={password}
          />
          {isSignup ? <p className="auth-help">{passwordRuleText}</p> : null}

          {isSignup ? (
            <label className="auth-agree">
              <input
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                type="checkbox"
              />
              {agreementText}
            </label>
          ) : null}

          {submitError ? (
            <p className="auth-error" role="alert" aria-live="polite">
              {submitError}
            </p>
          ) : null}

          <button className="auth-btn" disabled={isSubmitting} type="submit">
            {submitLabel}
          </button>
        </form>

        {!isSignup ? (
          <>
            <div className="auth-div">
              <span>또는</span>
            </div>
            <label className="auth-agree auth-agree-oauth">
              <input
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                type="checkbox"
              />
              {agreementText}
            </label>
            <button
              className="auth-social google"
              type="button"
              onClick={handleGoogleLogin}
            >
              Google로 계속하기
            </button>
          </>
        ) : null}

        <div className="auth-alt">
          {isSignup ? "이미 계정이 있으신가요?" : "아직 계정이 없으신가요?"}{" "}
          <button
            type="button"
            onClick={() => {
              setSubmitError("");
              setMode(isSignup ? "login" : "signup");
            }}
          >
            {isSignup ? "로그인" : "회원가입"}
          </button>
        </div>

        <button className="auth-guest" type="button" onClick={onClose}>
          계속 둘러보기
        </button>
      </section>
    </>
  );
}

function isValidSignupPassword(password: string) {
  return (
    password.length >= 8 &&
    password.length <= 120 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

function SearchView({
  onClose,
  onOpenPost,
  onOpenProfile,
}: {
  onClose: () => void;
  onOpenPost: (post: PostBundle) => void;
  onOpenProfile: (account: AccountProfile) => void;
}) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<"all" | "accounts" | "posts">("all");
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [posts, setPosts] = useState<PostBundle[]>([]);
  const [accountPageInfo, setAccountPageInfo] =
    useState<PageInfo>(emptyPageInfo);
  const [postPageInfo, setPostPageInfo] = useState<PageInfo>(emptyPageInfo);
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [loadingMoreAccounts, setLoadingMoreAccounts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [error, setError] = useState("");
  const cleanQuery = query.trim();
  const popularPosts = posts;
  const visibleAccounts = segment === "posts" ? [] : accounts;
  const visiblePosts = segment === "accounts" ? [] : posts;

  async function loadMoreSearchAccounts() {
    if (
      !accountPageInfo.hasNextPage ||
      !accountPageInfo.nextCursor ||
      loadingMoreAccounts
    ) {
      return;
    }

    try {
      setLoadingMoreAccounts(true);
      const result = await fetchSearch(
        cleanQuery,
        {
          accountCursor: accountPageInfo.nextCursor,
          accountLimit: listLoadStep,
        },
        undefined,
      );
      setAccounts((currentAccounts) => {
        const accountIds = new Set(
          currentAccounts.map((account) => account.id),
        );
        return [
          ...currentAccounts,
          ...result.accounts.filter((account) => !accountIds.has(account.id)),
        ];
      });
      setAccountPageInfo(result.accountPageInfo);
    } catch {
      // 추가 검색 실패 시 기존 결과를 유지한다.
    } finally {
      setLoadingMoreAccounts(false);
    }
  }

  async function loadMoreSearchPosts() {
    if (
      !postPageInfo.hasNextPage ||
      !postPageInfo.nextCursor ||
      loadingMorePosts
    ) {
      return;
    }

    try {
      setLoadingMorePosts(true);
      const result = await fetchSearch(
        cleanQuery,
        { postCursor: postPageInfo.nextCursor, postLimit: listLoadStep },
        undefined,
      );
      setPosts((currentPosts) => {
        const postIds = new Set(currentPosts.map((post) => post.post.id));
        return [
          ...currentPosts,
          ...result.posts.filter((post) => !postIds.has(post.post.id)),
        ];
      });
      setPostPageInfo(result.postPageInfo);
    } catch {
      // 추가 검색 실패 시 기존 결과를 유지한다.
    } finally {
      setLoadingMorePosts(false);
    }
  }

  const popularLoadMoreRef = useServerLoadMore(
    !cleanQuery && postPageInfo.hasNextPage,
    loadingMorePosts,
    loadMoreSearchPosts,
  );
  const accountLoadMoreRef = useServerLoadMore(
    cleanQuery.length > 0 &&
      visibleAccounts.length > 0 &&
      accountPageInfo.hasNextPage,
    loadingMoreAccounts,
    loadMoreSearchAccounts,
  );
  const postLoadMoreRef = useServerLoadMore(
    cleanQuery.length > 0 &&
      visiblePosts.length > 0 &&
      postPageInfo.hasNextPage,
    loadingMorePosts,
    loadMoreSearchPosts,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadSearch() {
      try {
        setStatus("loading");
        setError("");
        const result = await fetchSearch(
          query,
          { accountLimit: listInitialCount, postLimit: listInitialCount },
          controller.signal,
        );
        setAccounts(result.accounts);
        setPosts(result.posts);
        setAccountPageInfo(result.accountPageInfo);
        setPostPageInfo(result.postPageInfo);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setAccounts([]);
          setPosts([]);
          setAccountPageInfo(emptyPageInfo);
          setPostPageInfo(emptyPageInfo);
          setStatus("idle");
          setError("검색 결과를 불러올 수 없어요.");
        }
      }
    }

    void loadSearch();
    return () => controller.abort();
  }, [query]);

  const isEmpty =
    cleanQuery.length > 0 &&
    status !== "loading" &&
    !error &&
    visibleAccounts.length === 0 &&
    visiblePosts.length === 0;

  return (
    <section className="search-view">
      <div className="search-head">
        <button
          className="back-icon"
          type="button"
          onClick={onClose}
          aria-label="검색 닫기"
        >
          ←
        </button>
        <label className="search-input">
          <SearchIcon />
          <input
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="계정 · 글 검색"
            value={query}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="검색어 지우기"
            >
              ×
            </button>
          ) : null}
        </label>
      </div>

      {cleanQuery ? (
        <div className="search-segments" aria-label="검색 결과 종류">
          {[
            ["all", "전체"],
            ["accounts", "계정"],
            ["posts", "글"],
          ].map(([key, label]) => (
            <button
              className={segment === key ? "is-active" : undefined}
              key={key}
              type="button"
              onClick={() => setSegment(key as "all" | "accounts" | "posts")}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {!cleanQuery ? (
        <section className="search-suggest">
          <div className="search-label">인기 있는 글</div>
          {popularPosts.length > 0 ? (
            <div className="masonry">
              {popularPosts.map((post) => (
                <PostPreviewButton
                  key={post.post.id}
                  post={post}
                  onOpenPost={onOpenPost}
                />
              ))}
            </div>
          ) : (
            <p className="search-empty">아직 보여줄 글이 없어요.</p>
          )}
          <LoadMoreSentinel
            hasMore={postPageInfo.hasNextPage}
            innerRef={popularLoadMoreRef}
          />
        </section>
      ) : null}

      {cleanQuery && visibleAccounts.length > 0 ? (
        <section className="search-section">
          <h2>계정</h2>
          <div className="search-account-list">
            {visibleAccounts.map((account) => (
              <AccountResultButton
                account={account}
                key={account.id}
                onOpenProfile={onOpenProfile}
              />
            ))}
          </div>
          <LoadMoreSentinel
            hasMore={accountPageInfo.hasNextPage}
            innerRef={accountLoadMoreRef}
          />
        </section>
      ) : null}

      {cleanQuery && visiblePosts.length > 0 ? (
        <section className="search-section">
          <h2>글</h2>
          <div className="masonry">
            {visiblePosts.map((post) => (
              <PostPreviewButton
                key={post.post.id}
                post={post}
                onOpenPost={onOpenPost}
              />
            ))}
          </div>
          <LoadMoreSentinel
            hasMore={postPageInfo.hasNextPage}
            innerRef={postLoadMoreRef}
          />
        </section>
      ) : null}

      {cleanQuery && status === "loading" ? (
        <p className="search-empty">찾는 중</p>
      ) : null}
      {isEmpty ? (
        <p className="search-empty">‘{cleanQuery}’에 대한 결과가 없어요.</p>
      ) : null}
      {error && visibleAccounts.length === 0 && visiblePosts.length === 0 ? (
        <p className="search-empty">{error}</p>
      ) : null}
    </section>
  );
}

function AccountResultButton({
  account,
  onOpenProfile,
}: {
  account: AccountProfile;
  onOpenProfile: (account: AccountProfile) => void;
}) {
  return (
    <button
      className="search-account-row"
      type="button"
      onClick={() => onOpenProfile(account)}
    >
      <Avatar displayName={account.displayName} photoUrl={account.photoUrl} />
      <div>
        <strong>
          <AccountName account={account} />
        </strong>
        <p>{account.tagline}</p>
        <small>
          글 {formatCount(account.postCount)}개 · 글벗{" "}
          {formatCount(account.writingFriendCount)}
        </small>
      </div>
    </button>
  );
}

function PostPreviewButton({
  hideAuthor = false,
  hideLikeCount = false,
  post,
  onOpenPost,
}: {
  hideAuthor?: boolean;
  hideLikeCount?: boolean;
  post: PostBundle;
  onOpenPost: (post: PostBundle) => void;
}) {
  const card = post.cards[0]!;
  const likeCount = post.viewerState?.likeCount ?? 0;
  const hasMeta = !hideAuthor || !hideLikeCount;

  return (
    <button
      className={
        post.post.cardCount > 1
          ? "shelf-card post-card-button has-page-badge"
          : "shelf-card post-card-button"
      }
      type="button"
      onClick={() => onOpenPost(post)}
      style={cardSurfaceStyle(card)}
    >
      {post.post.cardCount > 1 ? (
        <span className="page-badge">{post.post.cardCount}장</span>
      ) : null}
      <p className="sq" style={cardTextStyle(card.comp, 0.58)}>
        {card.text}
      </p>
      <footer className="sfoot">
        <strong className="st2">{post.post.title}</strong>
        {hasMeta ? (
          <span className="sm2">
            {hideAuthor ? null : (
              <>
                <span className="sby">
                  <AccountName account={post.author} />
                </span>
                {hideLikeCount ? null : <span className="dot">·</span>}
              </>
            )}
            {hideLikeCount ? null : (
              <span className="mtr">♡ {formatCount(likeCount)}</span>
            )}
          </span>
        ) : null}
      </footer>
    </button>
  );
}

function HomeView({
  posts,
  accounts,
  currentAccountId,
  editorialPages,
  onOpenPost,
  onOpenAllPosts,
  onOpenEditorialPage,
  onOpenProfile,
  onToggleFollow,
}: {
  posts: PostBundle[];
  accounts: AccountProfile[];
  currentAccountId: string;
  editorialPages: EditorialPage[];
  onOpenPost: (post: PostBundle) => void;
  onOpenAllPosts: () => void;
  onOpenEditorialPage: (page: EditorialPage) => void;
  onOpenProfile: (account: AccountProfile) => void;
  onToggleFollow: (accountId: string, subscribed: boolean) => void;
}) {
  const displayAccounts = accounts.filter(
    (account) => account.id !== currentAccountId,
  );
  const heroPost = posts[0] ?? null;
  const heroCard = heroPost?.cards[0] ?? null;
  const todayPosts = posts.slice(0, 5);
  const heroItems = [
    ...(heroPost && heroCard
      ? [
          {
            kind: "post" as const,
            key: heroPost.post.id,
            tag: "오늘 닿은 글",
            text: heroCard.text,
            by: `${heroPost.author.displayName} · 『${heroPost.post.title}』`,
            style: cardSurfaceStyle(heroCard),
            onOpen: () => onOpenPost(heroPost),
          },
        ]
      : []),
    ...editorialPages.map((page) => ({
      kind: "page" as const,
      key: page.id,
      tag: page.label,
      text: page.title,
      by: page.kind === "ad" ? "제휴 · 광고" : page.date,
      style: {
        "--cv-text": "#FBF8FC",
        background: editorialHeroBackgrounds[page.kind],
        color: "#FBF8FC",
      } as CSSProperties,
      onOpen: () => onOpenEditorialPage(page),
    })),
  ];
  const [heroIndex, setHeroIndex] = useState(0);
  const safeHeroIndex = Math.min(heroIndex, Math.max(heroItems.length - 1, 0));

  useEffect(() => {
    setHeroIndex(0);
  }, [heroPost?.post.id, editorialPages.length]);

  useEffect(() => {
    if (heroItems.length < 2) return undefined;

    const timer = window.setInterval(() => {
      setHeroIndex((currentIndex) => (currentIndex + 1) % heroItems.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [heroItems.length]);

  return (
    <div className="home-view">
      <div className="hero-carousel">
        {heroItems.length > 0 ? (
          <>
            <div className="hb-viewport">
              <div
                className="hb-track"
                style={{ transform: `translateX(-${safeHeroIndex * 100}%)` }}
              >
                {heroItems.map((item) => (
                  <button
                    className="hb-slide"
                    key={item.key}
                    type="button"
                    onClick={item.onOpen}
                    style={item.style}
                  >
                    <span className="hb-tag">{item.tag}</span>
                    <p className="hb-q">{item.text}</p>
                    <span className="hb-by">{item.by}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="hb-dots" aria-hidden="true">
              {heroItems.map((item, index) => (
                <button
                  aria-label={`${index + 1}번째 배너`}
                  className={index === safeHeroIndex ? "is-active" : undefined}
                  key={item.key}
                  type="button"
                  onClick={() => setHeroIndex(index)}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="home-empty-card">
            <strong>아직 준비된 글이 없어요.</strong>
            <p>새로운 글이 도착하면 이곳에서 먼저 보여드릴게요.</p>
          </div>
        )}
      </div>

      <section className="home-sec">
        <div className="home-h">
          오늘 닿은 글
          <button type="button" onClick={onOpenAllPosts}>
            전체 ›
          </button>
        </div>
        <div className="home-rail">
          {todayPosts.length > 0 ? (
            todayPosts.map((item) => (
              <PostPreviewButton
                key={item.post.id}
                post={item}
                onOpenPost={onOpenPost}
              />
            ))
          ) : (
            <p className="home-empty-inline">아직 공개된 글이 없어요.</p>
          )}
        </div>
      </section>

      <section className="home-sec">
        <div className="home-h">추천 글벗</div>
        <div className="home-rail account-rail">
          {displayAccounts.length > 0 ? (
            displayAccounts.map((account) => {
              const isSubscribed = account.viewerState?.subscribed ?? false;

              return (
                <article className="home-acct account-chip" key={account.id}>
                  <button
                    className="account-chip-main"
                    type="button"
                    onClick={() => onOpenProfile(account)}
                  >
                    <Avatar
                      displayName={account.displayName}
                      photoUrl={account.photoUrl}
                    />
                    <div>
                      <strong>
                        <AccountName account={account} />
                      </strong>
                      <p>{account.tagline}</p>
                      <small className="fol">
                        글 {formatCount(account.postCount)}개 · 글벗{" "}
                        {formatCount(account.writingFriendCount)}
                      </small>
                    </div>
                  </button>
                  <button
                    className={isSubscribed ? "is-subscribed" : undefined}
                    type="button"
                    aria-pressed={isSubscribed}
                    onClick={() => onToggleFollow(account.id, isSubscribed)}
                  >
                    {isSubscribed ? "구독중" : "구독"}
                  </button>
                </article>
              );
            })
          ) : (
            <p className="home-empty-inline">추천할 글벗이 아직 없어요.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyDiscoverView() {
  return (
    <section className="discover-view empty-discover">
      <div className="empty-discover-card">
        <strong>아직 발견할 글이 없어요.</strong>
        <p>새로운 글이 도착하면 이곳에서 이어서 보여드릴게요.</p>
      </div>
    </section>
  );
}

function DiscoverView({
  activeCardIndex,
  currentAccountId,
  nextPost,
  post,
  postCount,
  postIndex,
  previousPost,
  onBack,
  onNextCard,
  onNextPost,
  onPreviousCard,
  onPreviousPost,
  onSelectCard,
  onToggleCarve,
  onOpenComments,
  onOpenInfo,
  onOpenProfile,
  onToggleFollow,
  onToggleLike,
}: {
  activeCardIndex: number;
  currentAccountId: string;
  nextPost: PostBundle | null;
  post: PostBundle;
  postCount: number;
  postIndex: number;
  previousPost: PostBundle | null;
  onBack?: () => void;
  onNextCard: () => void;
  onNextPost: () => void;
  onPreviousCard: () => void;
  onPreviousPost: () => void;
  onSelectCard: (index: number) => void;
  onToggleCarve: (post: PostBundle) => void;
  onOpenComments: (post: PostBundle) => void;
  onOpenInfo: (post: PostBundle, cardIndex: number) => void;
  onOpenProfile: (account: AccountProfile) => void;
  onToggleFollow: (accountId: string, subscribed: boolean) => void;
  onToggleLike: (post: PostBundle) => void;
}) {
  const card = post.cards[activeCardIndex] ?? post.cards[0]!;
  const viewerState = post.viewerState;
  const isOwnPost = post.author.id === currentAccountId;
  const isSubscribed = viewerState?.subscribed ?? false;
  const hasPreviousPost = postIndex > 0;
  const hasNextPost = postIndex < postCount - 1;
  const hasPreviousCard = activeCardIndex > 0;
  const hasNextCard = activeCardIndex < post.cards.length - 1;
  const shouldShowTitle = post.post.title.trim() !== card.text.trim();
  const detailViewRef = useRef<HTMLElement | null>(null);
  const detailCarouselRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragResetTimerRef = useRef<number | null>(null);
  const hasPointerMovedRef = useRef(false);
  const suppressChromeToggleRef = useRef(false);
  const suppressChromeToggleTimerRef = useRef<number | null>(null);
  const wheelLockUntilRef = useRef(0);
  const [isChromeHidden, setIsChromeHidden] = useState(false);
  const [showDiscoverHint, setShowDiscoverHint] = useState(false);
  const [dragState, setDragState] = useState<DetailDragState | null>(null);
  const activeDragAxis = dragState?.axis;
  const discoverViewClassName = [
    "discover-view",
    isChromeHidden ? "is-chrome-hidden" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const dragTrackStyle = {
    "--detail-drag-x": `${dragState?.x ?? 0}px`,
    "--detail-drag-y": `${dragState?.y ?? 0}px`,
  } as CSSProperties;
  const dragTrackClassName = dragState?.isAnimating
    ? "detail-carousel-track is-animating"
    : "detail-carousel-track";

  function clearDragResetTimer() {
    if (dragResetTimerRef.current) {
      window.clearTimeout(dragResetTimerRef.current);
      dragResetTimerRef.current = null;
    }
  }

  function animateDetailMove(
    axis: "x" | "y",
    direction: -1 | 1,
    size: number,
    onMove: () => void,
  ) {
    clearDragResetTimer();
    setDragState({
      x: axis === "x" ? (direction > 0 ? -size : size) : 0,
      y: axis === "y" ? (direction > 0 ? -size : size) : 0,
      axis,
      isAnimating: true,
    });
    dragResetTimerRef.current = window.setTimeout(() => {
      onMove();
      setDragState(null);
      dragResetTimerRef.current = null;
    }, 230);
  }

  function suppressNextChromeToggle() {
    suppressChromeToggleRef.current = true;

    if (suppressChromeToggleTimerRef.current) {
      window.clearTimeout(suppressChromeToggleTimerRef.current);
    }

    suppressChromeToggleTimerRef.current = window.setTimeout(() => {
      suppressChromeToggleRef.current = false;
      suppressChromeToggleTimerRef.current = null;
    }, 180);
  }

  function isDetailChromeTarget(target: HTMLElement) {
    return Boolean(
      target.closest(
        "button, input, textarea, a, .detail-title, .writer-bar, .action-rail, .feed-controls, .page-dots, .discover-gesture-hint",
      ),
    );
  }

  function toggleDetailChrome() {
    markDiscoverHintSeen();
    setShowDiscoverHint(false);
    setIsChromeHidden((currentValue) => !currentValue);
  }

  function markDiscoverHintSeen() {
    try {
      window.localStorage.setItem(discoverGestureHintStorageKey, "seen");
    } catch {
      // 브라우저 저장소를 쓸 수 없으면 현재 세션에서만 숨긴다.
    }
  }

  function detailMoveSize(axis: "x" | "y") {
    if (axis === "x") {
      return Math.max(detailCarouselRef.current?.clientWidth ?? 1, 1);
    }

    return Math.max(detailViewRef.current?.clientHeight ?? 1, 1);
  }

  function moveCardWithAnimation(direction: -1 | 1) {
    if (dragState?.isAnimating) return;

    const canMove = direction > 0 ? hasNextCard : hasPreviousCard;
    if (!canMove) return;

    animateDetailMove("x", direction, detailMoveSize("x"), () => {
      if (direction > 0) onNextCard();
      else onPreviousCard();
    });
  }

  function movePostWithAnimation(direction: -1 | 1) {
    if (dragState?.isAnimating) return;

    const canMove = direction > 0 ? hasNextPost : hasPreviousPost;
    if (!canMove) return;

    animateDetailMove("y", direction, detailMoveSize("y"), () => {
      if (direction > 0) onNextPost();
      else onPreviousPost();
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement;

    if (
      dragState?.isAnimating ||
      isDetailChromeTarget(target)
    ) {
      return;
    }

    clearDragResetTimer();
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    hasPointerMovedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ x: 0, y: 0, axis: null, isAnimating: false });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const start = pointerStartRef.current;
    if (!start || dragState?.isAnimating) {
      return;
    }

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (Math.max(absX, absY) > 8) {
      hasPointerMovedRef.current = true;
    }
    const nextAxis =
      dragState?.axis ??
      (Math.max(absX, absY) > 10 ? (absX > absY ? "x" : "y") : null);

    if (!nextAxis) {
      setDragState({ x: 0, y: 0, axis: null, isAnimating: false });
      return;
    }

    if (nextAxis === "x") {
      const canMove = (dx < 0 && hasNextCard) || (dx > 0 && hasPreviousCard);
      setDragState({
        x: canMove ? dx : dx * 0.24,
        y: 0,
        axis: "x",
        isAnimating: false,
      });
      return;
    }

    const canMove = (dy < 0 && hasNextPost) || (dy > 0 && hasPreviousPost);
    setDragState({
      x: 0,
      y: canMove ? dy : dy * 0.24,
      axis: "y",
      isAnimating: false,
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = pointerStartRef.current;
    const currentDragState = dragState;
    const target = event.target as HTMLElement;
    pointerStartRef.current = null;
    if (hasPointerMovedRef.current) {
      suppressNextChromeToggle();
    }

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 포인터 캡처가 이미 해제된 경우에는 무시한다.
    }

    if (!start || !currentDragState) {
      return;
    }

    if (isDetailChromeTarget(target)) {
      setDragState(null);
      return;
    }

    const dx = currentDragState.x || event.clientX - start.x;
    const dy = currentDragState.y || event.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const movedDistance = Math.max(absX, absY);

    if (movedDistance <= 8 && !currentDragState.axis) {
      setDragState(null);

      if (!suppressChromeToggleRef.current) {
        toggleDetailChrome();
      }

      suppressChromeToggleRef.current = false;
      hasPointerMovedRef.current = false;
      return;
    }

    const axis = currentDragState.axis ?? (absX > absY ? "x" : "y");
    const threshold = Math.min(
      axis === "x"
        ? event.currentTarget.clientWidth * 0.2
        : event.currentTarget.clientHeight * 0.16,
      96,
    );

    if (axis === "y" && absY > threshold) {
      const direction = dy < 0 ? 1 : -1;
      const canMove = direction > 0 ? hasNextPost : hasPreviousPost;
      if (canMove) {
        const targetY =
          direction > 0
            ? -event.currentTarget.clientHeight
            : event.currentTarget.clientHeight;
        setDragState({ x: 0, y: targetY, axis: "y", isAnimating: true });
        dragResetTimerRef.current = window.setTimeout(() => {
          if (direction > 0) onNextPost();
          else onPreviousPost();
          setDragState(null);
          dragResetTimerRef.current = null;
        }, 230);
        return;
      }
    }

    if (axis === "x" && absX > threshold) {
      const direction = dx < 0 ? 1 : -1;
      const canMove = direction > 0 ? hasNextCard : hasPreviousCard;
      if (canMove) {
        const targetX =
          direction > 0
            ? -event.currentTarget.clientWidth
            : event.currentTarget.clientWidth;
        setDragState({ x: targetX, y: 0, axis: "x", isAnimating: true });
        dragResetTimerRef.current = window.setTimeout(() => {
          if (direction > 0) onNextCard();
          else onPreviousCard();
          setDragState(null);
          dragResetTimerRef.current = null;
        }, 230);
        return;
      }
    }

    setDragState({ x: 0, y: 0, axis, isAnimating: true });
    dragResetTimerRef.current = window.setTimeout(() => {
      setDragState(null);
      dragResetTimerRef.current = null;
    }, 180);
  }

  useEffect(() => {
    return () => {
      clearDragResetTimer();
      if (suppressChromeToggleTimerRef.current) {
        window.clearTimeout(suppressChromeToggleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setDragState(null);
    pointerStartRef.current = null;
  }, [activeCardIndex, post.post.id]);

  function handlePointerCancel() {
    pointerStartRef.current = null;
    hasPointerMovedRef.current = false;
    suppressNextChromeToggle();
    if (dragState) {
      setDragState({ x: 0, y: 0, axis: dragState.axis, isAnimating: true });
      clearDragResetTimer();
      dragResetTimerRef.current = window.setTimeout(() => {
        setDragState(null);
        dragResetTimerRef.current = null;
      }, 180);
    }
  }

  function handleWheel(event: ReactWheelEvent<HTMLElement>) {
    if (
      dragState?.isAnimating ||
      isDetailChromeTarget(event.target as HTMLElement)
    ) {
      return;
    }

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);
    if (Math.max(absX, absY) < 18) {
      return;
    }

    const now = Date.now();
    if (now < wheelLockUntilRef.current) {
      event.preventDefault();
      return;
    }

    const axis: "x" | "y" = event.shiftKey || absX > absY ? "x" : "y";
    const delta =
      axis === "x"
        ? event.shiftKey && absY >= absX
          ? event.deltaY
          : event.deltaX
        : event.deltaY;
    const direction: -1 | 1 = delta > 0 ? 1 : -1;
    const canMove =
      axis === "x"
        ? direction > 0
          ? hasNextCard
          : hasPreviousCard
        : direction > 0
          ? hasNextPost
          : hasPreviousPost;

    event.preventDefault();
    if (!canMove) {
      wheelLockUntilRef.current = now + 180;
      setDragState({ x: 0, y: 0, axis, isAnimating: true });
      clearDragResetTimer();
      dragResetTimerRef.current = window.setTimeout(() => {
        setDragState(null);
        dragResetTimerRef.current = null;
      }, 160);
      return;
    }

    wheelLockUntilRef.current = now + 430;
    animateDetailMove(
      axis,
      direction,
      axis === "x"
        ? event.currentTarget.clientWidth
        : event.currentTarget.clientHeight,
      () => {
        if (axis === "x") {
          if (direction > 0) onNextCard();
          else onPreviousCard();
          return;
        }

        if (direction > 0) onNextPost();
        else onPreviousPost();
      },
    );
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === "ArrowUp" && hasPreviousPost) {
        event.preventDefault();
        movePostWithAnimation(-1);
      }
      if (event.key === "ArrowDown" && hasNextPost) {
        event.preventDefault();
        movePostWithAnimation(1);
      }
      if (event.key === "ArrowLeft" && hasPreviousCard) {
        event.preventDefault();
        moveCardWithAnimation(-1);
      }
      if (event.key === "ArrowRight" && hasNextCard) {
        event.preventDefault();
        moveCardWithAnimation(1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    hasNextCard,
    hasNextPost,
    hasPreviousCard,
    hasPreviousPost,
    dragState?.isAnimating,
    onNextCard,
    onNextPost,
    onPreviousCard,
    onPreviousPost,
  ]);

  useEffect(() => {
    try {
      setShowDiscoverHint(
        window.localStorage.getItem(discoverGestureHintStorageKey) !== "seen",
      );
    } catch {
      setShowDiscoverHint(true);
    }
  }, []);

  useEffect(() => {
    if (!showDiscoverHint) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      markDiscoverHintSeen();
      setShowDiscoverHint(false);
    }, 5200);

    return () => window.clearTimeout(timer);
  }, [showDiscoverHint]);

  return (
    <article
      className={discoverViewClassName}
      ref={detailViewRef}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      {onBack ? (
        <button
          className="detail-back"
          type="button"
          onClick={onBack}
          aria-label="이전 화면으로 돌아가기"
        >
          ←
        </button>
      ) : null}
      {shouldShowTitle ? (
        <div className="detail-title">{post.post.title}</div>
      ) : null}
      {showDiscoverHint && !isChromeHidden ? (
        <div className="discover-gesture-hint" role="status">
          위아래로 글, 좌우로 장을 넘겨요
        </div>
      ) : null}
      <div className="feed-controls" aria-label="글 이동">
        <button
          type="button"
          onClick={() => movePostWithAnimation(-1)}
          disabled={!hasPreviousPost}
          aria-label="이전 글"
        >
          ↑
        </button>
        <span>
          {postIndex + 1}/{postCount}
        </span>
        <button
          type="button"
          onClick={() => movePostWithAnimation(1)}
          disabled={!hasNextPost}
          aria-label="다음 글"
        >
          ↓
        </button>
      </div>
      <div
        className="detail-carousel"
        style={dragTrackStyle}
        ref={detailCarouselRef}
      >
        <div className={dragTrackClassName}>
          {hasPreviousCard ? (
            <DetailCardSurface
              className={`is-prev-card${activeDragAxis === "x" ? " is-adjacent-active" : ""}`}
              cardIndex={activeCardIndex - 1}
              post={post}
            />
          ) : null}
          {hasNextCard ? (
            <DetailCardSurface
              className={`is-next-card${activeDragAxis === "x" ? " is-adjacent-active" : ""}`}
              cardIndex={activeCardIndex + 1}
              post={post}
            />
          ) : null}
          {previousPost ? (
            <DetailCardSurface
              className={`is-prev-post${activeDragAxis === "y" ? " is-adjacent-active" : ""}`}
              cardIndex={0}
              post={previousPost}
            />
          ) : null}
          {nextPost ? (
            <DetailCardSurface
              className={`is-next-post${activeDragAxis === "y" ? " is-adjacent-active" : ""}`}
              cardIndex={0}
              post={nextPost}
            />
          ) : null}
          <DetailCardSurface
            className="is-current"
            cardIndex={activeCardIndex}
            post={post}
          />
        </div>

        {post.cards.length > 1 ? (
          <button
            className="card-step card-step-prev"
            type="button"
            onClick={() => moveCardWithAnimation(-1)}
            disabled={!hasPreviousCard}
            aria-label="이전 장"
          >
            ‹
          </button>
        ) : null}
        {post.cards.length > 1 ? (
          <button
            className="card-step card-step-next"
            type="button"
            onClick={() => moveCardWithAnimation(1)}
            disabled={!hasNextCard}
            aria-label="다음 장"
          >
            ›
          </button>
        ) : null}
      </div>
      {post.cards.length > 1 ? (
        <div className="page-dots" aria-label="장 이동">
          {post.cards.map((item, index) => (
            <button
              key={item.id}
              className={index === activeCardIndex ? "is-active" : undefined}
              type="button"
              onClick={() => onSelectCard(index)}
              aria-label={`${index + 1}장 보기`}
              aria-current={index === activeCardIndex ? "true" : undefined}
            />
          ))}
        </div>
      ) : null}
      <div className="writer-bar">
        <button
          className="writer-identity"
          type="button"
          onClick={() => onOpenProfile(post.author)}
        >
          <Avatar
            displayName={post.author.displayName}
            photoUrl={post.author.photoUrl}
          />
          <strong>
            <AccountName account={post.author} />
          </strong>
        </button>
        {isOwnPost ? null : (
          <button
            className={isSubscribed ? "is-subscribed" : undefined}
            type="button"
            aria-pressed={isSubscribed}
            onClick={() => onToggleFollow(post.author.id, isSubscribed)}
          >
            {isSubscribed ? "구독중" : "구독"}
          </button>
        )}
      </div>
      <aside className="action-rail" aria-label="글 행동">
        <button
          className={viewerState?.carved ? "is-on" : undefined}
          type="button"
          aria-label={viewerState?.carved ? "새김 취소" : "새김"}
          onClick={() => onToggleCarve(post)}
        >
          <span className="ring">
            <BookmarkIcon filled={Boolean(viewerState?.carved)} />
          </span>
        </button>
        <button
          className={viewerState?.liked ? "is-on" : undefined}
          type="button"
          aria-label={viewerState?.liked ? "좋아요 취소" : "좋아요"}
          onClick={() => onToggleLike(post)}
        >
          <span className="ring">
            <HeartIcon filled={Boolean(viewerState?.liked)} />
          </span>
          <small>{formatCount(viewerState?.likeCount ?? 0)}</small>
        </button>
        <button
          type="button"
          aria-label="댓글"
          onClick={() => onOpenComments(post)}
        >
          <span className="ring">
            <CommentIcon />
          </span>
          <small>{formatCount(viewerState?.commentCount ?? 0)}</small>
        </button>
        <button
          className="more-action"
          type="button"
          aria-label="더보기"
          onClick={() => onOpenInfo(post, activeCardIndex)}
        >
          <span className="ring">
            <MoreIcon />
          </span>
        </button>
      </aside>
    </article>
  );
}

function DetailCardSurface({
  cardIndex,
  className,
  post,
}: {
  cardIndex: number;
  className: string;
  post: PostBundle;
}) {
  const card = post.cards[cardIndex] ?? post.cards[0]!;

  return (
    <div
      className={`sentence-card discover-card detail-card-surface ${className}`}
      style={cardSurfaceStyle(card)}
      aria-hidden={className !== "is-current" ? "true" : undefined}
    >
      <CardBackgroundImageLayer comp={card.comp} />
      <div className="cv-grain" aria-hidden="true" />
      <div className="cmp-layer">
        <p className="cmp-text" style={cardTextStyle(card.comp, 1, true)}>
          {card.text}
        </p>
        {cardSourceLabel(card) ? (
          <div className="cmp-src" style={cardSourceStyle(card.comp)}>
            {cardSourceLabel(card)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PostInfoSheet({
  onClose,
  post,
}: {
  onClose: () => void;
  post: PostBundle;
}) {
  const card = post.cards[0]!;
  const dragRef = useRef<{ pointerId: number; startY: number } | null>(null);
  const mouseDragRef = useRef<{ startY: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const tags = card.tags.filter(Boolean);
  const sheetStyle = { "--info-sheet-drag-y": `${dragY}px` } as CSSProperties;

  function finishSheetDrag(nextY: number) {
    dragRef.current = null;
    mouseDragRef.current = null;
    setIsDragging(false);

    if (nextY > 76) {
      onClose();
      return;
    }

    setDragY(0);
  }

  useEffect(() => {
    function handleMouseMove(event: MouseEvent) {
      const drag = mouseDragRef.current;
      if (!drag) return;

      setDragY(Math.max(0, event.clientY - drag.startY));
    }

    function handleMouseUp(event: MouseEvent) {
      const drag = mouseDragRef.current;
      if (!drag) return;

      finishSheetDrag(Math.max(0, event.clientY - drag.startY));
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  });

  function handleGripMouseDown(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;

    mouseDragRef.current = { startY: event.clientY };
    setIsDragging(true);
    event.preventDefault();
  }

  function handleGripPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleGripPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextY = Math.max(0, event.clientY - drag.startY);
    setDragY(nextY);
  }

  function handleGripPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const nextY = Math.max(0, event.clientY - drag.startY);
    finishSheetDrag(nextY);
  }

  function handleGripPointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    finishSheetDrag(0);
  }

  function handleGripKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    onClose();
  }

  return (
    <>
      <button
        className="comment-backdrop"
        type="button"
        aria-label="정보 닫기"
        onClick={onClose}
      />
      <section
        className={isDragging ? "info-sheet is-dragging" : "info-sheet"}
        aria-label="정보"
        style={sheetStyle}
      >
        <div
          className="sheet-grip"
          aria-label="정보 패널 닫기"
          onKeyDown={handleGripKeyDown}
          onMouseDown={handleGripMouseDown}
          onPointerCancel={handleGripPointerCancel}
          onPointerDown={handleGripPointerDown}
          onPointerMove={handleGripPointerMove}
          onPointerUp={handleGripPointerEnd}
          role="button"
          tabIndex={0}
        >
          <span />
        </div>
        <div className="info-sheet-head">
          <strong>정보</strong>
        </div>

        <div className="info-summary">
          <Avatar
            displayName={post.author.displayName}
            photoUrl={post.author.photoUrl}
            size="mini"
          />
          <div>
            <strong>{post.post.title}</strong>
            <span>
              <AccountName account={post.author} />
            </span>
          </div>
        </div>

        <div className="info-fields">
          <div className="info-field">
            <span>출처</span>
            <strong>{formatSource(card.source)}</strong>
            <small>{sourceKindLabel(card.source)}</small>
          </div>
          <div className="info-field">
            <span>태그</span>
            {tags.length > 0 ? (
              <div className="info-tags">
                {tags.map((tag) => (
                  <small key={tag}>{tag}</small>
                ))}
              </div>
            ) : (
              <strong>아직 태그가 없어요.</strong>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function CommentSheet({
  post,
  onClose,
  onCommentSubmitted,
  onPostChange,
}: {
  post: PostBundle;
  onClose: () => void;
  onCommentSubmitted: (post: PostBundle, commentLength: number) => void;
  onPostChange: (post: PostBundle) => void;
}) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"loading" | "idle" | "submitting">(
    "loading",
  );
  const [error, setError] = useState("");
  const canSubmit = body.trim().length > 0 && status !== "submitting";

  useEffect(() => {
    const controller = new AbortController();

    async function loadComments() {
      try {
        setStatus("loading");
        setError("");
        const nextComments = await fetchPostComments(
          post.post.id,
          controller.signal,
        );
        setComments(nextComments);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("idle");
          setError("댓글을 불러올 수 없어요.");
        }
      }
    }

    void loadComments();
    return () => controller.abort();
  }, [post.post.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanBody = body.trim();
    if (!cleanBody) {
      setError("댓글을 입력해 주세요.");
      return;
    }

    try {
      setStatus("submitting");
      setError("");
      const result = await createPostComment(post.post.id, { body: cleanBody });
      setComments((currentComments) => [...currentComments, result.item]);
      setBody("");
      onPostChange(result.post);
      onCommentSubmitted(result.post, cleanBody.length);
      setStatus("idle");
    } catch {
      setStatus("idle");
      setError("댓글을 남길 수 없어요. 잠시 뒤 다시 시도해 주세요.");
    }
  }

  return (
    <>
      <button
        className="comment-backdrop"
        type="button"
        aria-label="댓글 닫기"
        onClick={onClose}
      />
      <section className="comment-sheet" aria-label="댓글">
        <div className="sheet-grip" aria-hidden="true">
          <span />
        </div>
        <div className="comment-sheet-head">
          <div>
            <strong>댓글</strong>
            <span>{formatCount(comments.length)}개</span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="comment-list">
          {status === "loading" ? (
            <p className="comment-empty">불러오는 중</p>
          ) : null}
          {status !== "loading" && !error && comments.length === 0 ? (
            <p className="comment-empty">아직 댓글이 없어요.</p>
          ) : null}
          {comments.map((comment) => (
            <article className="comment-item" key={comment.id}>
              <Avatar
                displayName={comment.author.displayName}
                photoUrl={comment.author.photoUrl}
                size="mini"
              />
              <div>
                <header>
                  <strong>
                    <AccountName account={comment.author} />
                  </strong>
                  <time dateTime={comment.createdAt}>
                    {formatCommentDate(comment.createdAt)}
                  </time>
                </header>
                <p>{comment.body}</p>
              </div>
            </article>
          ))}
        </div>

        <form className="comment-form" onSubmit={handleSubmit}>
          <input
            aria-label="댓글 입력"
            maxLength={300}
            onChange={(event) => setBody(event.target.value)}
            placeholder="댓글 남기기"
            value={body}
          />
          <button type="submit" disabled={!canSubmit}>
            남기기
          </button>
        </form>
        {error ? <p className="comment-error">{error}</p> : null}
      </section>
    </>
  );
}

function CaptureView({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: (post: PostBundle) => void;
}) {
  const [cards, setCards] = useState<CaptureDraftCard[]>(() => [
    createCaptureDraftCard(),
  ]);
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [selectedTool, setSelectedTool] = useState<CaptureSheetKey | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [sourceWork, setSourceWork] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState("");
  const [confirmState, setConfirmState] = useState<CaptureConfirmState | null>(
    null,
  );
  const [captureDragTarget, setCaptureDragTarget] =
    useState<CaptureDragTarget | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const captureDragRef = useRef<CapturePointerDrag | null>(null);
  const imageCropDragRef = useRef<CaptureImageCropDrag | null>(null);
  const activeDraft = cards[activeDraftIndex] ?? cards[0]!;
  const activeSentence = activeDraft.text;
  const activeComp = activeDraft.comp;
  const activeBgImage = activeComp.bgImage ?? null;
  const activeBackgroundOption = captureBackgroundOptions.find((background) =>
    isSameBackgroundOption(background, activeComp),
  );
  const solidBackgroundColor =
    solidColorFromBackground(activeComp.bg) ?? captureSolidColorOptions[0];
  const customTextColor = /^#[0-9a-fA-F]{6}$/.test(activeComp.textColor)
    ? activeComp.textColor
    : "#38323F";
  const captureStageStyle = {
    ...cardCompositionSurfaceStyle(activeComp),
    "--capture-text": activeComp.textColor,
    color: activeComp.textColor,
  } as CSSProperties;
  const captureTextBoxStyle = {
    left: `${activeComp.textPos?.xp ?? 50}%`,
    top: `${activeComp.textPos?.yp ?? 45}%`,
  } as CSSProperties;
  const captureSourceChipStyle = activeComp.sourcePos
    ? ({
        left: `${activeComp.sourcePos.xp}%`,
        top: `${activeComp.sourcePos.yp}%`,
        bottom: "auto",
        transform: "translate(-50%, -50%)",
      } as CSSProperties)
    : undefined;
  const tagList = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 3);
  const canPublish =
    cards.some((card) => card.text.trim().length > 0) &&
    status !== "submitting";
  const canAddDraftCard = cards.length < maxCaptureDraftCards;

  useEffect(() => {
    const textarea = textAreaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [activeSentence, activeComp.size, activeDraftIndex]);

  useEffect(() => {
    if (!confirmState) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && status !== "submitting") {
        setConfirmState(null);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmState, status]);

  function updateActiveDraft(
    updater: (draft: CaptureDraftCard) => CaptureDraftCard,
  ) {
    setCards((currentCards) =>
      currentCards.map((card, index) =>
        index === activeDraftIndex ? updater(card) : card,
      ),
    );
  }

  function updateActiveComp(
    updater: (comp: CardComposition) => CardComposition,
  ) {
    updateActiveDraft((draft) => ({
      ...draft,
      comp: updater(draft.comp),
    }));
  }

  function updateActiveSentence(value: string) {
    updateActiveDraft((draft) => ({
      ...draft,
      text: value,
    }));
  }

  function applyBackgroundOption(
    background: (typeof captureBackgroundOptions)[number],
  ) {
    updateActiveComp((comp) => ({
      ...comp,
      bg: background.bg,
      dim: background.dim,
      textColor: background.textColor,
      bgImage: null,
    }));
  }

  function applySolidBackground(color: string) {
    updateActiveComp((comp) => ({
      ...comp,
      bg: color,
      dim: 0,
      textColor: isLightHexColor(color) ? "#38323F" : "#F4EFF6",
      bgImage: null,
    }));
  }

  function updateBackgroundImage(
    updater: (image: CardBackgroundImage) => CardBackgroundImage,
  ) {
    updateActiveComp((comp) =>
      comp.bgImage ? { ...comp, bgImage: updater(comp.bgImage) } : comp,
    );
  }

  function handleBackgroundImageSelect(
    event: ReactChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!captureImageAcceptedTypes.has(file.type)) {
      setError("JPG, PNG, WebP, AVIF 이미지만 올릴 수 있어요.");
      return;
    }

    if (file.size > captureImageMaxBytes) {
      setError("지금 미리보기는 5MB 이하 이미지만 받아요.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const url = typeof reader.result === "string" ? reader.result : "";

      if (!url) {
        setError("사진을 읽을 수 없어요. 다른 이미지를 골라 주세요.");
        return;
      }

      const image = new Image();

      image.onload = () => {
        updateActiveComp((comp) => ({
          ...comp,
          bg: "#353039",
          dim: Math.max(comp.dim, 0.34),
          textColor: "#FBF8FC",
          bgImage: {
            url,
            alt: file.name,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            focalX: 50,
            focalY: 50,
            zoom: 1,
          },
        }));
        setError("");
      };

      image.onerror = () => {
        setError("사진을 읽을 수 없어요. 다른 이미지를 골라 주세요.");
      };

      image.src = url;
    };

    reader.onerror = () => {
      setError("사진을 읽을 수 없어요. 다른 이미지를 골라 주세요.");
    };

    reader.readAsDataURL(file);
  }

  function removeBackgroundImage() {
    updateActiveComp((comp) => ({
      ...comp,
      dim: 0,
      bgImage: null,
    }));
    setError("");
  }

  function beginImageCropDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!activeBgImage) return;

    imageCropDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseFocalX: activeBgImage.focalX,
      baseFocalY: activeBgImage.focalY,
      zoom: activeBgImage.zoom,
      rect: event.currentTarget.getBoundingClientRect(),
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveImageCropDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = imageCropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const speed = Math.max(drag.zoom, 1);
    const nextFocalX = clampNumber(
      drag.baseFocalX -
        ((event.clientX - drag.startX) / drag.rect.width) * (100 / speed),
      0,
      100,
    );
    const nextFocalY = clampNumber(
      drag.baseFocalY -
        ((event.clientY - drag.startY) / drag.rect.height) * (100 / speed),
      0,
      100,
    );

    updateBackgroundImage((image) => ({
      ...image,
      focalX: nextFocalX,
      focalY: nextFocalY,
    }));
    event.preventDefault();
  }

  function endImageCropDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = imageCropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    imageCropDragRef.current = null;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 캡처가 해제된 경우에는 무시한다.
    }
  }

  function addDraftCard() {
    if (!canAddDraftCard) {
      setError(`한 글은 최대 ${maxCaptureDraftCards}장까지 작성할 수 있어요.`);
      return;
    }

    setCards([...cards, createCaptureDraftCard(activeComp)]);
    setActiveDraftIndex(cards.length);
    setError("");
  }

  function removeDraftCard() {
    if (cards.length <= 1) {
      return;
    }

    setConfirmState({
      kind: "delete",
      index: activeDraftIndex,
      cardNumber: activeDraftIndex + 1,
    });
  }

  function deleteDraftCard(index: number) {
    const nextCards = cards.filter((_, cardIndex) => cardIndex !== index);
    setCards(nextCards);
    setActiveDraftIndex(Math.min(index, nextCards.length - 1));
    setError("");
    setConfirmState(null);
  }

  function beginCaptureDrag(
    target: CaptureDragTarget,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const targetRect = event.currentTarget.getBoundingClientRect();
    const halfWidthPercent = (targetRect.width / 2 / rect.width) * 100;
    const halfHeightPercent = (targetRect.height / 2 / rect.height) * 100;
    const baseTextPos = activeComp.textPos ?? { xp: 50, yp: 45 };
    const baseSourcePos = activeComp.sourcePos ?? { xp: 50, yp: 82 };
    const basePosition = target === "source" ? baseSourcePos : baseTextPos;

    captureDragRef.current = {
      pointerId: event.pointerId,
      target,
      startX: event.clientX,
      startY: event.clientY,
      baseXp: basePosition.xp,
      baseYp: basePosition.yp,
      baseSize: activeComp.size,
      moved: false,
      rect,
      minXp: target === "resize" ? 6 : clampNumber(halfWidthPercent + 2, 6, 48),
      maxXp:
        target === "resize"
          ? 94
          : clampNumber(100 - halfWidthPercent - 2, 52, 94),
      minYp:
        target === "resize" ? 8 : clampNumber(halfHeightPercent + 2, 8, 44),
      maxYp:
        target === "resize"
          ? 92
          : clampNumber(100 - halfHeightPercent - 2, 56, 92),
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    setCaptureDragTarget(target);

    if (target === "resize") {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function moveCaptureDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = captureDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const movedEnough =
      Math.abs(event.clientX - drag.startX) > 3 ||
      Math.abs(event.clientY - drag.startY) > 3;
    drag.moved = drag.moved || movedEnough;

    if (drag.target === "resize") {
      const delta =
        (event.clientX - drag.startX + event.clientY - drag.startY) / 2;
      const nextSize = Math.round(
        clampNumber(drag.baseSize + delta * 0.35, 16, 84),
      );
      updateActiveComp((comp) => ({
        ...comp,
        size: nextSize,
      }));
      event.preventDefault();
      return;
    }

    if (!drag.moved) return;

    const nextPosition = {
      xp: clampNumber(
        drag.baseXp + ((event.clientX - drag.startX) / drag.rect.width) * 100,
        drag.minXp,
        drag.maxXp,
      ),
      yp: clampNumber(
        drag.baseYp + ((event.clientY - drag.startY) / drag.rect.height) * 100,
        drag.minYp,
        drag.maxYp,
      ),
    };

    updateActiveComp((comp) => ({
      ...comp,
      ...(drag.target === "source"
        ? { sourcePos: nextPosition }
        : { textPos: nextPosition }),
    }));
    event.preventDefault();
  }

  function endCaptureDrag(event: ReactPointerEvent<HTMLElement>) {
    const drag = captureDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    captureDragRef.current = null;
    setCaptureDragTarget(null);

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // 이미 캡처가 해제된 경우에는 무시한다.
    }

    if (drag.target === "text" && !drag.moved) {
      textAreaRef.current?.focus();
    }
  }

  function resetCaptureDrafts() {
    setCards([createCaptureDraftCard()]);
    setActiveDraftIndex(0);
    setTitle("");
    setSourceAuthor("");
    setSourceWork("");
    setTags("");
    setSelectedTool(null);
  }

  function createPostInputFromDrafts() {
    const cleanCards = cards
      .map((card) => ({
        ...card,
        text: card.text.trim(),
      }))
      .filter((card) => card.text.length > 0);

    if (cleanCards.length === 0) {
      setError("문장을 먼저 적어 주세요.");
      return null;
    }

    if (cleanCards.length > maxCaptureDraftCards) {
      setError(`한 글은 최대 ${maxCaptureDraftCards}장까지 발행할 수 있어요.`);
      return null;
    }

    const cleanTitle = title.trim();
    const cleanAuthor = sourceAuthor.trim();
    const cleanWork = sourceWork.trim();
    const skippedEmptyCardCount = cards.length - cleanCards.length;
    const input: CreatePostInput = {
      visibility: "public",
      creationType: "original",
      cards: cleanCards.map((card) => ({
        text: card.text,
        comp: card.comp,
        source: {
          kind: "direct",
          ...(cleanAuthor ? { author: cleanAuthor } : {}),
          ...(cleanWork ? { work: cleanWork } : {}),
        },
        tags: tagList,
      })),
    };

    if (cleanTitle) {
      input.title = cleanTitle;
    }

    return { input, cardCount: cleanCards.length, skippedEmptyCardCount };
  }

  async function publishPost(input: CreatePostInput) {
    try {
      setStatus("submitting");
      setError("");
      const publishedPost = await createPost(input);
      resetCaptureDrafts();
      onPublished(publishedPost);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "발행할 수 없어요. 잠시 뒤 다시 시도해 주세요.",
      );
    } finally {
      setStatus("idle");
      setConfirmState(null);
    }
  }

  function handleConfirmAction() {
    if (!confirmState || status === "submitting") {
      return;
    }

    if (confirmState.kind === "delete") {
      deleteDraftCard(confirmState.index);
      return;
    }

    void publishPost(confirmState.input);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextPost = createPostInputFromDrafts();

    if (!nextPost) {
      return;
    }

    setSelectedTool(null);
    setError("");
    setConfirmState({
      kind: "publish",
      input: nextPost.input,
      cardCount: nextPost.cardCount,
      skippedEmptyCardCount: nextPost.skippedEmptyCardCount,
    });
  }

  const confirmCopy = confirmState
    ? confirmState.kind === "delete"
      ? {
          title: `${confirmState.cardNumber}번째 장을 삭제할까요?`,
          desc: "이 장의 문장·배경·출처가 사라져요. 되돌릴 수 없어요.",
          ok: "삭제",
        }
      : {
          title: "이 글을 발행할까요?",
          desc:
            confirmState.skippedEmptyCardCount > 0
              ? `${confirmState.cardCount}장으로 발견 피드에 올릴게요. 빈 장 ${confirmState.skippedEmptyCardCount}장은 제외돼요.`
              : `${confirmState.cardCount}장으로 발견 피드에 올릴게요.`,
          ok: status === "submitting" ? "발행 중" : "발행",
        }
    : null;

  return (
    <form className="capture-view" onSubmit={handleSubmit}>
      <div className="capture-stage" style={captureStageStyle} ref={stageRef}>
        <CardBackgroundImageLayer comp={activeComp} />
        <div className="capture-head">
          <button
            className="capture-close"
            type="button"
            onClick={onClose}
            aria-label="닫기"
          >
            ×
          </button>
          <button
            className="capture-submit"
            type="submit"
            disabled={!canPublish}
          >
            {status === "submitting" ? "발행 중" : "발행"}
          </button>
        </div>

        <div className="capture-tools" aria-label="카드 도구">
          {(["title", "background", "source", "tag"] as const).map((tool) => (
            <div className="capture-tool" key={tool}>
              <button
                className={selectedTool === tool ? "is-active" : undefined}
                type="button"
                onClick={() =>
                  setSelectedTool((currentTool) =>
                    currentTool === tool ? null : tool,
                  )
                }
                aria-label={captureToolLabels[tool]}
              >
                <CaptureToolIcon tool={tool} />
              </button>
              <span>{captureToolLabels[tool]}</span>
            </div>
          ))}
        </div>

        {title.trim() ? (
          <div className="capture-title-chip">{title.trim()}</div>
        ) : null}
        <div className="sentence-card editable capture-card">
          <div
            className={`capture-textbox ${captureDragTarget === "text" ? "is-dragging" : ""}`}
            style={captureTextBoxStyle}
            onPointerDown={(event) => beginCaptureDrag("text", event)}
            onPointerMove={moveCaptureDrag}
            onPointerUp={endCaptureDrag}
            onPointerCancel={endCaptureDrag}
          >
            <textarea
              aria-label={`${activeDraftIndex + 1}장 문장`}
              ref={textAreaRef}
              value={activeSentence}
              onChange={(event) => updateActiveSentence(event.target.value)}
              placeholder="문장을 적어 보세요"
              maxLength={240}
              style={cardTextStyle(activeComp)}
            />
            <button
              className="capture-resize"
              type="button"
              aria-label="문구 크기 조절"
              onPointerDown={(event) => beginCaptureDrag("resize", event)}
              onPointerMove={moveCaptureDrag}
              onPointerUp={endCaptureDrag}
              onPointerCancel={endCaptureDrag}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 20H4v-4" />
                <path d="M16 4h4v4" />
                <path d="M4 20l6-6" />
                <path d="M20 4l-6 6" />
              </svg>
            </button>
          </div>
        </div>
        {sourceAuthor.trim() || sourceWork.trim() ? (
          <div
            className={`capture-source-chip ${captureDragTarget === "source" ? "is-dragging" : ""}`}
            style={captureSourceChipStyle}
            onPointerDown={(event) => beginCaptureDrag("source", event)}
            onPointerMove={moveCaptureDrag}
            onPointerUp={endCaptureDrag}
            onPointerCancel={endCaptureDrag}
          >
            {sourceWork.trim() ? <strong>{sourceWork.trim()}</strong> : null}
            {sourceAuthor.trim() ? <span>{sourceAuthor.trim()}</span> : null}
          </div>
        ) : null}

        <div className="capture-bottom">
          <button
            className="capture-stylebar"
            type="button"
            onClick={() => setSelectedTool("text")}
          >
            <strong>Aa</strong>
            <span>
              {captureFontOptions.find((font) => font.id === activeComp.font)
                ?.label ?? "문구"}
            </span>
            <em>{activeComp.size}px</em>
          </button>
          <div className="capture-pagebar" aria-label="장 관리">
            <span>
              {activeDraftIndex + 1}/{maxCaptureDraftCards}장
            </span>
            <div className="capture-page-tabs" aria-label="장 목록">
              {cards.map((card, index) => (
                <button
                  className={
                    index === activeDraftIndex ? "is-active" : undefined
                  }
                  key={index}
                  type="button"
                  onClick={() => setActiveDraftIndex(index)}
                  aria-label={`${index + 1}장으로 이동`}
                  style={cardCompositionSurfaceStyle(card.comp)}
                >
                  <small>{index + 1}</small>
                  <span>{card.text.trim() || "새 문장"}</span>
                </button>
              ))}
              <button
                className="capture-page-add"
                type="button"
                onClick={addDraftCard}
                disabled={!canAddDraftCard}
                aria-label={
                  canAddDraftCard
                    ? "장 추가"
                    : `최대 ${maxCaptureDraftCards}장까지 작성할 수 있어요`
                }
              >
                +
              </button>
            </div>
            <button
              className="capture-page-delete"
              type="button"
              onClick={removeDraftCard}
              disabled={cards.length <= 1}
              aria-label="현재 장 삭제"
            >
              <TrashIcon />
            </button>
          </div>
        </div>
        {error ? <p className="capture-floating-error">{error}</p> : null}
        {confirmState && confirmCopy ? (
          <div className="capture-confirm" role="presentation">
            <button
              className="capture-confirm-backdrop"
              type="button"
              aria-label="확인 창 닫기"
              onClick={() => {
                if (status !== "submitting") {
                  setConfirmState(null);
                }
              }}
            />
            <section
              className="capture-confirm-box"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="captureConfirmTitle"
              aria-describedby="captureConfirmDesc"
            >
              <h3 id="captureConfirmTitle">{confirmCopy.title}</h3>
              <p id="captureConfirmDesc">{confirmCopy.desc}</p>
              <div className="capture-confirm-actions">
                <button
                  type="button"
                  onClick={() => setConfirmState(null)}
                  disabled={status === "submitting"}
                >
                  취소
                </button>
                <button
                  className="is-primary"
                  type="button"
                  onClick={handleConfirmAction}
                  disabled={status === "submitting"}
                >
                  {confirmCopy.ok}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>

      {selectedTool ? (
        <>
          <button
            className="capture-sheet-backdrop"
            type="button"
            aria-label="카드 설정 닫기"
            onClick={() => setSelectedTool(null)}
          />
          <section
            className="capture-tool-sheet"
            aria-label={`${captureToolLabels[selectedTool]} 설정`}
          >
            <div className="sheet-grip" aria-hidden="true">
              <span />
            </div>
            <div className="capture-sheet-head">
              <h3>{captureToolLabels[selectedTool]}</h3>
              <button
                type="button"
                onClick={() => setSelectedTool(null)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>
            <div className="capture-sheet-body">
              {selectedTool === "text" ? (
                <>
                  <div className="capture-style-section">
                    <span className="capture-section-title">폰트</span>
                    <div className="capture-option-grid font-options">
                      {captureFontOptions.map((font) => (
                        <button
                          className={
                            activeComp.font === font.id
                              ? "is-active"
                              : undefined
                          }
                          key={font.id}
                          type="button"
                          onClick={() =>
                            updateActiveComp((comp) => ({
                              ...comp,
                              font: font.id,
                            }))
                          }
                          style={{ fontFamily: cardFontFamily[font.id] }}
                        >
                          {font.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="capture-style-section">
                    <span className="capture-section-title">정렬</span>
                    <div className="capture-option-grid">
                      {captureAlignOptions.map((align) => (
                        <button
                          className={
                            activeComp.align === align.value
                              ? "is-active"
                              : undefined
                          }
                          key={align.value}
                          type="button"
                          onClick={() =>
                            updateActiveComp((comp) => ({
                              ...comp,
                              align: align.value,
                            }))
                          }
                        >
                          {align.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="capture-style-section">
                    <span className="capture-section-title">굵기</span>
                    <div className="capture-option-grid">
                      {captureWeightOptions.map((weight) => (
                        <button
                          className={
                            activeComp.weight === weight.value
                              ? "is-active"
                              : undefined
                          }
                          key={weight.value}
                          type="button"
                          onClick={() =>
                            updateActiveComp((comp) => ({
                              ...comp,
                              weight: weight.value,
                            }))
                          }
                          style={{ fontWeight: weight.value }}
                        >
                          {weight.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="capture-range-field">
                    <span>
                      크기 <em>{activeComp.size}px</em>
                    </span>
                    <input
                      type="range"
                      min="16"
                      max="84"
                      step="1"
                      value={activeComp.size}
                      onChange={(event) =>
                        updateActiveComp((comp) => ({
                          ...comp,
                          size: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <div className="capture-style-section">
                    <span className="capture-section-title">글자색</span>
                    <div className="capture-color-row">
                      {captureTextColorOptions.map((color) => (
                        <button
                          className={
                            activeComp.textColor.toLowerCase() ===
                            color.toLowerCase()
                              ? "is-active"
                              : undefined
                          }
                          key={color}
                          type="button"
                          aria-label={`글자색 ${color}`}
                          onClick={() =>
                            updateActiveComp((comp) => ({
                              ...comp,
                              textColor: color,
                            }))
                          }
                          style={{ background: color }}
                        />
                      ))}
                      <label
                        className="capture-color-picker"
                        aria-label="글자 직접 색상"
                      >
                        <input
                          type="color"
                          value={customTextColor}
                          onChange={(event) =>
                            updateActiveComp((comp) => ({
                              ...comp,
                              textColor: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                </>
              ) : null}

              {selectedTool === "title" ? (
                <label className="capture-field">
                  <span>제목</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="첫 문장이 제목이 돼요"
                  />
                </label>
              ) : null}

              {selectedTool === "background" ? (
                <>
                  <div className="capture-style-section">
                    <span className="capture-section-title">직접 색상</span>
                    <div className="capture-color-row capture-bg-colors">
                      {captureSolidColorOptions.map((color) => (
                        <button
                          className={
                            activeComp.bg.toLowerCase() === color.toLowerCase()
                              ? "is-active"
                              : undefined
                          }
                          key={color}
                          type="button"
                          aria-label={`배경색 ${color}`}
                          onClick={() => applySolidBackground(color)}
                          style={{ background: color }}
                        />
                      ))}
                      <label
                        className="capture-color-picker large"
                        aria-label="배경 직접 색상"
                      >
                        <input
                          type="color"
                          value={solidBackgroundColor}
                          onChange={(event) =>
                            applySolidBackground(event.target.value)
                          }
                        />
                      </label>
                    </div>
                  </div>
                  <div className="capture-style-section capture-image-section">
                    <span className="capture-section-title">직접 이미지</span>
                    <input
                      ref={imageInputRef}
                      className="capture-image-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      onChange={handleBackgroundImageSelect}
                    />
                    <div className="capture-image-actions">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        사진 선택
                      </button>
                      {activeBgImage ? (
                        <button
                          className="is-muted"
                          type="button"
                          onClick={removeBackgroundImage}
                        >
                          사진 제거
                        </button>
                      ) : null}
                    </div>
                    <p className="capture-image-hint">
                      권장 9:16 · 1080×1920 이상 · 현재 미리보기 5MB 이하
                    </p>
                    {activeBgImage ? (
                      <div className="capture-image-editor">
                        <div
                          className="capture-image-frame"
                          onPointerDown={beginImageCropDrag}
                          onPointerMove={moveImageCropDrag}
                          onPointerUp={endImageCropDrag}
                          onPointerCancel={endImageCropDrag}
                        >
                          <div
                            className="capture-image-card"
                            style={cardCompositionSurfaceStyle(activeComp)}
                          >
                            <CardBackgroundImageLayer comp={activeComp} />
                            <div
                              className="capture-image-guide"
                              aria-hidden="true"
                            >
                              <span />
                              <span />
                              <span />
                              <span />
                            </div>
                          </div>
                        </div>
                        <div className="capture-image-meta">
                          <span>
                            {activeBgImage.naturalWidth &&
                            activeBgImage.naturalHeight
                              ? `${activeBgImage.naturalWidth}×${activeBgImage.naturalHeight}`
                              : "이미지"}
                          </span>
                          <span>
                            초점 {Math.round(activeBgImage.focalX)} ·{" "}
                            {Math.round(activeBgImage.focalY)}
                          </span>
                        </div>
                        <label className="capture-range-field">
                          <span>
                            확대 <em>{activeBgImage.zoom.toFixed(2)}x</em>
                          </span>
                          <input
                            type="range"
                            min="1"
                            max="2.5"
                            step="0.05"
                            value={activeBgImage.zoom}
                            onChange={(event) =>
                              updateBackgroundImage((image) => ({
                                ...image,
                                zoom: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                        <label className="capture-range-field">
                          <span>
                            가로 초점{" "}
                            <em>{Math.round(activeBgImage.focalX)}%</em>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={activeBgImage.focalX}
                            onChange={(event) =>
                              updateBackgroundImage((image) => ({
                                ...image,
                                focalX: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                        <label className="capture-range-field">
                          <span>
                            세로 초점{" "}
                            <em>{Math.round(activeBgImage.focalY)}%</em>
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={activeBgImage.focalY}
                            onChange={(event) =>
                              updateBackgroundImage((image) => ({
                                ...image,
                                focalY: Number(event.target.value),
                              }))
                            }
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="capture-image-empty">
                        카드 배경 미리보기
                      </div>
                    )}
                  </div>
                  <label className="capture-range-field">
                    <span>
                      어둡게 <em>{Math.round(activeComp.dim * 100)}%</em>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="0.55"
                      step="0.01"
                      value={activeComp.dim}
                      onChange={(event) =>
                        updateActiveComp((comp) => ({
                          ...comp,
                          dim: Number(event.target.value),
                        }))
                      }
                    />
                  </label>
                  <div className="capture-bg-grid">
                    {captureBackgroundOptions.map((background) => (
                      <button
                        className={
                          activeBackgroundOption?.id === background.id
                            ? "is-active"
                            : undefined
                        }
                        key={background.id}
                        type="button"
                        onClick={() => applyBackgroundOption(background)}
                        style={{
                          background: bgWithDim(background.bg, background.dim),
                          color: background.textColor,
                        }}
                      >
                        <span>{background.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}

              {selectedTool === "source" ? (
                <>
                  <div className="capture-field-grid">
                    <label className="capture-field">
                      <span>저자</span>
                      <input
                        value={sourceAuthor}
                        onChange={(event) =>
                          setSourceAuthor(event.target.value)
                        }
                        placeholder="윤동주"
                      />
                    </label>
                    <label className="capture-field">
                      <span>출처명</span>
                      <input
                        value={sourceWork}
                        onChange={(event) => setSourceWork(event.target.value)}
                        placeholder="책, 연설, 글, 명언 등"
                      />
                    </label>
                  </div>
                  <button className="capture-book-link" type="button" disabled>
                    <span>출처 연결</span>
                    <em>원문·출처 연결 준비 중</em>
                  </button>
                </>
              ) : null}

              {selectedTool === "tag" ? (
                <>
                  {tagList.length > 0 ? (
                    <div className="capture-tag-list">
                      {tagList.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  <label className="capture-field">
                    <span>태그</span>
                    <input
                      value={tags}
                      onChange={(event) => setTags(event.target.value)}
                      placeholder="쉼표로 3개까지"
                    />
                  </label>
                </>
              ) : null}
              {error ? <p className="capture-error">{error}</p> : null}
            </div>
          </section>
        </>
      ) : null}
    </form>
  );
}

function ShelfView({ onOpenPost }: { onOpenPost: (post: PostBundle) => void }) {
  const [sortMode, setSortMode] = useState<"popular" | "new">("popular");
  const [posts, setPosts] = useState<PostBundle[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>(emptyPageInfo);
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const serverSortMode = sortMode === "popular" ? "popular" : "latest";
  const heroPost = posts[0] ?? null;
  const heroCard = heroPost?.cards[0] ?? null;
  const loadMoreRef = useServerLoadMore(
    pageInfo.hasNextPage,
    loadingMore,
    loadMoreShelfPosts,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadShelf() {
      try {
        setStatus("loading");
        setError("");
        const page = await fetchShelf(
          serverSortMode,
          { limit: listInitialCount },
          controller.signal,
        );
        setPosts(page.items);
        setPageInfo(page.pageInfo);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setPosts([]);
          setPageInfo(emptyPageInfo);
          setStatus("idle");
          setError("둘러보기 글을 불러올 수 없어요.");
        }
      }
    }

    void loadShelf();
    return () => controller.abort();
  }, [serverSortMode]);

  async function loadMoreShelfPosts() {
    if (!pageInfo.hasNextPage || !pageInfo.nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const page = await fetchShelf(serverSortMode, {
        cursor: pageInfo.nextCursor,
        limit: listLoadStep,
      });
      setPosts((currentPosts) => {
        const postIds = new Set(currentPosts.map((post) => post.post.id));
        return [
          ...currentPosts,
          ...page.items.filter((post) => !postIds.has(post.post.id)),
        ];
      });
      setPageInfo(page.pageInfo);
    } catch {
      // 추가 로딩 실패 시 현재 목록을 유지한다.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="shelf-view">
      {heroPost && heroCard ? (
        <button
          className="shelf-hero"
          type="button"
          onClick={() => onOpenPost(heroPost)}
          style={cardSurfaceStyle(heroCard)}
        >
          <div className="tag">✦ 에디터 픽 · 오늘의 글</div>
          <div className="htt">{heroPost.post.title}</div>
          <div className="hq">{heroCard.text}</div>
          <div className="hm">
            {heroPost.post.cardCount}장 · ♡{" "}
            {formatCount(heroPost.viewerState?.likeCount ?? 0)} ·{" "}
            <AccountName account={heroPost.author} />
          </div>
        </button>
      ) : status === "loading" ? (
        <p className="drawer-empty">불러오는 중</p>
      ) : error ? (
        <p className="drawer-empty">{error}</p>
      ) : (
        <p className="drawer-empty">아직 둘러볼 글이 없어요.</p>
      )}
      <div className="shelf-bar">
        <div className="shelf-seclabel">
          <span>글 둘러보기</span>
          <div className="shelf-sort" aria-label="둘러보기 정렬">
            <button
              className={sortMode === "popular" ? "is-active" : undefined}
              type="button"
              onClick={() => setSortMode("popular")}
            >
              인기순
            </button>
            <button
              className={sortMode === "new" ? "is-active" : undefined}
              type="button"
              onClick={() => setSortMode("new")}
            >
              최신순
            </button>
          </div>
        </div>
      </div>
      <div className="shelf-grid masonry">
        {posts.map((post) => (
          <PostPreviewButton
            key={post.post.id}
            post={post}
            onOpenPost={onOpenPost}
          />
        ))}
      </div>
      <LoadMoreSentinel hasMore={pageInfo.hasNextPage} innerRef={loadMoreRef} />
    </section>
  );
}

function EditorialPageView({
  page,
  onBack,
  onOpenDiscover,
}: {
  page: EditorialPage;
  onBack: () => void;
  onOpenDiscover: () => void;
}) {
  const isContactCta = page.cta?.action === "contact";

  return (
    <article className="editorial-page">
      <div className="page-head">
        <button
          className="back-icon"
          type="button"
          onClick={onBack}
          aria-label="이전으로 돌아가기"
        >
          ←
        </button>
        <div>
          <span>{page.label}</span>
          <h2>{page.title}</h2>
          <time dateTime={page.date.replaceAll(".", "-")}>{page.date}</time>
        </div>
      </div>

      <div className="page-body">
        <p className="page-summary">{page.summary}</p>
        {page.body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>

      {page.cta ? (
        <button
          className={isContactCta ? "primary-button ghost" : "primary-button"}
          disabled={isContactCta}
          type="button"
          onClick={page.cta.action === "discover" ? onOpenDiscover : undefined}
        >
          {isContactCta ? `${page.cta.label} 준비 중` : page.cta.label}
        </button>
      ) : null}
    </article>
  );
}

function NoticeListView({
  onBack,
  onOpenPage,
  pages,
}: {
  onBack: () => void;
  onOpenPage: (page: EditorialPage) => void;
  pages: EditorialPage[];
}) {
  const pageList = useProgressiveItems(
    pages,
    `notices:${pages.map((page) => page.id).join("|")}`,
  );

  return (
    <section className="notice-list-view">
      <div className="settings-head">
        <button
          className="back-icon"
          type="button"
          onClick={onBack}
          aria-label="설정으로 돌아가기"
        >
          ←
        </button>
        <div>
          <h2>공지사항</h2>
          <p>새김에서 전하는 소식</p>
        </div>
      </div>

      <div className="notice-list">
        {pages.length > 0 ? (
          pageList.visibleItems.map((page) => (
            <button
              className="notice-row"
              key={page.id}
              type="button"
              onClick={() => onOpenPage(page)}
            >
              <span>{page.label}</span>
              <strong>{page.title}</strong>
              <p>{page.summary}</p>
              <small>{page.date}</small>
            </button>
          ))
        ) : (
          <p className="drawer-empty">아직 등록된 공지가 없어요.</p>
        )}
      </div>
      <LoadMoreSentinel
        hasMore={pageList.hasMore}
        innerRef={pageList.loadMoreRef}
      />
    </section>
  );
}

function LegalDocumentView({
  document,
  onBack,
}: {
  document: LegalDocument;
  onBack: () => void;
}) {
  return (
    <section className="legal-view">
      <div className="settings-head">
        <button
          className="back-icon"
          type="button"
          onClick={onBack}
          aria-label="설정으로 돌아가기"
        >
          ←
        </button>
        <div>
          <h2>{document.title}</h2>
          <p>
            버전 {document.version} · 시행일 {document.effectiveDate}
          </p>
        </div>
      </div>

      <article className="legal-body">
        <p className="legal-summary">{document.summary}</p>
        <p className="legal-note">
          본 문서는 MVP 운영 준비용 초안입니다. 정식 운영 전 사업자 정보,
          문의 창구, 보존 기간, 위탁 현황을 확정해 갱신합니다.
        </p>

        {document.sections.map((section) => (
          <section className="legal-section" key={section.title}>
            <h3>{section.title}</h3>
            {section.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </section>
  );
}

function SettingsView({
  onBack,
  onEditProfile,
  onLogout,
  onOpenDrawer,
  onOpenFollowing,
  onOpenLegal,
  onOpenNotices,
}: {
  onBack: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onOpenDrawer: () => void;
  onOpenFollowing: () => void;
  onOpenLegal: (kind: LegalDocumentKind) => void;
  onOpenNotices: () => void;
}) {
  const sections: Array<{
    title: string;
    rows: Array<{ label: string; onClick?: () => void; state?: string }>;
  }> = [
    {
      title: "계정",
      rows: [{ label: "프로필 편집", onClick: onEditProfile }],
    },
    {
      title: "활동",
      rows: [
        { label: "내 서랍", onClick: onOpenDrawer },
        { label: "구독 목록", onClick: onOpenFollowing },
      ],
    },
    {
      title: "알림",
      rows: [
        { label: "푸시 알림", state: "준비 중" },
        { label: "새김 소식", state: "준비 중" },
      ],
    },
    {
      title: "정보",
      rows: [
        { label: "공지사항", onClick: onOpenNotices },
        { label: "이용약관", onClick: () => onOpenLegal("terms") },
        { label: "개인정보 처리방침", onClick: () => onOpenLegal("privacy") },
        { label: "문의하기", state: "준비 중" },
      ],
    },
  ];

  return (
    <section className="settings-view">
      <div className="settings-head">
        <button
          className="back-icon"
          type="button"
          onClick={onBack}
          aria-label="프로필로 돌아가기"
        >
          ←
        </button>
        <div>
          <h2>설정</h2>
        </div>
      </div>

      <div className="settings-groups">
        {sections.map((section) => (
          <section className="settings-section" key={section.title}>
            <h3>{section.title}</h3>
            <div className="settings-list">
              {section.rows.map((row) => (
                <button
                  className={
                    !row.onClick ? "settings-row is-disabled" : "settings-row"
                  }
                  disabled={!row.onClick}
                  key={row.label}
                  onClick={row.onClick}
                  type="button"
                >
                  <span>{row.label}</span>
                  {row.state ? <small>{row.state}</small> : <small>›</small>}
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <button className="settings-logout" type="button" onClick={onLogout}>
        로그아웃
      </button>
      <p className="settings-version">새김 · 버전 0.1.0 (MVP)</p>
    </section>
  );
}

function FollowingView({
  onBack,
  onOpenProfile,
}: {
  onBack: () => void;
  onOpenProfile: (account: AccountProfile) => void;
}) {
  const [followingAccounts, setFollowingAccounts] = useState<AccountProfile[]>(
    [],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadFollowing() {
      try {
        setStatus("loading");
        setError("");
        const nextAccounts = await fetchFollowingAccounts(controller.signal);
        setFollowingAccounts(nextAccounts);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setFollowingAccounts([]);
          setStatus("idle");
          setError("구독 목록을 불러올 수 없어요.");
        }
      }
    }

    void loadFollowing();
    return () => controller.abort();
  }, []);

  const visibleAccounts = followingAccounts.filter((account) => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return true;

    return `${account.displayName} ${account.handle} ${account.tagline}`
      .toLowerCase()
      .includes(cleanQuery);
  });
  const accountList = useProgressiveItems(
    visibleAccounts,
    `following:${query.trim()}:${accountListKey(visibleAccounts)}`,
  );

  return (
    <section className="drawer-view following-view">
      <div className="drawer-head">
        <button
          className="back-icon"
          type="button"
          onClick={onBack}
          aria-label="설정으로 돌아가기"
        >
          ←
        </button>
        <div>
          <h2>구독 목록</h2>
          <p>구독중인 글벗 {formatCount(followingAccounts.length)}명</p>
        </div>
      </div>

      <div className="drawer-tools">
        <label className="drawer-search">
          <SearchIcon />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="구독중인 계정 찾기"
            type="search"
            value={query}
          />
        </label>
      </div>

      {status === "loading" ? (
        <p className="drawer-empty">불러오는 중</p>
      ) : null}
      {status !== "loading" && !error && followingAccounts.length === 0 ? (
        <p className="drawer-empty">아직 구독중인 글벗이 없어요.</p>
      ) : null}
      {status !== "loading" &&
      !error &&
      followingAccounts.length > 0 &&
      visibleAccounts.length === 0 ? (
        <p className="drawer-empty">검색에 맞는 글벗이 없어요.</p>
      ) : null}
      {error ? <p className="drawer-empty">{error}</p> : null}
      {visibleAccounts.length > 0 ? (
        <div className="search-account-list following-account-list">
          {accountList.visibleItems.map((account) => (
            <AccountResultButton
              account={account}
              key={account.id}
              onOpenProfile={onOpenProfile}
            />
          ))}
        </div>
      ) : null}
      <LoadMoreSentinel
        hasMore={accountList.hasMore}
        innerRef={accountList.loadMoreRef}
      />
    </section>
  );
}

function DrawerView({
  onBack,
  onOpenPost,
}: {
  onBack: () => void;
  onOpenPost: (post: PostBundle) => void;
}) {
  const [drawerPosts, setDrawerPosts] = useState<PostBundle[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>(emptyPageInfo);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const loadMoreRef = useServerLoadMore(
    pageInfo.hasNextPage,
    loadingMore,
    loadMoreDrawerPosts,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadDrawer() {
      try {
        setStatus("loading");
        setError("");
        const page = await fetchDrawer(
          { limit: listInitialCount },
          controller.signal,
        );
        setDrawerPosts(page.items);
        setPageInfo(page.pageInfo);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setDrawerPosts([]);
          setPageInfo(emptyPageInfo);
          setStatus("idle");
          setError("서랍을 불러올 수 없어요.");
        }
      }
    }

    void loadDrawer();
    return () => controller.abort();
  }, []);

  async function loadMoreDrawerPosts() {
    if (!pageInfo.hasNextPage || !pageInfo.nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const page = await fetchDrawer({
        cursor: pageInfo.nextCursor,
        limit: listLoadStep,
      });
      setDrawerPosts((currentPosts) => {
        const postIds = new Set(currentPosts.map((post) => post.post.id));
        return [
          ...currentPosts,
          ...page.items.filter((post) => !postIds.has(post.post.id)),
        ];
      });
      setPageInfo(page.pageInfo);
    } catch {
      // 추가 로딩 실패 시 현재 서랍을 유지한다.
    } finally {
      setLoadingMore(false);
    }
  }

  const visiblePosts = drawerPosts.filter((post) => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return true;

    return `${post.post.title} ${post.author.displayName} ${post.cards.map((card) => card.text).join(" ")}`
      .toLowerCase()
      .includes(cleanQuery);
  });

  return (
    <section className="drawer-view">
      <div className="drawer-head">
        <button
          className="back-icon"
          type="button"
          onClick={onBack}
          aria-label="이전 화면으로 돌아가기"
        >
          ←
        </button>
        <div>
          <h2>내 서랍</h2>
          <p>간직한 글 {formatCount(drawerPosts.length)}개</p>
        </div>
      </div>

      <div className="drawer-tools">
        <label className="drawer-search">
          <SearchIcon />
          <input
            onChange={(event) => setQuery(event.target.value)}
            placeholder="새긴 글 찾기"
            type="search"
            value={query}
          />
        </label>
      </div>

      {status === "loading" ? (
        <p className="drawer-empty">불러오는 중</p>
      ) : null}
      {status !== "loading" && !error && drawerPosts.length === 0 ? (
        <p className="drawer-empty">아직 간직한 글이 없어요.</p>
      ) : null}
      {status !== "loading" &&
      !error &&
      drawerPosts.length > 0 &&
      visiblePosts.length === 0 ? (
        <p className="drawer-empty">검색에 맞는 글이 없어요.</p>
      ) : null}
      {error ? <p className="drawer-empty">{error}</p> : null}
      {visiblePosts.length > 0 ? (
        <div className="masonry">
          {visiblePosts.map((post) => (
            <PostPreviewButton
              key={post.post.id}
              post={post}
              onOpenPost={onOpenPost}
            />
          ))}
        </div>
      ) : null}
      <LoadMoreSentinel
        hasMore={!query.trim() && pageInfo.hasNextPage}
        innerRef={loadMoreRef}
      />
    </section>
  );
}

function ProfileView({
  account,
  isOwnProfile,
  onBack,
  onEdit,
  onOpenDrawer,
  onOpenPost,
  onOpenSettings,
  onToggleFollow,
}: {
  account: AccountProfile;
  isOwnProfile: boolean;
  onBack: () => void;
  onEdit: () => void;
  onOpenDrawer: () => void;
  onOpenPost: (post: PostBundle) => void;
  onOpenSettings: () => void;
  onToggleFollow: (accountId: string, subscribed: boolean) => void;
}) {
  const isSubscribed = account.viewerState?.subscribed ?? false;
  const shelfTitle = isOwnProfile ? "내 글" : `${account.displayName}의 글`;
  const [profilePosts, setProfilePosts] = useState<PostBundle[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfo>(emptyPageInfo);
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const loadMoreRef = useServerLoadMore(
    pageInfo.hasNextPage,
    loadingMore,
    loadMoreProfilePosts,
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfilePosts() {
      try {
        setStatus("loading");
        setError("");
        const page = await fetchAccountPosts(
          account.handle,
          { limit: listInitialCount },
          controller.signal,
        );
        setProfilePosts(page.items);
        setPageInfo(page.pageInfo);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setProfilePosts([]);
          setPageInfo(emptyPageInfo);
          setStatus("idle");
          setError("글 목록을 불러올 수 없어요.");
        }
      }
    }

    void loadProfilePosts();
    return () => controller.abort();
  }, [account.handle]);

  async function loadMoreProfilePosts() {
    if (!pageInfo.hasNextPage || !pageInfo.nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      const page = await fetchAccountPosts(account.handle, {
        cursor: pageInfo.nextCursor,
        limit: listLoadStep,
      });
      setProfilePosts((currentPosts) => {
        const postIds = new Set(currentPosts.map((post) => post.post.id));
        return [
          ...currentPosts,
          ...page.items.filter((post) => !postIds.has(post.post.id)),
        ];
      });
      setPageInfo(page.pageInfo);
    } catch {
      // 추가 로딩 실패 시 현재 글 목록을 유지한다.
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="profile-view">
      <div className="profile-top">
        {isOwnProfile ? (
          <span aria-hidden="true" />
        ) : (
          <button
            className="profile-icon-button"
            type="button"
            onClick={onBack}
            aria-label="이전 화면으로 돌아가기"
          >
            ←
          </button>
        )}
        {isOwnProfile ? (
          <button
            className="profile-icon-button"
            type="button"
            onClick={onOpenSettings}
            aria-label="설정"
          >
            <MenuIcon />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <div className="profile-head">
        <Avatar
          displayName={account.displayName}
          photoUrl={account.photoUrl}
          size="large"
        />
        <div className="profile-meta">
          <h2>
            <AccountName account={account} />
          </h2>
          <p>{account.tagline}</p>
          <small>
            글 {formatCount(account.postCount)}개 · 글벗{" "}
            {formatCount(account.writingFriendCount)}
          </small>
        </div>
        {isOwnProfile ? (
          <div className="profile-actions" aria-label="내 프로필 행동">
            <button
              className="profile-sub"
              type="button"
              onClick={onOpenDrawer}
            >
              내 서랍
            </button>
            <button
              className="profile-sub ghost"
              type="button"
              onClick={onEdit}
            >
              프로필 편집
            </button>
          </div>
        ) : (
          <button
            className={
              isSubscribed ? "profile-sub is-subscribed" : "profile-sub"
            }
            type="button"
            aria-pressed={isSubscribed}
            onClick={() => onToggleFollow(account.id, isSubscribed)}
          >
            {isSubscribed ? "구독중" : "구독"}
          </button>
        )}
      </div>
      {account.bio && account.bio !== account.tagline ? (
        <div className="profile-bio">{account.bio}</div>
      ) : null}

      <section className="profile-posts">
        <div className="profile-shelf-head">
          <h2>{shelfTitle}</h2>
          <span>글 {formatCount(account.postCount)}</span>
        </div>
        {status === "loading" ? (
          <p className="profile-empty">불러오는 중</p>
        ) : null}
        {error ? <p className="profile-empty">{error}</p> : null}
        {status !== "loading" && !error && profilePosts.length > 0 ? (
          <div className="masonry">
            {profilePosts.map((post) => (
              <PostPreviewButton
                hideAuthor
                hideLikeCount={isOwnProfile}
                key={post.post.id}
                post={post}
                onOpenPost={onOpenPost}
              />
            ))}
          </div>
        ) : null}
        {status !== "loading" && !error && profilePosts.length === 0 ? (
          <p className="profile-empty">아직 공개된 글이 없어요.</p>
        ) : null}
        <LoadMoreSentinel
          hasMore={pageInfo.hasNextPage}
          innerRef={loadMoreRef}
        />
      </section>
    </section>
  );
}

function ProfileEditView({
  account,
  onCancel,
  onSubmit,
}: {
  account: AccountProfile;
  onCancel: () => void;
  onSubmit: (input: UpdateAccountInput) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(account.displayName);
  const [tagline, setTagline] = useState(account.tagline);
  const [bio, setBio] = useState(account.bio ?? "");
  const [photoUrl, setPhotoUrl] = useState(account.photoUrl ?? "");
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const [photoStatus, setPhotoStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayName.trim()) {
      setError("닉네임을 입력해 주세요.");
      return;
    }

    if (photoStatus === "loading") {
      setError("사진을 다듬는 중이에요. 잠시 뒤 저장해 주세요.");
      return;
    }

    try {
      setStatus("saving");
      setError("");
      await onSubmit({
        displayName: displayName.trim(),
        tagline: tagline.trim(),
        bio: bio.trim() || null,
        photoUrl: photoUrl.trim() || null,
      });
    } catch {
      setStatus("idle");
      setError("프로필을 저장할 수 없어요. 잠시 뒤 다시 시도해 주세요.");
    }
  }

  async function handlePhotoSelect(event: ReactChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";

    if (!file) {
      return;
    }

    if (!captureImageAcceptedTypes.has(file.type)) {
      setError("JPG, PNG, WebP, AVIF 이미지만 올릴 수 있어요.");
      return;
    }

    if (file.size > profilePhotoMaxBytes) {
      setError("프로필 사진은 5MB 이하 이미지만 올릴 수 있어요.");
      return;
    }

    try {
      setPhotoStatus("loading");
      setError("");
      const nextPhotoUrl = await createProfilePhotoDataUrl(file);
      setPhotoUrl(nextPhotoUrl);
    } catch (error) {
      setError(error instanceof Error ? error.message : "사진을 바꿀 수 없어요. 다른 이미지를 골라 주세요.");
    } finally {
      setPhotoStatus("idle");
    }
  }

  return (
    <form className="profile-edit-view" onSubmit={handleSubmit}>
      <div className="edit-page-head">
        <div>
          <button
            className="back-icon"
            type="button"
            onClick={onCancel}
            aria-label="프로필로 돌아가기"
          >
            ←
          </button>
          <h2>프로필 편집</h2>
        </div>
        <button
          className="edit-save"
          type="submit"
          disabled={status === "saving" || photoStatus === "loading"}
        >
          {status === "saving" ? "저장 중" : "저장"}
        </button>
      </div>

      <div className="edit-photo">
        <input
          ref={photoInputRef}
          className="edit-photo-input"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handlePhotoSelect}
        />
        <div className="edit-avatar-wrap">
          <Avatar
            displayName={displayName || account.displayName}
            photoUrl={photoUrl}
            size="large"
          />
          <button
            className="edit-avatar-button"
            type="button"
            onClick={() => photoInputRef.current?.click()}
            aria-label="프로필 사진 바꾸기"
            disabled={photoStatus === "loading"}
          >
            <PencilIcon />
          </button>
        </div>
        {photoStatus === "loading" ? <p>사진을 다듬는 중</p> : null}
        {photoStatus !== "loading" && tagline.trim() ? <p>{tagline.trim()}</p> : null}
        {photoUrl ? (
          <button className="edit-photo-remove" type="button" onClick={() => setPhotoUrl("")}>
            사진 제거
          </button>
        ) : null}
      </div>
      <label className="edit-field">
        <div>
          <span className="edit-label">닉네임</span>
          <small>{displayName.length}/24</small>
        </div>
        <input
          maxLength={24}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="닉네임"
          value={displayName}
        />
      </label>
      <label className="edit-field">
        <div>
          <span className="edit-label">한줄 소개글</span>
          <small>{tagline.length}/48</small>
        </div>
        <input
          maxLength={48}
          onChange={(event) => setTagline(event.target.value)}
          placeholder="짧은 소개를 적어 주세요"
          value={tagline}
        />
        <em>추천 글벗 카드와 프로필 이름 아래에 보여요.</em>
      </label>
      <label className="edit-field">
        <div>
          <span className="edit-label">프로필 소개글</span>
          <small>{bio.length}/240</small>
        </div>
        <textarea
          maxLength={240}
          onChange={(event) => setBio(event.target.value)}
          placeholder="조용히 남겨 둘 소개글"
          value={bio}
        />
      </label>

      {error ? <p className="capture-error">{error}</p> : null}
    </form>
  );
}
