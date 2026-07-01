-- 새김 편집부 운영 콘텐츠 삽입 쿼리
-- 목적:
-- 1. 새김 편집부 공식 계정을 보강하거나, 없으면 운영 계정을 생성한다.
-- 2. 확정한 6개 큐레이션 글과 각 2장의 카드를 삽입/갱신한다.
-- 3. 여러 번 실행해도 같은 id의 글/장은 갱신된다.
--
-- 저작권 메모:
-- - 별 헤는 밤은 저작권 보호기간이 만료된 윤동주 원문 발췌 기준.
-- - 외국 작품 5건은 원문 공개 도메인/공개 원천을 바탕으로 한 새김 편집부 번안문이다.
-- - 기존 한국어 번역문을 복제하지 않는다.

BEGIN;

DO $$
DECLARE
  editor_account_id text;
  editor_handle text := 'saegim-editorial';
  now_at timestamptz := now();
BEGIN
  SELECT id
    INTO editor_account_id
  FROM "Account"
  WHERE handle = editor_handle
     OR "displayName" = '새김 편집부'
  ORDER BY
    CASE WHEN handle = editor_handle THEN 0 ELSE 1 END,
    "createdAt" ASC
  LIMIT 1;

  IF editor_account_id IS NULL THEN
    INSERT INTO "Account" (
      id,
      handle,
      "displayName",
      tagline,
      bio,
      verification,
      "createdAt",
      "updatedAt"
    )
    VALUES (
      'account-saegim-editorial',
      editor_handle,
      '새김 편집부',
      '오래 남을 문장을 고릅니다',
      '고전의 문장과 오늘의 감각 사이에서, 마음에 담아 둘 글을 고릅니다.',
      'OFFICIAL'::"VerificationState",
      now_at,
      now_at
    )
    ON CONFLICT (handle) DO UPDATE
    SET
      "displayName" = EXCLUDED."displayName",
      tagline = EXCLUDED.tagline,
      bio = EXCLUDED.bio,
      verification = EXCLUDED.verification,
      "updatedAt" = now_at
    RETURNING id INTO editor_account_id;
  ELSE
    UPDATE "Account"
    SET
      "displayName" = '새김 편집부',
      tagline = '오래 남을 문장을 고릅니다',
      bio = '고전의 문장과 오늘의 감각 사이에서, 마음에 담아 둘 글을 고릅니다.',
      verification = 'OFFICIAL'::"VerificationState",
      "updatedAt" = now_at
    WHERE id = editor_account_id;
  END IF;

  WITH post_rows(id, title, sort_order) AS (
    VALUES
      ('editorial-yun-dongju-counting-stars', '별 헤는 밤', 0),
      ('editorial-burnett-secret-garden', '비밀의 정원', 1),
      ('editorial-grahame-wind-in-the-willows', '버드나무에 부는 바람', 2),
      ('editorial-woolf-room-of-ones-own', '자기만의 방', 3),
      ('editorial-gibran-the-prophet', '예언자', 4),
      ('editorial-montaigne-essays', '몽테뉴 수상록', 5)
  )
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
  SELECT
    id,
    title,
    editor_account_id,
    'PUBLIC'::"PostVisibility",
    'CURATION'::"PostCreationType",
    0,
    0,
    now_at - (sort_order * interval '1 minute'),
    now_at,
    now_at
  FROM post_rows
  ON CONFLICT (id) DO UPDATE
  SET
    title = EXCLUDED.title,
    "authorId" = EXCLUDED."authorId",
    visibility = EXCLUDED.visibility,
    "creationType" = EXCLUDED."creationType",
    "publishedAt" = EXCLUDED."publishedAt",
    "updatedAt" = now_at;

  WITH card_rows(
    id,
    post_id,
    card_order,
    text,
    comp,
    source_author,
    source_work,
    source_url,
    tags
  ) AS (
    VALUES
      (
        'editorial-yun-dongju-counting-stars-1',
        'editorial-yun-dongju-counting-stars',
        0,
        E'계절이 지나가는 하늘에는\n가을로 가득 차 있습니다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F4F1F3,#E7E5EA 48%,#D8DAE4 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 30,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        '윤동주',
        '별 헤는 밤',
        NULL::text,
        ARRAY['별', '가을', '밤']::text[]
      ),
      (
        'editorial-yun-dongju-counting-stars-2',
        'editorial-yun-dongju-counting-stars',
        1,
        E'나는 아무 걱정도 없이\n가을 속의 별들을\n다 헤일 듯합니다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#EEF0F3 0%,#DDE4F2 48%,#C8C7E1 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 28,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        '윤동주',
        '별 헤는 밤',
        NULL::text,
        ARRAY['별', '가을', '밤']::text[]
      ),
      (
        'editorial-burnett-secret-garden-1',
        'editorial-burnett-secret-garden',
        0,
        E'닫힌 문 뒤에도\n계절은 혼자\n천천히 자라고 있었다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F6F2EA 0%,#E4EAD7 52%,#C9DBBA 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 28,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Frances Hodgson Burnett',
        'The Secret Garden',
        'https://www.gutenberg.org/ebooks/113',
        ARRAY['정원', '회복', '봄']::text[]
      ),
      (
        'editorial-burnett-secret-garden-2',
        'editorial-burnett-secret-garden',
        1,
        E'빛이 좋은 곳에서는\n오래 닫아 둔 마음도\n조금씩 창을 연다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F7F4EF 0%,#E6EDD9 45%,#D5E3C7 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 28,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Frances Hodgson Burnett',
        'The Secret Garden',
        'https://www.gutenberg.org/ebooks/113',
        ARRAY['정원', '회복', '봄']::text[]
      ),
      (
        'editorial-grahame-wind-in-the-willows-1',
        'editorial-grahame-wind-in-the-willows',
        0,
        E'강물 곁에서는\n서두르던 마음도\n제 속도를 잊는다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#EEF4EE 0%,#D8E6DE 50%,#BFD5D2 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 29,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Kenneth Grahame',
        'The Wind in the Willows',
        'https://www.gutenberg.org/ebooks/289',
        ARRAY['강가', '쉼', '우정']::text[]
      ),
      (
        'editorial-grahame-wind-in-the-willows-2',
        'editorial-grahame-wind-in-the-willows',
        1,
        E'좋은 날은\n먼 곳에 있지 않고\n천천히 흐르는 곁에 있다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F1F5F0 0%,#DCE9E4 48%,#C6D9DD 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 28,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Kenneth Grahame',
        'The Wind in the Willows',
        'https://www.gutenberg.org/ebooks/289',
        ARRAY['강가', '쉼', '우정']::text[]
      ),
      (
        'editorial-woolf-room-of-ones-own-1',
        'editorial-woolf-room-of-ones-own',
        0,
        E'혼자 있을 자리가 생기면\n마음은 비로소\n자기 목소리를 듣는다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F7F5F0 0%,#EAE2D7 52%,#D8D1C8 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 28,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Virginia Woolf',
        'A Room of One''s Own',
        'https://en.wikisource.org/wiki/A_Room_of_One%27s_Own',
        ARRAY['방', '쓰기', '목소리']::text[]
      ),
      (
        'editorial-woolf-room-of-ones-own-2',
        'editorial-woolf-room-of-ones-own',
        1,
        E'문장을 쓰기 전에\n먼저 필요한 것은\n조용히 닫히는 문.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F4F1EC 0%,#E5DDD5 50%,#D0CCD3 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 28,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Virginia Woolf',
        'A Room of One''s Own',
        'https://en.wikisource.org/wiki/A_Room_of_One%27s_Own',
        ARRAY['방', '쓰기', '목소리']::text[]
      ),
      (
        'editorial-gibran-the-prophet-1',
        'editorial-gibran-the-prophet',
        0,
        E'사랑은 붙드는 일이 아니라\n서로의 하늘을\n넓혀 주는 일.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F4EDE5 0%,#E7D7C8 50%,#D8C7D6 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 28,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Kahlil Gibran',
        'The Prophet',
        'https://www.gutenberg.org/ebooks/58585',
        ARRAY['사랑', '삶', '길']::text[]
      ),
      (
        'editorial-gibran-the-prophet-2',
        'editorial-gibran-the-prophet',
        1,
        E'삶은 대답보다 먼저\n우리에게\n걸어갈 길을 준다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F6EEE4 0%,#E4D8CA 46%,#CDC7DA 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 28,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Kahlil Gibran',
        'The Prophet',
        'https://www.gutenberg.org/ebooks/58585',
        ARRAY['사랑', '삶', '길']::text[]
      ),
      (
        'editorial-montaigne-essays-1',
        'editorial-montaigne-essays',
        0,
        E'나는 나를 설명하려다\n자주 나를\n다시 만나게 된다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F2F0EA 0%,#E2DFD7 50%,#CDC8BD 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 29,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Michel de Montaigne',
        'Essays',
        'https://www.gutenberg.org/ebooks/3600',
        ARRAY['생각', '질문', '자기']::text[]
      ),
      (
        'editorial-montaigne-essays-2',
        'editorial-montaigne-essays',
        1,
        E'확신보다 오래 남는 것은\n조용히 되묻는 마음이다.',
        jsonb_build_object(
          'bg', 'linear-gradient(150deg,#F0EFEB 0%,#E4E0D8 48%,#D4CDD4 100%)',
          'dim', 0,
          'textColor', '#38323F',
          'size', 29,
          'weight', 700,
          'align', 'center',
          'font', 'serif',
          'textPos', jsonb_build_object('xp', 50, 'yp', 46),
          'sourcePos', jsonb_build_object('xp', 50, 'yp', 85),
          'bgImage', NULL
        ),
        'Michel de Montaigne',
        'Essays',
        'https://www.gutenberg.org/ebooks/3600',
        ARRAY['생각', '질문', '자기']::text[]
      )
  )
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
    embedding,
    "createdAt",
    "updatedAt"
  )
  SELECT
    id,
    post_id,
    card_order,
    text,
    comp,
    'BOOK'::"SourceKind",
    source_author,
    source_work,
    source_url,
    tags,
    'PENDING'::"EmbeddingStatus",
    NULL::jsonb,
    now_at,
    now_at
  FROM card_rows
  ON CONFLICT ("postId", "order") DO UPDATE
  SET
    text = EXCLUDED.text,
    comp = EXCLUDED.comp,
    "sourceKind" = EXCLUDED."sourceKind",
    "sourceAuthor" = EXCLUDED."sourceAuthor",
    "sourceWork" = EXCLUDED."sourceWork",
    "sourceUrl" = EXCLUDED."sourceUrl",
    tags = EXCLUDED.tags,
    "embeddingStatus" = EXCLUDED."embeddingStatus",
    embedding = EXCLUDED.embedding,
    "updatedAt" = now_at;
END $$;

COMMIT;
