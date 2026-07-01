export type CardFont = "gothic" | "serif" | "round" | "pen" | "black";
export type CardAlign = "left" | "center" | "right";
export type CardWeight = 300 | 400 | 700 | 800;
export type VerificationState = "none" | "official";
export type PostVisibility = "public" | "private";
export type PostCreationType = "original" | "curation";
export type SourceKind = "book" | "web" | "direct" | "publisher";
export type EditorialPageKind = "notice" | "event" | "ad";
export type EditorialPageCtaAction = "discover" | "contact";

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

export interface AccountViewerState {
  subscribed: boolean;
}

export interface AccountProfile {
  id: string;
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

export interface SentenceCard {
  id: string;
  postId: string;
  order: number;
  text: string;
  comp: CardComposition;
  source: ContentSource;
  tags: string[];
  embeddingStatus: "pending" | "ready" | "skipped";
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  authorId: string;
  coverCardId: string;
  cardCount: number;
  visibility: PostVisibility;
  creationType: PostCreationType;
  createdAt: string;
  updatedAt: string;
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

export interface PostBundle {
  post: Post;
  author: AccountProfile;
  cards: SentenceCard[];
  viewerState?: ViewerPostState;
}

export interface CreatePostInput {
  title?: string;
  visibility?: PostVisibility;
  creationType?: PostCreationType;
  cards: Array<{
    text: string;
    comp?: Partial<CardComposition>;
    source?: Partial<ContentSource>;
    tags?: string[];
  }>;
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

export interface PostComment {
  id: string;
  postId: string;
  author: AccountProfile;
  body: string;
  createdAt: string;
}

export interface SearchResult {
  accounts: AccountProfile[];
  posts: PostBundle[];
  accountPageInfo: PageInfo;
  postPageInfo: PageInfo;
}

export interface AccountDetail {
  account: AccountProfile;
  posts: PostBundle[];
  postPageInfo: PageInfo;
}

export interface EditorialPage {
  id: string;
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
    id: string;
    updatedAt: string;
  }>;
  accounts: Array<{
    handle: string;
    updatedAt: string;
  }>;
  editorialPages: Array<{
    id: string;
    updatedAt: string;
  }>;
}
