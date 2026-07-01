export type SaegimId = string;

export type CardFont = "gothic" | "serif" | "round" | "pen" | "black";
export type CardAlign = "left" | "center" | "right";
export type CardWeight = 300 | 400 | 700 | 800;
export type VerificationState = "none" | "official";
export type PostVisibility = "public" | "private";
export type PostCreationType = "original" | "curation";
export type SourceKind = "book" | "web" | "direct" | "publisher";
export type EditorialPageKind = "notice" | "event" | "ad";
export type EditorialPageCtaAction = "discover" | "contact";
export type LegalDocumentKind = "terms" | "privacy";

export interface LegalDocumentSection {
  title: string;
  body: string[];
}

export interface LegalDocument {
  kind: LegalDocumentKind;
  title: string;
  version: string;
  effectiveDate: string;
  summary: string;
  sections: LegalDocumentSection[];
}

export interface LegalAgreementInput {
  terms: boolean;
  privacy: boolean;
  termsVersion: string;
  privacyVersion: string;
}

export const CURRENT_LEGAL_VERSIONS = {
  terms: "2026-07-01",
  privacy: "2026-07-01"
} as const;

export const LEGAL_DOCUMENTS: Record<LegalDocumentKind, LegalDocument> = {
  terms: {
    kind: "terms",
    title: "이용약관",
    version: CURRENT_LEGAL_VERSIONS.terms,
    effectiveDate: "2026-07-01",
    summary: "새김에서 글과 카드를 만들고 발견하며 간직하는 기본 이용 조건입니다.",
    sections: [
      {
        title: "1. 목적",
        body: [
          "이 약관은 새김(SAEGIM)이 제공하는 문장 카드 작성, 글 발행, 발견, 새김 보관, 댓글, 구독 등 서비스 이용 조건과 권리·의무를 정합니다.",
          "새김은 기획·MVP 단계의 모바일 웹 서비스이며, 정식 출시 전 기능과 운영 정책은 고지 후 조정될 수 있습니다."
        ]
      },
      {
        title: "2. 계정과 이용",
        body: [
          "회원은 이메일 또는 Google 계정 등 새김이 제공하는 방식으로 가입할 수 있습니다. 회원은 본인 계정 정보를 정확하게 관리해야 하며, 계정에서 발생한 활동에 대한 책임을 집니다.",
          "만 14세 미만 아동을 대상으로 하지 않습니다. 운영 전 연령 확인이나 보호자 동의가 필요한 기능을 제공하는 경우 별도 절차를 마련합니다."
        ]
      },
      {
        title: "3. 글과 카드의 공개 범위",
        body: [
          "회원이 공개로 발행한 글과 카드는 홈, 발견, 둘러보기, 검색, 공개 프로필, 공유 링크, 검색엔진 노출 영역에 표시될 수 있습니다.",
          "새김(서랍에 넣기)은 비공개 보관 행위이며, 좋아요는 공개 공감 신호로 표시될 수 있습니다. 댓글과 구독 활동은 서비스 안에서 필요한 범위로 표시됩니다."
        ]
      },
      {
        title: "4. 회원 콘텐츠와 권리",
        body: [
          "회원이 작성한 문장, 카드 구성, 댓글 등 콘텐츠의 권리는 원칙적으로 회원 또는 원 권리자에게 있습니다.",
          "회원은 새김에 콘텐츠를 게시함으로써 서비스 제공, 저장, 표시, 추천, 검색, 공유 미리보기, 신고 검토, 운영 개선에 필요한 범위의 비독점적 이용 권한을 부여합니다.",
          "회원은 인용·발췌·이미지·출처 정보 등 자신이 올리는 콘텐츠에 필요한 권리를 확보해야 하며, 타인의 저작권·상표권·초상권·명예를 침해해서는 안 됩니다."
        ]
      },
      {
        title: "5. 금지 행위",
        body: [
          "불법 정보, 권리 침해 콘텐츠, 혐오·괴롭힘·성적 착취·폭력 조장, 스팸, 사칭, 자동화된 무단 수집, 서비스 방해 행위를 금지합니다.",
          "새김은 위반 콘텐츠나 계정에 대해 노출 제한, 삭제, 이용 제한, 신고 처리 등 필요한 조치를 할 수 있습니다."
        ]
      },
      {
        title: "6. 서비스 변경과 중단",
        body: [
          "새김은 안정적인 운영을 위해 기능을 추가·변경·중단할 수 있습니다. 중요한 변경은 서비스 안 공지 등 적절한 방식으로 안내합니다.",
          "현재 유료 결제 기능은 제공하지 않습니다. 유료 기능이 도입되면 별도 요금, 환불, 청약철회 기준을 마련해 고지합니다."
        ]
      },
      {
        title: "7. 탈퇴와 콘텐츠 정리",
        body: [
          "회원은 언제든 서비스 이용 중단이나 계정 삭제를 요청할 수 있습니다. 계정 삭제 기능과 보존 정책은 정식 운영 전 별도 화면과 절차로 확정합니다.",
          "법령상 보존 의무, 분쟁 처리, 보안 로그 등 필요한 경우 일부 정보는 정해진 기간 동안 보관될 수 있습니다."
        ]
      },
      {
        title: "8. 책임의 제한",
        body: [
          "새김은 회원이 게시한 콘텐츠의 정확성, 적법성, 신뢰성을 보증하지 않습니다. 회원 사이 또는 회원과 제3자 사이의 분쟁은 당사자가 책임지고 해결해야 합니다.",
          "새김의 고의 또는 중대한 과실이 없는 한, 무료로 제공되는 서비스 이용 과정에서 발생한 간접 손해나 기대 이익 상실에 대해 책임을 지지 않습니다."
        ]
      },
      {
        title: "9. 문의와 준거법",
        body: [
          "문의 창구와 사업자 정보는 운영 전 확정해 본 약관과 서비스 화면에 반영합니다.",
          "이 약관은 대한민국 법령을 기준으로 해석합니다. 분쟁 관할은 관련 법령이 정한 절차를 따릅니다."
        ]
      }
    ]
  },
  privacy: {
    kind: "privacy",
    title: "개인정보 처리방침",
    version: CURRENT_LEGAL_VERSIONS.privacy,
    effectiveDate: "2026-07-01",
    summary: "새김이 계정, 콘텐츠, 서비스 이용 정보를 어떤 목적으로 다루는지 설명합니다.",
    sections: [
      {
        title: "1. 처리하는 개인정보",
        body: [
          "이메일 가입 시 이메일, 닉네임, 비밀번호 해시, 약관 동의 기록을 처리합니다. Google 로그인을 이용하면 Google 계정 식별자, 이메일, 이름, 프로필 사진을 처리할 수 있습니다.",
          "서비스 이용 과정에서 공개 글·카드·출처·태그·댓글·프로필 정보, 좋아요·새김·구독 같은 활동 정보, 세션 쿠키, 접속·브라우저 정보, 오류·보안 로그가 생성될 수 있습니다.",
          "분석 기능을 켠 경우 화면 방문, 가입·로그인·글 발행·좋아요·새김 등 이벤트가 집계될 수 있습니다. 문장 본문, 댓글 본문, 검색어, 제목, 출처명 같은 사용자 입력 텍스트는 분석 이벤트 속성으로 보내지 않는 것을 기본 원칙으로 합니다."
        ]
      },
      {
        title: "2. 이용 목적",
        body: [
          "계정 생성과 로그인, 본인 식별, 세션 유지, 글 발행과 공개 조회, 새김 보관함, 댓글, 구독, 검색, 추천, 신고·부정 이용 방지, 보안과 오류 대응, 서비스 개선을 위해 개인정보를 사용합니다.",
          "운영 공지, 약관 변경 안내, 필수 보안 알림처럼 서비스 제공에 필요한 연락에 사용할 수 있습니다. 광고성 정보 수신은 별도 동의가 있는 경우에만 진행합니다."
        ]
      },
      {
        title: "3. 보유 기간",
        body: [
          "회원 정보와 회원이 만든 콘텐츠는 원칙적으로 회원 탈퇴 또는 삭제 요청 시까지 보관합니다.",
          "약관 동의 기록, 부정 이용 방지 기록, 접속·보안 로그, 분쟁 대응에 필요한 자료는 법령상 의무 또는 운영상 필요한 최소 기간 동안 보관할 수 있습니다. 구체적인 보존 기간은 정식 운영 전 확정해 반영합니다."
        ]
      },
      {
        title: "4. 제3자 제공과 처리 위탁",
        body: [
          "새김은 법령에 근거가 있거나 이용자 동의가 있는 경우를 제외하고 개인정보를 제3자에게 판매하거나 임의 제공하지 않습니다.",
          "서비스 제공을 위해 클라우드 호스팅, 데이터베이스, 이미지 저장·전송, OAuth 인증, 서비스 분석 도구를 사용할 수 있습니다. 실제 수탁사, 이전 국가, 보관 위치는 운영 전 확정해 공개합니다."
        ]
      },
      {
        title: "5. 이용자의 권리",
        body: [
          "이용자는 자신의 개인정보 열람, 정정, 삭제, 처리 정지, 동의 철회를 요청할 수 있습니다. 서비스 안에서 제공되지 않는 요청은 문의 창구를 통해 접수합니다.",
          "공개 글이나 댓글을 삭제하더라도 백업, 보안 로그, 법령상 보존 자료에는 일정 기간 남을 수 있습니다."
        ]
      },
      {
        title: "6. 쿠키와 세션",
        body: [
          "새김은 로그인 상태 유지를 위해 세션 쿠키를 사용합니다. 브라우저 설정으로 쿠키를 차단할 수 있으나 로그인과 계정 기능 이용이 제한될 수 있습니다.",
          "분석 도구를 사용하는 경우 서비스 품질 개선을 위한 쿠키나 유사 식별자가 사용될 수 있으며, 운영 전 실제 적용 범위를 확정합니다."
        ]
      },
      {
        title: "7. 안전성 확보 조치",
        body: [
          "비밀번호는 원문으로 저장하지 않고 해시로 저장합니다. 세션 쿠키, 접근 권한, 보안 설정, 로그 점검 등 개인정보 보호를 위한 기술적·관리적 조치를 적용합니다.",
          "개발·운영 과정에서 불필요한 개인정보 수집을 줄이고, 문장 본문 같은 민감할 수 있는 사용자 입력을 분석 이벤트로 보내지 않는 방향을 유지합니다."
        ]
      },
      {
        title: "8. 변경 고지와 문의",
        body: [
          "이 처리방침을 변경할 때에는 변경 내용과 시행일을 서비스 안 공지 또는 적절한 방법으로 안내합니다.",
          "개인정보 보호책임자, 담당 부서, 문의 이메일, 사업자 정보는 운영 전 확정해 본 방침과 서비스 화면에 반영합니다."
        ]
      }
    ]
  }
};

export interface CardPosition {
  xp: number;
  yp: number;
}

export interface CardBackgroundImage {
  url: string;
  objectKey?: string;
  alt?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  focalX: number;
  focalY: number;
  zoom: number;
}

export interface CardComposition {
  bg: string;
  dim: number;
  textColor: string;
  size: number;
  weight: CardWeight;
  align: CardAlign;
  font: CardFont;
  textPos?: CardPosition | null;
  sourcePos?: CardPosition | null;
  bgImage?: CardBackgroundImage | null;
}

export interface ContentSource {
  kind: SourceKind;
  author?: string;
  work?: string;
  url?: string;
}

export interface AccountProfile {
  id: SaegimId;
  handle: string;
  displayName: string;
  photoUrl?: string;
  tagline: string;
  bio?: string;
  verification: VerificationState;
  postCount: number;
  writingFriendCount: number;
  viewerState?: AccountViewerState;
}

export interface AccountViewerState {
  subscribed: boolean;
}

export interface SentenceCard {
  id: SaegimId;
  postId: SaegimId;
  order: number;
  text: string;
  comp: CardComposition;
  source: ContentSource;
  tags: string[];
  embeddingStatus: "pending" | "ready" | "skipped";
  createdAt: string;
}

export interface Post {
  id: SaegimId;
  title: string;
  authorId: SaegimId;
  coverCardId: SaegimId;
  cardCount: number;
  visibility: PostVisibility;
  creationType: PostCreationType;
  createdAt: string;
  updatedAt: string;
}

export interface PostBundle {
  post: Post;
  author: AccountProfile;
  cards: SentenceCard[];
  viewerState?: ViewerPostState;
}

export interface CreateSentenceCardInput {
  text: string;
  comp?: Partial<CardComposition>;
  source?: Partial<ContentSource>;
  tags?: string[];
}

export interface CreatePostInput {
  title?: string;
  visibility?: PostVisibility;
  creationType?: PostCreationType;
  cards: CreateSentenceCardInput[];
}

export interface UpdateAccountInput {
  displayName?: string;
  tagline?: string;
  bio?: string | null;
  photoUrl?: string | null;
}

export interface CreateCommentInput {
  body: string;
}

export interface ViewerPostState {
  liked: boolean;
  carved: boolean;
  subscribed: boolean;
  likeCount: number;
  commentCount: number;
}

export interface PageInfo {
  nextCursor: string | null;
  hasNextPage: boolean;
  limit: number;
}

export interface ListPage<T> {
  items: T[];
  pageInfo: PageInfo;
}

export interface Comment {
  id: SaegimId;
  postId: SaegimId;
  authorId: SaegimId;
  body: string;
  createdAt: string;
}

export interface PostComment {
  id: SaegimId;
  postId: SaegimId;
  author: AccountProfile;
  body: string;
  createdAt: string;
}

export interface CommentMutationResult {
  item: PostComment;
  post: PostBundle;
}

export interface SearchResult {
  accounts: AccountProfile[];
  posts: PostBundle[];
  accountPageInfo: PageInfo;
  postPageInfo: PageInfo;
}

export interface EditorialPage {
  id: SaegimId;
  kind: EditorialPageKind;
  label: string;
  title: string;
  date: string;
  summary: string;
  body: string[];
  cta?: {
    label: string;
    action: EditorialPageCtaAction;
  };
}

export interface PublicSeoIndex {
  posts: Array<{
    id: SaegimId;
    updatedAt: string;
  }>;
  accounts: Array<{
    handle: string;
    updatedAt: string;
  }>;
  editorialPages: Array<{
    id: SaegimId;
    updatedAt: string;
  }>;
}

export interface AccountDetail {
  account: AccountProfile;
  posts: PostBundle[];
  postPageInfo: PageInfo;
}

export interface FollowRelation {
  followerId: SaegimId;
  followingId: SaegimId;
  createdAt: string;
}

export interface CarveRelation {
  accountId: SaegimId;
  postId: SaegimId;
  cardId?: SaegimId;
  createdAt: string;
}

export interface LikeRelation {
  accountId: SaegimId;
  postId: SaegimId;
  createdAt: string;
}

export const CARD_GRADIENT_PRESETS = {
  dawn: "linear-gradient(150deg,#EEF0F3,#E6E9F0 55%,#ECE8F1)",
  sunset: "linear-gradient(150deg,#F5D7C8,#E9BBA9 52%,#CAB6D8)",
  fog: "linear-gradient(150deg,#F4F1F3,#E7E5EA 55%,#D8DAE4)",
  apricot: "linear-gradient(150deg,#F9E1D0,#F4C7AF 58%,#E7B7A9)",
  lavender: "linear-gradient(150deg,#EDE7F5,#D8D0EA 58%,#C8C7E1)",
  night: "linear-gradient(150deg,#3C3652,#241F38)"
} as const;

export const DEFAULT_CARD_COMP: CardComposition = {
  bg: CARD_GRADIENT_PRESETS.fog,
  dim: 0,
  textColor: "#38323F",
  size: 30,
  weight: 700,
  align: "center",
  font: "gothic",
  textPos: null,
  sourcePos: null,
  bgImage: null
};
