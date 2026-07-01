# 환경변수

환경변수는 위치별로 역할이 다르다.

- `.env.local`: 로컬 개발용, git ignore
- `.env.example`: 로컬 개발 템플릿, 비밀값 없음
- GitHub Repository Variables: 웹 이미지 빌드 시점에 들어가는 public 값
- k3s ConfigMap: production 런타임 공개 설정
- k3s Secret: production 민감값

## 로컬 `.env.local`

필수 그룹:

```text
NODE_ENV
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_MIXPANEL_TOKEN
NEXT_PUBLIC_MIXPANEL_ENABLED
NEXT_PUBLIC_MIXPANEL_DEBUG
API_HOST
API_PORT
WEB_ORIGIN
DATABASE_URL
SAEGIM_SESSION_SECRET
SAEGIM_COOKIE_SECURE
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
GOOGLE_OAUTH_CALLBACK_URL
GOOGLE_OAUTH_SUCCESS_REDIRECT_URL
AWS_REGION
AWS_PROFILE
SAEGIM_UPLOADS_BUCKET
SAEGIM_UPLOADS_CDN_BASE_URL
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

`NEXT_PUBLIC_API_BASE_URL`을 비워두면 웹은 현재 브라우저 호스트 기준으로 `:4000` API를 사용한다.

## GitHub Repository Variables

위치:

```text
GitHub repo -> Settings -> Secrets and variables -> Actions -> Variables
```

운영 웹 이미지 빌드에 사용한다. `NEXT_PUBLIC_*` 값은 Next.js 번들에 포함되므로 런타임 Secret이 아니라 빌드 변수로 관리한다.

```text
NEXT_PUBLIC_MIXPANEL_TOKEN
NEXT_PUBLIC_MIXPANEL_ENABLED=true
NEXT_PUBLIC_MIXPANEL_DEBUG=false
NEXT_PUBLIC_MIXPANEL_API_HOST     # 선택
NEXT_PUBLIC_MIXPANEL_LIB_URL      # 선택
```

## k3s ConfigMap

매니페스트: [../deploy/k8s/configmap.yaml](../deploy/k8s/configmap.yaml)

```text
NODE_ENV=production
API_HOST=0.0.0.0
API_PORT=4000
WEB_ORIGIN=https://saegim.chuz.dev
SAEGIM_COOKIE_SECURE=true
GOOGLE_OAUTH_CALLBACK_URL=https://api-saegim.chuz.dev/auth/google/callback
GOOGLE_OAUTH_SUCCESS_REDIRECT_URL=https://saegim.chuz.dev
AWS_REGION=ap-northeast-2
SAEGIM_UPLOADS_BUCKET=saegim-uploads-prod
SAEGIM_UPLOADS_CDN_BASE_URL=https://cdn.saegim.chuz.dev
```

## k3s Secret

Secret 이름:

```text
saegim-env
```

필요 키:

```text
POSTGRES_PASSWORD
DATABASE_URL
SAEGIM_SESSION_SECRET
GOOGLE_OAUTH_CLIENT_ID
GOOGLE_OAUTH_CLIENT_SECRET
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

Cloudflare tunnel token은 별도 Secret을 쓴다.

```text
saegim-cloudflared
```

생성 명령:

```bash
read -rsp 'Cloudflare tunnel token: ' CF_TUNNEL_TOKEN; echo
kubectl -n apps create secret generic saegim-cloudflared \
  --from-literal=token="$CF_TUNNEL_TOKEN" \
  --dry-run=client -o yaml | kubectl apply -f -
unset CF_TUNNEL_TOKEN
```

## OAuth

Google Cloud Console에 아래 redirect URI가 필요하다.

```text
https://api-saegim.chuz.dev/auth/google/callback
```
