# 현재 상태

마지막 정리 시각: 2026-07-01 KST

이 문서는 다른 작업 세션이 현재 배포 준비 상태를 빠르게 파악하기 위한 스냅샷이다.
실제 배포 직전에는 명령으로 다시 확인한다.

## Git

기준:

```text
현재 작업 브랜치: dev
production 브랜치: main
폐기 브랜치: master
```

2026-07-01 기준 `dev` 최신 커밋:

```text
060be56 chore: tidy env and manualize dev image builds
```

`main`은 아직 production 배포 반영 전 상태다.

## Cloudflare

Tunnel:

```text
saegim-prod
```

Published application routes:

```text
saegim.chuz.dev      -> http://saegim-web.apps.svc.cluster.local:3000
api-saegim.chuz.dev  -> http://saegim-api.apps.svc.cluster.local:4000
```

잘못 만들 수 있는 `Hostname routes (Beta)`는 이 배포에 필요 없다.

## k3s Secret

2026-07-01 기준 확인된 Secret:

```text
apps/saegim-env
apps/ghcr-pull-secret
apps/saegim-cloudflared
```

값은 문서에 기록하지 않는다.

## GitHub Actions Variables

2026-07-01 기준 등록된 Mixpanel variables:

```text
NEXT_PUBLIC_MIXPANEL_TOKEN
NEXT_PUBLIC_MIXPANEL_ENABLED
NEXT_PUBLIC_MIXPANEL_DEBUG
```

선택값은 비어 있어 등록하지 않았다.

```text
NEXT_PUBLIC_MIXPANEL_API_HOST
NEXT_PUBLIC_MIXPANEL_LIB_URL
```

## Google OAuth

등록해야 하는 redirect URI:

```text
https://api-saegim.chuz.dev/auth/google/callback
```

사용자가 2026-07-01 대화에서 이미 추가했다고 확인했다.

## 아직 하지 않은 일

- URL 분리 작업 완료 대기
- `dev` 최신 상태 재확인
- `main` 반영
- `main` push로 GHCR 이미지 빌드/푸시
- `kubectl apply -k deploy/k8s`
- 외부 URL 확인

## 배포 재개 시 시작 명령

```bash
git status --short --branch
git fetch origin dev main
kubectl -n apps get secret saegim-env ghcr-pull-secret saegim-cloudflared
kubectl apply -k deploy/k8s --dry-run=server
```
