import type { AccountProfile, CreatePostInput, PostBundle } from "@saegim/domain";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

interface ListResponse<T> {
  items: T[];
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(`새김 API 요청 실패: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchFeed(signal?: AbortSignal): Promise<PostBundle[]> {
  const data = await fetchJson<ListResponse<PostBundle>>("/feed", signal ? { signal } : {});
  return data.items;
}

export async function fetchRecommendedAccounts(signal?: AbortSignal): Promise<AccountProfile[]> {
  const data = await fetchJson<ListResponse<AccountProfile>>("/accounts/recommended", signal ? { signal } : {});
  return data.items;
}

export async function createPost(input: CreatePostInput): Promise<PostBundle> {
  return fetchJson<PostBundle>("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}
