export type SaegimId = string;

export type CardFont = "gothic" | "serif" | "round" | "pen" | "black";
export type CardAlign = "left" | "center" | "right";
export type CardWeight = 300 | 400 | 700 | 800;
export type VerificationState = "none" | "official";
export type PostVisibility = "public" | "private";
export type PostCreationType = "original" | "curation";
export type SourceKind = "book" | "web" | "direct" | "publisher";

export interface CardPosition {
  xp: number;
  yp: number;
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

export interface ViewerPostState {
  liked: boolean;
  carved: boolean;
  subscribed: boolean;
  likeCount: number;
  commentCount: number;
}

export interface Comment {
  id: SaegimId;
  postId: SaegimId;
  authorId: SaegimId;
  body: string;
  createdAt: string;
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
  sourcePos: null
};
