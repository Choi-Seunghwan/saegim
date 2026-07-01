import type { AccountDetail, EditorialPage, PostBundle, PublicSeoIndex } from "@saegim/domain";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:4000";

interface ItemResponse<T> {
  item: T;
}

export class PublicApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PublicApiError";
  }
}

async function fetchPublicJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    let message = `새김 공개 API 요청 실패: ${response.status}`;

    try {
      const errorBody = (await response.json()) as { message?: unknown };
      if (typeof errorBody.message === "string") {
        message = errorBody.message;
      }
    } catch {
      // 공개 페이지에서는 상태 코드만으로도 오류를 구분할 수 있다.
    }

    throw new PublicApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export async function fetchPublicPost(postId: string) {
  return fetchPublicJson<PostBundle>(`/posts/${encodeURIComponent(postId)}`);
}

export async function fetchPublicAccount(handle: string) {
  return fetchPublicJson<AccountDetail>(`/accounts/${encodeURIComponent(handle)}`);
}

export async function fetchPublicEditorialPage(pageId: string) {
  const data = await fetchPublicJson<ItemResponse<EditorialPage>>(
    `/editorial-pages/${encodeURIComponent(pageId)}`
  );
  return data.item;
}

export async function fetchPublicSeoIndex() {
  return fetchPublicJson<PublicSeoIndex>("/seo/public-index");
}

export function isPublicNotFound(error: unknown) {
  return error instanceof PublicApiError && error.status === 404;
}
