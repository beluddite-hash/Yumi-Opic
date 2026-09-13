const test = require('node:test');
const assert = require('node:assert/strict');
const expectedEnglish = require('./fixtures/park-questions.json');
const { surveyTopicById } = require('../.test-build/data/survey-bank');
const { allTopics } = require('../.test-build/data');
const { buildPracticeExam, buildFullExam, buildRandomPractice, buildTopicSet, itemNumber } = require('../.test-build/lib/exam');
const { questionAudioUrl } = require('../.test-build/lib/questionAudio');
const park = surveyTopicById.get('park');
const expectedIds = [
  'park-set1-q2','park-set1-q3','park-set1-q4',
  'park-set2-q5','park-set2-q6','park-set2-q7',
  'park-set3-q8','park-set3-q9','park-set3-q10',
  'park-roleplay1-q11','park-roleplay1-q12','park-roleplay1-q13',
  'park-roleplay2-q11','park-roleplay2-q12','park-roleplay2-q13',
  'park-advanced1-q14','park-advanced1-q15','park-advanced2-q14','park-advanced2-q15',
];
const expectedNumbers = ['2','3','4','5','6','7','8','9','10','11','12','13','11','12','13','14','15','14','15'];
function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

test('PARK contains exactly the 19 approved literal questions in seven fixed sets', () => {
  const exam = buildPracticeExam(park, () => { throw new Error('Fixed practice must not draw'); });
  assert.equal(park.questions.length, 19);
  assert.equal(new Set(park.questions.map(q => q.id)).size, 19);
  assert.deepEqual(exam.items.map(i => i.question.id), expectedIds);
  assert.deepEqual(exam.items.map(i => i.question.en), expectedEnglish);
  assert.deepEqual(exam.items.map(i => i.slot), Array.from({ length: 19 }, (_, i) => i + 1));
  assert.deepEqual(exam.items.map(i => itemNumber('practice', i)), expectedNumbers);
  assert.deepEqual(park.fixedPracticeSets.map(s => s.label), [
    'SET 1','SET 2','SET 3','ROLEPLAY SET 1','ROLEPLAY SET 2','ADVANCED SET 1','ADVANCED SET 2',
  ]);
  assert.deepEqual(park.fixedPracticeSets.map(s => s.items.length), [3,3,3,3,3,2,2]);
  assert.deepEqual(exam.items.map(i => i.question.type), [
    'description','routine','experience','description','experience','memorable',
    'description','experience','memorable','roleplay_ask','roleplay_problem','roleplay_experience',
    'roleplay_ask','roleplay_problem','roleplay_experience','comparison','issue','comparison','issue',
  ]);
  assert.ok(exam.items.every(i => i.question.source === 'provided' && i.question.ko.length > 0));
  for (const set of park.fixedPracticeSets) {
    const earlier = new Set();
    for (const { questionId } of set.items) {
      const q = park.questions.find(q => q.id === questionId);
      assert.ok((q.dependsOn ?? []).every(id => earlier.has(id)));
      earlier.add(q.id);
    }
  }
});

test('all new PARK questions are reachable in full exams and old PARK IDs are absent', () => {
  const expected = new Set(expectedIds);
  const reached = new Set();
  for (let seed = 0; seed < 500; seed++) {
    for (const item of buildFullExam({ enabledSurveyIds: ['park','home','music','beach'], rng: seeded(seed) }).items) {
      if (item.topicId !== 'park') continue;
      assert.ok(expected.has(item.question.id));
      assert.equal(item.question.en, expectedEnglish[expectedIds.indexOf(item.question.id)]);
      reached.add(item.question.id);
    }
  }
  assert.deepEqual([...reached].sort(), [...expected].sort());
  assert.deepEqual(allTopics.find(t => t.id === 'park').questions, park.questions);
});

test('random single/topic practice uses the replacement bank and preserves its existing eligibility rules', () => {
  // 이 LCG 는 작은 시드의 첫 출력이 0.24~0.43 에 몰려 후보 목록의 한가운데만 짚는다.
  // 1문제 추첨은 rng 를 딱 한 번 부르므로, 첫 출력을 버려야 후보 전체를 훑는다.
  const spread = (seed) => { const rng = seeded(seed); rng(); return rng; };
  for (const mode of ['single', 'set']) {
    const reached = new Set();
    for (let seed = 0; seed < 500; seed++) {
      for (const item of buildRandomPractice(mode, 'survey', spread(seed)).items) {
        if (item.topicId !== 'park') continue;
        assert.ok(expectedIds.includes(item.question.id));
        if (mode === 'single') assert.ok(!item.question.dependsOn?.length);
        reached.add(item.question.id);
      }
    }
    assert.ok(reached.size > 0, mode);
  }
});

test('all 19 PARK recordings match the approved text and current voice settings', () => {
  const { createHash } = require('node:crypto');
  const { readFileSync } = require('node:fs');
  const path = require('node:path');
  const manifest = require('../src/data/audio-manifest.json');
  for (const q of park.questions) {
    const seed = JSON.stringify([q.en.trim(), manifest.model, manifest.voice,
      /^gpt-/.test(manifest.model) ? null : manifest.speed,
      /^gpt-/.test(manifest.model) ? manifest.instructions : null]);
    const hash = createHash('sha256').update(seed).digest('hex').slice(0, 12);
    assert.equal(manifest.questions[q.id], hash, q.id);
    assert.equal(questionAudioUrl(q.id), '/audio/' + q.id + '.mp3?v=' + hash);
    const audio = readFileSync(path.join(__dirname, '..', 'public/audio', q.id + '.mp3'));
    assert.ok(audio.length > 1000, q.id);
    assert.ok(audio.subarray(0, 3).toString() === 'ID3' ||
      (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0), q.id);
  }
});


test('PARK random topic practice draws all seven declared sets intact across the expanded patterns', () => {
  const expected = park.fixedPracticeSets.map(set => set.items.map(i => i.questionId));
  const reached = new Set();
  for (let seed = 0; seed < 200; seed++) {
    const actual = buildTopicSet([park], seeded(seed)).items.map(i => i.question.id);
    const index = expected.findIndex(ids => JSON.stringify(ids) === JSON.stringify(actual));
    assert.notEqual(index, -1);
    reached.add(index);
  }
  assert.equal(reached.size, 7);
});
