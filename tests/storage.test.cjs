const test = require('node:test');
const assert = require('node:assert/strict');
const storage = require('../.test-build/lib/storage');
const { buildSingleQuestion, buildTopicSet } = require('../.test-build/lib/exam');
const { allTopics, DEFAULT_SURVEY_IDS } = require('../.test-build/data');
const SETTINGS_KEY = 'yumi-opic:settings';
const KEY = 'yumi-opic:history';
// 롤플레이의 명시적인 undefined 필드를 항상 포함해 JSON 저장 경계를 검증한다.
const fixtureTopics = allTopics.map(topic => ({
  ...topic, questions: topic.questions.filter(question => question.type === 'roleplay_ask'),
}));
const jsonSnapshot = value => JSON.parse(JSON.stringify(value));
const feedback = {
  overall: '구체적인 경험이 잘 드러납니다.',
  structure: { topic: 'good', detail: 'good', feeling: 'needs_work', note: '감정을 덧붙여 보세요.' },
  pronunciationBasis: 'browser_only', items: [],
};

function entry(id = 'attempt-1', exam = buildSingleQuestion(fixtureTopics, () => 0)) {
  const slot = exam.items[0].slot;
  return {
    id, finishedAt: Date.now(), mode: exam.mode, label: '1문제 연습', answered: 1, totalItems: 1,
    result: { exam, answers: { [slot]: 'I enjoyed the trip with my friends.' }, times: { [slot]: 30 },
      hintUse: { [slot]: 1 }, replays: { [slot]: 1 }, feedback: { [slot]: feedback } },
  };
}

function withStorage(run) {
  const previous = global.window;
  const data = new Map();
  global.window = { localStorage: {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  } };
  try { run(data); } finally {
    if (previous === undefined) delete global.window;
    else global.window = previous;
  }
}

test('질문과 답변, 시간, 힌트, 재청취, 피드백을 함께 복원한다', () => withStorage(() => {
  const original = entry();
  storage.pushHistory(original);
  assert.deepEqual(storage.loadHistory(), jsonSnapshot([original]));
}));

test('JSON 저장 시 undefined는 생략하고 실제 선행 문항 배열은 보존한다', () => withStorage(() => {
  const original = entry();
  const question = original.result.exam.items[0].question;
  assert.ok(Object.hasOwn(question, 'dependsOn'));
  assert.equal(question.dependsOn, undefined);
  storage.pushHistory(original);
  assert.equal(Object.hasOwn(storage.loadHistory()[0].result.exam.items[0].question, 'dependsOn'), false);

  const updated = jsonSnapshot(original.result);
  updated.exam.items[0].question.dependsOn = ['previous-question'];
  storage.updateHistoryResult(original.id, updated);
  assert.deepEqual(storage.loadHistory()[0].result, updated);
}));

test('Before / After 로 쓸 고친 답변과 바탕 답변을 함께 저장하고 되살린다', () => withStorage(() => {
  const original = entry();
  const slot = original.result.exam.items[0].slot;
  original.result.feedback[slot] = {
    ...feedback,
    improvedAnswer: 'My favorite trip was to Jeju. I enjoyed the trip with my friends.',
    improvedFrom: 'I enjoyed the trip with my friends.',
  };
  storage.pushHistory(original);
  assert.deepEqual(storage.loadHistory()[0].result.feedback[slot], original.result.feedback[slot]);
}));

test('같은 시험을 다시 풀어도 회차별로 남고 같은 회차 저장은 중복되지 않는다', () => withStorage(() => {
  const first = entry();
  const second = entry('attempt-2', first.result.exam);
  storage.pushHistory(first);
  storage.pushHistory(second);
  storage.pushHistory(second);
  assert.deepEqual(storage.loadHistory().map((item) => item.id), ['attempt-2', 'attempt-1']);
}));

test('늦게 확정된 답변과 피드백을 원래 회차에 저장하고 날짜와 순서를 유지한다', () => withStorage(() => {
  const first = entry();
  storage.pushHistory(first);
  storage.pushHistory(entry('attempt-2'));
  const slot = first.result.exam.items[0].slot;
  const updated = { ...first.result, answers: { [slot]: 'Final transcript.' },
    feedback: { [slot]: { ...feedback, overall: '업데이트된 피드백' } } };
  storage.updateHistoryResult(first.id, updated);
  const history = storage.loadHistory();
  assert.equal(history[1].finishedAt, first.finishedAt);
  assert.deepEqual(history[1].result, jsonSnapshot(updated));
}));

test('개별/전체 삭제가 상세 결과도 지우며 늦은 업데이트가 기록을 되살리지 않는다', () => withStorage((data) => {
  const first = entry();
  storage.pushHistory(first);
  storage.pushHistory(entry('attempt-2'));
  assert.equal(storage.deleteHistory(first.id).length, 1);
  assert.throws(() => storage.updateHistoryResult(first.id, first.result), /삭제/);
  assert.ok(!data.get(KEY).includes('attempt-1'));
  storage.clearHistory();
  assert.equal(data.has(KEY), false);
}));

test('고른 기록을 한 번에 지우고 나머지는 그대로 둔다', () => withStorage((data) => {
  storage.pushHistory(entry('attempt-1'));
  storage.pushHistory(entry('attempt-2'));
  storage.pushHistory(entry('attempt-3'));
  const left = storage.deleteHistoryEntries(['attempt-1', 'attempt-3', '없는-기록']);
  assert.deepEqual(left.map(item => item.id), ['attempt-2']);
  assert.deepEqual(storage.loadHistory().map(item => item.id), ['attempt-2']);
  assert.ok(!data.get(KEY).includes('attempt-3'));
  assert.deepEqual(storage.deleteHistoryEntries([]).map(item => item.id), ['attempt-2']);
}));

test('1토픽 랜덤 연습 기록도 상세 결과와 함께 되살린다', () => withStorage(() => {
  for (const [pattern, count] of [[0, 3], [0.3, 3], [0.6, 3], [0.9, 2]]) {
    const draws = [0, pattern, 0];
    const exam = buildTopicSet(allTopics, () => draws.shift());
    storage.pushHistory({ ...entry(`topic-set-${pattern}`, exam), label: '1토픽 랜덤 연습', totalItems: exam.items.length });
    const saved = storage.loadHistory()[0];
    assert.equal(saved.mode, 'set');
    assert.equal(saved.totalItems, count);
    assert.deepEqual(saved.result.exam, jsonSnapshot(exam));
  }
}));

test('최근 20회만 저장한다', () => withStorage(() => {
  for (let i = 0; i < 21; i++) storage.pushHistory(entry(`attempt-${i}`));
  const history = storage.loadHistory();
  assert.equal(history.length, 20);
  assert.equal(history[0].id, 'attempt-20');
  assert.equal(history[19].id, 'attempt-1');
}));

test('이전 요약과 정상 기록을 보존하며 손상된 항목/피드백만 제외한다', () => withStorage((data) => {
  const legacy = { id: 'legacy', finishedAt: 1, mode: 'single', label: '이전 기록', answered: 0, totalItems: 1 };
  const broken = entry('broken');
  broken.result.feedback[broken.result.exam.items[0].slot] = { items: [] };
  const raw = JSON.stringify([null, {}, legacy, broken, entry()]);
  data.set(KEY, raw);
  const history = storage.loadHistory();
  assert.equal(history.length, 3);
  assert.equal(history[0].result, undefined);
  assert.deepEqual(history[1].result.feedback, {});
  assert.equal(data.get(KEY), raw, '읽기는 기존 저장 내용을 변경하지 않는다');
  data.set(KEY, '{broken json');
  assert.deepEqual(storage.loadHistory(), []);
}));

test('저장 공간 부족/권한 오류를 호출자에게 알리고 기존 기록을 유지한다', () => withStorage(() => {
  const first = entry();
  storage.pushHistory(first);
  window.localStorage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => storage.pushHistory(entry('attempt-2')), /저장/);
  assert.throws(() => storage.deleteHistory(first.id), /저장/);
  assert.equal(storage.loadHistory()[0].id, first.id);
}));

test('이전 버전에서 ID를 재사용한 회차도 각각 보존한다', () => withStorage((data) => {
  const legacy = { id: 'same-exam', finishedAt: 2, mode: 'single', label: '이전 기록', answered: 1, totalItems: 1 };
  data.set(KEY, JSON.stringify([legacy, { ...legacy, finishedAt: 1 }]));
  const history = storage.loadHistory();
  assert.equal(history.length, 2);
  assert.notEqual(history[0].id, history[1].id);
  const oldId = history[1].id;
  storage.pushHistory(entry());
  assert.equal(storage.loadHistory()[2].id, oldId);
}));

test('덧붙여 저장하면 연습 시각은 두고 업데이트 시각만 새로 찍는다', () => withStorage(() => {
  const first = entry();
  first.finishedAt = Date.now() - 60_000;
  storage.pushHistory(first);
  assert.equal(storage.loadHistory()[0].updatedAt, undefined, '연습을 마친 기록에는 업데이트 시각이 없다');

  const before = Date.now();
  storage.updateHistoryResult(first.id, first.result);
  const saved = storage.loadHistory()[0];
  assert.equal(saved.finishedAt, first.finishedAt);
  assert.ok(saved.updatedAt >= before, '덧붙여 저장한 시각을 남긴다');
  assert.ok(saved.updatedAt > saved.finishedAt);
}));

test('OpenAI 로 다시 받아쓴 답변과 원래 받아쓰기를 함께 저장한다', () => withStorage(() => {
  const original = entry();
  const slot = original.result.exam.items[0].slot;
  storage.pushHistory(original);

  const rewritten = {
    ...original.result,
    answers: { [slot]: 'I enjoyed the trip with my friends.' },
    browserAnswers: { [slot]: 'I enjoyed the trip with my friend.' },
  };
  storage.updateHistoryResult(original.id, rewritten);
  assert.deepEqual(storage.loadHistory()[0].result, jsonSnapshot(rewritten));

  // 되돌리면 원본 키가 사라지고 예전 기록과 같은 모양으로 남는다.
  storage.updateHistoryResult(original.id, original.result);
  assert.equal(Object.hasOwn(storage.loadHistory()[0].result, 'browserAnswers'), false);
}));

test('손상된 원래 받아쓰기와 업데이트 시각은 버린다', () => withStorage((data) => {
  const broken = entry();
  const slot = broken.result.exam.items[0].slot;
  broken.updatedAt = '어제';
  broken.result.browserAnswers = { [slot]: 12, 99: 'kept' };
  data.set(KEY, JSON.stringify([broken]));
  const saved = storage.loadHistory()[0];
  assert.equal(saved.updatedAt, undefined);
  assert.deepEqual(saved.result.browserAnswers, { 99: 'kept' });
}));

test('설정이 없으면 문제은행이 있는 항목이 모두 켜진 채로 시작한다', () => withStorage(() => {
  const settings = storage.loadSettings();
  assert.deepEqual(settings.enabledSurveyIds.slice().sort(), DEFAULT_SURVEY_IDS.slice().sort());
  assert.ok(settings.surveyChoiceIds.includes('job-none'));
  assert.equal(settings.volume, 1);
}));

test('주제만 저장했던 이전 설정을 실제 서베이 선택으로 되살린다', () => withStorage((data) => {
  data.set(SETTINGS_KEY, JSON.stringify({ enabledSurveyIds: ['home', 'music', 'park'], volume: 0.5 }));
  const settings = storage.loadSettings();
  assert.deepEqual(settings.enabledSurveyIds, ['home', 'park', 'music']);
  assert.deepEqual(settings.surveyChoiceIds,
    ['job-none', 'student-no', 'course-lapsed', 'housing-alone', 'hobby-music', 'leisure-park']);
  assert.equal(settings.volume, 0.5);
}));

test('서베이 선택을 저장하면 문제은행이 있는 주제만 시험 목록으로 추린다', () => withStorage(() => {
  const saved = storage.saveSurveyChoices(['housing-dorm', 'leisure-cafe', 'sport-gym', 'hobby-music', 'vacation-home']);
  assert.deepEqual(saved.enabledSurveyIds, ['music', 'gym', 'staycation']);
  // 문제 준비 중인 항목도 화면에 그대로 다시 보여 줘야 해서 저장해 둔다.
  assert.deepEqual(storage.loadSettings().surveyChoiceIds,
    ['housing-dorm', 'leisure-cafe', 'sport-gym', 'hobby-music', 'vacation-home']);
}));

test('시험 화면에서 주제를 껐다 켜도 문제은행이 없는 선택은 그대로 남는다', () => withStorage(() => {
  storage.saveSurveyChoices(['job-none', 'housing-dorm', 'leisure-cafe', 'hobby-music', 'sport-gym', 'vacation-home']);
  const saved = storage.saveEnabledTopics(['music', 'gym', 'park']);
  assert.deepEqual(saved.enabledSurveyIds, ['park', 'music', 'gym']);
  assert.deepEqual(saved.surveyChoiceIds,
    ['job-none', 'housing-dorm', 'leisure-cafe', 'hobby-music', 'sport-gym', 'leisure-park']);
}));

test('설문을 거치지 않은 브라우저와 거친 브라우저를 구분한다', () => withStorage((data) => {
  assert.equal(storage.hasSavedSettings(), false);
  storage.markSurveySeen();
  assert.equal(storage.hasSavedSettings(), true);
  // 방문 사실만 남기고 고른 값은 기본값 그대로여야 한다.
  assert.deepEqual(JSON.parse(data.get(SETTINGS_KEY)).surveyChoiceIds, storage.defaultSettings.surveyChoiceIds);
}));

test('이미 고른 설문이 있으면 방문 표시가 그 선택을 덮지 않는다', () => withStorage(() => {
  storage.saveSurveyChoices(['job-none', 'hobby-music', 'sport-gym', 'vacation-home']);
  storage.markSurveySeen();
  assert.deepEqual(storage.loadSettings().surveyChoiceIds, ['job-none', 'hobby-music', 'sport-gym', 'vacation-home']);
}));
