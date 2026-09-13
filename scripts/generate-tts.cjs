/**
 * 문제 지문을 미리 사람 목소리로 만들어 `public/audio` 에 넣는다.
 *
 * 문제은행은 고정돼 있으므로 한 번 만들어 두면 앱에서는 mp3 를 틀기만 하면 된다.
 * 브라우저 내장 낭독보다 훨씬 사람에 가깝고, 기기가 달라도 같은 목소리로 들리며,
 * 재생할 때마다 드는 비용도 없다.
 *
 *   OPENAI_API_KEY=... npm run tts            # 새 문항·바뀐 문항만 만든다
 *   OPENAI_API_KEY=... npm run tts -- --force # 전부 다시 만든다
 *   npm run tts -- --dry-run                  # 무엇을 만들지만 보여 준다
 *
 * 만들어진 mp3 와 `src/data/audio-manifest.json` 은 함께 커밋한다. 배포본에 그대로
 * 실려야 앱이 쓸 수 있다. 아직 만들지 않은 문항은 앱이 알아서 브라우저 낭독으로
 * 읽으므로, 이 스크립트를 한 번도 돌리지 않아도 앱은 그대로 돌아간다.
 *
 * 목소리·말투는 아래 기본값이나 환경변수로 바꾼다. 바꾸면 해시가 달라져 전부
 * 다시 만들어진다.
 */
const { createHash } = require('node:crypto');
const { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
// CLI 실행에서도 로컬 .env를 읽는다. 셸에서 지정한 값이 우선한다.
if (existsSync(path.join(ROOT, '.env'))) process.loadEnvFile(path.join(ROOT, '.env'));
const OUT_DIR = path.join(ROOT, 'public', 'audio');
const MANIFEST_PATH = path.join(ROOT, 'src', 'data', 'audio-manifest.json');
const BUILD_DIR = path.join(ROOT, '.test-build');

/** 대략적인 단가(USD/1000자). 감을 주기 위한 값이라 청구액과는 다르다. */
const USD_PER_1K_CHARS = 0.015;

const args = new Set(process.argv.slice(2));
const FORCE = args.has('--force');
const DRY_RUN = args.has('--dry-run');
const TOPIC = process.argv.find((arg) => arg.startsWith('--topic='))?.slice('--topic='.length);
const CATEGORY = process.argv.find((arg) => arg.startsWith('--category='))?.slice('--category='.length);
const FILTERED = Boolean(TOPIC || CATEGORY);

/* ------------------------------------------------------------------ */
/* 설정                                                                */
/* ------------------------------------------------------------------ */

function loadManifest() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return {};
  }
}

const previous = loadManifest();

const config = {
  model: process.env.OPENAI_TTS_MODEL || previous.model || 'gpt-4o-mini-tts',
  voice: process.env.OPENAI_TTS_VOICE || previous.voice || 'shimmer',
  speed: Number(process.env.OPENAI_TTS_SPEED || previous.speed || 1),
  instructions: process.env.OPENAI_TTS_INSTRUCTIONS || previous.instructions || '',
};

/**
 * 두 설정은 모델을 가린다. `instructions` 는 gpt-4o 계열만, `speed` 는 tts-1 계열만
 * 받는다. 지원하지 않는 쪽에 보내면 요청 자체가 거절된다.
 */
const supportsInstructions = /^gpt-/.test(config.model);
const supportsSpeed = !supportsInstructions;

/** 지문이나 목소리 설정이 바뀌면 해시가 달라져 그 문항만 다시 만들어진다. */
function hashOf(text) {
  const seed = JSON.stringify([
    text,
    config.model,
    config.voice,
    supportsSpeed ? config.speed : null,
    supportsInstructions ? config.instructions : null,
  ]);
  return createHash('sha256').update(seed).digest('hex').slice(0, 12);
}

/* ------------------------------------------------------------------ */
/* 문제 목록                                                            */
/* ------------------------------------------------------------------ */

/**
 * 문제은행은 TypeScript 라 그대로 require 할 수 없다. 테스트와 똑같이 tsc 로
 * 한 번 굽고 그 결과를 읽는다.
 */
function loadQuestions() {
  rmSync(BUILD_DIR, { recursive: true, force: true });
  const compile = spawnSync(
    process.execPath,
    [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.test.json'],
    { stdio: 'inherit', cwd: ROOT },
  );
  if (compile.status !== 0) process.exit(compile.status ?? 1);

  const bank = require(path.join(BUILD_DIR, 'data', 'index.js'));
  if (TOPIC && !bank.allTopics.some((topic) => topic.id === TOPIC)) {
    throw new Error(`Unknown topic: ${TOPIC}`);
  }
  if (CATEGORY && !bank.allTopics.some((topic) => topic.category === CATEGORY)) {
    throw new Error(`Unknown category: ${CATEGORY}`);
  }
  const byId = new Map();
  const add = (question) => {
    if (!question || !question.id || !question.en) return;
    if (!byId.has(question.id)) byId.set(question.id, question.en.trim());
  };

  if (!FILTERED) add(bank.introQuestion);
  for (const topic of bank.allTopics) {
    if (TOPIC && topic.id !== TOPIC) continue;
    if (CATEGORY && topic.category !== CATEGORY) continue;
    for (const question of topic.questions) add(question);
  }

  // 지울 것을 고를 때는 걸러낸 목록이 아니라 문제은행 전체를 봐야 한다. 한 주제만
  // 다시 만들더라도, 그 주제에서 사라진 문항의 mp3 와 목록은 같이 사라져야 한다.
  const allIds = new Set([bank.introQuestion?.id]);
  for (const topic of bank.allTopics) {
    for (const question of topic.questions) allIds.add(question.id);
  }
  return { questions: [...byId].map(([id, text]) => ({ id, text })), allIds };
}

/* ------------------------------------------------------------------ */
/* 생성                                                                */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function synthesize(apiKey, text) {
  const body = {
    model: config.model,
    voice: config.voice,
    input: text,
    response_format: 'mp3',
  };
  if (supportsInstructions && config.instructions) body.instructions = config.instructions;
  if (supportsSpeed) body.speed = config.speed;

  // 속도 제한과 일시적인 5xx 만 다시 시도한다. 나머지는 고쳐야 할 문제라 바로 멈춘다.
  let wait = 2000;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
    if (response.ok) return Buffer.from(await response.arrayBuffer());

    const retryable = response.status === 429 || response.status >= 500;
    const detail = (await response.text()).split(apiKey).join('[REDACTED]').slice(0, 300);
    if (!retryable || attempt >= 3) {
      throw new Error(`OpenAI ${response.status}: ${detail}`);
    }
    await sleep(wait);
    wait *= 2;
  }
}

/** 지금 문제은행에 없는 mp3 를 지운다. 문항이 사라지면 파일도 같이 사라져야 한다. */
function pruneOrphans(validIds) {
  if (!existsSync(OUT_DIR)) return 0;
  let removed = 0;
  for (const file of readdirSync(OUT_DIR)) {
    if (!file.endsWith('.mp3')) continue;
    if (validIds.has(file.slice(0, -4))) continue;
    if (!DRY_RUN) unlinkSync(path.join(OUT_DIR, file));
    console.log(`  - ${file} (없는 문항)`);
    removed += 1;
  }
  return removed;
}

async function main() {
  if (FILTERED && Object.keys(config).some((key) => config[key] !== previous[key])) {
    throw new Error('Keep the existing voice settings when generating a topic or category.');
  }
  const { questions, allIds } = loadQuestions();

  const done = FORCE ? {} : previous.questions ?? {};
  const pending = questions.filter((q) => {
    const fresh = done[q.id] === hashOf(q.text);
    return !(fresh && existsSync(path.join(OUT_DIR, `${q.id}.mp3`)));
  });

  const chars = pending.reduce((sum, q) => sum + q.text.length, 0);
  console.log(`문항 ${questions.length}개 · 만들 것 ${pending.length}개 · ${chars.toLocaleString()}자`);
  console.log(`목소리 ${config.voice} / 모델 ${config.model}`);
  if (chars > 0) {
    console.log(`대략 $${((chars / 1000) * USD_PER_1K_CHARS).toFixed(2)} 정도 듭니다.`);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!DRY_RUN && pending.length > 0 && !apiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }
  const removed = pruneOrphans(allIds);

  if (DRY_RUN) {
    for (const q of pending) console.log(`  + ${q.id}`);
    console.log('--dry-run 이라 아무것도 만들지 않았습니다.');
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const stale = new Set(pending.map((q) => q.id));
  const questionHashes = {};
  if (FILTERED) {
    // 이번에 만들지 않는 문항의 해시는 그대로 물려받되, 문제은행에서 사라진 것은 버린다.
    for (const [id, hash] of Object.entries(previous.questions ?? {})) {
      if (allIds.has(id)) questionHashes[id] = hash;
    }
  }
  for (const q of pending) delete questionHashes[q.id];
  let made = 0;

  // 한 번에 하나씩 보낸다. 124문항이면 몇 분 걸리지만 속도 제한에 걸릴 일이 없다.
  // 도중에 끊기더라도 여기까지 만든 것은 목록에 남겨, 다시 돌릴 때 두 번 만들지 않는다.
  try {
    for (const q of questions) {
      if (stale.has(q.id)) {
        process.stdout.write(`  + ${q.id} ... `);
        const mp3 = await synthesize(apiKey, q.text);
        writeFileSync(path.join(OUT_DIR, `${q.id}.mp3`), mp3);
        console.log(`${Math.round(mp3.length / 1024)}KB`);
        made += 1;
      }
      // 파일이 확실히 생긴 뒤에만 목록에 올린다.
      questionHashes[q.id] = hashOf(q.text);
    }
  } finally {
    writeFileSync(
      MANIFEST_PATH,
      `${JSON.stringify({ ...config, questions: questionHashes }, null, 2)}\n`,
    );
  }

  console.log(`\n완료: 새로 만든 ${made}개, 지운 ${removed}개, 전체 ${questions.length}개`);
  console.log('public/audio 와 src/data/audio-manifest.json 을 함께 커밋하세요.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
