"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { DEFAULT_CARD_COMP } from "@saegim/domain";
import type { AccountProfile, CreatePostInput, PostBundle } from "@saegim/domain";
import {
  carvePost,
  createPost,
  fetchCurrentAccount,
  fetchFeed,
  fetchRecommendedAccounts,
  getGoogleOAuthStartUrl,
  likePost,
  uncarvePost,
  unlikePost
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

export function SaegimShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [entryState, setEntryState] = useState<EntryState>("gate");
  const [posts, setPosts] = useState<PostBundle[]>(samplePosts);
  const [accounts, setAccounts] = useState<AccountProfile[]>(sampleAccounts);
  const [currentAccount, setCurrentAccount] = useState<AccountProfile>(
    sampleAccounts.find((account) => account.id === "acct-me") ?? sampleAccounts[0]!
  );
  const featuredPost = posts[0] ?? samplePosts[0]!;

  function handlePostPublished(post: PostBundle) {
    setPosts((currentPosts) => [post, ...currentPosts.filter((item) => item.post.id !== post.post.id)]);
    setActiveTab("discover");
  }

  function replacePost(post: PostBundle) {
    setPosts((currentPosts) => currentPosts.map((item) => (item.post.id === post.post.id ? post : item)));
  }

  function enterApp(nextEntryState: Exclude<EntryState, "gate">) {
    setEntryState(nextEntryState);
    window.localStorage.setItem(ENTRY_STATE_STORAGE_KEY, nextEntryState);
  }

  function leaveApp() {
    setActiveTab("home");
    setEntryState("gate");
    window.localStorage.removeItem(ENTRY_STATE_STORAGE_KEY);
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

  const content = useMemo(() => {
    if (activeTab === "discover") {
      return <DiscoverView post={featuredPost} onToggleCarve={handleToggleCarve} onToggleLike={handleToggleLike} />;
    }
    if (activeTab === "capture") return <CaptureView onPublished={handlePostPublished} />;
    if (activeTab === "shelf") return <ShelfView posts={posts} />;
    if (activeTab === "me") return <ProfileView account={currentAccount} onLogout={leaveApp} />;
    return <HomeView post={featuredPost} accounts={accounts} onOpenDiscover={() => setActiveTab("discover")} />;
  }, [accounts, activeTab, currentAccount, featuredPost, posts]);

  return (
    <main className="app-shell" aria-label="새김 앱">
      <section className="mobile-frame">
        {entryState === "gate" ? (
          <AuthGate onEnter={enterApp} onGoogleLogin={startGoogleOAuth} />
        ) : (
          <>
            <header className="topbar">
              <div className="wordmark">새김</div>
              <button className="icon-button" type="button" aria-label="검색">
                ⌕
              </button>
            </header>

            <div className="screen">{content}</div>

            <nav className="tabbar" aria-label="주요 메뉴">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  className={tab.key === activeTab ? "tab is-active" : "tab"}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
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

function HomeView({
  post,
  accounts,
  onOpenDiscover
}: {
  post: PostBundle;
  accounts: AccountProfile[];
  onOpenDiscover: () => void;
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
          {accounts.map((account) => (
            <article className="account-chip" key={account.id}>
              <div className="avatar">{account.displayName.slice(0, 1)}</div>
              <div>
                <strong>{account.displayName}</strong>
                <p>{account.tagline}</p>
              </div>
              <button type="button">구독</button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function DiscoverView({
  post,
  onToggleCarve,
  onToggleLike
}: {
  post: PostBundle;
  onToggleCarve: (post: PostBundle) => void;
  onToggleLike: (post: PostBundle) => void;
}) {
  const card = post.cards[0]!;
  const viewerState = post.viewerState;

  return (
    <article className="discover-view">
      <div className="detail-title">{post.post.title}</div>
      <div className="sentence-card" style={{ background: card.comp.bg, color: card.comp.textColor }}>
        <p>{card.text}</p>
      </div>
      <div className="writer-bar">
        <div className="avatar">{post.author.displayName.slice(0, 1)}</div>
        <strong>{post.author.displayName}</strong>
        <button type="button">구독</button>
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
        <button type="button" aria-label="댓글">
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

function ShelfView({ posts }: { posts: PostBundle[] }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>둘러보기</h2>
        <span>인기</span>
      </div>
      <div className="masonry">
        {posts.map((post) => (
          <CardPreview key={post.post.id} post={post} />
        ))}
      </div>
    </section>
  );
}

function ProfileView({ account, onLogout }: { account: AccountProfile; onLogout: () => void }) {
  return (
    <section className="profile-view">
      <div className="profile-head">
        <div className="avatar large">{account.displayName.slice(0, 1)}</div>
        <div>
          <h2>{account.displayName}</h2>
          <p>{account.tagline}</p>
          <small>
            글 {formatCount(account.postCount)}개 · 글벗 {formatCount(account.writingFriendCount)}
          </small>
        </div>
      </div>
      <button className="primary-button ghost" type="button">
        프로필 편집
      </button>
      <button className="profile-logout" type="button" onClick={onLogout}>
        로그아웃
      </button>
    </section>
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
