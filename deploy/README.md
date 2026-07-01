# 새김 배포

## 목표 도메인

- `saegim.chuz.dev` - Next.js 웹앱
- `api-saegim.chuz.dev` - NestJS API

Cloudflare Free Universal SSL 범위에 맞추기 위해 `web.saegim.chuz.dev` 같은 깊은 하위 도메인 대신 한 단계 하위 도메인을 쓴다.

## 이미지

브랜치는 `dev`에서 개발/검증하고, `main`을 production 배포 기준으로 쓴다.

GitHub Actions는 `dev` push에서 Docker build만 검증하고, `main` push에서만 GHCR에 두 이미지를 푸시한다.

- `ghcr.io/choi-seunghwan/saegim-web:main`
- `ghcr.io/choi-seunghwan/saegim-api:main`

웹 이미지는 빌드 시점에 아래 API 주소를 브라우저 번들에 포함한다.

```text
NEXT_PUBLIC_API_BASE_URL=https://api-saegim.chuz.dev
```

## AWS 업로드/CDN

- S3 bucket: `saegim-uploads-prod`
- CDN: `https://cdn.saegim.chuz.dev`
- CloudFront distribution: `E33CMHGQNKG05A`
- CloudFront OAC만 S3 `GetObject`를 허용한다.
- S3 직접 public 접근은 차단한다.

API가 presigned upload URL을 만들게 되면 앱 전용 IAM user/access key를 쓴다.
정책 JSON은 `deploy/aws-saegim-app-policy.json`이다.

권장 IAM 구성:

```text
User: saegim-app-prod
Policy: deploy/aws-saegim-app-policy.json
Access key: Kubernetes secret saegim-env에 저장
```

생성한 앱 access key는 아래 키로 `saegim-env`에 추가한다.

```bash
kubectl -n apps create secret generic saegim-env \
  --from-literal=POSTGRES_PASSWORD='...' \
  --from-literal=DATABASE_URL='postgresql://saegim:...@saegim-postgres:5432/saegim' \
  --from-literal=SAEGIM_SESSION_SECRET='...' \
  --from-literal=GOOGLE_OAUTH_CLIENT_ID='...' \
  --from-literal=GOOGLE_OAUTH_CLIENT_SECRET='...' \
  --from-literal=AWS_ACCESS_KEY_ID='...' \
  --from-literal=AWS_SECRET_ACCESS_KEY='...' \
  --dry-run=client -o yaml | kubectl apply -f -
```

## Cloudflare Tunnel

Cloudflare Zero Trust에서 named tunnel을 만들고, Public Hostname을 아래처럼 연결한다.

```text
saegim.chuz.dev -> http://saegim-web.apps.svc.cluster.local:3000
api-saegim.chuz.dev -> http://saegim-api.apps.svc.cluster.local:4000
```

Cloudflare tunnel token은 아래 secret에 저장한다.

```bash
kubectl -n apps create secret generic saegim-cloudflared \
  --from-literal=token='CLOUDFLARE_TUNNEL_TOKEN' \
  --dry-run=client -o yaml | kubectl apply -f -
```

## k3s 배포

1. Secret 예시를 복사해서 실제 값을 넣는다.

```bash
cp deploy/k8s/secret.example.yaml /tmp/saegim-secret.yaml
vi /tmp/saegim-secret.yaml
kubectl apply -f /tmp/saegim-secret.yaml
```

2. 매니페스트를 적용한다.

```bash
kubectl apply -k deploy/k8s
```

3. 상태를 확인한다.

```bash
kubectl -n apps get pods -l app.kubernetes.io/part-of=saegim
kubectl -n apps get svc -l app.kubernetes.io/part-of=saegim
kubectl -n apps logs deploy/saegim-api
kubectl -n apps logs deploy/saegim-cloudflared
```

4. 내부 서비스 확인:

```bash
kubectl -n apps run saegim-curl --rm -it --image=curlimages/curl --restart=Never -- \
  curl -fsS http://saegim-api:4000/health
```

## Google OAuth

Google Cloud Console OAuth 리디렉션 URI:

```text
https://api-saegim.chuz.dev/auth/google/callback
```

OAuth 설정 전에도 이메일 회원가입/로그인 API는 사용할 수 있다.
