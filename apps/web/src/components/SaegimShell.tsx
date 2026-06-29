"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { DEFAULT_CARD_COMP } from "@saegim/domain";
import type {
  AccountProfile,
  CardComposition,
  CreatePostInput,
  PostBundle,
  PostComment,
  SentenceCard,
  UpdateAccountInput
} from "@saegim/domain";
import {
  carvePost,
  createPost,
  createPostComment,
  fetchAccountDetail,
  fetchPostComments,
  fetchCurrentAccount,
  fetchDrawer,
  fetchFeed,
  fetchRecommendedAccounts,
  fetchSearch,
  fetchAuthSession,
  followAccount,
  getGoogleOAuthStartUrl,
  likePost,
  logoutSession,
  uncarvePost,
  unlikePost,
  unfollowAccount,
  updateCurrentAccount
} from "../lib/api";
import { sampleAccounts, samplePosts } from "../lib/sample-data";

type TabKey = "home" | "discover" | "capture" | "shelf" | "me";
type EntryState = "gate" | "guest" | "signed-in";
type InfoSheetState = { postId: string; cardIndex: number };
type EditorialPageKind = "notice" | "event" | "ad";
type EditorialPageOrigin = "home" | "settings" | "notice-list";
type EditorialPageState = { pageId: string; origin: EditorialPageOrigin };
type EditorialPage = {
  id: string;
  kind: EditorialPageKind;
  label: string;
  title: string;
  date: string;
  summary: string;
  body: string[];
  cta?: {
    label: string;
    action: "discover" | "contact";
  };
};

const ENTRY_STATE_STORAGE_KEY = "saegim_web_entry_state";

const tabLabels: Record<TabKey, string> = {
  home: "홈",
  discover: "발견",
  capture: "포착",
  shelf: "둘러보기",
  me: "나"
};

const topbarCopy: Record<Exclude<TabKey, "discover">, { title: string; subtitle: string }> = {
  home: { title: "새김", subtitle: "마음에 새길 한 줄" },
  capture: { title: "포착", subtitle: "한 줄을 카드로 남기기" },
  shelf: { title: "둘러보기", subtitle: "엮어 둔 글 모음" },
  me: { title: "나", subtitle: "내가 남긴 글과 서랍" }
};

const editorialPages: EditorialPage[] = [
  {
    id: "notice-mvp-progress",
    kind: "notice",
    label: "공지",
    title: "새김 MVP를 다듬고 있어요",
    date: "2026.06.29",
    summary: "발견, 새김, 프로필, 서랍의 기본 흐름을 먼저 단단하게 만들고 있어요.",
    body: [
      "새김은 좋은 문장을 카드로 만들고, 발견하고, 마음에 담아 다시 보는 경험을 먼저 완성하고 있어요.",
      "지금은 발견 피드, 좋아요와 새김, 댓글, 프로필, 서랍, Google 계정 연결을 차례대로 붙이는 단계예요.",
      "소식 페이지는 운영자 CMS가 붙기 전까지 정적 페이지로 운영하면서 공지와 이벤트 흐름을 먼저 확인합니다."
    ]
  },
  {
    id: "event-first-sentence",
    kind: "event",
    label: "이벤트",
    title: "첫 번째로 남기고 싶은 문장",
    date: "2026.06.29",
    summary: "나중에 첫 사용자 이벤트로 확장할 문장 수집 흐름을 준비하고 있어요.",
    body: [
      "처음 새기고 싶은 문장은 대개 아주 크지 않아요. 오래 남은 한 줄, 자주 떠오르는 한 문장이면 충분해요.",
      "이 이벤트 자리는 포착과 발견의 연결을 검증하기 위한 자리로 먼저 열어 둡니다."
    ],
    cta: {
      label: "발견으로 이동",
      action: "discover"
    }
  },
  {
    id: "ad-book-connection",
    kind: "ad",
    label: "AD",
    title: "책 속 문장을 카드로 만나는 자리",
    date: "2026.06.29",
    summary: "작가와 출판사의 문장이 새김 안에서 자연스럽게 발견되는 방식을 준비 중이에요.",
    body: [
      "새김의 책 연결은 문장을 먼저 만나고, 관심이 생기면 책으로 이어지는 조용한 흐름을 목표로 합니다.",
      "현재는 글 정보 패널의 책으로 보기와 포착의 책 연결 자리를 준비 상태로 열어 두고 있어요."
    ],
    cta: {
      label: "제휴 문의",
      action: "contact"
    }
  }
];

const editorialHeroBackgrounds: Record<EditorialPageKind, string> = {
  notice: "linear-gradient(150deg,#4A4651,#38323F)",
  event: "linear-gradient(150deg,#5A5466,#3C3652)",
  ad: "linear-gradient(150deg,#6E6A74,#4A4651)"
};

function readStoredEntryState() {
  try {
    const savedEntryState = window.localStorage?.getItem(ENTRY_STATE_STORAGE_KEY);
    return savedEntryState === "guest" || savedEntryState === "signed-in" ? savedEntryState : null;
  } catch {
    return null;
  }
}

function writeStoredEntryState(nextEntryState: Exclude<EntryState, "gate">) {
  try {
    window.localStorage?.setItem(ENTRY_STATE_STORAGE_KEY, nextEntryState);
  } catch {
    // 저장소가 막힌 환경에서도 현재 세션 입장은 유지한다.
  }
}

function clearStoredEntryState() {
  try {
    window.localStorage?.removeItem(ENTRY_STATE_STORAGE_KEY);
  } catch {
    // 저장소가 막힌 환경에서는 지울 값도 없다고 보고 넘어간다.
  }
}

function mergeUniquePosts(primaryPosts: PostBundle[], fallbackPosts: PostBundle[]) {
  const seenPostIds = new Set(primaryPosts.map((post) => post.post.id));
  return [...primaryPosts, ...fallbackPosts.filter((post) => !seenPostIds.has(post.post.id))];
}

function mergeUniqueAccounts(primaryAccounts: AccountProfile[], fallbackAccounts: AccountProfile[]) {
  const seenAccountIds = new Set(primaryAccounts.map((account) => account.id));
  return [...primaryAccounts, ...fallbackAccounts.filter((account) => !seenAccountIds.has(account.id))];
}

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function sourceKindLabel(kind: PostBundle["cards"][number]["source"]["kind"]) {
  if (kind === "book") return "책";
  if (kind === "web") return "웹";
  if (kind === "publisher") return "출판사";
  return "직접 새김";
}

function formatSource(source: PostBundle["cards"][number]["source"]) {
  const author = source.author?.trim();
  const work = source.work?.trim();

  if (work && work !== "직접 새김") {
    return author ? `『${work}』 · ${author}` : `『${work}』`;
  }

  if (author) {
    return `${author}의 직접 새김`;
  }

  return work || "직접 새김";
}

function bgWithDim(background: string, dim: number) {
  if (dim <= 0) return background;
  return `linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), ${background}`;
}

const cardFontFamily: Record<CardComposition["font"], string> = {
  gothic: "var(--font-ui)",
  serif: "var(--font-card)",
  round: "var(--font-round)",
  pen: "var(--font-pen)",
  black: "var(--font-black)"
};

function cardSurfaceStyle(card: SentenceCard): CSSProperties {
  return {
    "--cv-text": card.comp.textColor,
    background: bgWithDim(card.comp.bg, card.comp.dim),
    color: card.comp.textColor
  } as CSSProperties;
}

function cardTextStyle(comp: CardComposition, scale = 1): CSSProperties {
  return {
    fontFamily: cardFontFamily[comp.font],
    fontSize: `${Math.round(comp.size * scale)}px`,
    fontWeight: comp.weight,
    textAlign: comp.align
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
    <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}>
      <path d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17l-6-3.6L6 21V4z" />
    </svg>
  );
}

function HeartIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}>
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21 11.5a8.4 8.4 0 0 1-12 7.6L3 21l1.9-6A8.4 8.4 0 1 1 21 11.5z" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <circle cx="5" cy="12" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="19" cy="12" r="1.9" />
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

function Avatar({
  displayName,
  photoUrl,
  size
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

  return (
    <div className={size ? `avatar ${size}` : "avatar"}>
      {showImage ? <img src={cleanPhotoUrl} alt="" onError={() => setImageFailed(true)} /> : initial}
    </div>
  );
}

function OfficialMark({ verification }: { verification: AccountProfile["verification"] }) {
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
  const [entryState, setEntryState] = useState<EntryState>("gate");
  const [isSearching, setIsSearching] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isViewingDrawer, setIsViewingDrawer] = useState(false);
  const [isViewingSettings, setIsViewingSettings] = useState(false);
  const [isViewingNoticeList, setIsViewingNoticeList] = useState(false);
  const [editorialPageState, setEditorialPageState] = useState<EditorialPageState | null>(null);
  const [commentPost, setCommentPost] = useState<PostBundle | null>(null);
  const [infoSheet, setInfoSheet] = useState<InfoSheetState | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostBundle[]>(samplePosts);
  const [accounts, setAccounts] = useState<AccountProfile[]>(sampleAccounts);
  const [currentAccount, setCurrentAccount] = useState<AccountProfile>(
    sampleAccounts.find((account) => account.id === "acct-me") ?? sampleAccounts[0]!
  );
  const displayPostsForUi = mergeUniquePosts(posts, samplePosts);
  const featuredPost = displayPostsForUi[0] ?? samplePosts[0]!;
  const activePost = posts.find((post) => post.post.id === activePostId) ?? featuredPost;
  const selectedProfile =
    selectedProfileId === currentAccount.id
      ? currentAccount
      : accounts.find((account) => account.id === selectedProfileId) ??
        displayPostsForUi.find((post) => post.author.id === selectedProfileId)?.author ??
        currentAccount;
  const selectedProfilePosts = displayPostsForUi.filter((post) => post.author.id === selectedProfile.id);
  const isOwnProfile = selectedProfile.id === currentAccount.id;
  const infoSheetPost = infoSheet ? posts.find((post) => post.post.id === infoSheet.postId) : null;
  const infoSheetCardIndex = infoSheetPost
    ? Math.min(infoSheet?.cardIndex ?? 0, Math.max(infoSheetPost.cards.length - 1, 0))
    : 0;
  const selectedEditorialPage = editorialPageState
    ? editorialPages.find((page) => page.id === editorialPageState.pageId) ?? null
    : null;
  const noticePages = editorialPages.filter((page) => page.kind === "notice");
  const isFullPage =
    isSearching ||
    isEditingProfile ||
    isViewingDrawer ||
    isViewingSettings ||
    isViewingNoticeList ||
    Boolean(editorialPageState);
  const isDiscoverMode = activeTab === "discover" && !isFullPage;
  const isProfileTab = activeTab === "me" && !isFullPage;
  const frameClassName = [
    "mobile-frame",
    isDiscoverMode ? "is-discover" : "",
    isFullPage ? "is-full" : "",
    isProfileTab ? "is-profile" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const topbar = activeTab === "discover" ? topbarCopy.home : topbarCopy[activeTab];
  const activePostIndex = Math.max(
    0,
    posts.findIndex((post) => post.post.id === activePost.post.id)
  );

  function handlePostPublished(post: PostBundle) {
    setPosts((currentPosts) => [post, ...currentPosts.filter((item) => item.post.id !== post.post.id)]);
    setActivePostId(post.post.id);
    setActiveCardIndex(0);
    setIsSearching(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setInfoSheet(null);
    setActiveTab("discover");
  }

  function replacePost(post: PostBundle) {
    setPosts((currentPosts) => currentPosts.map((item) => (item.post.id === post.post.id ? post : item)));
    setCommentPost((currentPost) => (currentPost?.post.id === post.post.id ? post : currentPost));
  }

  function mergePosts(nextPosts: PostBundle[]) {
    setPosts((currentPosts) => {
      const nextPostMap = new Map(nextPosts.map((post) => [post.post.id, post]));
      const currentPostIds = new Set(currentPosts.map((post) => post.post.id));
      const mergedPosts = currentPosts.map((post) => nextPostMap.get(post.post.id) ?? post);
      const newPosts = nextPosts.filter((post) => !currentPostIds.has(post.post.id));

      return [...mergedPosts, ...newPosts];
    });
  }

  function upsertAccount(account: AccountProfile) {
    setAccounts((currentAccounts) => {
      const exists = currentAccounts.some((item) => item.id === account.id);

      if (!exists) {
        return [account, ...currentAccounts];
      }

      return currentAccounts.map((item) => (item.id === account.id ? account : item));
    });
  }

  function replaceAccount(account: AccountProfile) {
    setAccounts((currentAccounts) => currentAccounts.map((item) => (item.id === account.id ? account : item)));
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
                commentCount: post.viewerState?.commentCount ?? 0
              }
            }
          : post
      )
    );
  }

  function enterApp(nextEntryState: Exclude<EntryState, "gate">) {
    setEntryState(nextEntryState);
    setSelectedProfileId(currentAccount.id);
    writeStoredEntryState(nextEntryState);
  }

  function leaveApp() {
    void logoutSession().catch(() => undefined);
    setActiveTab("home");
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setSelectedProfileId(currentAccount.id);
    setEntryState("gate");
    clearStoredEntryState();
  }

  function selectTab(tab: TabKey) {
    setActiveTab(tab);
    setIsSearching(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);

    if (tab === "discover") {
      setActivePostId((currentPostId) => currentPostId ?? featuredPost.post.id);
      setActiveCardIndex(0);
    }

    if (tab !== "me") {
      setIsEditingProfile(false);
      setIsViewingDrawer(false);
      setIsViewingSettings(false);
    } else {
      setSelectedProfileId(currentAccount.id);
    }
  }

  function startGoogleOAuth() {
    window.location.assign(getGoogleOAuthStartUrl());
  }

  function openEditorialPage(page: EditorialPage, origin: EditorialPageOrigin) {
    setCommentPost(null);
    setInfoSheet(null);
    setIsSearching(false);
    setIsViewingNoticeList(false);
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
    setIsViewingNoticeList(true);
    setEditorialPageState(null);
    setActiveTab("me");
  }

  async function handleToggleLike(post: PostBundle) {
    try {
      const updatedPost = post.viewerState?.liked ? await unlikePost(post.post.id) : await likePost(post.post.id);
      replacePost(updatedPost);
    } catch {
      // 네트워크 실패 시 현재 화면 상태를 유지한다.
    }
  }

  async function handleToggleCarve(post: PostBundle) {
    try {
      const updatedPost = post.viewerState?.carved ? await uncarvePost(post.post.id) : await carvePost(post.post.id);
      replacePost(updatedPost);
    } catch {
      // 새김은 비공개 간직 액션이라 실패 시 조용히 유지한다.
    }
  }

  async function handleUpdateProfile(input: UpdateAccountInput) {
    const updatedAccount = await updateCurrentAccount(input);
    setCurrentAccount(updatedAccount);
    setIsEditingProfile(false);
  }

  async function handleToggleFollow(accountId: string, subscribed: boolean) {
    try {
      const updatedAccount = subscribed ? await unfollowAccount(accountId) : await followAccount(accountId);
      replaceAccount(updatedAccount);
    } catch {
      // 구독은 관계 액션이라 실패 시 화면 상태를 그대로 둔다.
    }
  }

  function openPost(post: PostBundle) {
    setPosts((currentPosts) => {
      const exists = currentPosts.some((item) => item.post.id === post.post.id);

      if (!exists) {
        return [post, ...currentPosts];
      }

      return currentPosts.map((item) => (item.post.id === post.post.id ? post : item));
    });
    setActivePostId(post.post.id);
    setActiveCardIndex(0);
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setActiveTab("discover");
  }

  async function openProfile(account: AccountProfile) {
    upsertAccount(account);
    setSelectedProfileId(account.id);
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setIsViewingSettings(false);
    setIsViewingNoticeList(false);
    setEditorialPageState(null);
    setCommentPost(null);
    setInfoSheet(null);
    setActiveTab("me");

    try {
      const detail = await fetchAccountDetail(account.id);
      upsertAccount(detail.account);
      mergePosts(detail.posts);
    } catch {
      // 계정 상세 API가 실패해도 이미 가진 계정 정보로 프로필을 유지한다.
    }
  }

  function movePost(direction: -1 | 1) {
    const nextIndex = activePostIndex + direction;
    const nextPost = posts[nextIndex];

    if (!nextPost) {
      return;
    }

    setActivePostId(nextPost.post.id);
    setActiveCardIndex(0);
    setCommentPost(null);
    setInfoSheet(null);
  }

  function selectCard(index: number) {
    setActiveCardIndex(Math.min(Math.max(index, 0), activePost.cards.length - 1));
  }

  function openInfoSheet(post: PostBundle, cardIndex: number) {
    setCommentPost(null);
    setInfoSheet({ postId: post.post.id, cardIndex });
  }

  useEffect(() => {
    const savedEntryState = readStoredEntryState();
    if (savedEntryState) {
      setEntryState(savedEntryState);
      return;
    }

    const controller = new AbortController();

    async function restoreSession() {
      try {
        const session = await fetchAuthSession(controller.signal);
        if (session.authenticated) {
          setEntryState("signed-in");
          writeStoredEntryState("signed-in");
        }
      } catch {
        // 세션이 없거나 API가 꺼져 있으면 로그인 게이트를 유지한다.
      }
    }

    void restoreSession();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (entryState === "gate") {
      return;
    }

    const controller = new AbortController();

    async function loadInitialData() {
      try {
        const [nextPosts, nextAccounts, nextCurrentAccount] = await Promise.all([
          fetchFeed(controller.signal),
          fetchRecommendedAccounts(controller.signal),
          fetchCurrentAccount(controller.signal)
        ]);

        if (nextPosts.length > 0) {
          setPosts(nextPosts);
        }

        if (nextAccounts.length > 0) {
          setAccounts(nextAccounts);
        }

        setCurrentAccount(nextCurrentAccount);
      } catch {
        // API가 아직 꺼져 있어도 프로토타입 샘플로 첫 화면을 유지한다.
      }
    }

    void loadInitialData();
    return () => controller.abort();
  }, [entryState]);

  useEffect(() => {
    setActiveCardIndex((currentIndex) => Math.min(currentIndex, Math.max(activePost.cards.length - 1, 0)));
  }, [activePost.cards.length, activePost.post.id]);

  const content = useMemo(() => {
    if (selectedEditorialPage) {
      return (
        <EditorialPageView
          page={selectedEditorialPage}
          onBack={closeEditorialPage}
          onOpenDiscover={() => openPost(featuredPost)}
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
      return <SearchView onClose={() => setIsSearching(false)} onOpenPost={openPost} onOpenProfile={openProfile} />;
    }

    if (activeTab === "discover") {
      return (
        <DiscoverView
          activeCardIndex={activeCardIndex}
          currentAccountId={currentAccount.id}
          post={activePost}
          postCount={posts.length}
          postIndex={activePostIndex}
          onNextCard={() => selectCard(activeCardIndex + 1)}
          onNextPost={() => movePost(1)}
          onPreviousCard={() => selectCard(activeCardIndex - 1)}
          onPreviousPost={() => movePost(-1)}
          onSelectCard={selectCard}
          onToggleCarve={handleToggleCarve}
          onOpenComments={(post) => {
            setInfoSheet(null);
            setCommentPost(post);
          }}
          onOpenInfo={openInfoSheet}
          onOpenProfile={openProfile}
          onToggleFollow={handleToggleFollow}
          onToggleLike={handleToggleLike}
        />
      );
    }
    if (activeTab === "capture") return <CaptureView onPublished={handlePostPublished} />;
    if (activeTab === "shelf") return <ShelfView posts={posts} onOpenPost={openPost} />;
    if (activeTab === "me") {
      if (isViewingSettings) {
        return (
          <SettingsView
            onBack={() => setIsViewingSettings(false)}
            onEditProfile={() => {
              setIsViewingSettings(false);
              setIsEditingProfile(true);
            }}
            onLogout={leaveApp}
            onOpenDrawer={() => {
              setIsViewingSettings(false);
              setIsViewingDrawer(true);
            }}
            onOpenNotices={openNoticeList}
          />
        );
      }

      if (isViewingDrawer) {
        return <DrawerView onBack={() => setIsViewingDrawer(false)} onOpenPost={openPost} />;
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
          onEdit={() => setIsEditingProfile(true)}
          isOwnProfile={isOwnProfile}
          onOpenPost={openPost}
          onOpenProfile={() => setSelectedProfileId(currentAccount.id)}
          onOpenSettings={() => setIsViewingSettings(true)}
          onToggleFollow={handleToggleFollow}
          posts={selectedProfilePosts}
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
    currentAccount,
    featuredPost,
    isEditingProfile,
    isSearching,
    isViewingDrawer,
    isViewingNoticeList,
    isViewingSettings,
    isOwnProfile,
    noticePages,
    posts,
    displayPostsForUi,
    selectedEditorialPage,
    selectedProfile,
    selectedProfilePosts
  ]);

  return (
    <main className="app-shell" aria-label="새김 앱">
      <section className={frameClassName}>
        {entryState === "gate" ? (
          <AuthGate onEnter={enterApp} onGoogleLogin={startGoogleOAuth} />
        ) : (
          <>
            {isDiscoverMode || isFullPage || isProfileTab ? null : (
              <header className="topbar">
                <div>
                  <div className={activeTab === "home" ? "wordmark brand" : "wordmark"}>{topbar.title}</div>
                  <p>{topbar.subtitle}</p>
                </div>
              <button
                className="icon-button"
                type="button"
                aria-label="검색"
                onClick={() => {
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
              <CommentSheet post={commentPost} onClose={() => setCommentPost(null)} onPostChange={replacePost} />
            ) : null}

            {infoSheet && infoSheetPost ? (
              <PostInfoSheet
                cardIndex={infoSheetCardIndex}
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
                    className={tabKey === activeTab ? "tab is-active" : "tab"}
                    type="button"
                    onClick={() => selectTab(tabKey)}
                    aria-label={tabLabels[tabKey]}
                    aria-current={tabKey === activeTab ? "page" : undefined}
                  >
                    <TabIcon tab={tabKey} />
                  </button>
                ))}
                  <span className="tab tab-spacer" aria-hidden="true" />
                  {(["shelf", "me"] as const).map((tabKey) => (
                    <button
                      key={tabKey}
                      className={tabKey === activeTab ? "tab is-active" : "tab"}
                      type="button"
                      onClick={() => selectTab(tabKey)}
                      aria-label={tabLabels[tabKey]}
                      aria-current={tabKey === activeTab ? "page" : undefined}
                    >
                      {tabKey === "me" ? (
                        <Avatar
                          displayName={currentAccount.displayName}
                          photoUrl={currentAccount.photoUrl}
                          size="tab"
                        />
                      ) : (
                        <TabIcon tab={tabKey} />
                      )}
                    </button>
                  ))}
                </nav>
                <button
                  className={activeTab === "capture" ? "fab is-active" : "fab"}
                  type="button"
                  aria-label={tabLabels.capture}
                  aria-current={activeTab === "capture" ? "page" : undefined}
                  onClick={() => selectTab("capture")}
                >
                  <PlusIcon />
                </button>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function AuthGate({
  onEnter,
  onGoogleLogin
}: {
  onEnter: (entryState: Exclude<EntryState, "gate">) => void;
  onGoogleLogin: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const isSignup = mode === "signup";
  const submitLabel = isSignup ? "가입하기" : "로그인";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onEnter("signed-in");
  }

  return (
    <section className="auth-gate" aria-label="로그인">
      <div className="auth-card">
        <div className="auth-brand">새김</div>

        <form className="auth-panel" onSubmit={handleSubmit}>
          <h2>{isSignup ? "새김 시작하기" : "다시 만나 반가워요"}</h2>
          <p className="auth-sub">
            {isSignup ? "마음에 닿은 문장을 모아보세요" : "문장을 새기고, 곁에 두는 공간"}
          </p>

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
            placeholder={isSignup ? "비밀번호 (8자 이상)" : "비밀번호"}
            type="password"
            value={password}
          />

          {isSignup ? (
            <label className="auth-agree">
              <input checked={agreed} onChange={(event) => setAgreed(event.target.checked)} type="checkbox" />
              <span>이용약관 및 개인정보 처리방침에 동의합니다</span>
            </label>
          ) : null}

          <button className="auth-btn" type="submit">
            {submitLabel}
          </button>
        </form>

        {!isSignup ? (
          <>
            <div className="auth-div">
              <span>또는</span>
            </div>
            <button className="auth-social google" type="button" onClick={onGoogleLogin}>
              Google로 계속하기
            </button>
          </>
        ) : null}

        <div className="auth-alt">
          {isSignup ? "이미 계정이 있으신가요?" : "아직 계정이 없으신가요?"}{" "}
          <button type="button" onClick={() => setMode(isSignup ? "login" : "signup")}>
            {isSignup ? "로그인" : "회원가입"}
          </button>
        </div>

        <button className="auth-guest" type="button" onClick={() => onEnter("guest")}>
          로그인 없이 둘러보기
        </button>
      </div>
    </section>
  );
}

function SearchView({
  onClose,
  onOpenPost,
  onOpenProfile
}: {
  onClose: () => void;
  onOpenPost: (post: PostBundle) => void;
  onOpenProfile: (account: AccountProfile) => void;
}) {
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<"all" | "accounts" | "posts">("all");
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [posts, setPosts] = useState<PostBundle[]>([]);
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [error, setError] = useState("");
  const cleanQuery = query.trim();
  const lowerQuery = cleanQuery.toLowerCase();
  const recentQueries = ["윤동주", "위로", "밤"];
  const fallbackAccounts = cleanQuery
    ? sampleAccounts.filter((account) =>
        `${account.displayName} ${account.handle} ${account.tagline} ${account.bio ?? ""}`.toLowerCase().includes(lowerQuery)
      )
    : [];
  const fallbackPosts = cleanQuery
    ? samplePosts.filter((post) =>
        `${post.post.title} ${post.author.displayName} ${post.cards
          .map((card) => `${card.text} ${card.tags.join(" ")}`)
          .join(" ")}`.toLowerCase().includes(lowerQuery)
      )
    : [];
  const resultAccounts = cleanQuery ? mergeUniqueAccounts(accounts, fallbackAccounts) : accounts;
  const resultPosts = cleanQuery ? mergeUniquePosts(posts, fallbackPosts) : posts;
  const suggestedPosts = mergeUniquePosts(posts, samplePosts)
    .slice()
    .sort((a, b) => (b.viewerState?.likeCount ?? 0) - (a.viewerState?.likeCount ?? 0))
    .slice(0, 4);
  const visibleAccounts = segment === "posts" ? [] : resultAccounts;
  const visiblePosts = segment === "accounts" ? [] : resultPosts;

  useEffect(() => {
    const controller = new AbortController();

    async function loadSearch() {
      try {
        setStatus("loading");
        setError("");
        const result = await fetchSearch(query, controller.signal);
        setAccounts(result.accounts);
        setPosts(result.posts);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("idle");
          setError("검색 결과를 불러올 수 없어요.");
        }
      }
    }

    void loadSearch();
    return () => controller.abort();
  }, [query]);

  const isEmpty = cleanQuery.length > 0 && status !== "loading" && visibleAccounts.length === 0 && visiblePosts.length === 0;

  return (
    <section className="search-view">
      <div className="search-head">
        <button className="back-icon" type="button" onClick={onClose} aria-label="검색 닫기">
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
            <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">
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
            ["posts", "글"]
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
          <div className="search-label">최근 검색</div>
          <div className="search-chip-row">
            {recentQueries.map((item) => (
              <button key={item} type="button" onClick={() => setQuery(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="search-label">인기 있는 글</div>
          <div className="masonry">
            {suggestedPosts.map((post) => (
              <PostPreviewButton key={post.post.id} post={post} onOpenPost={onOpenPost} />
            ))}
          </div>
        </section>
      ) : null}

      {cleanQuery && visibleAccounts.length > 0 ? (
        <section className="search-section">
          <h2>계정</h2>
          <div className="search-account-list">
            {visibleAccounts.map((account) => (
              <button
                className="search-account-row"
                key={account.id}
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
                    글 {formatCount(account.postCount)}개 · 글벗 {formatCount(account.writingFriendCount)}
                  </small>
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {cleanQuery && visiblePosts.length > 0 ? (
        <section className="search-section">
          <h2>글</h2>
          <div className="masonry">
            {visiblePosts.map((post) => (
              <PostPreviewButton key={post.post.id} post={post} onOpenPost={onOpenPost} />
            ))}
          </div>
        </section>
      ) : null}

      {cleanQuery && status === "loading" ? <p className="search-empty">찾는 중</p> : null}
      {isEmpty ? <p className="search-empty">‘{cleanQuery}’에 대한 결과가 없어요.</p> : null}
      {error && visibleAccounts.length === 0 && visiblePosts.length === 0 ? <p className="search-empty">{error}</p> : null}
    </section>
  );
}

function PostPreviewButton({
  hideAuthor = false,
  hideLikeCount = false,
  post,
  onOpenPost
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
      className="shelf-card post-card-button"
      type="button"
      onClick={() => onOpenPost(post)}
      style={cardSurfaceStyle(card)}
    >
      {post.post.cardCount > 1 ? <span className="page-badge">{post.post.cardCount}장</span> : null}
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
            {hideLikeCount ? null : <span className="mtr">♡ {formatCount(likeCount)}</span>}
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
  onToggleFollow
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
  const displayPosts = mergeUniquePosts(posts, samplePosts);
  const displayAccounts = mergeUniqueAccounts(accounts, sampleAccounts).filter(
    (account) => account.id !== currentAccountId
  );
  const heroPost = displayPosts[0] ?? samplePosts[0]!;
  const heroCard = heroPost.cards[0]!;
  const todayPosts = displayPosts.slice(0, 5);
  const heroItems = [
    {
      kind: "post" as const,
      key: heroPost.post.id,
      tag: "오늘 닿은 글",
      text: heroCard.text,
      by: `${heroPost.author.displayName} · 『${heroPost.post.title}』`,
      style: cardSurfaceStyle(heroCard),
      onOpen: () => onOpenPost(heroPost)
    },
    ...editorialPages.map((page) => ({
      kind: "page" as const,
      key: page.id,
      tag: page.label,
      text: page.title,
      by: page.kind === "ad" ? "제휴 · 광고" : page.date,
      style: {
        "--cv-text": "#FBF8FC",
        background: editorialHeroBackgrounds[page.kind],
        color: "#FBF8FC"
      } as CSSProperties,
      onOpen: () => onOpenEditorialPage(page)
    }))
  ];
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    setHeroIndex(0);
  }, [heroPost.post.id, editorialPages.length]);

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
        <div className="hb-viewport">
          <div className="hb-track" style={{ transform: `translateX(-${heroIndex * 100}%)` }}>
            {heroItems.map((item) => (
              <button className="hb-slide" key={item.key} type="button" onClick={item.onOpen} style={item.style}>
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
              className={index === heroIndex ? "is-active" : undefined}
              key={item.key}
              type="button"
              onClick={() => setHeroIndex(index)}
            />
          ))}
        </div>
      </div>

      <section className="home-sec">
        <div className="home-h">
          오늘 닿은 글
          <button type="button" onClick={onOpenAllPosts}>
            전체 ›
          </button>
        </div>
        <div className="home-rail">
          {todayPosts.map((item) => (
            <PostPreviewButton key={item.post.id} post={item} onOpenPost={onOpenPost} />
          ))}
        </div>
      </section>

      <section className="home-sec">
        <div className="home-h">추천 글벗</div>
        <div className="home-rail account-rail">
          {displayAccounts.map((account) => {
            const isSubscribed = account.viewerState?.subscribed ?? false;

            return (
              <article className="home-acct account-chip" key={account.id}>
                <button className="account-chip-main" type="button" onClick={() => onOpenProfile(account)}>
                  <Avatar displayName={account.displayName} photoUrl={account.photoUrl} />
                  <div>
                    <strong>
                      <AccountName account={account} />
                    </strong>
                    <p>{account.tagline}</p>
                    <small className="fol">
                      글 {formatCount(account.postCount)}개 · 글벗 {formatCount(account.writingFriendCount)}
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
          })}
        </div>
      </section>
    </div>
  );
}

function DiscoverView({
  activeCardIndex,
  currentAccountId,
  post,
  postCount,
  postIndex,
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
  onToggleLike
}: {
  activeCardIndex: number;
  currentAccountId: string;
  post: PostBundle;
  postCount: number;
  postIndex: number;
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

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.key === "ArrowUp" && hasPreviousPost) {
        event.preventDefault();
        onPreviousPost();
      }
      if (event.key === "ArrowDown" && hasNextPost) {
        event.preventDefault();
        onNextPost();
      }
      if (event.key === "ArrowLeft" && hasPreviousCard) {
        event.preventDefault();
        onPreviousCard();
      }
      if (event.key === "ArrowRight" && hasNextCard) {
        event.preventDefault();
        onNextCard();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNextCard, hasNextPost, hasPreviousCard, hasPreviousPost, onNextCard, onNextPost, onPreviousCard, onPreviousPost]);

  return (
    <article className="discover-view">
      {shouldShowTitle ? <div className="detail-title">{post.post.title}</div> : null}
      <div className="feed-controls" aria-label="글 이동">
        <button type="button" onClick={onPreviousPost} disabled={!hasPreviousPost} aria-label="이전 글">
          ↑
        </button>
        <span>
          {postIndex + 1}/{postCount}
        </span>
        <button type="button" onClick={onNextPost} disabled={!hasNextPost} aria-label="다음 글">
          ↓
        </button>
      </div>
      <div className="sentence-card discover-card" style={cardSurfaceStyle(card)}>
        <div className="cv-grain" aria-hidden="true" />
        {post.cards.length > 1 ? (
          <button
            className="card-step card-step-prev"
            type="button"
            onClick={onPreviousCard}
            disabled={!hasPreviousCard}
            aria-label="이전 장"
          >
            ‹
          </button>
        ) : null}
        <div className="cmp-layer">
          <p className="cmp-text" style={cardTextStyle(card.comp)}>
            {card.text}
          </p>
          {cardSourceLabel(card) ? <div className="cmp-src">{cardSourceLabel(card)}</div> : null}
        </div>
        {post.cards.length > 1 ? (
          <button
            className="card-step card-step-next"
            type="button"
            onClick={onNextCard}
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
        <button className="writer-identity" type="button" onClick={() => onOpenProfile(post.author)}>
          <Avatar displayName={post.author.displayName} photoUrl={post.author.photoUrl} />
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
        <button type="button" aria-label="댓글" onClick={() => onOpenComments(post)}>
          <span className="ring">
            <CommentIcon />
          </span>
          <small>{formatCount(viewerState?.commentCount ?? 0)}</small>
        </button>
        <button type="button" aria-label="더보기" onClick={() => onOpenInfo(post, activeCardIndex)}>
          <span className="ring">
            <MoreIcon />
          </span>
        </button>
      </aside>
    </article>
  );
}

function PostInfoSheet({
  cardIndex,
  onClose,
  post
}: {
  cardIndex: number;
  onClose: () => void;
  post: PostBundle;
}) {
  const card = post.cards[cardIndex] ?? post.cards[0]!;
  const tags = card.tags.filter(Boolean);
  const actions = ["공유하기", "링크 복사", "책으로 보기", "신고"];

  return (
    <>
      <button className="comment-backdrop" type="button" aria-label="글 정보 닫기" onClick={onClose} />
      <section className="info-sheet" aria-label="글 정보">
        <div className="info-sheet-head">
          <div>
            <strong>글 정보</strong>
            <span>
              {cardIndex + 1}/{post.cards.length}장
            </span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="info-summary">
          <Avatar displayName={post.author.displayName} photoUrl={post.author.photoUrl} size="mini" />
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
            <small>{sourceKindLabel(card.source.kind)}</small>
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

        <div className="info-actions" aria-label="준비 중인 글 기능">
          {actions.map((action) => (
            <button key={action} type="button" disabled>
              <span>{action}</span>
              <small>준비 중</small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function CommentSheet({
  post,
  onClose,
  onPostChange
}: {
  post: PostBundle;
  onClose: () => void;
  onPostChange: (post: PostBundle) => void;
}) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"loading" | "idle" | "submitting">("loading");
  const [error, setError] = useState("");
  const canSubmit = body.trim().length > 0 && status !== "submitting";

  useEffect(() => {
    const controller = new AbortController();

    async function loadComments() {
      try {
        setStatus("loading");
        setError("");
        const nextComments = await fetchPostComments(post.post.id, controller.signal);
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
      setStatus("idle");
    } catch {
      setStatus("idle");
      setError("댓글을 남길 수 없어요. API 서버를 확인해 주세요.");
    }
  }

  return (
    <>
      <button className="comment-backdrop" type="button" aria-label="댓글 닫기" onClick={onClose} />
      <section className="comment-sheet" aria-label="댓글">
        <div className="comment-sheet-head">
          <div>
            <strong>댓글</strong>
            <span>{formatCount(post.viewerState?.commentCount ?? comments.length)}개</span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>

        <div className="comment-list">
          {status === "loading" ? <p className="comment-empty">불러오는 중</p> : null}
          {status !== "loading" && comments.length === 0 ? <p className="comment-empty">아직 댓글이 없어요.</p> : null}
          {comments.map((comment) => (
            <article className="comment-item" key={comment.id}>
              <Avatar displayName={comment.author.displayName} photoUrl={comment.author.photoUrl} size="mini" />
              <div>
                <header>
                  <strong>
                    <AccountName account={comment.author} />
                  </strong>
                  <time dateTime={comment.createdAt}>{formatCommentDate(comment.createdAt)}</time>
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
            placeholder="짧게 남기기"
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

function CaptureView({ onPublished }: { onPublished: (post: PostBundle) => void }) {
  const [cards, setCards] = useState([""]);
  const [activeDraftIndex, setActiveDraftIndex] = useState(0);
  const [title, setTitle] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [sourceWork, setSourceWork] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState("");
  const activeSentence = cards[activeDraftIndex] ?? "";
  const canPublish = cards.some((card) => card.trim().length > 0) && status !== "submitting";

  function updateActiveSentence(value: string) {
    setCards((currentCards) => currentCards.map((card, index) => (index === activeDraftIndex ? value : card)));
  }

  function addDraftCard() {
    setCards((currentCards) => [...currentCards, ""]);
    setActiveDraftIndex(cards.length);
    setError("");
  }

  function removeDraftCard() {
    if (cards.length <= 1) {
      return;
    }

    if (!window.confirm("이 장을 삭제할까요?")) {
      return;
    }

    const nextCards = cards.filter((_, index) => index !== activeDraftIndex);
    setCards(nextCards);
    setActiveDraftIndex(Math.min(activeDraftIndex, nextCards.length - 1));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanCards = cards.map((card) => card.trim()).filter(Boolean);
    if (cleanCards.length === 0) {
      setError("문장을 먼저 적어 주세요.");
      return;
    }

    const cleanTitle = title.trim();
    const cleanAuthor = sourceAuthor.trim();
    const cleanWork = sourceWork.trim();
    const tagList = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 3);
    const input: CreatePostInput = {
      visibility: "public",
      creationType: "original",
      cards: cleanCards.map((text) => ({
        text,
        comp: DEFAULT_CARD_COMP,
        source: {
          kind: "direct",
          ...(cleanAuthor ? { author: cleanAuthor } : {}),
          ...(cleanWork ? { work: cleanWork } : {})
        },
        tags: tagList
      }))
    };

    if (cleanTitle) {
      input.title = cleanTitle;
    }

    try {
      setStatus("submitting");
      setError("");
      const publishedPost = await createPost(input);
      setCards([""]);
      setActiveDraftIndex(0);
      setTitle("");
      setSourceAuthor("");
      setSourceWork("");
      setTags("");
      onPublished(publishedPost);
    } catch {
      setError("지금은 발행할 수 없어요. API 서버를 확인해 주세요.");
      setStatus("idle");
    }
  }

  return (
    <form className="capture-view" onSubmit={handleSubmit}>
      <div className="capture-pagebar" aria-label="장 관리">
        <button
          type="button"
          onClick={() => setActiveDraftIndex(Math.max(activeDraftIndex - 1, 0))}
          disabled={activeDraftIndex === 0}
          aria-label="이전 장"
        >
          ←
        </button>
        <span>
          {activeDraftIndex + 1}/{cards.length}장
        </span>
        <button
          type="button"
          onClick={() => setActiveDraftIndex(Math.min(activeDraftIndex + 1, cards.length - 1))}
          disabled={activeDraftIndex === cards.length - 1}
          aria-label="다음 장"
        >
          →
        </button>
        <button type="button" onClick={addDraftCard}>
          + 장
        </button>
        <button type="button" onClick={removeDraftCard} disabled={cards.length <= 1}>
          삭제
        </button>
      </div>

      <div className="capture-page-tabs" aria-label="장 목록">
        {cards.map((card, index) => (
          <button
            className={index === activeDraftIndex ? "is-active" : undefined}
            key={index}
            type="button"
            onClick={() => setActiveDraftIndex(index)}
          >
            <span>{index + 1}장</span>
            <small>{card.trim() ? "작성됨" : "비어 있음"}</small>
          </button>
        ))}
      </div>

      <div className="sentence-card editable capture-card">
        <textarea
          aria-label={`${activeDraftIndex + 1}장 문장`}
          value={activeSentence}
          onChange={(event) => updateActiveSentence(event.target.value)}
          placeholder={`${activeDraftIndex + 1}장 문장 쓰기`}
          maxLength={240}
        />
      </div>
      <label className="capture-field">
        <span>제목</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="비우면 첫 문장이 제목" />
      </label>
      <div className="capture-field-grid">
        <label className="capture-field">
          <span>저자</span>
          <input value={sourceAuthor} onChange={(event) => setSourceAuthor(event.target.value)} placeholder="선택" />
        </label>
        <label className="capture-field">
          <span>책</span>
          <input value={sourceWork} onChange={(event) => setSourceWork(event.target.value)} placeholder="선택" />
        </label>
      </div>
      <label className="capture-field">
        <span>태그</span>
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="쉼표로 3개까지" />
      </label>
      <div className="tool-row" aria-label="카드 작성 도구">
        <button type="button">제목</button>
        <button type="button">배경</button>
        <button type="button">출처</button>
        <button type="button">태그</button>
      </div>
      {error ? <p className="capture-error">{error}</p> : null}
      <button className="primary-button" type="submit" disabled={!canPublish}>
        {status === "submitting" ? "발행 중" : "발행"}
      </button>
    </form>
  );
}

function ShelfView({ posts, onOpenPost }: { posts: PostBundle[]; onOpenPost: (post: PostBundle) => void }) {
  const [sortMode, setSortMode] = useState<"popular" | "new">("popular");
  const displayPosts = mergeUniquePosts(posts, samplePosts);
  const heroPost = displayPosts
    .slice()
    .sort((a, b) => (b.viewerState?.likeCount ?? 0) - (a.viewerState?.likeCount ?? 0))[0]!;
  const heroCard = heroPost.cards[0]!;
  const sortedPosts = displayPosts.slice().sort((a, b) => {
    if (sortMode === "popular") {
      return (b.viewerState?.likeCount ?? 0) - (a.viewerState?.likeCount ?? 0);
    }

    return Date.parse(b.post.createdAt) - Date.parse(a.post.createdAt);
  });

  return (
    <section className="shelf-view">
      <button className="shelf-hero" type="button" onClick={() => onOpenPost(heroPost)} style={cardSurfaceStyle(heroCard)}>
        <div className="tag">✦ 에디터 픽 · 오늘의 글</div>
        <div className="htt">{heroPost.post.title}</div>
        <div className="hq">{heroCard.text}</div>
        <div className="hm">
          {heroPost.post.cardCount}장 · ♡ {formatCount(heroPost.viewerState?.likeCount ?? 0)} ·{" "}
          <AccountName account={heroPost.author} />
        </div>
      </button>
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
        {sortedPosts.map((post) => (
          <PostPreviewButton key={post.post.id} post={post} onOpenPost={onOpenPost} />
        ))}
      </div>
    </section>
  );
}

function EditorialPageView({
  page,
  onBack,
  onOpenDiscover
}: {
  page: EditorialPage;
  onBack: () => void;
  onOpenDiscover: () => void;
}) {
  const isContactCta = page.cta?.action === "contact";

  return (
    <article className="editorial-page">
      <div className="page-head">
        <button className="back-icon" type="button" onClick={onBack} aria-label="이전으로 돌아가기">
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
  pages
}: {
  onBack: () => void;
  onOpenPage: (page: EditorialPage) => void;
  pages: EditorialPage[];
}) {
  return (
    <section className="notice-list-view">
      <div className="settings-head">
        <button className="back-icon" type="button" onClick={onBack} aria-label="설정으로 돌아가기">
          ←
        </button>
        <div>
          <h2>공지사항</h2>
          <p>새김에서 전하는 소식</p>
        </div>
      </div>

      <div className="notice-list">
        {pages.map((page) => (
          <button className="notice-row" key={page.id} type="button" onClick={() => onOpenPage(page)}>
            <span>{page.label}</span>
            <strong>{page.title}</strong>
            <p>{page.summary}</p>
            <small>{page.date}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function SettingsView({
  onBack,
  onEditProfile,
  onLogout,
  onOpenDrawer,
  onOpenNotices
}: {
  onBack: () => void;
  onEditProfile: () => void;
  onLogout: () => void;
  onOpenDrawer: () => void;
  onOpenNotices: () => void;
}) {
  const sections: Array<{
    title: string;
    rows: Array<{ label: string; onClick?: () => void; state?: string }>;
  }> = [
    {
      title: "계정",
      rows: [{ label: "프로필 편집", onClick: onEditProfile }]
    },
    {
      title: "활동",
      rows: [{ label: "내 서랍", onClick: onOpenDrawer }, { label: "구독 목록", state: "준비 중" }]
    },
    {
      title: "알림",
      rows: [{ label: "푸시 알림", state: "준비 중" }, { label: "새김 소식", state: "준비 중" }]
    },
    {
      title: "정보",
      rows: [
        { label: "공지사항", onClick: onOpenNotices },
        { label: "이용약관", state: "준비 중" },
        { label: "개인정보 처리방침", state: "준비 중" },
        { label: "문의하기", state: "준비 중" }
      ]
    }
  ];

  return (
    <section className="settings-view">
      <div className="settings-head">
        <button className="back-icon" type="button" onClick={onBack} aria-label="프로필로 돌아가기">
          ←
        </button>
        <div>
          <h2>설정</h2>
          <p>계정과 활동을 조용히 정리해요.</p>
        </div>
      </div>

      <div className="settings-groups">
        {sections.map((section) => (
          <section className="settings-section" key={section.title}>
            <h3>{section.title}</h3>
            <div className="settings-list">
              {section.rows.map((row) => (
                <button
                  className={!row.onClick ? "settings-row is-disabled" : "settings-row"}
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
      <p className="settings-version">새김 · 버전 1.0.0 (MVP)</p>
    </section>
  );
}

function DrawerView({ onBack, onOpenPost }: { onBack: () => void; onOpenPost: (post: PostBundle) => void }) {
  const [drawerPosts, setDrawerPosts] = useState<PostBundle[]>([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<"recent" | "author">("recent");
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadDrawer() {
      try {
        setStatus("loading");
        setError("");
        const nextPosts = await fetchDrawer(controller.signal);
        setDrawerPosts(nextPosts);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) {
          setStatus("idle");
          setError("서랍을 불러올 수 없어요.");
        }
      }
    }

    void loadDrawer();
    return () => controller.abort();
  }, []);

  const visiblePosts = drawerPosts
    .filter((post) => {
      const cleanQuery = query.trim().toLowerCase();
      if (!cleanQuery) return true;

      return `${post.post.title} ${post.author.displayName} ${post.cards.map((card) => card.text).join(" ")}`
        .toLowerCase()
        .includes(cleanQuery);
    })
    .sort((a, b) => {
      if (sortMode === "author") {
        return a.author.displayName.localeCompare(b.author.displayName, "ko");
      }

      return Date.parse(b.post.updatedAt) - Date.parse(a.post.updatedAt);
    });

  return (
    <section className="drawer-view">
      <div className="drawer-head">
        <button className="back-icon" type="button" onClick={onBack} aria-label="프로필로 돌아가기">
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
        <div className="drawer-sort" aria-label="서랍 정렬">
          <button
            className={sortMode === "recent" ? "is-active" : undefined}
            type="button"
            onClick={() => setSortMode("recent")}
          >
            최신
          </button>
          <button
            className={sortMode === "author" ? "is-active" : undefined}
            type="button"
            onClick={() => setSortMode("author")}
          >
            작가
          </button>
        </div>
      </div>

      {status === "loading" ? <p className="drawer-empty">불러오는 중</p> : null}
      {status !== "loading" && drawerPosts.length === 0 ? (
        <p className="drawer-empty">아직 간직한 글이 없어요.</p>
      ) : null}
      {status !== "loading" && drawerPosts.length > 0 && visiblePosts.length === 0 ? (
        <p className="drawer-empty">검색에 맞는 글이 없어요.</p>
      ) : null}
      {error ? <p className="drawer-empty">{error}</p> : null}
      {visiblePosts.length > 0 ? (
        <div className="masonry">
          {visiblePosts.map((post) => (
            <PostPreviewButton key={post.post.id} post={post} onOpenPost={onOpenPost} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProfileView({
  account,
  isOwnProfile,
  onEdit,
  onOpenPost,
  onOpenProfile,
  onOpenSettings,
  onToggleFollow,
  posts
}: {
  account: AccountProfile;
  isOwnProfile: boolean;
  onEdit: () => void;
  onOpenPost: (post: PostBundle) => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onToggleFollow: (accountId: string, subscribed: boolean) => void;
  posts: PostBundle[];
}) {
  const isSubscribed = account.viewerState?.subscribed ?? false;
  const shelfTitle = isOwnProfile ? "내 글" : `${account.displayName}의 글`;

  return (
    <section className="profile-view">
      <div className="profile-top">
        {isOwnProfile ? (
          <span aria-hidden="true" />
        ) : (
          <button className="profile-icon-button" type="button" onClick={onOpenProfile} aria-label="내 프로필로 돌아가기">
            ←
          </button>
        )}
        {isOwnProfile ? (
          <button className="profile-icon-button" type="button" onClick={onOpenSettings} aria-label="설정">
            <MenuIcon />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </div>
      <div className="profile-head">
        <Avatar displayName={account.displayName} photoUrl={account.photoUrl} size="large" />
        <div className="profile-meta">
          <h2>
            <AccountName account={account} />
          </h2>
          <p>{account.tagline}</p>
          <small>
            글 {formatCount(account.postCount)}개 · 글벗 {formatCount(account.writingFriendCount)}
          </small>
        </div>
        {isOwnProfile ? (
          <button className="profile-sub ghost" type="button" onClick={onEdit}>
            프로필 편집
          </button>
        ) : (
          <button
            className={isSubscribed ? "profile-sub is-subscribed" : "profile-sub"}
            type="button"
            aria-pressed={isSubscribed}
            onClick={() => onToggleFollow(account.id, isSubscribed)}
          >
            {isSubscribed ? "구독중" : "구독"}
          </button>
        )}
      </div>
      {account.bio && account.bio !== account.tagline ? <div className="profile-bio">{account.bio}</div> : null}

      <section className="profile-posts">
        <div className="profile-shelf-head">
          <h2>{shelfTitle}</h2>
          <span>글 {formatCount(posts.length)}</span>
        </div>
        {posts.length > 0 ? (
          <div className="masonry">
            {posts.map((post) => (
              <PostPreviewButton
                hideAuthor
                hideLikeCount={isOwnProfile}
                key={post.post.id}
                post={post}
                onOpenPost={onOpenPost}
              />
            ))}
          </div>
        ) : (
          <p className="profile-empty">아직 공개된 글이 없어요.</p>
        )}
      </section>
    </section>
  );
}

function ProfileEditView({
  account,
  onCancel,
  onSubmit
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
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!displayName.trim()) {
      setError("닉네임을 입력해 주세요.");
      return;
    }

    try {
      setStatus("saving");
      setError("");
      await onSubmit({
        displayName: displayName.trim(),
        tagline: tagline.trim(),
        bio: bio.trim() || null,
        photoUrl: photoUrl.trim() || null
      });
    } catch {
      setStatus("idle");
      setError("프로필을 저장할 수 없어요. API 서버를 확인해 주세요.");
    }
  }

  return (
    <form className="profile-edit-view" onSubmit={handleSubmit}>
      <div className="edit-page-head">
        <div>
          <button className="back-icon" type="button" onClick={onCancel} aria-label="프로필로 돌아가기">
            ←
          </button>
          <h2>프로필 편집</h2>
        </div>
        <button className="edit-save" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "저장 중" : "저장"}
        </button>
      </div>

      <div className="edit-photo">
        <div className="edit-avatar-wrap">
          <Avatar displayName={displayName || account.displayName} photoUrl={photoUrl} size="large" />
          <span aria-hidden="true">사진</span>
        </div>
        <p>{tagline || "한 줄을 곁에 두는 사람"}</p>
      </div>

      <label className="edit-field">
        <span className="edit-label">프로필 사진 URL</span>
        <input
          onChange={(event) => setPhotoUrl(event.target.value)}
          placeholder="이미지 주소"
          value={photoUrl}
        />
      </label>
      <label className="edit-field">
        <div>
          <span className="edit-label">닉네임</span>
          <small>{displayName.length}/24</small>
        </div>
        <input
          maxLength={24}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="나의 서재"
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
          placeholder="한 줄을 곁에 두는 사람"
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
