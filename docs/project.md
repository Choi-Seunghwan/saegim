# 프로젝트 개요

## 한 줄 정의

새김(SAEGIM)은 문장을 카드로 만들어 발견하고, 마음에 새겨 간직하는 모바일 우선 웹 서비스다.

## 핵심 모델

- 카드(장): 문장, 구성 `comp`, 출처를 담는 원자 단위
- 글: 카드(장)의 순서 묶음이며 발행 단위
- 좋아요: 공개 공감
- 새김: 비공개 보관, 내 서랍에 담는 브랜드 핵심 액션
- 글벗: 계정 간 구독 관계

## 현재 스택

- Frontend: Next.js App Router, `apps/web`
- Backend: NestJS, `apps/api`
- Database: PostgreSQL, Prisma
- Shared domain: `packages/domain`
- Auth: 이메일 세션 + Google OAuth
- Analytics: Mixpanel, `NEXT_PUBLIC_MIXPANEL_*`
- Runtime: 홈랩 k3s
- Public ingress: Cloudflare Tunnel
- Image registry: GHCR
- Upload/CDN: S3 `saegim-uploads-prod` + CloudFront `cdn.saegim.chuz.dev`

## 주요 경로

- `apps/web`: 모바일 웹앱
- `apps/api`: API 서버와 Prisma schema
- `packages/domain`: 프론트/API 공유 타입
- `deploy/k8s`: k3s 매니페스트
- `.github/workflows/build-images.yml`: GHCR 이미지 빌드
- `docs`: 프로젝트/인프라/배포 문서

## 기획 기준

상세 기획과 UI/UX 결정은 [../PLANNING.md](../PLANNING.md)를 우선한다.
개발 구현 계약만 빠르게 보려면 [../HANDOFF.md](../HANDOFF.md)를 읽는다.
