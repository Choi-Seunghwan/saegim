# 인프라

## 목표 구조

```text
Browser
  -> Cloudflare DNS / TLS
  -> Cloudflare Tunnel
  -> k3s cloudflared pod
  -> saegim-web / saegim-api service
  -> PostgreSQL StatefulSet
```

업로드 파일:

```text
Browser/API
  -> S3 saegim-uploads-prod
  -> CloudFront
  -> cdn.saegim.chuz.dev
```

## 도메인

Cloudflare Free Universal SSL 범위에 맞추기 위해 깊은 하위 도메인을 피한다.

```text
saegim.chuz.dev       -> 웹앱
api-saegim.chuz.dev   -> API
cdn.saegim.chuz.dev   -> 업로드 CDN
```

Cloudflare Tunnel Published application routes:

```text
saegim.chuz.dev      -> http://saegim-web.apps.svc.cluster.local:3000
api-saegim.chuz.dev  -> http://saegim-api.apps.svc.cluster.local:4000
```

`Hostname routes (Beta)`는 WARP/Gateway private hostname 용도이므로 이 배포 경로에는 쓰지 않는다.

## Cloudflare

- Zone: `chuz.dev`
- Tunnel: `saegim-prod`
- Connector runtime: k3s Deployment `saegim-cloudflared`
- Token storage: k3s Secret `apps/saegim-cloudflared`

Cloudflare dashboard의 `cloudflared service install ...` 명령은 직접 실행하지 않는다.
그 명령의 token만 복사해 k3s Secret으로 저장한다.

## k3s

Namespace:

```text
apps
```

주요 리소스:

```text
saegim-postgres  StatefulSet + Service
saegim-api       Deployment + Service
saegim-web       Deployment + Service
saegim-cloudflared Deployment
```

이미지:

```text
ghcr.io/choi-seunghwan/saegim-web:main
ghcr.io/choi-seunghwan/saegim-api:main
```

이미지 pull secret:

```text
ghcr-pull-secret
```

## AWS

S3:

```text
Bucket: saegim-uploads-prod
Region: ap-northeast-2
```

CloudFront:

```text
Distribution: E33CMHGQNKG05A
Alias: cdn.saegim.chuz.dev
```

S3 public access는 차단하고 CloudFront OAC만 `GetObject`를 허용한다.
앱 업로드용 IAM policy는 [../deploy/aws-saegim-app-policy.json](../deploy/aws-saegim-app-policy.json)에 둔다.

## GitHub / GHCR

GitHub Actions workflow:

```text
.github/workflows/build-images.yml
```

정책:

- `dev` push: 자동 이미지 빌드 없음
- 수동 workflow_dispatch: 필요 시 검증 빌드
- `main` push: GHCR 이미지 빌드/푸시

GHCR 이미지는 private일 수 있으므로 k3s는 `ghcr-pull-secret`으로 pull한다.
