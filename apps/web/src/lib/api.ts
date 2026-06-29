import type { AccountProfile, PostBundle } from "@saegim/domain";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

interface ListResponse<T> {
  items: T[];
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const init: RequestInit = {
    headers: { Accept: "application/json" }
  };

  if (signal) {
    init.signal = signal;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (!response.ok) {
    throw new Error(`새김 API 요청 실패: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchFeed(signal?: AbortSignal): Promise<PostBundle[]> {
  const data = await fetchJson<ListResponse<PostBundle>>("/feed", signal);
  return data.items;
}

export async function fetchRecommendedAccounts(signal?: AbortSignal): Promise<AccountProfile[]> {
  const data = await fetchJson<ListResponse<AccountProfile>>("/accounts/recommended", signal);
  return data.items;
}
