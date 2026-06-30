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
- `apps/web/src/lib/api.ts`: `NEXT_PUBLIC_API_BASE_URL` 기준으로 `/feed`, `/drawer`, `/editorial-pages`, `/accounts/me`, `/accounts/recommended`, `/accounts/following`, `POST /posts`, 좋아요/새김 토글 API를 호출한다. 프론트 내장 샘플 fallback은 두지 않는다.
- `apps/web/src/components/SaegimShell.tsx`: 포착 탭에서 1~N장 draft를 프론트 메모리에 유지하고 내부 발행 확인 팝업을 거쳐 `POST /posts` 성공 시에만 draft를 비운 뒤 API 응답을 피드 상태에 prepend하고 발견 탭으로 이동한다. 카드 삭제도 브라우저 기본 확인창이 아니라 내부 확인 팝업을 사용한다.
- `apps/web/src/components/SaegimShell.tsx`: 발견 화면은 현재 글/장 위치를 상태로 들고, ↑/↓로 글 이동, ←/→ 또는 장 점으로 장 이동을 처리한다. 홈·둘러보기·서랍·검색에서 글을 열면 해당 글을 발견 화면의 현재 글로 고정한다.
- `apps/web/src/components/SaegimShell.tsx`: 발견 화면의 좋아요(공개 수치)와 새김(비공개 상태) 버튼은 API 응답으로 viewerState를 갱신한다.
- `apps/web/src/components/SaegimShell.tsx`: 발견 화면 댓글 버튼은 댓글 시트를 열고, `GET/POST /posts/:postId/comments`로 댓글 목록과 작성 흐름을 처리한다. 작성 성공 시 응답의 갱신된 글 bundle로 댓글 수를 즉시 반영한다.
- `apps/web/src/components/SaegimShell.tsx`: 발견 화면 `⋯` 버튼은 출처·태그만 보여주는 하단 정보 패널을 연다. 준비 중인 공유/링크/출처 보기/신고 액션은 노출하지 않으며, 패널은 상단 핸들을 아래로 끌어 닫는다.
- `apps/web/src/components/SaegimShell.tsx`: 홈 소식 레일과 설정 > 공지사항은 `GET /editorial-pages` DB 데이터를 사용한다. MVP 시드는 공지만 넣고, 이벤트/광고는 DB 모델과 API만 열어 두며 계획 확정 전까지 노출하지 않는다.
- `apps/web/src/components/SaegimShell.tsx`: 홈 추천 글벗과 발견 작성자 바의 구독 버튼은 `POST/DELETE /accounts/:accountId/follow` 응답으로 계정 `viewerState.subscribed`와 같은 작성자의 글 `viewerState.subscribed`를 함께 갱신한다.
- `apps/web/src/components/SaegimShell.tsx`: 홈 추천 글벗·발견 작성자·검색 계정 결과를 동일 프로필 화면으로 열고, 타인 프로필 진입 시 `GET /accounts/:accountId` 상세로 계정 정보와 해당 계정 글 그리드를 보강한다.
- `apps/web/src/components/SaegimShell.tsx`: 프로필 글 그리드는 공통 글 미리보기 카드를 쓰되, 내 프로필에서는 공개 좋아요 수를 숨긴다.
- `apps/web/src/components/SaegimShell.tsx`: 나 탭의 `내 서랍`은 내 프로필 헤더 액션과 설정 활동 행 양쪽에서 진입하고, `GET /drawer`로 현재 계정이 새김한 글 목록을 읽어 둘러보기 카드 그리드로 보여준다. 설정에서 연 서랍은 뒤로가기 시 설정으로 돌아간다.
- `apps/web/src/components/SaegimShell.tsx`: 상단 검색 버튼은 검색 화면을 열고, `GET /search?q=`로 계정·글 통합 결과를 표시한다. 글 결과를 누르면 해당 글을 발견 화면으로 올린다.
- `apps/web/src/components/SaegimShell.tsx`: 앱은 미로그인 게스트 상태로 바로 열리고, 홈·발견·둘러보기·검색·타인 프로필은 막지 않는다. 하단 `나` 탭은 로그인 상태에서 현재 계정 아바타, 게스트 상태에서 별도 게스트 표시 아바타로 보인다. 게스트가 `나` 탭을 누르거나 좋아요·새김·댓글·구독·＋포착·내 프로필/서랍/구독 목록/프로필 편집처럼 계정에 남는 행동을 시도할 때 하단 로그인 패널(새김 워드마크/이메일/회원가입/Google/계속 둘러보기)을 띄운다. 로그인 패널은 액션별 제목·설명 없이 공통 폼으로 노출되고, 탭바/FAB보다 위의 모달 계층으로 뜬다. 이메일 회원가입/로그인은 `/auth/signup`·`/auth/login`을 호출해 `Account`와 세션 쿠키를 만들고, 성공 시 반환 계정을 현재 계정/나 탭에 즉시 반영한다. Google 버튼은 `/auth/google`로 이동하고, OAuth 콜백 후에는 `/auth/session`으로 세션 쿠키를 감지해 signed-in 상태로 전환한다. 나 탭 로그아웃은 `/auth/logout`을 호출하고 게스트 홈으로 돌아간다.
- `apps/web/src/components/SaegimShell.tsx`: 나 탭 프로필 편집은 `PATCH /accounts/me`로 닉네임·한줄 소개글·소개글·프로필 사진 URL을 저장하고 API 응답으로 현재 계정 상태를 갱신한다.
- `apps/web/src/components/SaegimShell.tsx`: 나 탭 설정 전체 페이지는 프로필 편집·내 서랍·구독 목록·공지사항·로그아웃을 연결하고, 알림·약관·문의 같은 미구현 항목은 `준비 중`으로 표시한다. 검색·설정·서랍·구독 목록·프로필 편집 같은 전체 페이지 상태에서는 하단 탭을 숨긴다.
- `apps/web/app/globals.css`: 설정에서 진입하는 전체 페이지(설정·내 서랍·구독 목록·공지 목록/상세·프로필 편집)는 같은 헤더 기준선(뒤로가기/제목 시작점)과 좌우 본문 여백을 공유한다. 서랍 계열도 설정 하위 페이지로 취급해 검색/정렬 도구와 목록을 동일한 레일 안에서 보여준다.
- `apps/web/src/components/SaegimShell.tsx`: 공통 `Avatar`는 `photoUrl`이 있으면 이미지 아바타를 보여주고, 실패하면 첫 글자 아바타로 돌아간다. 검색·추천 글벗·발견 작가 바·댓글·프로필·프로필 편집 미리보기에서 공유한다.
- `apps/web/src/components/SaegimShell.tsx`: `verification: "official"` 계정은 공통 이름 표시에서 닉네임 옆 공식 마크를 보여준다. 하단 `나` 탭은 현재 계정 아바타를 사용한다.
- `apps/web/src/components/SaegimShell.tsx` + `apps/web/app/globals.css`: Next 웹 공통 모바일 뷰는 `app.html`의 실제 앱 UI를 따르되, 데모용 폰 프레임·상태바는 제외한다. 워드마크 밑줄·원형 검색·하단 아이콘 탭/FAB, 홈 배너/레일, 발견 풀블리드 카드/제목 라벨/작가 칩/액션 레일은 프로토타입 위치감을 기준으로 맞추고, 글 미리보기는 공통 `shelf-card`와 카드 `comp` 배경 계약을 공유한다.
- `apps/api`: NestJS API. 현재 `/health`, `/auth/signup`, `/auth/login`, `/auth/google`, `/auth/google/callback`, `/auth/session`, `/auth/logout`, `/feed`, `/shelf`, `/drawer`, `/search`, `/posts/:postId`, `GET/PATCH /accounts/me`, `GET /accounts/:accountId`, `/accounts/recommended`, `/accounts/following`, `/editorial-pages`, `POST /posts`, `GET/POST /posts/:postId/comments`, `POST/DELETE /accounts/:accountId/follow`, 좋아요/새김 토글로 기본 계약을 확인한다. 발행·좋아요·새김·구독·댓글·공지/소식은 PostgreSQL에 저장한다. 이메일 계정은 `EmailCredential` 비밀번호 해시와 `saegim_session` 쿠키를 사용한다.
- `apps/api/src/auth`: Google OAuth 토큰 교환·계정/OAuthAccount 연결·서명 세션 쿠키(`saegim_session`) 발급을 담당한다. 개발 환경에서는 `x-saegim-account-id` 요청 헤더로 계정 컨텍스트를 임시 전환할 수 있고, 웹은 `NEXT_PUBLIC_DEV_ACCOUNT_ID`가 있으면 이 헤더를 자동으로 보낸다. 세션도 개발 헤더도 없으면 개발 기본값 `DEV_ACCOUNT_ID`를 사용하고, 운영에서는 세션 없이는 인증 오류를 반환한다.
- `apps/api/src/content/content.repository.ts`: Prisma 기반 콘텐츠 저장소. 서버 시작 시 시드 계정/글/공지 1건을 idempotent하게 보강하고, 응답을 `PostBundle`/`EditorialPage` 형태로 매핑한다.
- `apps/api/prisma/schema.prisma`: PostgreSQL 모델 계약. 계정, OAuth 계정, 글, 장, 구독, 좋아요, 새김, 댓글, 소식 페이지와 공개 카운터 캐시를 정의한다.
- `packages/domain`: 카드/글/계정/관계 공유 타입. WYSIWYG `comp` 계약은 여기서 먼저 바꾼다.
- `docker-compose.yml`: 로컬 PostgreSQL 개발용. 호스트 포트는 `55432`.

## 규칙

화면 텍스트·주석은 한글.
