"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DEFAULT_CARD_COMP } from "@saegim/domain";
import type { AccountProfile, CreatePostInput, PostBundle, PostComment, UpdateAccountInput } from "@saegim/domain";
import {
  carvePost,
  createPost,
  createPostComment,
  fetchPostComments,
  fetchCurrentAccount,
  fetchDrawer,
  fetchFeed,
  fetchRecommendedAccounts,
  fetchSearch,
  followAccount,
  getGoogleOAuthStartUrl,
  likePost,
  uncarvePost,
  unlikePost,
  unfollowAccount,
  updateCurrentAccount
} from "../lib/api";
import { sampleAccounts, samplePosts } from "../lib/sample-data";

type TabKey = "home" | "discover" | "capture" | "shelf" | "me";
type EntryState = "gate" | "guest" | "signed-in";

const ENTRY_STATE_STORAGE_KEY = "saegim_web_entry_state";

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "홈", icon: "⌂" },
  { key: "discover", label: "발견", icon: "◇" },
  { key: "capture", label: "포착", icon: "+" },
  { key: "shelf", label: "둘러보기", icon: "□" },
  { key: "me", label: "나", icon: "나" }
];

function formatCount(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatCommentDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function SaegimShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [entryState, setEntryState] = useState<EntryState>("gate");
  const [isSearching, setIsSearching] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isViewingDrawer, setIsViewingDrawer] = useState(false);
  const [commentPost, setCommentPost] = useState<PostBundle | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostBundle[]>(samplePosts);
  const [accounts, setAccounts] = useState<AccountProfile[]>(sampleAccounts);
  const [currentAccount, setCurrentAccount] = useState<AccountProfile>(
    sampleAccounts.find((account) => account.id === "acct-me") ?? sampleAccounts[0]!
  );
  const featuredPost = posts[0] ?? samplePosts[0]!;
  const activePost = posts.find((post) => post.post.id === activePostId) ?? featuredPost;
  const selectedProfile =
    selectedProfileId === currentAccount.id
      ? currentAccount
      : accounts.find((account) => account.id === selectedProfileId) ??
        posts.find((post) => post.author.id === selectedProfileId)?.author ??
        currentAccount;
  const selectedProfilePosts = posts.filter((post) => post.author.id === selectedProfile.id);
  const isOwnProfile = selectedProfile.id === currentAccount.id;
  const activePostIndex = Math.max(
    0,
    posts.findIndex((post) => post.post.id === activePost.post.id)
  );

  function handlePostPublished(post: PostBundle) {
    setPosts((currentPosts) => [post, ...currentPosts.filter((item) => item.post.id !== post.post.id)]);
    setActivePostId(post.post.id);
    setActiveCardIndex(0);
    setIsSearching(false);
    setActiveTab("discover");
  }

  function replacePost(post: PostBundle) {
    setPosts((currentPosts) => currentPosts.map((item) => (item.post.id === post.post.id ? post : item)));
    setCommentPost((currentPost) => (currentPost?.post.id === post.post.id ? post : currentPost));
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
    window.localStorage.setItem(ENTRY_STATE_STORAGE_KEY, nextEntryState);
  }

  function leaveApp() {
    setActiveTab("home");
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setCommentPost(null);
    setSelectedProfileId(currentAccount.id);
    setEntryState("gate");
    window.localStorage.removeItem(ENTRY_STATE_STORAGE_KEY);
  }

  function selectTab(tab: TabKey) {
    setActiveTab(tab);
    setIsSearching(false);
    setCommentPost(null);

    if (tab === "discover") {
      setActivePostId((currentPostId) => currentPostId ?? featuredPost.post.id);
      setActiveCardIndex(0);
    }

    if (tab !== "me") {
      setIsEditingProfile(false);
      setIsViewingDrawer(false);
    } else {
      setSelectedProfileId(currentAccount.id);
    }
  }

  function startGoogleOAuth() {
    window.location.assign(getGoogleOAuthStartUrl());
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
    setCommentPost(null);
    setActiveTab("discover");
  }

  function openProfile(account: AccountProfile) {
    setAccounts((currentAccounts) => {
      const exists = currentAccounts.some((item) => item.id === account.id);

      if (!exists) {
        return [account, ...currentAccounts];
      }

      return currentAccounts.map((item) => (item.id === account.id ? account : item));
    });
    setSelectedProfileId(account.id);
    setIsSearching(false);
    setIsEditingProfile(false);
    setIsViewingDrawer(false);
    setCommentPost(null);
    setActiveTab("me");
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
  }

  function selectCard(index: number) {
    setActiveCardIndex(Math.min(Math.max(index, 0), activePost.cards.length - 1));
  }

  useEffect(() => {
    const savedEntryState = window.localStorage.getItem(ENTRY_STATE_STORAGE_KEY);
    if (savedEntryState === "guest" || savedEntryState === "signed-in") {
      setEntryState(savedEntryState);
    }
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
          onOpenComments={setCommentPost}
          onOpenProfile={openProfile}
          onToggleFollow={handleToggleFollow}
          onToggleLike={handleToggleLike}
        />
      );
    }
    if (activeTab === "capture") return <CaptureView onPublished={handlePostPublished} />;
    if (activeTab === "shelf") return <ShelfView posts={posts} onOpenPost={openPost} />;
    if (activeTab === "me") {
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
          onLogout={leaveApp}
          onOpenDrawer={() => setIsViewingDrawer(true)}
          onOpenPost={openPost}
          onOpenProfile={() => setSelectedProfileId(currentAccount.id)}
          onToggleFollow={handleToggleFollow}
          posts={selectedProfilePosts}
        />
      );
    }
    return (
      <HomeView
        post={featuredPost}
        accounts={accounts}
        onOpenDiscover={() => openPost(featuredPost)}
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
    isOwnProfile,
    posts,
    selectedProfile,
    selectedProfilePosts
  ]);

  return (
    <main className="app-shell" aria-label="새김 앱">
      <section className="mobile-frame">
        {entryState === "gate" ? (
          <AuthGate onEnter={enterApp} onGoogleLogin={startGoogleOAuth} />
        ) : (
          <>
            <header className="topbar">
              <div className="wordmark">새김</div>
              <button
                className="icon-button"
                type="button"
                aria-label="검색"
                onClick={() => {
                  setCommentPost(null);
                  setIsSearching(true);
                }}
              >
                ⌕
              </button>
            </header>

            <div className="screen">{content}</div>

            {commentPost ? (
              <CommentSheet post={commentPost} onClose={() => setCommentPost(null)} onPostChange={replacePost} />
            ) : null}

            <nav className="tabbar" aria-label="주요 메뉴">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={tab.key === activeTab ? "tab is-active" : "tab"}
                  type="button"
                  onClick={() => selectTab(tab.key)}
                  aria-label={tab.label}
                  aria-current={tab.key === activeTab ? "page" : undefined}
                >
                  <span className="tab-icon">{tab.icon}</span>
                </button>
              ))}
            </nav>
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const submitLabel = mode === "login" ? "로그인" : "회원가입";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onEnter("signed-in");
  }

  return (
    <section className="auth-gate" aria-label="로그인">
      <div className="auth-brand">
        <div className="wordmark">새김</div>
        <p>한 줄을 카드로 만들어, 발견하고, 마음에 새겨 간직하는 곳</p>
      </div>

      <div className="auth-mode-tabs" aria-label="인증 모드">
        <button className={mode === "login" ? "is-active" : undefined} type="button" onClick={() => setMode("login")}>
          로그인
        </button>
        <button className={mode === "signup" ? "is-active" : undefined} type="button" onClick={() => setMode("signup")}>
          회원가입
        </button>
      </div>

      <button className="google-button" type="button" onClick={onGoogleLogin}>
        Google 계정으로 계속
      </button>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="capture-field">
          <span>이메일</span>
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            type="email"
            value={email}
          />
        </label>
        <label className="capture-field">
          <span>비밀번호</span>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8자 이상"
            type="password"
            value={password}
          />
        </label>
        <button className="primary-button" type="submit">
          {submitLabel}
        </button>
      </form>

      <button className="guest-button" type="button" onClick={() => onEnter("guest")}>
        로그인 없이 둘러보기
      </button>
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
  const [accounts, setAccounts] = useState<AccountProfile[]>([]);
  const [posts, setPosts] = useState<PostBundle[]>([]);
  const [status, setStatus] = useState<"loading" | "idle">("loading");
  const [error, setError] = useState("");

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

  const isEmpty = status !== "loading" && accounts.length === 0 && posts.length === 0;

  return (
    <section className="search-view">
      <div className="search-head">
        <button className="back-icon" type="button" onClick={onClose} aria-label="검색 닫기">
          ←
        </button>
        <label className="search-input">
          <span>검색</span>
          <input
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="계정·글 검색"
            value={query}
          />
        </label>
      </div>

      {accounts.length > 0 ? (
        <section className="search-section">
          <h2>계정</h2>
          <div className="search-account-list">
            {accounts.map((account) => (
              <button
                className="search-account-row"
                key={account.id}
                type="button"
                onClick={() => onOpenProfile(account)}
              >
                <div className="avatar">{account.displayName.slice(0, 1)}</div>
                <div>
                  <strong>{account.displayName}</strong>
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

      {posts.length > 0 ? (
        <section className="search-section">
          <h2>글</h2>
          <div className="masonry">
            {posts.map((post) => (
              <PostPreviewButton key={post.post.id} post={post} onOpenPost={onOpenPost} />
            ))}
          </div>
        </section>
      ) : null}

      {status === "loading" ? <p className="search-empty">찾는 중</p> : null}
      {isEmpty ? <p className="search-empty">아직 맞는 결과가 없어요.</p> : null}
      {error ? <p className="search-empty">{error}</p> : null}
    </section>
  );
}

function PostPreviewButton({ post, onOpenPost }: { post: PostBundle; onOpenPost: (post: PostBundle) => void }) {
  const card = post.cards[0]!;

  return (
    <button
      className="post-card post-card-button"
      type="button"
      onClick={() => onOpenPost(post)}
      style={{ background: card.comp.bg, color: card.comp.textColor }}
    >
      {post.post.cardCount > 1 ? <span className="page-badge">{post.post.cardCount}장</span> : null}
      <p>{card.text}</p>
      <footer>
        <strong>{post.post.title}</strong>
        <span>♡ {post.viewerState?.likeCount.toLocaleString("ko-KR") ?? 0}</span>
      </footer>
    </button>
  );
}

function HomeView({
  post,
  accounts,
  onOpenDiscover,
  onOpenProfile,
  onToggleFollow
}: {
  post: PostBundle;
  accounts: AccountProfile[];
  onOpenDiscover: () => void;
  onOpenProfile: (account: AccountProfile) => void;
  onToggleFollow: (accountId: string, subscribed: boolean) => void;
}) {
  return (
    <div className="view-stack">
      <button className="banner-card" type="button" onClick={onOpenDiscover}>
        <span className="quiet-label">오늘 닿은 글</span>
        <CardPreview post={post} />
      </button>

      <section className="section">
        <div className="section-head">
          <h2>추천 글벗</h2>
        </div>
        <div className="account-rail">
          {accounts.map((account) => {
            const isSubscribed = account.viewerState?.subscribed ?? false;

            return (
              <article className="account-chip" key={account.id}>
                <button className="account-chip-main" type="button" onClick={() => onOpenProfile(account)}>
                  <div className="avatar">{account.displayName.slice(0, 1)}</div>
                  <div>
                    <strong>{account.displayName}</strong>
                    <p>{account.tagline}</p>
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
      <div className="detail-title">{post.post.title}</div>
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
      <div className="sentence-card" style={{ background: card.comp.bg, color: card.comp.textColor }}>
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
        <p>{card.text}</p>
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
          <div className="avatar">{post.author.displayName.slice(0, 1)}</div>
          <strong>{post.author.displayName}</strong>
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
          <span>{viewerState?.carved ? "▰" : "▱"}</span>
        </button>
        <button
          className={viewerState?.liked ? "is-on" : undefined}
          type="button"
          aria-label={viewerState?.liked ? "좋아요 취소" : "좋아요"}
          onClick={() => onToggleLike(post)}
        >
          <span>{viewerState?.liked ? "♥" : "♡"}</span>
          <small>{formatCount(viewerState?.likeCount ?? 0)}</small>
        </button>
        <button type="button" aria-label="댓글" onClick={() => onOpenComments(post)}>
          <span>◌</span>
          <small>{formatCount(viewerState?.commentCount ?? 0)}</small>
        </button>
        <button type="button" aria-label="더보기">
          <span>⋯</span>
        </button>
      </aside>
    </article>
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
              <div className="avatar mini">{comment.author.displayName.slice(0, 1)}</div>
              <div>
                <header>
                  <strong>{comment.author.displayName}</strong>
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
  const [sentence, setSentence] = useState("");
  const [title, setTitle] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [sourceWork, setSourceWork] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState("");
  const canPublish = sentence.trim().length > 0 && status !== "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanText = sentence.trim();
    if (!cleanText) {
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
      cards: [
        {
          text: cleanText,
          comp: DEFAULT_CARD_COMP,
          source: {
            kind: "direct",
            ...(cleanAuthor ? { author: cleanAuthor } : {}),
            ...(cleanWork ? { work: cleanWork } : {})
          },
          tags: tagList
        }
      ]
    };

    if (cleanTitle) {
      input.title = cleanTitle;
    }

    try {
      setStatus("submitting");
      setError("");
      const publishedPost = await createPost(input);
      setSentence("");
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
      <div className="sentence-card editable capture-card">
        <textarea
          aria-label="문장"
          value={sentence}
          onChange={(event) => setSentence(event.target.value)}
          placeholder="탭하여 문장 쓰기"
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
  return (
    <section className="section">
      <div className="section-head">
        <h2>둘러보기</h2>
        <span>인기</span>
      </div>
      <div className="masonry">
        {posts.map((post) => (
          <PostPreviewButton key={post.post.id} post={post} onOpenPost={onOpenPost} />
        ))}
      </div>
    </section>
  );
}

function DrawerView({ onBack, onOpenPost }: { onBack: () => void; onOpenPost: (post: PostBundle) => void }) {
  const [drawerPosts, setDrawerPosts] = useState<PostBundle[]>([]);
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

      {status === "loading" ? <p className="drawer-empty">불러오는 중</p> : null}
      {status !== "loading" && drawerPosts.length === 0 ? (
        <p className="drawer-empty">아직 간직한 글이 없어요.</p>
      ) : null}
      {error ? <p className="drawer-empty">{error}</p> : null}
      {drawerPosts.length > 0 ? (
        <div className="masonry">
          {drawerPosts.map((post) => (
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
  onLogout,
  onOpenDrawer,
  onOpenPost,
  onOpenProfile,
  onToggleFollow,
  posts
}: {
  account: AccountProfile;
  isOwnProfile: boolean;
  onEdit: () => void;
  onLogout: () => void;
  onOpenDrawer: () => void;
  onOpenPost: (post: PostBundle) => void;
  onOpenProfile: () => void;
  onToggleFollow: (accountId: string, subscribed: boolean) => void;
  posts: PostBundle[];
}) {
  const isSubscribed = account.viewerState?.subscribed ?? false;

  return (
    <section className="profile-view">
      <div className="profile-head">
        <div className="avatar large">{account.displayName.slice(0, 1)}</div>
        <div>
          <h2>{account.displayName}</h2>
          <p>{account.tagline}</p>
          {account.bio ? <p className="profile-bio">{account.bio}</p> : null}
          <small>
            글 {formatCount(account.postCount)}개 · 글벗 {formatCount(account.writingFriendCount)}
          </small>
        </div>
      </div>
      {isOwnProfile ? (
        <>
          <button className="primary-button ghost" type="button" onClick={onEdit}>
            프로필 편집
          </button>
          <button className="primary-button ghost" type="button" onClick={onOpenDrawer}>
            내 서랍
          </button>
          <button className="profile-logout" type="button" onClick={onLogout}>
            로그아웃
          </button>
        </>
      ) : (
        <div className="profile-actions">
          <button
            className={isSubscribed ? "primary-button ghost" : "primary-button"}
            type="button"
            aria-pressed={isSubscribed}
            onClick={() => onToggleFollow(account.id, isSubscribed)}
          >
            {isSubscribed ? "구독중" : "구독"}
          </button>
          <button className="primary-button ghost" type="button" onClick={onOpenProfile}>
            내 프로필
          </button>
        </div>
      )}

      <section className="profile-posts">
        <div className="section-head">
          <h2>글</h2>
          <span>{formatCount(posts.length)}개</span>
        </div>
        {posts.length > 0 ? (
          <div className="masonry">
            {posts.map((post) => (
              <PostPreviewButton key={post.post.id} post={post} onOpenPost={onOpenPost} />
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
      <div className="profile-edit-head">
        <div className="avatar large">{displayName.trim().slice(0, 1) || account.displayName.slice(0, 1)}</div>
        <div>
          <h2>프로필 편집</h2>
          <p>{tagline || "한 줄을 곁에 두는 사람"}</p>
        </div>
      </div>

      <label className="capture-field">
        <span>닉네임</span>
        <input
          maxLength={24}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="나의 서재"
          value={displayName}
        />
      </label>
      <label className="capture-field">
        <span>한줄 소개글</span>
        <input
          maxLength={48}
          onChange={(event) => setTagline(event.target.value)}
          placeholder="한 줄을 곁에 두는 사람"
          value={tagline}
        />
      </label>
      <label className="capture-field">
        <span>소개글</span>
        <textarea
          maxLength={240}
          onChange={(event) => setBio(event.target.value)}
          placeholder="조용히 남겨 둘 소개글"
          value={bio}
        />
      </label>
      <label className="capture-field">
        <span>프로필 사진</span>
        <input
          onChange={(event) => setPhotoUrl(event.target.value)}
          placeholder="이미지 주소"
          value={photoUrl}
        />
      </label>

      {error ? <p className="capture-error">{error}</p> : null}
      <div className="profile-edit-actions">
        <button className="primary-button ghost" type="button" onClick={onCancel}>
          취소
        </button>
        <button className="primary-button" type="submit" disabled={status === "saving"}>
          {status === "saving" ? "저장 중" : "저장"}
        </button>
      </div>
    </form>
  );
}

function CardPreview({ post }: { post: PostBundle }) {
  const card = post.cards[0]!;

  return (
    <article className="post-card" style={{ background: card.comp.bg, color: card.comp.textColor }}>
      {post.post.cardCount > 1 ? <span className="page-badge">{post.post.cardCount}장</span> : null}
      <p>{card.text}</p>
      <footer>
        <strong>{post.post.title}</strong>
        <span>♡ {post.viewerState?.likeCount.toLocaleString("ko-KR") ?? 0}</span>
      </footer>
    </article>
  );
}
