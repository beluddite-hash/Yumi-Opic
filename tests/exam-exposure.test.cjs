const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SURVEY_IDS, allTopics, surpriseTopics, topicById } = require('../.test-build/data');
const engine = require('../.test-build/lib/exam');
const { questionExposureKey: key, recordQuestionExposure, readExamExposure } = require('../.test-build/lib/examExposure');
const storage = require('../.test-build/lib/storage');

const questions = allTopics.filter(t => !engine.DRAW_EXCLUDED_TOPIC_IDS.includes(t.id)).flatMap(t => t.questions);
const patterns = [
  ['description', 'routine', 'experience'], ['description', 'experience', 'memorable'],
  ['roleplay_ask', 'roleplay_problem', 'roleplay_experience'], ['comparison', 'issue'],
];
function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
const keys = exam => new Set(exam.items.filter(i => i.topicId !== 'intro').map(i => key(i.question)));
const allSeen = () => Object.fromEntries(questions.map(q => [key(q), { count: 1, lastSeen: 100, lastAttemptId: 'previous' }]));
function remember(exposure, exam, time) {
  for (const item of exam.items) exposure = recordQuestionExposure(exposure, item.question, exam.id, time);
  return exposure;
}

test('every active bank question belongs to a complete full-exam set, including new source variants and surprise roleplay', () => {
  // 개수를 못박아 두면 문항을 늘릴 때마다 이 줄부터 깨지고, 정작 무엇이 잘못됐는지는
  // 알려 주지 못한다. 개수 대신 데이터에서 끌어온 불변식만 본다.
  assert.ok(questions.length > 0);
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length, '문항 ID 가 겹친다');
  for (const topic of allTopics.filter(t => !engine.DRAW_EXCLUDED_TOPIC_IDS.includes(t.id))) {
    assert.ok(topic.questions.length > 0, `${topic.id}: 출제 대상인데 문항이 없다`);
    const reachable = new Set(patterns.flatMap(types => engine.completeQuestionSets(topic, types)).flat().map(q => q.id));
    assert.deepEqual([...reachable].sort(), topic.questions.map(q => q.id).sort(), topic.id);
  }
});

test('the legacy omission cannot recur when verified and adapted experience questions coexist', () => {
  for (const topicId of ['shopping', 'gym']) {
    const template = allTopics.find(t => t.category === 'survey' && !t.fixedPracticeSets);
    const experiences = template.questions.filter(q => q.type === 'experience');
    const target = `${topicId}-e2`;
    const topic = { ...template, id: topicId, questions: template.questions.map(q =>
      experiences.includes(q) ? { ...q, id: q === experiences[0] ? `${topicId}-e1` : target,
        source: q === experiences[0] ? 'verified' : 'adapted' } : q) };
    assert.ok(engine.buildPracticeExam(topic, () => 0.999).items.some(i => i.question.id === target));
    const singles = topic.questions.filter(q => !q.dependsOn?.length);
    const index = singles.findIndex(q => q.id === target);
    assert.equal(engine.buildSingleQuestion([topic], () => (index + 0.5) / singles.length).items[0].question.id, target);
    const draws = [0, 0, 0.999];
    assert.ok(engine.buildTopicSet([topic], () => draws.shift()).items.some(i => i.question.id === target));
  }
});

test('every unseen eligible text wins over previously seen sets, across topics and surprise placements', () => {
  const snapshot = allSeen();
  const untouched = JSON.stringify(snapshot);
  for (const questionKey of Object.keys(snapshot)) {
    const exposure = { ...snapshot };
    delete exposure[questionKey];
    const exam = engine.buildFullExam({ exposure, rng: seeded(51) });
    assert.ok(keys(exam).has(questionKey), questionKey);
    assert.equal(new Set(exam.items.map(i => i.question.id)).size, exam.items.length);
    for (const group of new Set(exam.items.map(i => i.comboLabel))) {
      const entries = exam.items.filter(i => i.comboLabel === group);
      entries.forEach((item, index) => {
        for (const dependency of item.question.dependsOn ?? []) {
          assert.ok(entries.slice(0, index).some(i => i.question.id === dependency), item.question.id);
        }
      });
    }
  }
  assert.equal(JSON.stringify(snapshot), untouched);
});

test('when everything was seen, draw less-practiced texts first and use recency to break ties', () => {
  const target = topicById.get('music').questions.find(q => q.id === 'music-advanced1-q14');
  for (const count of [1, 2]) {
    const exposure = Object.fromEntries(Object.entries(allSeen()).map(([k, v]) => [k, { ...v, count: 2 }]));
    exposure[key(target)] = { count, lastSeen: 1, lastAttemptId: 'older' };
    for (let seed = 0; seed < 12; seed++) {
      assert.ok(keys(engine.buildFullExam({ exposure, rng: seeded(seed) })).has(key(target)));
    }
  }
});

test('duplicate IDs, whitespace, curly quotes and trailing punctuation share one exposure record', () => {
  const park = topicById.get('park');
  const first = park.questions.find(q => q.id === 'park-set1-q2');
  const duplicate = park.questions.find(q => q.id === 'park-set3-q8');
  let exposure = recordQuestionExposure({}, first, 'attempt', 100);
  assert.equal(recordQuestionExposure(exposure, duplicate, 'attempt', 101), exposure);
  const alternate = { ...duplicate, id: 'changed-id', en: `  ${duplicate.en.toUpperCase()}!  ` };
  assert.equal(key(first), key(alternate));
  exposure = recordQuestionExposure(exposure, alternate, 'next-attempt', 200);
  assert.equal(Object.keys(exposure).length, 1);
  assert.equal(exposure[key(first)].count, 2);
  const parkRoleplay = park.questions.find(q => q.id === 'park-roleplay1-q13');
  const vacationRoleplay = topicById.get('staycation').questions.find(q => q.id === 'staycation-q13');
  assert.equal(key(parkRoleplay), key(vacationRoleplay));
  assert.equal(key({ en: "What's new?" }), key({ en: 'What’s new?' }));
});

const bankKeys = () => new Set(questions.map(key));
const surveyPool = engine.drawableSurveyTopics.filter(t => DEFAULT_SURVEY_IDS.includes(t.id));

/**
 * 한 구간은 한 주제의 완성된 세트를 통째로 가져간다. 그래서 한 주제를 다 보려면
 * 가장 큰 세트로 나눈 만큼의 구간이 필요하고, 은행이 커지면 전 문항을 도는 데 드는
 * 회차도 같이 늘어난다. 회차를 숫자로 못박아 두면 문항을 추가할 때마다 이 테스트부터
 * 깨지면서 정작 뽑기 전략이 나빠졌는지는 알려 주지 못한다. 한도는 데이터에서 구한다.
 */
function groupDrawsToCover(pool) {
  return pool.reduce((draws, topic) => {
    const sets = engine.completeQuestionSets(topic);
    assert.ok(sets.length, `${topic.id}: 완성된 세트가 없어 한 번도 출제될 수 없다`);
    const largest = Math.max(...sets.map(set => set.length));
    return draws + Math.ceil(new Set(topic.questions.map(key)).size / largest);
  }, 0);
}

/** 한 번도 겹치지 않게 이상적으로 뽑았을 때 전 문항을 도는 데 필요한 회차. */
const IDEAL_ROUNDS = Math.max(
  Math.ceil(groupDrawsToCover(surveyPool) / engine.MIN_FULL_EXAM_SURVEY_TOPICS),
  Math.ceil(groupDrawsToCover(surpriseTopics) / engine.FULL_EXAM_SURPRISE_GROUPS),
);
/** 실제 뽑기는 이상적인 배분보다 오래 걸린다. 이 배수를 넘겨야 깨지면 전략이 나빠진 것이다. */
const COVERAGE_BUDGET = IDEAL_ROUNDS * 2;

test('consecutive exams cover the whole bank within the budget the bank size implies', () => {
  const total = bankKeys();
  for (const seed of [1, 27, 20260913]) {
    let exposure = {};
    const seen = new Set();
    const rng = seeded(seed);
    let rounds = 0;
    while (seen.size < total.size && rounds < COVERAGE_BUDGET) {
      const exam = engine.buildFullExam({ exposure, rng });
      keys(exam).forEach(k => seen.add(k));
      exposure = remember(exposure, exam, ++rounds);
    }
    const missing = [...total].filter(k => !seen.has(k));
    // 어떤 문항이 안 나왔는지 함께 남긴다. 숫자만 틀리면 무엇을 고쳐야 할지 알 수 없다.
    assert.deepEqual(missing.slice(0, 5), [],
      `seed ${seed}: ${COVERAGE_BUDGET}회를 출제해도 ${missing.length}/${total.size}개 문항이 한 번도 안 나왔다`);
  }
});

/** 회차 수는 표본 구간일 뿐이다. 아래 두 비교는 같은 구간의 무작위 뽑기와 견주는 상대값이다. */
const COMPARISON_ROUNDS = 12;

test('consecutive exams spread wider and repeat less than independent draws', () => {
  for (const seed of [1, 27, 20260913]) {
    let exposure = {};
    const seen = new Set();
    const randomSeen = new Set();
    let previous = new Set(), randomPrevious = new Set(), repeats = 0, randomRepeats = 0;
    const rng = seeded(seed), randomRng = seeded(seed);
    for (let attempt = 0; attempt < COMPARISON_ROUNDS; attempt++) {
      const exam = engine.buildFullExam({ exposure, rng });
      const drawn = keys(exam);
      const randomDrawn = keys(engine.buildFullExam({ rng: randomRng }));
      repeats += [...drawn].filter(k => previous.has(k)).length;
      randomRepeats += [...randomDrawn].filter(k => randomPrevious.has(k)).length;
      drawn.forEach(k => seen.add(k)); randomDrawn.forEach(k => randomSeen.add(k));
      previous = drawn; randomPrevious = randomDrawn;
      exposure = remember(exposure, exam, attempt + 1);
    }
    assert.ok(seen.size > randomSeen.size,
      `seed ${seed}: ${COMPARISON_ROUNDS}회 동안 출제 이력은 ${seen.size}개, 무작위는 ${randomSeen.size}개를 냈다`);
    assert.ok(repeats < randomRepeats,
      `seed ${seed}: 직전 회차와 겹친 문항이 출제 이력 ${repeats}개, 무작위 ${randomRepeats}개다`);
  }
});

function withStorage(run) {
  const previous = global.window;
  const data = new Map();
  global.window = { localStorage: {
    getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k),
  } };
  try { run(data); } finally { if (previous === undefined) delete global.window; else global.window = previous; }
}

test('drawing does not mark questions seen; actual exposures survive storage reload and result-history rotation', () => withStorage(() => {
  const exam = engine.buildFullExam({ exposure: storage.loadFullExamExposure(), rng: seeded(20) });
  assert.deepEqual(storage.loadFullExamExposure(), {});
  const question = exam.items[1].question;
  storage.recordFullExamQuestion(exam, question, 'heard', 10);
  storage.recordFullExamQuestion(exam, question, 'heard', 11);
  storage.recordFullExamQuestion(exam, exam.items[0].question, 'heard', 11); // Intro
  storage.recordFullExamQuestion({ ...exam, mode: 'practice' }, question, 'practice', 12);
  assert.deepEqual(storage.loadFullExamExposure(), { [key(question)]: { count: 1, lastSeen: 10, lastAttemptId: 'heard' } });
  for (let i = 0; i < 21; i++) {
    storage.pushHistory({ id: `summary-${i}`, mode: 'full', label: '모의고사', finishedAt: i, answered: 0, totalItems: 15 });
  }
  assert.equal(storage.loadHistory().length, 20);
  assert.equal(storage.loadFullExamExposure()[key(question)].count, 1);
  storage.recordFullExamQuestion(exam, question, 'retry', 20);
  assert.equal(storage.loadFullExamExposure()[key(question)].count, 2);
  storage.clearHistory();
  assert.deepEqual(storage.loadFullExamExposure(), {});
}));

test('migration uses only evidence of exposure in old full-exam results, and imports it once', () => withStorage(data => {
  const exam = engine.buildFullExam({ rng: seeded(7) });
  const [intro, answered, timed, hinted, replayed, skipped] = exam.items;
  const result = { exam, answers: { [answered.slot]: 'My answer' }, times: { [timed.slot]: 5 },
    hintUse: { [hinted.slot]: 1 }, replays: { [replayed.slot]: 1 }, feedback: {} };
  const entry = { id: 'legacy', mode: 'full', label: 'Old', finishedAt: 100, answered: 1, totalItems: 15, result };
  data.set('yumi-opic:history', JSON.stringify([entry, { ...entry, id: 'practice', mode: 'practice' }]));
  const exposure = storage.loadFullExamExposure();
  assert.equal(Object.keys(exposure).length, 4);
  assert.equal(exposure[key(skipped.question)], undefined);
  assert.equal(exposure[key(intro.question)], undefined);
  storage.recordFullExamQuestion(exam, skipped.question, 'new', 200);
  assert.equal(storage.loadFullExamExposure()[key(answered.question)].count, 1);
  assert.equal(storage.loadFullExamExposure()[key(skipped.question)].count, 1);
  assert.equal(Object.keys(storage.loadFullExamExposure()).length, 5);
}));

test('bad saved exposure entries and unavailable storage do not prevent an exam', () => withStorage(data => {
  assert.equal(readExamExposure(null), undefined);
  assert.deepEqual(readExamExposure({ bad: { count: -1 }, empty: null }), {});
  const good = { count: 1, lastSeen: 1, lastAttemptId: 'ok' };
  assert.deepEqual(readExamExposure({ good, bad: { ...good, lastSeen: '1' } }), { good });
  data.set('yumi-opic:exam-exposure', '{broken');
  assert.deepEqual(storage.loadFullExamExposure(), {});
  window.localStorage.getItem = () => { throw new Error('unavailable'); };
  window.localStorage.setItem = () => { throw new Error('quota'); };
  assert.doesNotThrow(() => {
    const exam = engine.buildFullExam({ exposure: storage.loadFullExamExposure() });
    storage.recordFullExamQuestion(exam, exam.items[1].question);
  });
}));
