# 새김 (SAEGIM)

> 한 줄을 카드로 만들어, 발견하고, 마음에 새겨 간직하는 모바일 웹 서비스
> 현재 **기획/디자인 프로토타입 + 실서비스 개발 골격 착수**

## 한 줄 정의
문장을 카드로 만들어 **발견·새김·컬렉션으로 엮는** 곳. 깊은 문장 큐레이션 + 인스타식 평등 계정 소셜.

## 핵심 개념
- **카드(장)** = 원자 단위(문장 + 구성 `comp` + 출처). 한 종류이며 **카드 내부 스크롤 없음**(작성 크기로 표시, 넘치면 클립).
- **글** = 카드(장)의 순서 묶음. **발행 단위**(카드 1장도 1장짜리 글). 카드 ↔ 글 = **1:N**.
- **5탭**: 홈(에디토리얼) · 발견(글 피드) · ＋포착(에디터) · 둘러보기(글 갤러리) · 나 + 검색.
- **좋아요(공개 공감) ↔ 새김(비공개 서랍 간직) 분리** — 새김이 브랜드 핵심 액션.
- **소셜**: 모든 계정 동등·상호 구독(**글벗**). 인증 = '상태'(단일 '공식' 채움 마크).
- **비주얼**: C 소프트 감성 · 모노톤(색은 '글 카드'에만, UI 크롬은 무채색). 카드 문장 폰트 5종(고딕/명조/둥근/손글씨/진한), 워드마크 Gowun Dodum, UI Pretendard.

## 폴더 구조
- `docs/` — 프로젝트 문서 허브. 제품·개발·환경변수·인프라·배포·현재 상태를 여기서 찾는다.
- `PLANNING.md` — **기획 SSOT**(확정 상태 종합본 §1~13 · 진행 로그 · **§14 개발 착수 가이드**). 여기부터 읽으면 전체 맥락이 잡힌다.
- `design-system.html` — 디자인 시스템 + 화면별 데모(통합 앱 딥링크 임베드).
- `CLAUDE.md` — 작업 지침(요약).
- `HANDOFF.md` — 개발 착수용 핵심 계약(기획 히스토리 제외).
- `apps/`
  - `web/` — Next.js(App Router) 프론트 골격.
  - `api/` — NestJS API 골격. `prisma/schema.prisma`에 PostgreSQL 모델 계약을 둔다.
- `packages/`
  - `domain/` — 프론트·백엔드가 공유하는 카드/글/계정 타입 계약.
- `saegim/`
  - `app.html` — **통합 앱(메인 데모)**. 5탭 + 발견 2D 뷰어 + 검색 + 서랍, 단일 파일 SPA(바닐라 JS·localStorage).
  - `editor.html` — 카드 에디터(＋포착, 작성=조회 WYSIWYG).

## 데모 보는 법
브라우저에서 `saegim/app.html`(통합 앱)을 열거나, `design-system.html`(기획서 + 화면별 데모)을 연다.

## 개발 착수
**스택**: Next.js(App Router) 프론트 · NestJS 백엔드 · PostgreSQL · Google OAuth 우선.

**`PLANNING.md` §14(개발 착수 가이드)** 참조 — 화면 라우팅, 상태/저장(localStorage → API/DB), 발행 흐름, WYSIWYG `comp` 계약, 데이터 시드, 백엔드 경계(임베딩·인증·검색), 재사용 컴포넌트, 테스트, 정리 대상.

```bash
pnpm install
pnpm dev:web
pnpm dev:api
```

PostgreSQL 로컬 확인이 필요하면 `docker compose up -d postgres`를 사용한다. 새김 전용 DB는 기존 로컬 Postgres와 충돌하지 않도록 호스트 `55432` 포트를 쓴다.

문서는 [docs/README.md](docs/README.md)에서 시작한다. 컨테이너/k3s 배포는 [docs/deployment.md](docs/deployment.md)를 따른다. 초기 목표 도메인은 `saegim.chuz.dev`와 `api-saegim.chuz.dev`다.

API 기본 조회 계약:
- `GET /health`
- `POST /auth/signup` — 이메일 회원가입, 계정 생성, 세션 쿠키 발급
- `POST /auth/login` — 이메일 로그인, 세션 쿠키 발급
- `GET /auth/google` — Google OAuth 시작(클라이언트 ID 설정 시 Google로 리다이렉트)
- `GET /auth/google/callback` — Google OAuth 토큰 교환·계정 연결·세션 쿠키 발급 후 웹으로 리다이렉트
- `GET /auth/session` — 세션 쿠키 인증 상태 확인
- `POST /auth/logout` — 세션 쿠키 삭제
- `GET /feed`
- `GET /shelf`
- `GET /posts/:postId`
- `GET /accounts/me`
- `PATCH /accounts/me` — 현재 계정 프로필 수정
- `GET /accounts/:accountId` — 계정 상세 + 공개 글 목록
- `GET /accounts/recommended`
- `GET /accounts/following` — 현재 계정이 구독중인 계정 목록
- `GET /editorial-pages` — 공지·이벤트·광고 소식 목록(DB 기반, 운영 데이터는 별도 등록)
- `POST /posts` — PostgreSQL 저장
- `POST /posts/:postId/like` / `DELETE /posts/:postId/like`
- `POST /posts/:postId/carve` / `DELETE /posts/:postId/carve`

웹은 `NEXT_PUBLIC_API_BASE_URL`이 있으면 해당 API를 사용하고, 비워두면 브라우저에서 연 호스트의 `:4000` API를 읽는다. 프론트 내장 샘플 fallback은 두지 않는다. 포착 탭은 작성 중 draft를 프론트 메모리에 유지하다가 1~N장 글을 `POST /posts`로 발행하고, 성공 시 draft를 비운 뒤 발견 피드로 이동한다. 로컬 개발에서는 API 시작 시 MVP용 공개 계정/글 샘플과 공지 1건을 PostgreSQL에 idempotent하게 보강할 수 있지만, `NODE_ENV=production`에서는 자동 seed를 실행하지 않는다.

API의 현재 계정은 이메일 로그인 또는 Google OAuth가 발급한 세션 쿠키(`saegim_session`)로만 해석한다. 세션이 없으면 홈·발견·둘러보기·검색·타인 프로필 같은 공개 조회는 게스트 상태로 동작하고, 내 프로필·내 서랍·구독 목록·발행·좋아요·새김·댓글·구독·프로필 수정 같은 계정 필요 API는 인증 오류를 반환한다.

Mixpanel은 `NEXT_PUBLIC_MIXPANEL_TOKEN`과 `NEXT_PUBLIC_MIXPANEL_ENABLED=true`가 있을 때만 브라우저에서 활성화된다. 기본 이벤트는 화면 상태 기반 `Page Viewed`/Mixpanel pageview와 가입·로그인·로그아웃·글 발행·글 열기·프로필 열기·좋아요·새김·구독·댓글·검색 열기·정보 패널 열기다. 문장 본문, 댓글 본문, 검색어, 제목, 출처명 같은 사용자 입력 텍스트는 이벤트 속성으로 보내지 않고 카드 수·태그 수·댓글 길이·이미지 배경 여부 같은 집계용 값만 보낸다. EU 리전이나 프록시를 쓰면 `NEXT_PUBLIC_MIXPANEL_API_HOST`를 추가한다. 운영에서는 GitHub repository variables로 `NEXT_PUBLIC_*` 값을 넣고 웹 이미지를 빌드한다.

이미지 업로드를 S3로 연결할 때는 `.env.example`의 업로드 섹션을 채운다. 기본 AWS S3는 `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SAEGIM_UPLOADS_BUCKET`, `SAEGIM_UPLOADS_CDN_BASE_URL`이 필요하다.

Prisma 스키마 확인:

```bash
DATABASE_URL=postgresql://saegim:saegim@localhost:55432/saegim pnpm --filter @saegim/api db:validate
DATABASE_URL=postgresql://saegim:saegim@localhost:55432/saegim pnpm --filter @saegim/api db:generate
DATABASE_URL=postgresql://saegim:saegim@localhost:55432/saegim pnpm --filter @saegim/api db:push
```

## 디자인
**C(소프트 감성) · 모노톤** — 배경 뉴트럴 미스트(#F6F5F6) · 먹보라/차콜 잉크(#38323F) · 포인트 잉크 차콜(#353039). 색은 글 카드 그라데이션 프리셋(새벽/노을/안개/살구/라벤더/밤)에만. 아이콘은 라인 round 마감 통일.

## 상태 / 저작권
기획·디자인 프로토타입(단일 HTML · localStorage). 모든 문장은 공유저작물 또는 자체 창작 시드. 실제 런칭 전 라이선스 검토 필요.
