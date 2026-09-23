const test = require('node:test');
const assert = require('node:assert/strict');
const { RANDOM_SCOPES, examExitLink, nextPracticeLink, randomPracticeLink, repeatPracticeLink } = require('../.test-build/lib/nav');
const { buildPracticeExam, buildRandomPractice } = require('../.test-build/lib/exam');
const { allTopics } = require('../.test-build/data');

const jogging = allTopics.find(topic => topic.id === 'jogging') ?? allTopics[0];

function entry(overrides) {
  return { id: 'a', finishedAt: 1, mode: 'practice', label: `주제별 연습 · ${jogging.ko}`, answered: 1, totalItems: 15, ...overrides };
}

test('연습 화면은 홈이 아니라 그 연습을 고른 목록으로 나간다', () => {
  assert.deepEqual(examExitLink('practice'), { href: '/topics', label: '← 주제별 연습' });
  assert.deepEqual(examExitLink('single'), { href: '/topics', label: '← 주제별 연습' });
  assert.deepEqual(examExitLink('full'), { href: '/exam?mode=full', label: '← 실전 모의고사' });
});

test('결과 화면의 다음 행동은 늘 주제 목록으로 이어진다', () => {
  for (const mode of ['practice', 'single', 'set', 'full']) {
    assert.equal(nextPracticeLink(mode).href, '/topics');
  }
});

test('마지막 주제별 연습은 같은 주제로 다시 시작한다', () => {
  const exam = buildPracticeExam(jogging, () => 0);
  const link = repeatPracticeLink(entry({ label: '이름이 바뀐 라벨', result: { exam, answers: {}, times: {}, hintUse: {}, replays: {}, feedback: {} } }), allTopics);
  assert.equal(link.href, `/exam?mode=practice&topic=${encodeURIComponent(jogging.id)}`);
  assert.ok(link.label.includes(jogging.ko));
});

test('상세 결과가 없는 예전 기록도 라벨로 주제를 되짚는다', () => {
  assert.equal(repeatPracticeLink(entry(), allTopics).href, `/exam?mode=practice&topic=${encodeURIComponent(jogging.id)}`);
});

test('주제를 알 수 없는 주제별 기록은 링크를 만들지 않는다', () => {
  assert.equal(repeatPracticeLink(entry({ label: '주제별 연습 · 사라진 주제' }), allTopics), undefined);
});

test('모의고사와 랜덤 연습은 주제 없이 같은 모드로 다시 시작한다', () => {
  assert.equal(repeatPracticeLink(entry({ mode: 'full', label: '실전 모의고사' }), allTopics).href, '/exam?mode=full');
  // 범위를 적어 두지 않은 예전 1문제 기록은 서베이와 돌발 전체로 다시 뽑는다.
  assert.equal(repeatPracticeLink(entry({ mode: 'single', label: '1문제 연습' }), allTopics).href, '/exam?mode=single');
  // 1토픽 랜덤 연습은 지난번 주제가 아니라 같은 범위에서 새 주제를 뽑는다.
  for (const scope of ['all', 'survey', 'surprise']) {
    for (const mode of ['single', 'set']) {
      const exam = buildRandomPractice(mode, scope, () => 0);
      const link = repeatPracticeLink(entry({ mode, label: '라벨', result: { exam, answers: {}, times: {}, hintUse: {}, replays: {}, feedback: {} } }), allTopics);
      assert.deepEqual(link, randomPracticeLink(mode, scope));
    }
  }
});

test('랜덤 연습 링크는 범위 여섯 가지를 모두 구분하고 전체 범위는 예전 주소를 그대로 쓴다', () => {
  assert.deepEqual(randomPracticeLink('single'), { href: '/exam?mode=single', label: '1문제 랜덤 연습 (서베이+돌발)' });
  assert.deepEqual(randomPracticeLink('set', 'survey'), { href: '/exam?mode=set&scope=survey', label: '1토픽 랜덤 연습 (서베이)' });
  assert.deepEqual(randomPracticeLink('single', 'surprise'), { href: '/exam?mode=single&scope=surprise', label: '1문제 랜덤 연습 (돌발)' });
  const links = RANDOM_SCOPES.flatMap(scope => ['single', 'set'].map(mode => randomPracticeLink(mode, scope)));
  assert.equal(new Set(links.map(link => link.href)).size, 6);
  assert.equal(new Set(links.map(link => link.label)).size, 6);
});

test('주제 ID 에 특수문자가 있어도 링크가 깨지지 않는다', () => {
  const odd = { id: 'a/b?c', ko: '이상한 주제', emoji: '🌀' };
  const link = repeatPracticeLink(entry({ label: '주제별 연습 · 이상한 주제' }), [odd]);
  assert.equal(link.href, '/exam?mode=practice&topic=a%2Fb%3Fc');
});

test('돌발 연습을 나가거나 마치면 돌발 탭으로 돌아간다', () => {
  for (const topic of allTopics) {
    const exam = buildPracticeExam(topic, () => 0);
    const expected = topic.category === 'surprise' ? '/topics?category=surprise' : '/topics';
    assert.equal(examExitLink(exam.mode, exam).href, expected);
    assert.equal(nextPracticeLink(exam.mode, exam).href, expected);
  }
});
