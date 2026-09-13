const test = require('node:test');
const assert = require('node:assert/strict');
const { surveyTopicById } = require('../.test-build/data/survey-bank');
const { buildPracticeExam, buildTopicSet, buildSingleQuestion, itemNumber } = require('../.test-build/lib/exam');
const { pushHistory, loadHistory, updateHistoryResult } = require('../.test-build/lib/storage');

const noDraw = () => { throw new Error('Fixed practice must not draw randomly'); };
const home = surveyTopicById.get('home');
// 고정 세트를 아직 선언하지 않은 주제. 유형별 추첨 경로는 이 주제로 확인한다.
const plain = surveyTopicById.get('concert');

test('any survey topic can supply set order, arbitrary question IDs and actual slots through data alone', () => {
  // Deliberately use another topic ID, unsorted slots and IDs unrelated to slot numbers.
  const [a, b, c] = home.questions;
  const topic = { ...home, id: 'another-survey-topic', fixedPracticeSets: [
    { label: '첫 세트', items: [{ slot: 8, questionId: a.id }, { slot: 4, questionId: b.id }] },
    { label: '다음 세트', items: [{ slot: 14, questionId: c.id }] },
  ] };
  const first = buildPracticeExam(topic, noDraw);
  assert.equal(first.mode, 'practice');
  assert.equal(first.focusTopicId, topic.id);
  assert.deepEqual(first.items.map(i => [i.slot, i.question.id, i.comboLabel]), [
    [8, a.id, '첫 세트'], [4, b.id, '첫 세트'], [14, c.id, '다음 세트'],
  ]);
  assert.equal(first.items[0].question, a);
  assert.deepEqual(first.notices, ['첫 세트 / 다음 세트 순서로 연습합니다. 원하는 문항만 답변할 수 있습니다.']);
  assert.deepEqual(buildPracticeExam(topic, noDraw).items, first.items);
});

test('staycation retains its exact notice, mode and fixed slots', () => {
  const exam = buildPracticeExam(surveyTopicById.get('staycation'), noDraw);
  assert.equal(exam.mode, 'practice');
  assert.equal(exam.focusTopicId, 'staycation');
  assert.deepEqual(exam.items.map(i => i.slot), [2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  assert.deepEqual(exam.items.map(i => itemNumber(exam.mode, i)), ['2','3','4','5','6','7','8','9','10','11','12','13','14','15']);
  assert.deepEqual(exam.notices, ['Q2–Q4 / Q5–Q7 / Q8–Q10 / Q11–Q13 / Q14–Q15 순서로 연습합니다. 원하는 문항만 답변할 수 있습니다.']);
});

function repeatedNumberExam() {
  const groups = [[2,3,4], [5,6,7], [8,9,10], [11,12,13], [11,12,13], [14,15], [14,15]];
  const topic = { id: 'fixed-fixture', category: 'survey', ko: '테스트', en: 'Fixture', emoji: '', questions: [], fixedPracticeSets: [] };
  let slot = 0;
  for (const numbers of groups) {
    topic.fixedPracticeSets.push({ label: numbers.join('·'), items: numbers.map(number => {
      const questionId = `fixture-${++slot}`;
      topic.questions.push({ id: questionId, type: 'description', en: `Fixture question ${slot}.`, ko: `테스트 문항 ${slot}`, number: 'source-number' });
      return { slot, questionId, displayNumber: String(number) };
    }) });
  }
  return buildPracticeExam(topic, noDraw);
}

test('nineteen fixed items have unique storage slots while Q11-Q15 display numbers repeat', () => {
  const exam = repeatedNumberExam();
  assert.deepEqual(exam.items.map(i => i.slot), Array.from({ length: 19 }, (_, i) => i + 1));
  assert.equal(new Set(exam.items.map(i => i.question.id)).size, 19);
  assert.deepEqual(exam.items.map(i => itemNumber(exam.mode, i)),
    ['2','3','4','5','6','7','8','9','10','11','12','13','11','12','13','14','15','14','15']);
  // The override belongs to this exam item, never to the shared question text or source number.
  assert.ok(exam.items.every(i => i.question.number === 'source-number'));
  for (const mode of ['full', 'single', 'set']) {
    assert.deepEqual(exam.items.map(i => itemNumber(mode, i)), exam.items.map(i => String(i.slot)));
  }
});

test('duplicate display numbers retain separate state keys and survive the real history save/load boundary', () => {
  const exam = repeatedNumberExam();
  const bySlot = value => Object.fromEntries(exam.items.map(i => [i.slot, value(i)]));
  const result = {
    exam, answers: bySlot(i => `Answer ${i.question.id}`),
    times: bySlot(i => i.slot * 10), hintUse: bySlot(i => i.slot), replays: bySlot(i => i.slot % 2),
    feedback: bySlot(i => ({ overall: `Feedback ${i.question.id}`,
      structure: { topic: 'good', detail: 'good', feeling: 'needs_work', note: 'Note' },
      pronunciationBasis: 'browser_only', items: [] })),
  };
  // Recordings remain in memory as in ExamRunner; blob URLs are not persisted in history.
  const recordings = bySlot(i => ({ url: `blob:test-${i.slot}`, mimeType: 'audio/webm' }));
  for (const display of ['11', '12', '13', '14', '15']) {
    const pair = exam.items.filter(i => i.displayNumber === display);
    assert.equal(pair.length, 2);
    const [a, b] = pair.map(i => i.slot);
    assert.notEqual(a, b);
    assert.notEqual(result.answers[a], result.answers[b]);
    assert.notEqual(recordings[a].url, recordings[b].url);
    assert.notEqual(result.times[a], result.times[b]);
    assert.notEqual(result.hintUse[a], result.hintUse[b]);
    assert.notEqual(result.feedback[a].overall, result.feedback[b].overall);
    result.answers[b] = `Updated ${b}`;
    assert.equal(result.answers[a], `Answer fixture-${a}`);
  }
  const previous = global.window;
  const data = new Map();
  global.window = { localStorage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) } };
  try {
    pushHistory({ id: exam.id, finishedAt: 1, mode: 'practice', label: 'Fixture', answered: 19, totalItems: 19, result });
    assert.deepEqual(loadHistory()[0].result, JSON.parse(JSON.stringify(result)));
    result.answers[13] = 'Edited second Q11';
    result.replays[13] = 1;
    updateHistoryResult(exam.id, result);
    const saved = loadHistory()[0];
    assert.equal(saved.answered, 19);
    assert.deepEqual(saved.result, JSON.parse(JSON.stringify(result)));
    assert.equal(saved.result.answers[10], 'Answer fixture-10');
    assert.equal(saved.result.answers[13], 'Edited second Q11');
  } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
});

test('old exam items without display metadata retain source-number and slot fallbacks', () => {
  const item = repeatedNumberExam().items[0];
  delete item.displayNumber;
  assert.equal(itemNumber('practice', item), 'source-number');
  delete item.question.number;
  assert.equal(itemNumber('practice', item), '1');
});

test('an unconfigured topic retains 14-question practice with the original type-based draws', () => {
  assert.equal(plain.fixedPracticeSets, undefined, `${plain.id} 에 고정 세트가 생겼다면 다른 주제로 바꿔야 한다`);
  const first = buildPracticeExam(plain, () => 0);
  assert.deepEqual(first.items.map(i => i.slot), [2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
  assert.deepEqual(first.items.map(i => i.question.id), [
    'concert-d1','concert-r1','concert-e1','concert-d1','concert-e1','concert-m1','concert-d1',
    'concert-e1','concert-m1','concert-rp11','concert-rp12','concert-rp13','concert-c1','concert-i1',
  ]);
  assert.equal(buildPracticeExam(plain, () => 0.99).items[0].question.id, 'concert-d2');
});

test('invalid fixed sets fail instead of silently dropping questions or overwriting answer slots', () => {
  const entry = { slot: 2, questionId: home.questions[0].id };
  // 올바른 항목 하나만으로는 통과해야, 아래 네 가지가 각자의 이유로 막힌다는 뜻이 된다.
  assert.doesNotThrow(() => buildPracticeExam({ ...home, fixedPracticeSets: [{ label: '세트', items: [entry] }] }, noDraw));
  for (const items of [[], [{ ...entry, questionId: 'missing' }], [entry, entry], [{ ...entry, slot: 0 }]]) {
    assert.throws(() => buildPracticeExam({ ...home, fixedPracticeSets: [{ label: '세트', items }] }, noDraw));
  }
  assert.throws(() => buildPracticeExam({ ...home, fixedPracticeSets: [] }, noDraw));
});

test('single practice keeps drawing from the shared bank; set practice requires complete declared sets', () => {
  const configured = { ...plain, fixedPracticeSets: [{ label: '고정', items: [{ slot: 14, questionId: plain.questions[0].id }] }] };
  assert.throws(() => buildTopicSet([configured], () => 0));
  for (const build of [buildSingleQuestion]) {
    assert.deepEqual(build([configured], () => 0).items, build([plain], () => 0).items);
    assert.deepEqual(build([configured], () => 0.99).items, build([plain], () => 0.99).items);
  }
});
