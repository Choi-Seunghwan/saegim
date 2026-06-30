type CardFont = "gothic" | "serif" | "round" | "pen" | "black";
type CardAlign = "left" | "center" | "right";
type CardWeight = 300 | 400 | 700 | 800;

interface CardComposition {
  bg: string;
  dim: number;
  textColor: string;
  size: number;
  weight: CardWeight;
  align: CardAlign;
  font: CardFont;
  textPos?: { xp: number; yp: number } | null;
  sourcePos?: { xp: number; yp: number } | null;
}

interface AccountProfile {
  id: string;
  handle: string;
  displayName: string;
  photoUrl?: string;
  tagline: string;
  bio?: string;
  verification: "none" | "official";
  postCount: number;
  writingFriendCount: number;
}

interface PostBundle {
  post: {
    id: string;
    title: string;
    authorId: string;
    coverCardId: string;
    cardCount: number;
    visibility: "public" | "private";
    creationType: "original" | "curation";
    createdAt: string;
    updatedAt: string;
  };
  author: AccountProfile;
  cards: Array<{
    id: string;
    postId: string;
    order: number;
    text: string;
    comp: CardComposition;
    source: {
      kind: "book" | "web" | "direct" | "publisher";
      author?: string;
      work?: string;
      url?: string;
    };
    tags: string[];
    embeddingStatus: "pending" | "ready" | "skipped";
    createdAt: string;
  }>;
  viewerState: {
    liked: boolean;
    carved: boolean;
    subscribed: boolean;
    likeCount: number;
    commentCount: number;
  };
}

interface SeedEditorialPage {
  id: string;
  kind: "notice" | "event" | "ad";
  label: string;
  title: string;
  summary: string;
  body: string[];
  publishedAt: string;
  cta?: {
    label: string;
    action: "discover" | "contact";
  };
}

const cardGradientPresets = {
  night: "linear-gradient(150deg,#3C3652,#241F38)",
  fog: "linear-gradient(150deg,#F4F1F3,#E7E5EA 55%,#D8DAE4)",
  lavender: "linear-gradient(150deg,#EDE7F5,#D8D0EA 58%,#C8C7E1)",
  sunset: "linear-gradient(150deg,#F5D7C8,#E9BBA9 52%,#CAB6D8)",
  apricot: "linear-gradient(150deg,#F9E1D0,#F4C7AF 58%,#E7B7A9)"
} as const;

const defaultCardComp: CardComposition = {
  bg: cardGradientPresets.fog,
  dim: 0,
  textColor: "#38323F",
  size: 30,
  weight: 700,
  align: "center",
  font: "gothic",
  textPos: null,
  sourcePos: null
};

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

const moowolAccount: AccountProfile = {
  id: "acct-moowol",
  handle: "moowol",
  displayName: "무월",
  tagline: "밤에 읽는 짧은 문장",
  bio: "조용히 남는 문장을 씁니다.",
  verification: "none",
  postCount: 8,
  writingFriendCount: 1260
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

const meAccount: AccountProfile = {
  id: "acct-me",
  handle: "me",
  displayName: "나의 서재",
  tagline: "한 줄을 곁에 두는 사람",
  verification: "none",
  postCount: 0,
  writingFriendCount: 0
};

export const seedAccounts: AccountProfile[] = [
  editorAccount,
  moowolAccount,
  collectorAccount,
  bookshopAccount,
  marginAccount,
  meAccount
];

export const seedPostBundles: PostBundle[] = [
  {
    post: {
      id: "post-dawn-1",
      title: "잠들기 전 마지막 줄",
      authorId: editorAccount.id,
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
          ...defaultCardComp,
          bg: cardGradientPresets.night,
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
          ...defaultCardComp,
          bg: cardGradientPresets.fog,
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
      title: "천천히 남는 말",
      authorId: moowolAccount.id,
      coverCardId: "card-fog-1",
      cardCount: 1,
      visibility: "public",
      creationType: "original",
      createdAt: "2026-06-29T00:10:00.000Z",
      updatedAt: "2026-06-29T00:10:00.000Z"
    },
    author: moowolAccount,
    cards: [
      {
        id: "card-fog-1",
        postId: "post-fog-1",
        order: 0,
        text: "마음은 자주 늦게 도착한다.\n그래서 우리는 기다리는 법을 배운다.",
        comp: {
          ...defaultCardComp,
          bg: cardGradientPresets.lavender,
          textColor: "#38323F",
          font: "serif",
          weight: 700
        },
        source: { kind: "direct", author: "무월", work: "직접 새김" },
        tags: ["기다림", "위로"],
        embeddingStatus: "pending",
        createdAt: "2026-06-29T00:10:00.000Z"
      }
    ],
    viewerState: {
      liked: false,
      carved: false,
      subscribed: true,
      likeCount: 612,
      commentCount: 5
    }
  },
  {
    post: {
      id: "post-morning-1",
      title: "아침의 여백",
      authorId: collectorAccount.id,
      coverCardId: "card-morning-1",
      cardCount: 1,
      visibility: "public",
      creationType: "original",
      createdAt: "2026-06-28T09:10:00.000Z",
      updatedAt: "2026-06-28T09:10:00.000Z"
    },
    author: collectorAccount,
    cards: [
      {
        id: "card-morning-1",
        postId: "post-morning-1",
        order: 0,
        text: "서두르지 않는 아침은\n하루의 문장을 천천히 고른다.",
        comp: {
          ...defaultCardComp,
          bg: cardGradientPresets.fog,
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
      authorId: bookshopAccount.id,
      coverCardId: "card-sunset-1",
      cardCount: 1,
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
          ...defaultCardComp,
          bg: cardGradientPresets.sunset,
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
      authorId: marginAccount.id,
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
          ...defaultCardComp,
          bg: cardGradientPresets.lavender,
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
      authorId: editorAccount.id,
      coverCardId: "card-apricot-1",
      cardCount: 1,
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
          ...defaultCardComp,
          bg: cardGradientPresets.apricot,
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

export const seedEditorialPages: SeedEditorialPage[] = [
  {
    id: "notice-mvp-progress",
    kind: "notice",
    label: "공지",
    title: "새김 MVP를 다듬고 있어요",
    summary: "발견, 새김, 프로필, 서랍의 기본 흐름을 먼저 단단하게 만들고 있어요.",
    publishedAt: "2026-06-30T00:00:00.000Z",
    body: [
      "새김은 좋은 문장을 카드로 만들고, 발견하고, 마음에 담아 다시 보는 경험을 먼저 완성하고 있어요.",
      "MVP에서는 발견 피드, 좋아요와 새김, 댓글, 프로필, 서랍, 계정 연결, DB 기반 발행 흐름을 우선 안정화합니다.",
      "공지사항은 배포 시점부터 DB에 저장된 운영 데이터로 노출하고, 이벤트와 광고는 계획이 정리된 뒤 같은 구조로 확장합니다."
    ]
  }
];
