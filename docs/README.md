# 새김 문서

이 폴더는 새김 프로젝트의 제품, 개발, 환경변수, 인프라, 배포 문서를 모으는 진입점이다.
다른 작업 세션에서는 이 파일을 먼저 읽고 필요한 문서로 들어간다.

## 빠른 진입

- [프로젝트 개요](./project.md) - 제품 정의, 핵심 모델, 코드 구조
- [개발 가이드](./development.md) - 브랜치 운용, 로컬 실행, 검증
- [환경변수](./environment.md) - 로컬 `.env.local`, GitHub Actions Variables, k3s ConfigMap/Secret
- [인프라](./infrastructure.md) - 홈랩, 도메인, Cloudflare, AWS, k3s 구성
- [배포](./deployment.md) - `dev -> main -> GHCR -> k3s` 배포 절차
- [현재 상태](./current-status.md) - 2026-07-01 기준 배포 준비 상태와 남은 작업

## 루트 문서

아래 파일은 도구나 기획 관례상 루트에 둔다.

- [../AGENTS.md](../AGENTS.md) - Codex/에이전트 작업 규칙
- [../CLAUDE.md](../CLAUDE.md) - Claude 작업 규칙
- [../PLANNING.md](../PLANNING.md) - 기획 SSOT
- [../HANDOFF.md](../HANDOFF.md) - 제품/개발 계약 인수인계
- [../README.md](../README.md) - 저장소 첫 화면용 요약

## 운영 원칙

- `dev`는 개발/검증 브랜치다.
- `main`은 production 배포 브랜치다.
- `master`는 폐기된 브랜치로 간주한다.
- `dev` push는 비용 절감을 위해 자동 이미지 빌드를 실행하지 않는다.
- production 이미지는 `main` push 때만 GitHub Actions가 GHCR에 push한다.
