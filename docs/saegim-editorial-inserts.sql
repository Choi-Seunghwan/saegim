-- 새김 편집부 운영 콘텐츠 삽입 초안
-- 실행 전 확인:
-- 1. 운영 DB에 '새김 편집부' 계정이 먼저 생성되어 있어야 한다.
-- 2. 같은 id의 글/장은 재실행 시 업데이트된다.

BEGIN;

DO $$
DECLARE
  editor_account_id text;
  now_at timestamptz := now();
  post_id text := 'editorial-yun-dongju-counting-stars';
BEGIN
  SELECT id
    INTO editor_account_id
  FROM "Account"
  WHERE "displayName" = '새김 편집부'
  ORDER BY "createdAt" ASC
  LIMIT 1;

  IF editor_account_id IS NULL THEN
    RAISE EXCEPTION '새김 편집부 계정을 찾을 수 없습니다. 먼저 계정을 생성하고 displayName을 새김 편집부로 저장해 주세요.';
  END IF;

  UPDATE "Account"
  SET
    "displayName" = '새김 편집부',
    "tagline" = '오래 남을 문장을 고릅니다',
    "bio" = '고전의 문장과 오늘의 감각 사이에서, 마음에 담아 둘 글을 고릅니다.',
    "verification" = 'OFFICIAL',
    "updatedAt" = now_at
  WHERE id = editor_account_id;

  INSERT INTO "Post" (
    id,
    title,
    "authorId",
    visibility,
    "creationType",
    "likeCountCache",
    "commentCountCache",
    "publishedAt",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    post_id,
    '별 헤는 밤',
    editor_account_id,
    'PUBLIC',
    'CURATION',
    0,
    0,
    now_at,
    now_at,
    now_at
  )
  ON CONFLICT (id) DO UPDATE
  SET
    title = EXCLUDED.title,
    "authorId" = EXCLUDED."authorId",
    visibility = EXCLUDED.visibility,
    "creationType" = EXCLUDED."creationType",
    "publishedAt" = EXCLUDED."publishedAt",
    "updatedAt" = now_at;

  INSERT INTO "Card" (
    id,
    "postId",
    "order",
    text,
    comp,
    "sourceKind",
    "sourceAuthor",
    "sourceWork",
    "sourceUrl",
    tags,
    "embeddingStatus",
    "createdAt",
    "updatedAt"
  )
  VALUES
    (
      'editorial-yun-dongju-counting-stars-1',
      post_id,
      0,
      '계절이 지나가는 하늘에는' || E'\n' ||
      '가을로 가득 차 있습니다.',
      '{
        "bg": "linear-gradient(150deg,#F4F1F3,#E7E5EA 48%,#D8DAE4 100%)",
        "dim": 0,
        "textColor": "#38323F",
        "size": 30,
        "weight": 700,
        "align": "center",
        "font": "serif",
        "textPos": { "xp": 50, "yp": 46 },
        "sourcePos": { "xp": 50, "yp": 85 },
        "bgImage": null
      }'::jsonb,
      'BOOK',
      '윤동주',
      '별 헤는 밤',
      NULL,
      ARRAY['별', '가을', '밤'],
      'PENDING',
      now_at,
      now_at
    ),
    (
      'editorial-yun-dongju-counting-stars-2',
      post_id,
      1,
      '나는 아무 걱정도 없이' || E'\n' ||
      '가을 속의 별들을' || E'\n' ||
      '다 헤일 듯합니다.',
      '{
        "bg": "linear-gradient(150deg,#EEF0F3 0%,#DDE4F2 48%,#C8C7E1 100%)",
        "dim": 0,
        "textColor": "#38323F",
        "size": 28,
        "weight": 700,
        "align": "center",
        "font": "serif",
        "textPos": { "xp": 50, "yp": 46 },
        "sourcePos": { "xp": 50, "yp": 85 },
        "bgImage": null
      }'::jsonb,
      'BOOK',
      '윤동주',
      '별 헤는 밤',
      NULL,
      ARRAY['별', '가을', '밤'],
      'PENDING',
      now_at,
      now_at
    )
  ON CONFLICT ("postId", "order") DO UPDATE
  SET
    id = EXCLUDED.id,
    text = EXCLUDED.text,
    comp = EXCLUDED.comp,
    "sourceKind" = EXCLUDED."sourceKind",
    "sourceAuthor" = EXCLUDED."sourceAuthor",
    "sourceWork" = EXCLUDED."sourceWork",
    "sourceUrl" = EXCLUDED."sourceUrl",
    tags = EXCLUDED.tags,
    "embeddingStatus" = EXCLUDED."embeddingStatus",
    "updatedAt" = now_at;
END $$;

COMMIT;
