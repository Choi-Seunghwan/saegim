# 개발 가이드

## 브랜치 운용

- `dev`: 개발과 검증 작업
- `main`: production 배포 기준
- `master`: 폐기, 작업 기준에서 제외

작업은 기본적으로 `dev`에서 진행한다. 검증이 끝난 뒤 `main`으로 반영하고, `main` push로 production 이미지 빌드를 시작한다.

## 로컬 실행

필요 버전:

```text
Node >= 22.11.0
pnpm 11.x
```

이 홈랩 PC의 기본 Node가 낮을 수 있으므로, 임시 검증에는 아래처럼 Node/pnpm을 `npx`로 실행할 수 있다.

```bash
npx -y -p node@22.17.0 -p pnpm@11.7.0 pnpm install --frozen-lockfile
npx -y -p node@22.17.0 -p pnpm@11.7.0 pnpm db:generate
npx -y -p node@22.17.0 -p pnpm@11.7.0 pnpm typecheck
npx -y -p node@22.17.0 -p pnpm@11.7.0 pnpm build
```

일반 로컬 개발:

```bash
pnpm install
pnpm dev:web
pnpm dev:api
```

PostgreSQL만 로컬로 띄울 때:

```bash
docker compose up -d postgres
```

## 검증

변경 후 기본 확인:

```bash
pnpm db:generate
pnpm typecheck
pnpm build
kubectl apply -k deploy/k8s --dry-run=server
```

YAML 문법 확인:

```bash
python3 - <<'PY'
from pathlib import Path
import yaml
for path in [Path('.github/workflows/build-images.yml'), *Path('deploy/k8s').glob('*.yaml')]:
    with path.open() as fh:
        list(yaml.safe_load_all(fh))
print('yaml ok')
PY
```

## 이미지 빌드 정책

`dev` push는 자동 이미지 빌드를 실행하지 않는다. 비용과 시간을 아끼기 위한 결정이다.

필요할 때만 GitHub Actions 화면에서 `Build images` workflow를 수동 실행한다.
`main` push는 자동으로 GHCR 이미지 빌드와 push를 실행한다.
