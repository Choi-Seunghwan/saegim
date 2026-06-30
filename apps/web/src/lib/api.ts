import type {
  AccountDetail,
  AccountProfile,
  CommentMutationResult,
  CreateCommentInput,
  CreatePostInput,
  EditorialPage,
  PostBundle,
  PostComment,
  SearchResult,
  UpdateAccountInput
} from "@saegim/domain";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";
const DEV_ACCOUNT_ID = process.env.NEXT_PUBLIC_DEV_ACCOUNT_ID?.trim();

interface ListResponse<T> {
  items: T[];
}

interface ItemResponse<T> {
  item: T;
}

interface AuthSessionResponse {
  authenticated: boolean;
  accountId: string | null;
}

interface EmailAuthInput {
  email: string;
  password: string;
  displayName?: string;
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (process.env.NODE_ENV !== "production" && DEV_ACCOUNT_ID) {
    headers.set("x-saegim-account-id", DEV_ACCOUNT_ID);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers
  });

  if (!response.ok) {
    let message = `새김 API 요청 실패: ${response.status}`;

    try {
      const errorBody = (await response.json()) as { message?: unknown };
      if (typeof errorBody.message === "string") {
        message = errorBody.message;
      } else if (Array.isArray(errorBody.message) && typeof errorBody.message[0] === "string") {
        message = errorBody.message[0];
      }
    } catch {
      // JSON 오류 본문이 아니면 기본 상태 메시지를 사용한다.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function signupWithEmail(input: EmailAuthInput): Promise<AccountProfile> {
  const data = await fetchJson<ItemResponse<AccountProfile>>("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return data.item;
}

export async function loginWithEmail(input: EmailAuthInput): Promise<AccountProfile> {
  const data = await fetchJson<ItemResponse<AccountProfile>>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return data.item;
}

export async function fetchAuthSession(signal?: AbortSignal): Promise<AuthSessionResponse> {
  return fetchJson<AuthSessionResponse>("/auth/session", signal ? { signal } : {});
}

export async function logoutSession(): Promise<{ ok: boolean }> {
  return fetchJson<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export async function fetchFeed(signal?: AbortSignal): Promise<PostBundle[]> {
  const data = await fetchJson<ListResponse<PostBundle>>("/feed", signal ? { signal } : {});
  return data.items;
}

export async function fetchRecommendedAccounts(signal?: AbortSignal): Promise<AccountProfile[]> {
  const data = await fetchJson<ListResponse<AccountProfile>>("/accounts/recommended", signal ? { signal } : {});
  return data.items;
}

export async function fetchFollowingAccounts(signal?: AbortSignal): Promise<AccountProfile[]> {
  const data = await fetchJson<ListResponse<AccountProfile>>("/accounts/following", signal ? { signal } : {});
  return data.items;
}

export async function fetchDrawer(signal?: AbortSignal): Promise<PostBundle[]> {
  const data = await fetchJson<ListResponse<PostBundle>>("/drawer", signal ? { signal } : {});
  return data.items;
}

export async function fetchEditorialPages(signal?: AbortSignal): Promise<EditorialPage[]> {
  const data = await fetchJson<ListResponse<EditorialPage>>("/editorial-pages", signal ? { signal } : {});
  return data.items;
}

export async function fetchSearch(query: string, signal?: AbortSignal): Promise<SearchResult> {
  const searchParams = new URLSearchParams();
  if (query.trim()) {
    searchParams.set("q", query.trim());
  }

  const queryString = searchParams.toString();
  return fetchJson<SearchResult>(`/search${queryString ? `?${queryString}` : ""}`, signal ? { signal } : {});
}

export async function fetchCurrentAccount(signal?: AbortSignal): Promise<AccountProfile> {
  const data = await fetchJson<ItemResponse<AccountProfile>>("/accounts/me", signal ? { signal } : {});
  return data.item;
}

export async function fetchAccountDetail(accountId: string, signal?: AbortSignal): Promise<AccountDetail> {
  return fetchJson<AccountDetail>(`/accounts/${encodeURIComponent(accountId)}`, signal ? { signal } : {});
}

export async function updateCurrentAccount(input: UpdateAccountInput): Promise<AccountProfile> {
  const data = await fetchJson<ItemResponse<AccountProfile>>("/accounts/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return data.item;
}

export async function followAccount(accountId: string): Promise<AccountProfile> {
  const data = await fetchJson<ItemResponse<AccountProfile>>(`/accounts/${accountId}/follow`, { method: "POST" });
  return data.item;
}

export async function unfollowAccount(accountId: string): Promise<AccountProfile> {
  const data = await fetchJson<ItemResponse<AccountProfile>>(`/accounts/${accountId}/follow`, { method: "DELETE" });
  return data.item;
}

export function getGoogleOAuthStartUrl() {
  return `${API_BASE_URL}/auth/google`;
}

export async function createPost(input: CreatePostInput): Promise<PostBundle> {
  return fetchJson<PostBundle>("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function likePost(postId: string): Promise<PostBundle> {
  return fetchJson<PostBundle>(`/posts/${postId}/like`, { method: "POST" });
}

export async function unlikePost(postId: string): Promise<PostBundle> {
  return fetchJson<PostBundle>(`/posts/${postId}/like`, { method: "DELETE" });
}

export async function carvePost(postId: string): Promise<PostBundle> {
  return fetchJson<PostBundle>(`/posts/${postId}/carve`, { method: "POST" });
}

export async function uncarvePost(postId: string): Promise<PostBundle> {
  return fetchJson<PostBundle>(`/posts/${postId}/carve`, { method: "DELETE" });
}

export async function fetchPostComments(postId: string, signal?: AbortSignal): Promise<PostComment[]> {
  const data = await fetchJson<ListResponse<PostComment>>(
    `/posts/${postId}/comments`,
    signal ? { signal } : {}
  );
  return data.items;
}

export async function createPostComment(
  postId: string,
  input: CreateCommentInput
): Promise<CommentMutationResult> {
  return fetchJson<CommentMutationResult>(`/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}
