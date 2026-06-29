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

const collectorAccount: AccountProfile = {
  id: "acct-collector",
  handle: "collector-yoon",
  displayName: "문장수집가 윤",
  tagline: "고요한 문장을 모아요",
  verification: "none",
  postCount: 8,
  writingFriendCount: 2300
};

const bookshopAccount: AccountProfile = {
  id: "acct-bookshop",
  handle: "night-bookshop",
  displayName: "밤서점",
  tagline: "잠들기 전 펼치는 책장",
  verification: "official",
  postCount: 21,
  writingFriendCount: 9600
};

const marginAccount: AccountProfile = {
  id: "acct-margin",
  handle: "margin-note",
  displayName: "여백 노트",
  tagline: "짧게 남겨 오래 보는 말",
  verification: "none",
  postCount: 6,
  writingFriendCount: 1240
};

export const sampleAccounts: AccountProfile[] = [
  editorAccount,
  meAccount,
  collectorAccount,
  bookshopAccount,
  marginAccount
];

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
  },
  {
    post: {
      id: "post-fog-1",
      title: "아침의 여백",
      authorId: "acct-collector",
      coverCardId: "card-fog-1",
      cardCount: 1,
      visibility: "public",
      creationType: "original",
      createdAt: "2026-06-28T09:10:00.000Z",
      updatedAt: "2026-06-28T09:10:00.000Z"
    },
    author: collectorAccount,
    cards: [
      {
        id: "card-fog-1",
        postId: "post-fog-1",
        order: 0,
        text: "서두르지 않는 아침은\n하루의 문장을 천천히 고른다.",
        comp: {
          ...DEFAULT_CARD_COMP,
          bg: CARD_GRADIENT_PRESETS.fog,
          textColor: "#38323F",
          font: "serif"
        },
        source: { kind: "direct", author: "문장수집가 윤", work: "직접 새김" },
        tags: ["아침", "여백"],
        embeddingStatus: "pending",
        createdAt: "2026-06-28T09:10:00.000Z"
      }
    ],
    viewerState: {
      liked: false,
      carved: false,
      subscribed: false,
      likeCount: 936,
      commentCount: 7
    }
  },
  {
    post: {
      id: "post-sunset-1",
      title: "노을 밑줄",
      authorId: "acct-bookshop",
      coverCardId: "card-sunset-1",
      cardCount: 3,
      visibility: "public",
      creationType: "curation",
      createdAt: "2026-06-27T18:30:00.000Z",
      updatedAt: "2026-06-27T18:30:00.000Z"
    },
    author: bookshopAccount,
    cards: [
      {
        id: "card-sunset-1",
        postId: "post-sunset-1",
        order: 0,
        text: "해가 기우는 쪽으로\n마음도 조금 부드러워진다.",
        comp: {
          ...DEFAULT_CARD_COMP,
          bg: CARD_GRADIENT_PRESETS.sunset,
          textColor: "#38323F",
          font: "round"
        },
        source: { kind: "publisher", author: "밤서점", work: "노을 밑줄" },
        tags: ["노을", "서점"],
        embeddingStatus: "pending",
        createdAt: "2026-06-27T18:30:00.000Z"
      }
    ],
    viewerState: {
      liked: false,
      carved: false,
      subscribed: false,
      likeCount: 1250,
      commentCount: 12
    }
  },
  {
    post: {
      id: "post-lavender-1",
      title: "느린 답장",
      authorId: "acct-margin",
      coverCardId: "card-lavender-1",
      cardCount: 1,
      visibility: "public",
      creationType: "original",
      createdAt: "2026-06-26T21:40:00.000Z",
      updatedAt: "2026-06-26T21:40:00.000Z"
    },
    author: marginAccount,
    cards: [
      {
        id: "card-lavender-1",
        postId: "post-lavender-1",
        order: 0,
        text: "늦은 답장은 미안함보다\n오래 생각했다는 증거일 때가 있다.",
        comp: {
          ...DEFAULT_CARD_COMP,
          bg: CARD_GRADIENT_PRESETS.lavender,
          textColor: "#38323F",
          font: "gothic"
        },
        source: { kind: "direct", author: "여백 노트", work: "직접 새김" },
        tags: ["답장", "생각"],
        embeddingStatus: "pending",
        createdAt: "2026-06-26T21:40:00.000Z"
      }
    ],
    viewerState: {
      liked: false,
      carved: false,
      subscribed: false,
      likeCount: 648,
      commentCount: 4
    }
  },
  {
    post: {
      id: "post-apricot-1",
      title: "살구빛 메모",
      authorId: "acct-editor",
      coverCardId: "card-apricot-1",
      cardCount: 2,
      visibility: "public",
      creationType: "curation",
      createdAt: "2026-06-25T13:20:00.000Z",
      updatedAt: "2026-06-25T13:20:00.000Z"
    },
    author: editorAccount,
    cards: [
      {
        id: "card-apricot-1",
        postId: "post-apricot-1",
        order: 0,
        text: "다정함은 대개\n가장 작은 문장으로 도착한다.",
        comp: {
          ...DEFAULT_CARD_COMP,
          bg: CARD_GRADIENT_PRESETS.apricot,
          textColor: "#38323F",
          font: "serif"
        },
        source: { kind: "direct", author: "새김 편집부", work: "직접 새김" },
        tags: ["다정", "메모"],
        embeddingStatus: "pending",
        createdAt: "2026-06-25T13:20:00.000Z"
      }
    ],
    viewerState: {
      liked: false,
      carved: false,
      subscribed: false,
      likeCount: 1588,
      commentCount: 21
    }
  }
];
