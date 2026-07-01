import type {
  AccountDetail,
  AccountProfile,
  CommentMutationResult,
  CreateCommentInput,
  CreatePostInput,
  EditorialPage,
  LegalAgreementInput,
  ListPage,
  PostBundle,
  PostComment,
  SearchResult,
  UpdateAccountInput,
  UpdatePostInput
} from "@saegim/domain";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

interface ListResponse<T> {
  items: T[];
  pageInfo?: ListPage<T>["pageInfo"];
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
  agreements?: LegalAgreementInput;
}

interface CursorPageParams {
  cursor?: string | null;
  limit?: number;
}

interface SearchPageParams {
  accountCursor?: string | null;
  postCursor?: string | null;
  accountLimit?: number;
  postLimit?: number;
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      credentials: "include",
      ...init,
      headers
    });
  } catch {
    throw new Error("서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
  }

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

    throw new Error(toDisplayApiErrorMessage(response.status, message));
  }

  return response.json() as Promise<T>;
}

function toDisplayApiErrorMessage(status: number, message: string) {
  const cleanMessage = message.trim();
  if (status >= 500) {
    return cleanMessage && cleanMessage !== "Internal server error"
      ? cleanMessage
      : "일시적으로 요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }

  return cleanMessage || `새김 요청을 완료하지 못했어요. (${status})`;
}

function getApiBaseUrl() {
  if (API_BASE_URL) {
    return normalizeLoopbackApiBaseUrl(API_BASE_URL);
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return "http://127.0.0.1:4000";
}

function normalizeLoopbackApiBaseUrl(apiBaseUrl: string) {
  if (typeof window === "undefined") {
    return apiBaseUrl;
  }

  try {
    const url = new URL(apiBaseUrl);
    const currentHostname = window.location.hostname;
    const isConfiguredLoopback =
      url.hostname === "127.0.0.1" || url.hostname === "localhost";
    const isCurrentLoopback =
      currentHostname === "127.0.0.1" || currentHostname === "localhost";

    if (isConfiguredLoopback && isCurrentLoopback) {
      url.hostname = currentHostname;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // 잘못된 URL이면 기존 설정값을 그대로 사용해 환경 오류가 드러나게 둔다.
  }

  return apiBaseUrl;
}

function toListPage<T>(data: ListResponse<T>): ListPage<T> {
  return {
    items: data.items,
    pageInfo: data.pageInfo ?? {
      nextCursor: null,
      hasNextPage: false,
      limit: data.items.length
    }
  };
}

function appendCursorParams(searchParams: URLSearchParams, params?: CursorPageParams) {
  if (params?.cursor) {
    searchParams.set("cursor", params.cursor);
  }

  if (typeof params?.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }
}

function makeQueryPath(path: string, searchParams: URLSearchParams) {
  const queryString = searchParams.toString();
  return `${path}${queryString ? `?${queryString}` : ""}`;
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

export async function fetchFeed(params?: CursorPageParams, signal?: AbortSignal): Promise<ListPage<PostBundle>> {
  const searchParams = new URLSearchParams();
  appendCursorParams(searchParams, params);
  const data = await fetchJson<ListResponse<PostBundle>>(makeQueryPath("/feed", searchParams), signal ? { signal } : {});
  return toListPage(data);
}

export async function fetchHomePosts(params?: CursorPageParams, signal?: AbortSignal): Promise<ListPage<PostBundle>> {
  const searchParams = new URLSearchParams();
  appendCursorParams(searchParams, params);
  const data = await fetchJson<ListResponse<PostBundle>>(
    makeQueryPath("/home/posts", searchParams),
    signal ? { signal } : {}
  );
  return toListPage(data);
}

export async function fetchShelf(
  sort: "popular" | "latest",
  params?: CursorPageParams,
  signal?: AbortSignal
): Promise<ListPage<PostBundle>> {
  const searchParams = new URLSearchParams({ sort });
  appendCursorParams(searchParams, params);
  const data = await fetchJson<ListResponse<PostBundle>>(makeQueryPath("/shelf", searchParams), signal ? { signal } : {});
  return toListPage(data);
}

export async function fetchRecommendedAccounts(
  params?: CursorPageParams,
  signal?: AbortSignal
): Promise<ListPage<AccountProfile>> {
  const searchParams = new URLSearchParams();
  appendCursorParams(searchParams, params);
  const data = await fetchJson<ListResponse<AccountProfile>>(
    makeQueryPath("/accounts/recommended", searchParams),
    signal ? { signal } : {}
  );
  return toListPage(data);
}

export async function fetchFollowingAccounts(signal?: AbortSignal): Promise<AccountProfile[]> {
  const data = await fetchJson<ListResponse<AccountProfile>>("/accounts/following", signal ? { signal } : {});
  return data.items;
}

export async function fetchDrawer(params?: CursorPageParams, signal?: AbortSignal): Promise<ListPage<PostBundle>> {
  const searchParams = new URLSearchParams();
  appendCursorParams(searchParams, params);
  const data = await fetchJson<ListResponse<PostBundle>>(makeQueryPath("/drawer", searchParams), signal ? { signal } : {});
  return toListPage(data);
}

export async function fetchEditorialPages(signal?: AbortSignal): Promise<EditorialPage[]> {
  const data = await fetchJson<ListResponse<EditorialPage>>("/editorial-pages", signal ? { signal } : {});
  return data.items;
}

export async function fetchSearch(
  query: string,
  params?: SearchPageParams,
  signal?: AbortSignal
): Promise<SearchResult> {
  const searchParams = new URLSearchParams();
  if (query.trim()) {
    searchParams.set("q", query.trim());
  }

  if (params?.accountCursor) {
    searchParams.set("accountCursor", params.accountCursor);
  }

  if (params?.postCursor) {
    searchParams.set("postCursor", params.postCursor);
  }

  if (typeof params?.accountLimit === "number") {
    searchParams.set("accountLimit", String(params.accountLimit));
  }

  if (typeof params?.postLimit === "number") {
    searchParams.set("postLimit", String(params.postLimit));
  }

  return fetchJson<SearchResult>(makeQueryPath("/search", searchParams), signal ? { signal } : {});
}

export async function fetchCurrentAccount(signal?: AbortSignal): Promise<AccountProfile> {
  const data = await fetchJson<ItemResponse<AccountProfile>>("/accounts/me", signal ? { signal } : {});
  return data.item;
}

export async function fetchAccountDetail(accountHandle: string, signal?: AbortSignal): Promise<AccountDetail> {
  return fetchJson<AccountDetail>(`/accounts/${encodeURIComponent(accountHandle)}`, signal ? { signal } : {});
}

export async function fetchAccountPosts(
  accountHandle: string,
  params?: CursorPageParams,
  signal?: AbortSignal
): Promise<ListPage<PostBundle>> {
  const searchParams = new URLSearchParams();
  appendCursorParams(searchParams, params);
  return fetchJson<ListPage<PostBundle>>(
    makeQueryPath(`/accounts/${encodeURIComponent(accountHandle)}/posts`, searchParams),
    signal ? { signal } : {}
  );
}

export async function fetchPost(postId: string, signal?: AbortSignal): Promise<PostBundle> {
  return fetchJson<PostBundle>(`/posts/${encodeURIComponent(postId)}`, signal ? { signal } : {});
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
  return `${getApiBaseUrl()}/auth/google`;
}

export async function createPost(input: CreatePostInput): Promise<PostBundle> {
  return fetchJson<PostBundle>("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function updatePost(postId: string, input: UpdatePostInput): Promise<PostBundle> {
  return fetchJson<PostBundle>(`/posts/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function deletePost(postId: string): Promise<{ ok: boolean; postId: string }> {
  return fetchJson<{ ok: boolean; postId: string }>(`/posts/${encodeURIComponent(postId)}`, {
    method: "DELETE"
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
