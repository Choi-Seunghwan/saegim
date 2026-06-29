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

const cardGradientPresets = {
  night: "linear-gradient(150deg,#3C3652,#241F38)",
  fog: "linear-gradient(150deg,#F4F1F3,#E7E5EA 55%,#D8DAE4)",
  lavender: "linear-gradient(150deg,#EDE7F5,#D8D0EA 58%,#C8C7E1)"
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

const meAccount: AccountProfile = {
  id: "acct-me",
  handle: "me",
  displayName: "나의 서재",
  tagline: "한 줄을 곁에 두는 사람",
  verification: "none",
  postCount: 0,
  writingFriendCount: 0
};

export const seedAccounts: AccountProfile[] = [editorAccount, moowolAccount, meAccount];

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
  }
];
