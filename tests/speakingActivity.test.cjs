const test = require('node:test');
const assert = require('node:assert/strict');
const {
  localDay, emptySpeakingTotals, savedReadPractices,
  speakingForDay, mergeDailySpeaking, totalDailySpeaking,
} = require('../.test-build/lib/speakingActivity');

const today = new Date(2026, 8, 12, 14).getTime();
const yesterday = new Date(2026, 8, 11, 14).getTime();
const day = localDay(today);
const noFeedback = { evaluated: 0, topic: 0, detail: 0, feeling: 0 };

function entry(overrides = {}) {
  return {
    id: 'a', finishedAt: today, mode: 'set', label: '연습', answered: 2, totalItems: 3,
    result: {
      exam: { items: [{ slot: 1 }, { slot: 2 }, { slot: 3 }] },
      answers: { 1: 'I went to the park. It was fun!', 2: 'I love music', 3: '  ', 99: 'Not an exam item.' },
      times: {}, hintUse: {}, replays: {}, feedback: {},
    },
    ...overrides,
  };
}

test('실제 답변이 있는 문제 수와 각 답변의 문장 수를 합산한다', () => {
  assert.deepEqual(speakingForDay(entry(), day), {
    questions: 2, answerSentences: 3, readCount: 0, readSentences: 0, feedback: noFeedback,
  });
});

test('다른 날 답변은 재분석해 저장 시각이 오늘이 되어도 오늘 답변으로 세지 않는다', () => {
  assert.deepEqual(speakingForDay(entry({ finishedAt: yesterday, updatedAt: today }), day), emptySpeakingTotals());
});

test('지난 문제를 오늘 읽은 횟수만 더하고 읽은 당시 문장 수를 지킨다', () => {
  const old = entry({ finishedAt: yesterday, updatedAt: today });
  old.result.readPractices = [
    { slot: 1, completedAt: yesterday, sentences: 3, count: 1 },
    { slot: 1, completedAt: today, sentences: 6, count: 3 },
  ];
  old.result.feedback[1] = { improvedAnswer: 'A new rewrite with a different length.' };
  old.result.readCounts = { 1: 4 };
  assert.deepEqual(speakingForDay(old, day), {
    questions: 0, answerSentences: 0, readCount: 3, readSentences: 18, feedback: noFeedback,
  });
});

test('옛 따라 읽기는 시작과 마지막 저장이 같은 날일 때만 복원한다', () => {
  const old = entry();
  old.result.readCounts = { 1: 3, 2: 0, 99: 9 };
  old.result.feedback[1] = { improvedAnswer: 'I like music. It helps me relax.' };
  assert.deepEqual(savedReadPractices(old), [{ slot: 1, completedAt: today, sentences: 2, count: 3 }]);
  old.updatedAt = new Date(2026, 8, 13, 9).getTime();
  assert.deepEqual(savedReadPractices(old), []);
  // 날짜 집계를 시작한 뒤에는 누적 readCounts를 다시 추정해 더하지 않는다.
  old.updatedAt = today;
  old.result.readPractices = [];
  assert.deepEqual(savedReadPractices(old), []);
});

test('여러 날의 기존 누적 횟수에 오늘 읽기를 더해도 오늘 한 번만 센다', () => {
  const old = entry({ finishedAt: yesterday, updatedAt: today });
  old.result.readCounts = { 1: 8 };
  old.result.readPractices = [...savedReadPractices(old), { slot: 1, completedAt: today, sentences: 4, count: 1 }];
  assert.equal(speakingForDay(old, day).readCount, 1);
  assert.equal(speakingForDay(old, day).readSentences, 4);
});

test('답변 텍스트가 없는 옛 요약에서는 문장 수를 만들어내지 않는다', () => {
  assert.deepEqual(speakingForDay(entry({ result: undefined }), day), {
    questions: 2, answerSentences: 0, readCount: 0, readSentences: 0, feedback: noFeedback,
  });
});

test('최근 다섯 회 밖의 연습과 같은 문제를 다시 푼 새 회차도 합산한다', () => {
  const history = Array.from({ length: 8 }, (_, i) => entry({ id: String(i) }));
  const daily = mergeDailySpeaking(null, history, today);
  assert.deepEqual(totalDailySpeaking(daily), { questions: 16, answerSentences: 24, readCount: 0, readSentences: 0, feedback: noFeedback });
  assert.deepEqual(mergeDailySpeaking(daily, history, today), daily, '다시 읽기만 해서는 합계가 늘지 않는다');
});

test('다시 받아쓴 답변은 해당 회차의 합계를 교체한다', () => {
  const initial = mergeDailySpeaking(null, [entry()], today);
  const revised = entry();
  revised.result.answers[1] = 'I went to the park. It was fun. I will go again.';
  const next = mergeDailySpeaking(initial, [revised], today);
  assert.equal(totalDailySpeaking(next).questions, 2);
  assert.equal(totalDailySpeaking(next).answerSentences, 4);
  assert.equal(totalDailySpeaking(initial).answerSentences, 3, '기존 값을 직접 바꾸지 않는다');
});

test('상세 기록 보관 범위에서 사라져도 오늘 합계는 유지한다', () => {
  const history = Array.from({ length: 25 }, (_, i) => entry({ id: String(i) }));
  const daily = mergeDailySpeaking(null, history, today);
  assert.equal(totalDailySpeaking(mergeDailySpeaking(daily, history.slice(0, 20), today)).questions, 50);
});

test('기기 현지 자정에 오늘 합계를 새로 시작한다', () => {
  const before = new Date(2026, 8, 12, 23, 59, 59).getTime();
  const after = new Date(2026, 8, 13, 0, 0, 0).getTime();
  const history = [entry({ finishedAt: before })];
  const daily = mergeDailySpeaking(null, history, before);
  assert.equal(localDay(before), '2026-09-12');
  assert.equal(localDay(after), '2026-09-13');
  assert.deepEqual(totalDailySpeaking(mergeDailySpeaking(daily, history, after)), emptySpeakingTotals());
});

test('오늘 완료한 답변의 평가만 합산하고 늦은 재분석은 해당 회차 합계를 교체한다', () => {
  const current = entry();
  current.result.feedback = {
    1: { structure: { topic: 'good', detail: 'good', feeling: 'needs_work' } },
    3: { structure: { topic: 'good', detail: 'good', feeling: 'good' } },
  };
  const old = { ...current, id: 'old', finishedAt: yesterday, updatedAt: today };
  const initial = mergeDailySpeaking(null, [current, old], today);
  assert.deepEqual(totalDailySpeaking(initial).feedback, { evaluated: 1, topic: 1, detail: 1, feeling: 0 });
  current.result.feedback[1].structure.topic = 'needs_work';
  current.result.feedback[2] = { structure: { topic: 'good', detail: 'needs_work', feeling: 'good' } };
  const revised = totalDailySpeaking(mergeDailySpeaking(initial, [current, old], today));
  assert.equal(revised.questions, 2);
  assert.deepEqual(revised.feedback, { evaluated: 2, topic: 1, detail: 1, feeling: 1 });
  assert.deepEqual(totalDailySpeaking(initial).feedback, { evaluated: 1, topic: 1, detail: 1, feeling: 0 });
  assert.deepEqual(totalDailySpeaking(mergeDailySpeaking(initial, [current, old], new Date(2026, 8, 13).getTime())).feedback, noFeedback);
});
