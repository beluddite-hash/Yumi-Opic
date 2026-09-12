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

test('all 35 surprise questions preserve the supplied topic, numbering, title, wording and order', () => {
  const source = readFileSync(path.join(__dirname, 'fixtures/surprise-questions.md'), 'utf8');
  const sections = source.split(/^## \d+\. /m).slice(1);
  assert.equal(bank.surpriseTopics.length, 7);
  assert.equal(bank.surpriseQuestionCount, 35);
  assert.deepEqual(bank.surpriseTopics.map(t => t.questions.length), [7, 5, 5, 6, 4, 4, 4]);
  sections.forEach((section, i) => {
    const topic = bank.surpriseTopics[i];
    assert.equal(topic.en, section.split('\n')[0]);
    assert.equal(topic.category, 'surprise');
    const expected = [...section.matchAll(/\*\*(\d+(?:-[AB])?)\. (.*?)\*\*\s*\n(.*?)(?=\n\n|$)/gs)]
      .map(([, number, title, en]) => ({ number, title, en: en.trim() }));
    assert.deepEqual(topic.questions.map(({ number, title, en }) => ({ number, title, en })), expected);
    for (const q of topic.questions) {
      assert.match(q.ko, /[가-힣]/);
      assert.equal(q.source, 'provided');
      assert.ok(manifest.questions[q.id]);
    }
  });
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

test('5-A and 5-B answers survive history roundtrip separately and repeat the same topic', () => {
  const data = new Map();
  const previousWindow = global.window;
  global.window = { localStorage: {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  }};
  try {
    const exam = engine.buildPracticeExam(bank.topicById.get('recycling'));
    const a = exam.items.find(i => i.question.number === '5-A');
    const b = exam.items.find(i => i.question.number === '5-B');
    assert.notEqual(a.slot, b.slot);
    const answers = { [a.slot]: 'Collection systems changed.', [b.slot]: 'Attitudes changed.' };
    storage.pushHistory({ id: 'surprise-test', finishedAt: 1, mode: 'practice', label: '주제별 연습 · 재활용',
      answered: 2, totalItems: 7, result: { exam, answers, times: {}, hintUse: {}, replays: {}, feedback: {} } });
    const saved = storage.loadHistory()[0];
    assert.deepEqual(saved.result.answers, answers);
    assert.deepEqual(saved.result.exam.items.map(i => i.question.number), ['1', '2', '3', '4', '5-A', '5-B', '6']);
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
