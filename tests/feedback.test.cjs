const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeFeedback, emptyFeedbackCounts, FEEDBACK_CRITERIA } = require('../.test-build/lib/feedback');

test('완료한 N문항의 좋음만 집계하고 미평가와 범위 밖 피드백을 구분한다', () => {
  const feedback = (topic, detail, feeling) => ({ structure: { topic, detail, feeling } });
  const bySlot = {
    2: feedback('good', 'good', 'needs_work'),
    4: feedback('needs_work', 'good', 'good'),
    99: feedback('good', 'good', 'good'),
  };
  assert.deepEqual(summarizeFeedback([2, 4, 6], bySlot), { evaluated: 2, topic: 1, detail: 2, feeling: 1 });
  assert.deepEqual(summarizeFeedback([4], bySlot), { evaluated: 1, topic: 0, detail: 1, feeling: 1 });
  assert.deepEqual(summarizeFeedback([], bySlot), emptyFeedbackCounts());
  assert.deepEqual(summarizeFeedback([6], bySlot), emptyFeedbackCounts());
  assert.deepEqual(summarizeFeedback([2, 2], bySlot), summarizeFeedback([2], bySlot));
  assert.deepEqual(FEEDBACK_CRITERIA.map(({ label }) => label), ['핵심 제시', '전개·디테일', '감정·의미']);
});
const {
  requiresFrontLoadedOpening, isOpicFeedback, readFeedbackResponse, feedbackRewrite, feedbackOutputTokenLimit,
} = require('../.test-build/lib/feedback');

test('서술형 문항은 두괄식 기준으로 보고 롤플레이는 빼 준다', () => {
  for (const type of ['description', 'routine', 'experience', 'memorable', 'comparison', 'issue', 'intro']) {
    assert.equal(requiresFrontLoadedOpening(type), true, type);
  }
  for (const type of ['roleplay_ask', 'roleplay_problem', 'roleplay_experience']) {
    assert.equal(requiresFrontLoadedOpening(type), false, type);
  }
});

test('유형을 모르면 일반 서술형으로 본다', () => {
  assert.equal(requiresFrontLoadedOpening(undefined), true);
  assert.equal(requiresFrontLoadedOpening(''), true);
});

test('두괄식 규칙을 넣어도 저장된 피드백 형태는 그대로 통과한다', () => {
  const stored = {
    overall: '핵심을 먼저 말했습니다.',
    structure: { topic: 'good', detail: 'needs_work', feeling: 'good', note: '디테일을 더 붙여 보세요.' },
    pronunciationBasis: 'browser_only',
    items: [{ category: 'storytelling', title: '도입', message: '첫 문장이 좋습니다.', example: '' }],
  };
  assert.equal(isOpicFeedback(stored), true);
  assert.equal(isOpicFeedback({ ...stored, structure: { ...stored.structure, topic: 'front_loaded' } }), false);
});

const sampleFeedback = {
  overall: '핵심을 먼저 말했습니다.',
  structure: { topic: 'good', detail: 'good', feeling: 'good', note: '' },
  pronunciationBasis: 'audio_compare',
  items: [],
};

test('응답에서 피드백과 녹음본 전사를 함께 읽는다', () => {
  const read = readFeedbackResponse({ feedback: sampleFeedback, audioTranscript: '  I go to the gym.  ' });
  assert.deepEqual(read.feedback, sampleFeedback);
  assert.equal(read.audioTranscript, 'I go to the gym.');
});

test('전사가 없거나 형식이 어긋난 응답을 가려낸다', () => {
  assert.equal(readFeedbackResponse({ feedback: sampleFeedback }).audioTranscript, '');
  assert.equal(readFeedbackResponse({ feedback: sampleFeedback, audioTranscript: 3 }).audioTranscript, '');
  assert.equal(readFeedbackResponse({ error: '실패' }), null);
  assert.equal(readFeedbackResponse(sampleFeedback), null);
  assert.equal(readFeedbackResponse(null), null);
});

test('고친 답변이 붙은 피드백도, 없는 예전 피드백도 통과한다', () => {
  const rewritten = { ...sampleFeedback, improvedAnswer: 'My favorite place is the gym.', improvedFrom: 'I go to the gym.' };
  assert.equal(isOpicFeedback(sampleFeedback), true);
  assert.equal(isOpicFeedback(rewritten), true);
  assert.equal(isOpicFeedback({ ...rewritten, improvedAnswer: 3 }), false);
  assert.equal(isOpicFeedback({ ...rewritten, improvedFrom: null }), false);
  assert.deepEqual(readFeedbackResponse({ feedback: rewritten }).feedback, rewritten);
});

test('Before / After 는 바탕 답변과 고친 답변이 모두 있을 때만 만든다', () => {
  assert.deepEqual(
    feedbackRewrite({ ...sampleFeedback, improvedAnswer: ' After. ', improvedFrom: ' Before. ' }),
    { before: 'Before.', after: 'After.' },
  );
  assert.equal(feedbackRewrite(sampleFeedback), null);
  assert.equal(feedbackRewrite({ ...sampleFeedback, improvedAnswer: 'After.', improvedFrom: '  ' }), null);
  assert.equal(feedbackRewrite({ ...sampleFeedback, improvedAnswer: '', improvedFrom: 'Before.' }), null);
});

test('출력 토큰은 고친 답변만큼 답변 길이에 맞춰 늘리되 상한을 넘지 않는다', () => {
  const short = feedbackOutputTokenLimit(300);
  const long = feedbackOutputTokenLimit(1500);
  assert.ok(short >= 1_200, '피드백만 받던 예전 상한보다 작지 않다');
  assert.ok(long > short);
  assert.equal(feedbackOutputTokenLimit(-10), feedbackOutputTokenLimit(0));
  assert.equal(feedbackOutputTokenLimit(1_000_000), 6_000);
});

test('피드백 항목은 5개까지만 읽는다', () => {
  const many = Array.from({ length: 7 }, (_, index) => ({
    category: 'storytelling', title: `${index}`, message: '', example: '',
  }));
  assert.equal(readFeedbackResponse({ feedback: { ...sampleFeedback, items: many } }).feedback.items.length, 5);
});

test('연결 표현 유형을 읽고 모르는 유형은 가려낸다', () => {
  const item = { category: 'transition', title: '결과로 넘어갈 때', message: '', example: 'As a result, young people care about balance.' };
  assert.equal(isOpicFeedback({ ...sampleFeedback, items: [item] }), true);
  assert.equal(isOpicFeedback({ ...sampleFeedback, items: [{ ...item, category: 'connector' }] }), false);
});
