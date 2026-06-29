import {
  CARD_GRADIENT_PRESETS,
  DEFAULT_CARD_COMP,
  type AccountProfile,
  type PostBundle
} from "@saegim/domain";

const editorAccount: AccountProfile = {
  id: "acct-editor",
  handle: "editor",
  displayName: "새김 편집부",
  tagline: "새김이 고른 글",
  bio: "문장이 오래 머무는 방식을 살핍니다.",
  verification: "official",
  postCount: 12,
  writingFriendCount: 18400
};

const meAccount: AccountProfile = {
  id: "acct-me",
  handle: "me",
  displayName: "나의 서재",
  tagline: "한 줄을 곁에 두는 사람",
  verification: "none",
  postCount: 0,
  writingFriendCount: 0
};

export const sampleAccounts: AccountProfile[] = [editorAccount, meAccount];

export const samplePosts: PostBundle[] = [
  {
    post: {
      id: "post-dawn-1",
      title: "잠들기 전 마지막 줄",
      authorId: "acct-editor",
      coverCardId: "card-dawn-1",
      cardCount: 2,
      visibility: "public",
      creationType: "curation",
      createdAt: "2026-06-29T00:00:00.000Z",
      updatedAt: "2026-06-29T00:00:00.000Z"
    },
    author: editorAccount,
    cards: [
      {
        id: "card-dawn-1",
        postId: "post-dawn-1",
        order: 0,
        text: "좋은 문장은 두 번 읽힌다.\n눈으로 한 번, 마음으로 한 번.",
        comp: {
          ...DEFAULT_CARD_COMP,
          bg: CARD_GRADIENT_PRESETS.night,
          dim: 0.08,
          textColor: "#FBF8FC",
          font: "serif"
        },
        source: { kind: "direct", author: "새김 편집부", work: "직접 새김" },
        tags: ["밤", "필사"],
        embeddingStatus: "pending",
        createdAt: "2026-06-29T00:00:00.000Z"
      },
      {
        id: "card-dawn-2",
        postId: "post-dawn-1",
        order: 1,
        text: "읽는 일은 빨라질 수 있어도,\n이해하는 일은 제 속도를 고집한다.",
        comp: {
          ...DEFAULT_CARD_COMP,
          bg: CARD_GRADIENT_PRESETS.fog,
          textColor: "#38323F",
          font: "gothic"
        },
        source: { kind: "direct", author: "새김 편집부", work: "직접 새김" },
        tags: ["읽기", "이해"],
        embeddingStatus: "pending",
        createdAt: "2026-06-29T00:00:00.000Z"
      }
    ],
    viewerState: {
      liked: false,
      carved: false,
      subscribed: false,
      likeCount: 1842,
      commentCount: 18
    }
  }
];
