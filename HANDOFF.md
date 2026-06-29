# 새김 (SAEGIM) — 개발 착수 인수인계

> 기획/디자인 프로토타입 기준 인수인계. 단일 HTML 프로토타입 → 실서비스 개발 시작 시 참고.
> 이 문서는 **빌드에 필요한 요구사항·계약**만 담는다. 결정 배경·히스토리는 생략(프로토타입에 편향되지 않도록).

## 제품

문장을 카드로 만들어 **발견·새김·구독**으로 엮는 모바일 웹 서비스(모바일 뷰 우선).
5탭(홈 · 발견 · ＋포착 · 둘러보기 · 나) + 검색.

## 스택

- 모바일 뷰 우선 웹 서비스로 개발하고, 해당 웹을 기반으로 웹앱(WebView 래핑) 출시를 검토한다.
- **프론트**: Next.js(App Router)
- **백엔드**: NestJS
- **DB**: PostgreSQL
- **인증**: Google OAuth 우선(심사 불필요). provider를 추상화한 **범용 OAuth 모듈**로 설계 — 카카오·네이버는 이후 추가만.

## 핵심 도메인 모델

- **카드(장) ↔ 글 = 1:N**. 글 = 발행 단위(1~N장)
- **좋아요(♡ 공개 공감) ↔ 새김(서랍 비공개 간직)** = 별개 액션, 둘 다 유지.
- **구독 = 글벗**(상호·평등 계정). 인증 = 단일 '공식' 마크(상태).

## 깨면 안 되는 UX 계약

- **WYSIWYG**: 작성(에디터) = 조회(피드) 동일 렌더. `comp{bg,dim,textColor,size,weight,align,font}`를 그대로 전달.
- **카드 내부 스크롤 없음**(콘텐츠 자동 너비, 넘치면 클립).
- **모노톤**: 색은 '글 카드' 그라데이션에만, UI 크롬은 무채색.

## 백엔드 핵심

- 발행 저장 · 관계 그래프(구독/좋아요/새김) · 검색 인덱스.
- **의미 임베딩** → 취향 피드 · 유사 추천 · 자동 묶음(사용자는 테마를 직접 고르지 않음).

## 레퍼런스 (구현이 아니라 동작·디자인 참고용)

- **화면 명세** = `PLANNING.md` §1~13 (진행 로그·뒷이야기는 볼 필요 없음).
- **디자인 토큰·화면** = `design-system.html`.
- **인터랙션 데모** = `saegim/app.html` · `saegim/editor.html` — 바닐라 프로토타입. **그대로 포팅하지 말고 Next.js 프론트 + NestJS API 구조로 새로 구현.**

## 현재 개발 골격

- `apps/web`: Next.js(App Router) 프론트. 모바일 앱 쉘부터 구현한다.
- `apps/web/src/lib/api.ts`: `NEXT_PUBLIC_API_BASE_URL` 기준으로 `/feed`, `/accounts/me`, `/accounts/recommended`, `POST /posts`, 좋아요/새김 토글 API를 호출한다. API 실패 시 첫 화면은 샘플 데이터로 유지한다.
- `apps/web/src/components/SaegimShell.tsx`: 포착 탭에서 1~N장 글을 작성·발행하면 API 응답을 피드 상태에 prepend하고 발견 탭으로 이동한다.
- `apps/web/src/components/SaegimShell.tsx`: 발견 화면은 현재 글/장 위치를 상태로 들고, ↑/↓로 글 이동, ←/→ 또는 장 점으로 장 이동을 처리한다. 홈·둘러보기·서랍·검색에서 글을 열면 해당 글을 발견 화면의 현재 글로 고정한다.
- `apps/web/src/components/SaegimShell.tsx`: 발견 화면의 좋아요(공개 수치)와 새김(비공개 상태) 버튼은 API 응답으로 viewerState를 갱신한다.
- `apps/web/src/components/SaegimShell.tsx`: 발견 화면 댓글 버튼은 댓글 시트를 열고, `GET/POST /posts/:postId/comments`로 댓글 목록과 작성 흐름을 처리한다. 작성 성공 시 응답의 갱신된 글 bundle로 댓글 수를 즉시 반영한다.
- `apps/web/src/components/SaegimShell.tsx`: 발견 화면 `⋯` 버튼은 현재 글/장의 출처·태그와 공유/링크 복사/책으로 보기/신고 준비 상태를 보여주는 하단 정보 패널을 연다.
- `apps/web/src/components/SaegimShell.tsx`: 홈 소식 레일은 정적 공지·이벤트·AD 상세 페이지를 열고, 설정 > 공지사항은 공지 목록을 거쳐 공지 상세를 연다. 이벤트 CTA는 발견 피드로 이동하고 제휴 문의는 `준비 중`으로 둔다.
- `apps/web/src/components/SaegimShell.tsx`: 홈 추천 글벗과 발견 작성자 바의 구독 버튼은 `POST/DELETE /accounts/:accountId/follow` 응답으로 계정 `viewerState.subscribed`와 같은 작성자의 글 `viewerState.subscribed`를 함께 갱신한다.
- `apps/web/src/components/SaegimShell.tsx`: 홈 추천 글벗·발견 작성자·검색 계정 결과를 동일 프로필 화면으로 열고, 타인 프로필 진입 시 `GET /accounts/:accountId` 상세로 계정 정보와 해당 계정 글 그리드를 보강한다.
- `apps/web/src/components/SaegimShell.tsx`: 프로필 글 그리드는 공통 글 미리보기 카드를 쓰되, 내 프로필에서는 공개 좋아요 수를 숨긴다.
- `apps/web/src/components/SaegimShell.tsx`: 나 탭의 `내 서랍`은 `GET /drawer`로 현재 계정이 새김한 글 목록을 읽어 둘러보기 카드 그리드로 보여준다.
- `apps/web/src/components/SaegimShell.tsx`: 상단 검색 버튼은 검색 화면을 열고, `GET /search?q=`로 계정·글 통합 결과를 표시한다. 글 결과를 누르면 해당 글을 발견 화면으로 올린다.
- `apps/web/src/components/SaegimShell.tsx`: 로그인 게이트(로그인/회원가입/Google/게스트)를 먼저 보여주고, Google 버튼은 `/auth/google`로 이동한다. OAuth 콜백 후에는 `/auth/session`으로 세션 쿠키를 감지해 자동 입장한다. 이메일/게스트 입장 상태는 임시로 `saegim_web_entry_state` localStorage에 저장한다. 나 탭 로그아웃은 `/auth/logout`을 호출하고 게이트로 돌아간다.
- `apps/web/src/components/SaegimShell.tsx`: 나 탭 프로필 편집은 `PATCH /accounts/me`로 닉네임·한줄 소개글·소개글·프로필 사진 URL을 저장하고 현재 계정 상태를 갱신한다.
- `apps/web/src/components/SaegimShell.tsx`: 나 탭 설정 전체 페이지는 프로필 편집·내 서랍·로그아웃을 연결하고, 구독 목록·알림·정보 항목은 `준비 중`으로 표시한다. 검색·설정·서랍·프로필 편집 같은 전체 페이지 상태에서는 하단 탭을 숨긴다.
- `apps/web/src/components/SaegimShell.tsx`: 공통 `Avatar`는 `photoUrl`이 있으면 이미지 아바타를 보여주고, 실패하면 첫 글자 아바타로 돌아간다. 검색·추천 글벗·발견 작가 바·댓글·프로필·프로필 편집 미리보기에서 공유한다.
- `apps/api`: NestJS API. 현재 `/health`, `/auth/google`, `/auth/google/callback`, `/auth/session`, `/auth/logout`, `/feed`, `/shelf`, `/drawer`, `/search`, `/posts/:postId`, `GET/PATCH /accounts/me`, `GET /accounts/:accountId`, `/accounts/recommended`, `POST /posts`, `GET/POST /posts/:postId/comments`, `POST/DELETE /accounts/:accountId/follow`, 좋아요/새김 토글로 기본 계약을 확인한다. 발행·좋아요·새김·구독·댓글은 PostgreSQL에 저장한다.
- `apps/api/src/auth`: Google OAuth 토큰 교환·계정/OAuthAccount 연결·서명 세션 쿠키(`saegim_session`) 발급을 담당한다. 개발 환경에서는 `x-saegim-account-id` 요청 헤더로 계정 컨텍스트를 임시 전환할 수 있고, 웹은 `NEXT_PUBLIC_DEV_ACCOUNT_ID`가 있으면 이 헤더를 자동으로 보낸다. 세션도 개발 헤더도 없으면 개발 기본값 `DEV_ACCOUNT_ID`를 사용하고, 운영에서는 세션 없이는 인증 오류를 반환한다.
- `apps/api/src/content/content.repository.ts`: Prisma 기반 콘텐츠 저장소. 서버 시작 시 시드 계정/글을 idempotent하게 보강하고, 응답을 `PostBundle` 형태로 매핑한다.
- `apps/api/prisma/schema.prisma`: PostgreSQL 모델 계약. 계정, OAuth 계정, 글, 장, 구독, 좋아요, 새김, 댓글과 공개 카운터 캐시를 정의한다.
- `packages/domain`: 카드/글/계정/관계 공유 타입. WYSIWYG `comp` 계약은 여기서 먼저 바꾼다.
- `docker-compose.yml`: 로컬 PostgreSQL 개발용. 호스트 포트는 `55432`.

## 규칙

화면 텍스트·주석은 한글.
