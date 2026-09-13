const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');
const path = require('node:path');
const bank = require('../.test-build/data');
const engine = require('../.test-build/lib/exam');
const storage = require('../.test-build/lib/storage');
const { topicPracticeCounts } = require('../.test-build/lib/history');
const { repeatPracticeLink } = require('../.test-build/lib/nav');
const { questionAudioUrl } = require('../.test-build/lib/questionAudio');
const manifest = require('../src/data/audio-manifest.json');

/** 고정 세트 자료로 다시 받은 돌발 주제. 번호와 순서는 세트 선언이 정한다. */
const FIXED_SET_TOPIC_IDS = ['recycling', 'industry'];

test('supplied surprise questions preserve the topic, numbering, title, wording and order', () => {
  const source = readFileSync(path.join(__dirname, 'fixtures/surprise-questions.md'), 'utf8');
  const sections = source.split(/^## \d+\. /m).slice(1);
  assert.equal(bank.surpriseTopics.length, 7);
  assert.equal(bank.surpriseQuestionCount, 67);
  assert.deepEqual(bank.surpriseTopics.map(t => t.questions.length), [19, 25, 5, 6, 4, 4, 4]);

  // 자료 그대로 받은 다섯 주제는 fixture 와 한 글자도 달라지면 안 된다.
  const supplied = bank.surpriseTopics.filter(t => !FIXED_SET_TOPIC_IDS.includes(t.id));
  assert.equal(sections.length, supplied.length);
  sections.forEach((section, i) => {
    const topic = supplied[i];
    assert.equal(topic.en, section.split('\n')[0]);
    const expected = [...section.matchAll(/\*\*(\d+(?:-[AB])?)\. (.*?)\*\*\s*\n(.*?)(?=\n\n|$)/gs)]
      .map(([, number, title, en]) => ({ number, title, en: en.trim() }));
    assert.deepEqual(topic.questions.map(({ number, title, en }) => ({ number, title, en })), expected);
  });

  // 고정 세트 주제는 fixture 대신 선언된 세트가 번호와 순서의 근거가 된다.
  for (const id of FIXED_SET_TOPIC_IDS) {
    const topic = bank.topicById.get(id);
    const declared = topic.fixedPracticeSets.flatMap(set => set.items);
    assert.deepEqual(topic.questions.map(q => q.id), declared.map(entry => entry.questionId));
    assert.deepEqual(topic.questions.map(q => q.number), declared.map(entry => entry.displayNumber));
  }

  for (const topic of bank.surpriseTopics) {
    assert.equal(topic.category, 'surprise');
    for (const q of topic.questions) {
      assert.match(q.ko, /[가-힣]/);
      assert.equal(q.source, 'provided');
      assert.ok(manifest.questions[q.id], q.id);
    }
  }
  const allIds = bank.allTopics.flatMap(t => t.questions.map(q => q.id));
  assert.equal(new Set(allIds).size, allIds.length);
  assert.equal(bank.totalQuestionCount, allIds.length + 1);
});

test('surprise practice includes every question once in source order and keeps connected questions together', () => {
  for (const topic of bank.surpriseTopics) {
    assert.equal(bank.topicById.get(topic.id), topic);
    const exam = engine.buildPracticeExam(topic, () => { throw new Error('must not shuffle'); });
    assert.equal(exam.mode, 'practice');
    assert.equal(exam.focusTopicId, topic.id);
    assert.deepEqual(exam.items.map(i => i.question.id), topic.questions.map(q => q.id));
    assert.deepEqual(engine.selectPracticeQuestions(topic), topic.questions);
    assert.equal(new Set(exam.items.map(i => i.slot)).size, topic.questions.length);
    exam.items.forEach((item, i) => {
      for (const dep of item.question.dependsOn ?? []) {
        assert.ok(exam.items.slice(0, i).some(previous => previous.question.id === dep));
      }
      assert.doesNotMatch(item.typeLabel, /번/);
    });
  }
  assert.throws(() => engine.buildPracticeExam({ ...bank.surpriseTopics[0], questions: [] }), /문항이 없습니다/);
});

test('repeated display numbers survive history roundtrip separately and repeat the same topic', () => {
  const data = new Map();
  const previousWindow = global.window;
  global.window = { localStorage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  }};
  try {
    const topic = bank.topicById.get('recycling');
    const exam = engine.buildPracticeExam(topic);
    // 고정 세트 자료는 같은 번호를 여러 세트에서 다시 쓴다. 그래도 답은 섞이면 안 된다.
    const repeated = exam.items.filter(i => i.question.number === '14');
    assert.equal(repeated.length, 2);
    const [a, b] = repeated;
    assert.notEqual(a.slot, b.slot);
    const answers = { [a.slot]: 'Collection systems changed.', [b.slot]: 'Attitudes changed.' };
    storage.pushHistory({ id: 'surprise-test', finishedAt: 1, mode: 'practice', label: '주제별 연습 · 재활용',
      answered: 2, totalItems: topic.questions.length, result: { exam, answers, times: {}, hintUse: {}, replays: {}, feedback: {} } });
    const saved = storage.loadHistory()[0];
    assert.deepEqual(saved.result.answers, answers);
    assert.deepEqual(saved.result.exam.items.map(i => i.question.number), topic.questions.map(q => q.number));
    assert.deepEqual(topicPracticeCounts([saved], bank.allTopics), { recycling: 1 });
    assert.equal(repeatPracticeLink(saved, bank.allTopics).href, '/exam?mode=practice&topic=recycling');
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
  }
});

test('single-question practice can reach every standalone surprise question, never an orphaned follow-up', () => {
  const eligible = bank.allTopics.flatMap(topic => topic.questions.filter(q =>
    (q.source === 'verified' || q.source === 'provided') && !q.dependsOn?.length));
  const seen = new Set();
  for (let i = 0; i < eligible.length; i++) {
    const exam = engine.buildSingleQuestion(undefined, () => (i + 0.5) / eligible.length);
    const q = exam.items[0].question;
    assert.equal(exam.items.length, 1);
    assert.ok(!q.dependsOn?.length);
    seen.add(q.id);
  }
  for (const topic of bank.surpriseTopics) {
    for (const q of topic.questions) assert.equal(seen.has(q.id), !q.dependsOn?.length);
  }
});

test('every surprise MP3 matches current text and voice settings and contains MPEG audio', () => {
  for (const topic of bank.surpriseTopics) {
    for (const q of topic.questions) {
      const seed = JSON.stringify([q.en.trim(), manifest.model, manifest.voice,
        /^gpt-/.test(manifest.model) ? null : manifest.speed,
        /^gpt-/.test(manifest.model) ? manifest.instructions : null]);
      const hash = createHash('sha256').update(seed).digest('hex').slice(0, 12);
      assert.equal(manifest.questions[q.id], hash, q.id);
      assert.equal(questionAudioUrl(q.id), `/audio/${q.id}.mp3?v=${hash}`);
      const audio = readFileSync(path.join(__dirname, '..', 'public/audio', `${q.id}.mp3`));
      assert.ok(audio.length > 1000, q.id);
      assert.ok(audio.subarray(0, 3).toString() === 'ID3' || (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0), q.id);
    }
  }
});
