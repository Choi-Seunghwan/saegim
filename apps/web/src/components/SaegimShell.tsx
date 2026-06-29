"use client";

import { useEffect, useMemo, useState } from "react";
import type { AccountProfile, PostBundle } from "@saegim/domain";
import { fetchFeed, fetchRecommendedAccounts } from "../lib/api";
import { sampleAccounts, samplePosts } from "../lib/sample-data";

type TabKey = "home" | "discover" | "capture" | "shelf" | "me";

const tabs: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "home", label: "홈", icon: "⌂" },
  { key: "discover", label: "발견", icon: "◇" },
  { key: "capture", label: "포착", icon: "+" },
  { key: "shelf", label: "둘러보기", icon: "□" },
  { key: "me", label: "나", icon: "나" }
];

export function SaegimShell() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [posts, setPosts] = useState<PostBundle[]>(samplePosts);
  const [accounts, setAccounts] = useState<AccountProfile[]>(sampleAccounts);
  const featuredPost = posts[0] ?? samplePosts[0]!;

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      try {
        const [nextPosts, nextAccounts] = await Promise.all([
          fetchFeed(controller.signal),
          fetchRecommendedAccounts(controller.signal)
        ]);

        if (nextPosts.length > 0) {
          setPosts(nextPosts);
        }

        if (nextAccounts.length > 0) {
          setAccounts(nextAccounts);
        }
      } catch {
        // API가 아직 꺼져 있어도 프로토타입 샘플로 첫 화면을 유지한다.
      }
    }

    void loadInitialData();
    return () => controller.abort();
  }, []);

  const content = useMemo(() => {
    if (activeTab === "discover") return <DiscoverView post={featuredPost} />;
    if (activeTab === "capture") return <CaptureView />;
    if (activeTab === "shelf") return <ShelfView posts={posts} />;
    if (activeTab === "me") return <ProfileView />;
    return <HomeView post={featuredPost} accounts={accounts} onOpenDiscover={() => setActiveTab("discover")} />;
  }, [accounts, activeTab, featuredPost, posts]);

  return (
    <main className="app-shell" aria-label="새김 앱">
      <section className="mobile-frame">
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
      </section>
    </main>
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

function DiscoverView({ post }: { post: PostBundle }) {
  const card = post.cards[0]!;

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
        <button type="button" aria-label="새김">
          ▱
        </button>
        <button type="button" aria-label="좋아요">
          ♡
        </button>
        <button type="button" aria-label="댓글">
          ◌
        </button>
        <button type="button" aria-label="더보기">
          ⋯
        </button>
      </aside>
    </article>
  );
}

function CaptureView() {
  return (
    <div className="capture-view">
      <div className="sentence-card editable">
        <p>탭하여 문장 쓰기</p>
      </div>
      <div className="tool-row" aria-label="카드 작성 도구">
        <button type="button">제목</button>
        <button type="button">배경</button>
        <button type="button">출처</button>
        <button type="button">태그</button>
      </div>
      <button className="primary-button" type="button">
        발행
      </button>
    </div>
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

function ProfileView() {
  return (
    <section className="profile-view">
      <div className="profile-head">
        <div className="avatar large">나</div>
        <div>
          <h2>나의 서재</h2>
          <p>한 줄을 곁에 두는 사람</p>
          <small>글 0개 · 글벗 0</small>
        </div>
      </div>
      <button className="primary-button ghost" type="button">
        프로필 편집
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
