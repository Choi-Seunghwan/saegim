# 배포

## 브랜치 흐름

```text
dev에서 개발/검증
  -> main에 반영
  -> main push
  -> GitHub Actions가 GHCR 이미지 빌드/푸시
  -> k3s apply
  -> Cloudflare Tunnel로 외부 확인
```

`main`은 production 배포 브랜치다.

## 배포 전 체크리스트

- `dev`가 clean이고 `origin/dev`와 일치한다.
- 필요한 작업이 `main`에 반영될 준비가 됐다.
- GitHub Repository Variables에 Mixpanel 값이 있다.
- `saegim-env` Secret이 있다.
- `saegim-cloudflared` Secret이 있다.
- `ghcr-pull-secret` Secret이 있다.
- Google OAuth redirect URI가 등록됐다.
- Cloudflare Published application routes가 있다.

## main 반영

```bash
git switch main
git pull --ff-only origin main
git merge --ff-only dev
git push origin main
```

상황에 따라 fast-forward가 불가능하면 merge commit 또는 PR 전략을 선택한다.

## GitHub Actions 확인

`main` push 후 `Build images` workflow가 실행된다.

생성 이미지:

```text
ghcr.io/choi-seunghwan/saegim-web:main
ghcr.io/choi-seunghwan/saegim-api:main
```

웹 이미지는 빌드 시점에 아래 값을 포함한다.

```text
NEXT_PUBLIC_API_BASE_URL=https://api-saegim.chuz.dev
NEXT_PUBLIC_MIXPANEL_*
```

## k3s 적용

```bash
kubectl apply -k deploy/k8s
```

상태 확인:

```bash
kubectl -n apps get pods -l app.kubernetes.io/part-of=saegim
kubectl -n apps get svc -l app.kubernetes.io/part-of=saegim
kubectl -n apps logs deploy/saegim-api
kubectl -n apps logs deploy/saegim-cloudflared
```

내부 API 확인:

```bash
kubectl -n apps run saegim-curl --rm -it --image=curlimages/curl --restart=Never -- \
  curl -fsS http://saegim-api:4000/health
```

외부 확인:

```text
https://api-saegim.chuz.dev/health
https://saegim.chuz.dev
```

## 롤백

가장 단순한 롤백은 kustomize image tag를 이전 SHA/tag로 바꾸거나, 이전 정상 커밋을 `main`에 되돌린 뒤 다시 Actions와 k3s apply를 진행하는 것이다.

PostgreSQL PVC는 유지된다. 스키마 변경이 포함된 배포는 Prisma 변경 내용을 먼저 확인한다.
