const test = require('node:test');
const assert = require('node:assert/strict');
const bank = require('../.test-build/data/survey-bank');
const data = require('../.test-build/data');
const engine = require('../.test-build/lib/exam');

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const ids = (items) => items.map((x) => x.question.id);

test('survey bank contains the 11 selected topics', () => {
  assert.equal(bank.surveyTopics.length, 11);
  assert.deepEqual(bank.DEFAULT_SURVEY_IDS, ['home','music','beach','park','concert','shopping','jogging','walking','gym','staycation','overseas']);
  for (const topic of bank.surveyTopics) {
    assert.equal(topic.category, 'survey');
    assert.ok(topic.questions.some((q) => q.source === 'verified' || q.source === 'provided'));
  }
});

test('other topic practice uses actual slots 2-15 for one topic, without intro and with coherent roleplay', () => {
  const types = ['description', 'routine', 'experience', 'description', 'experience',
    'memorable', 'description', 'experience', 'memorable',
    'roleplay_ask', 'roleplay_problem', 'roleplay_experience', 'comparison', 'issue'];
  for (const topic of bank.surveyTopics.filter((topic) => !topic.fixedPracticeSets)) {
    for (let seed = 0; seed < 100; seed++) {
      const exam = engine.buildPracticeExam(topic, seeded(seed));
      assert.deepEqual(exam.items.map((item) => item.question.type), types);
      assert.deepEqual(exam.items.map((item) => item.slot), [2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
      assert.ok(exam.items.every((i) => i.topicId === topic.id));
      assert.equal(exam.focusTopicId, topic.id);
      for (const [index, item] of exam.items.entries()) {
        if (topic.questions.some((q) => q.type === item.question.type && q.source === 'verified')) {
          assert.equal(item.question.source, 'verified');
        }
        for (const dependency of item.question.dependsOn ?? []) {
          assert.ok(ids(exam.items.slice(0, index)).includes(dependency));
        }
      }
    }
    const first = engine.buildPracticeExam(topic, () => 0);
    const last = engine.buildPracticeExam(topic, () => 0.999);
    assert.notEqual(first.items[0].question.id, last.items[0].question.id);
  }
});

test('topic practice draws repeated types independently and allows duplicate questions', () => {
  const topic = bank.surveyTopics[0];
  let draw = 0;
  const exam = engine.buildPracticeExam(topic, () => [0, 0, 0, 0.999][draw++ % 4]);
  assert.equal(draw, 14);
  const descriptions = exam.items.filter((i) => [2,5,8].includes(i.slot));
  assert.deepEqual(ids(descriptions), ['home-d1', 'home-d2', 'home-d1']);
  const repeated = engine.buildPracticeExam(topic, () => 0);
  assert.equal(new Set(ids(repeated.items.filter((i) => [2,5,8].includes(i.slot)))).size, 1);
  assert.equal(repeated.items.length, 14);
});

test('topic practice rejects incomplete topics instead of renumbering slots', () => {
  const topic = bank.surveyTopics[0];
  const questions = topic.questions.filter((q) => q.type === 'description');
  assert.throws(() => engine.buildPracticeExam({ ...topic, questions }), /문항이 부족/);
  assert.throws(() => engine.buildPracticeExam({ ...topic, questions: [] }), /문항이 부족/);
});

const EXCLUDED = ['walking', 'concert', 'jogging'];

const FULL_EXAM_GROUPS = [
  { slots: [2, 3, 4], types: ['description', 'routine', 'experience'] },
  { slots: [5, 6, 7], types: ['description', 'experience', 'memorable'] },
  { slots: [8, 9, 10], types: ['description', 'experience', 'memorable'] },
  { slots: [11, 12, 13], types: ['roleplay_ask', 'roleplay_problem', 'roleplay_experience'], surveyOnly: true },
  { slots: [14, 15], types: ['comparison', 'issue'] },
];
const groupItems = (exam, group) => group.slots.map((slot) => exam.items.find((i) => i.slot === slot));

test('full exam draws three survey sets and two surprise sets, placing the surprise sets at random', () => {
  const surpriseById = new Map(data.surpriseTopics.map((t) => [t.id, t]));
  const placements = new Set();
  for (let seed = 0; seed < 1000; seed++) {
    const exam = engine.buildFullExam({ enabledSurveyIds: bank.DEFAULT_SURVEY_IDS, rng: seeded(seed) });
    assert.deepEqual(exam.items.map((i) => i.slot), [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
    assert.equal(new Set(ids(exam.items)).size, exam.items.length);
    assert.ok(exam.items.every((i) => !EXCLUDED.includes(i.topicId)));

    const groups = FULL_EXAM_GROUPS.map((group) => ({ ...group, items: groupItems(exam, group) }));
    for (const group of groups) assert.equal(new Set(group.items.map((i) => i.topicId)).size, 1);
    assert.equal(new Set(groups.map((group) => group.items[0].topicId)).size, groups.length);

    const surprise = groups.filter((group) => surpriseById.has(group.items[0].topicId));
    assert.equal(surprise.length, engine.FULL_EXAM_SURPRISE_GROUPS);
    assert.ok(surprise.every((group) => !group.surveyOnly), '롤플레이 구간은 돌발에서 나오지 않는다');
    placements.add(surprise.map((group) => group.slots[0]).join('-'));

    for (const group of groups) {
      const topic = surpriseById.get(group.items[0].topicId);
      if (!topic) {
        // 배경 설문 구간은 번호별 유형을 그대로 따르고, 선언된 고정 세트가 있으면 그대로 쓴다.
        assert.deepEqual(group.items.map((i) => i.question.type), group.types);
        const surveyTopic = bank.surveyTopicById.get(group.items[0].topicId);
        if (surveyTopic.fixedPracticeSets) {
          assert.ok(surveyTopic.fixedPracticeSets.some((set) =>
            JSON.stringify(set.items.map((i) => i.questionId)) === JSON.stringify(ids(group.items))));
        }
      } else if (group.types.includes('comparison')) {
        // 돌발 어드밴스 구간만 비교 → 이슈 순서를 지킨다.
        assert.deepEqual(group.items.map((i) => i.question.type), group.types);
      } else {
        // 돌발 일반 구간은 자료의 첫 문항으로 시작해 자료 순서대로, 비교·이슈를 빼고 낸다.
        // 유형은 주제가 가진 자료를 따르므로 구간의 번호별 유형과 다를 수 있다.
        assert.equal(group.items[0].question.id, topic.questions[0].id);
        const order = group.items.map((i) => topic.questions.findIndex((q) => q.id === i.question.id));
        assert.deepEqual(order, [...order].sort((a, b) => a - b));
        assert.equal(new Set(order).size, order.length);
        assert.ok(group.items.every((i) => !['comparison', 'issue'].includes(i.question.type)));
      }
      for (const [index, entry] of group.items.entries()) {
        if (topic) assert.doesNotMatch(entry.typeLabel, /번/);
        for (const dependency of entry.question.dependsOn ?? []) {
          assert.ok(ids(group.items.slice(0, index)).includes(dependency));
        }
      }
    }
  }
  // 롤플레이를 뺀 네 구간에서 두 곳을 고르는 여섯 조합이 모두 나온다.
  assert.deepEqual([...placements].sort(), ['2-14', '2-5', '2-8', '5-14', '5-8', '8-14']);
});

test('full exam never substitutes unselected survey topics and requires at least three valid topics', () => {
  const surpriseIds = data.surpriseTopics.map((t) => t.id);
  assert.equal(engine.MIN_FULL_EXAM_SURVEY_TOPICS, 3);
  assert.throws(() => engine.buildFullExam({ enabledSurveyIds: [] }));
  assert.throws(() => engine.buildFullExam({ enabledSurveyIds: ['home','home','unknown'] }), /3개 이상/);
  assert.throws(() => engine.buildFullExam({ enabledSurveyIds: ['home','music'] }), /3개 이상/);
  for (let seed = 0; seed < 300; seed++) {
    const selected = ['home','music','park','beach'];
    const exam = engine.buildFullExam({ enabledSurveyIds: selected, includeIntro: false, rng: seeded(seed) });
    assert.deepEqual(exam.items.map((i) => i.slot), [2,3,4,5,6,7,8,9,10,11,12,13,14,15]);
    for (const item of exam.items) {
      assert.ok(selected.includes(item.topicId) || surpriseIds.includes(item.topicId), `slot ${item.slot}: ${item.topicId}`);
    }
  }
  // 최소 개수만 골라도 세 개의 배경 설문 구간을 모두 채운다.
  for (const trio of [['home','music','beach'], ['park','staycation','gym'], ['home','park','overseas']]) {
    for (let seed = 0; seed < 100; seed++) {
      const exam = engine.buildFullExam({ enabledSurveyIds: trio, rng: seeded(seed) });
      const surveyTopics = FULL_EXAM_GROUPS.map((group) => groupItems(exam, group)[0].topicId).filter((id) => trio.includes(id));
      assert.deepEqual([...surveyTopics].sort(), [...trio].sort());
    }
  }
});

test('walking, concert and jogging never appear in the full exam even when selected', () => {
  assert.deepEqual(engine.drawableSurveyTopics.map((t) => t.id), bank.DEFAULT_SURVEY_IDS.filter((id) => !EXCLUDED.includes(id)));
  // 제외 주제만 남으면 세트를 만들 주제가 모자라 모의고사를 만들지 않는다.
  assert.throws(() => engine.buildFullExam({ enabledSurveyIds: [...EXCLUDED, 'home', 'music'] }), /3개 이상/);
  for (let seed = 0; seed < 300; seed++) {
    const exam = engine.buildFullExam({ enabledSurveyIds: [...EXCLUDED, 'home', 'music', 'park', 'beach'], rng: seeded(seed) });
    assert.ok(exam.items.every((i) => !EXCLUDED.includes(i.topicId)));
  }
  // 주제별 연습에는 그대로 남는다.
  for (const id of EXCLUDED) {
    assert.equal(engine.buildPracticeExam(bank.surveyTopicById.get(id), seeded(1)).focusTopicId, id);
  }
});

test('every surprise topic can fill a general set, only comparison-issue topics reach 14-15, and slot numbers are shown', () => {
  const surpriseById = new Map(data.surpriseTopics.map((t) => [t.id, t]));
  const general = new Set();
  const advanced = new Set();
  const drawnSets = new Map();
  for (let seed = 0; seed < 1500; seed++) {
    const exam = engine.buildFullExam({ rng: seeded(seed) });
    for (const group of FULL_EXAM_GROUPS) {
      const items = groupItems(exam, group);
      if (!surpriseById.has(items[0].topicId)) continue;
      (group.types.includes('comparison') ? advanced : general).add(items[0].topicId);
      if (!group.types.includes('comparison')) {
        const drawn = drawnSets.get(items[0].topicId) ?? new Set();
        drawn.add(items.map((i) => i.question.number).join('·'));
        drawnSets.set(items[0].topicId, drawn);
      }
      assert.deepEqual(items.map((i) => engine.itemNumber(exam.mode, i)), group.slots.map(String));
    }
  }
  // 일반 구간은 돌발 7개 주제가 모두 채우고, 어드밴스 구간은 비교와 이슈를 함께 가진 주제만 채운다.
  assert.deepEqual([...general].sort(), data.surpriseTopics.map((t) => t.id).sort());
  assert.deepEqual([...advanced].sort(), data.surpriseTopics
    .filter((t) => t.questions.some((q) => q.type === 'comparison') && t.questions.some((q) => q.type === 'issue'))
    .map((t) => t.id).sort());

  // 1번은 늘 나오지만 나머지 두 문항은 자료 순서를 지키며 조합이 달라진다.
  for (const [topicId, drawn] of drawnSets) {
    const topic = surpriseById.get(topicId);
    const expected = engine.completeQuestionSets(topic).map((set) => set.map((q) => q.number).join('·'));
    assert.deepEqual([...drawn].sort(), [...expected].sort(), topicId);
    assert.ok([...drawn].every((set) => set.startsWith(`${topic.questions[0].number}·`)), topicId);
  }
  assert.ok([...drawnSets.values()].some((drawn) => drawn.size > 1), '자료가 허용하면 조합이 하나로 굳지 않는다');

  const practice = engine.buildPracticeExam(data.topicById.get('recycling'));
  assert.deepEqual(practice.items.map((i) => engine.itemNumber(practice.mode, i)), ['1', '2', '3', '4', '5-A', '5-B', '6']);
});

const randomSetTypes = [
  ['description', 'routine', 'experience'],
  ['description', 'experience', 'memorable'],
  ['roleplay_ask', 'roleplay_problem', 'roleplay_experience'],
  ['comparison', 'issue'],
];

test('1-topic random practice reaches all four set types and keeps each set on one topic', () => {
  const drawable = data.allTopics.filter((t) => !EXCLUDED.includes(t.id));
  const seen = new Map(drawable.map((topic) => [topic.id, new Set()]));
  for (let index = 0; index < drawable.length; index++) {
    for (let variant = 0; variant < 12; variant++) {
      const rest = seeded(index * 12 + variant);
      const draws = [(index + 0.5) / drawable.length, ((variant % 4) + 0.5) / 4];
      const exam = engine.buildRandomPractice('set', 'all', () => draws.length ? draws.shift() : rest());
      const topic = drawable[index];
      const types = exam.items.map((i) => i.question.type);
      seen.get(topic.id).add(types.join());
      assert.equal(exam.focusTopicId, topic.id);
      assert.equal(exam.mode, 'set');
      const slots = types[0] === 'comparison' ? [1, 2] : [1, 2, 3];
      assert.deepEqual(exam.items.map((i) => i.slot), slots);
      assert.deepEqual(exam.items.map((i) => engine.itemNumber(exam.mode, i)), slots.map(String));
      assert.ok(exam.items.every((i) => i.topicId === topic.id));
      assert.equal(new Set(ids(exam.items)).size, slots.length);
      assert.equal(new Set(exam.items.map((i) => i.comboLabel)).size, 1);
      exam.items.forEach((item, position) => {
        assert.ok(topic.questions.includes(item.question));
        for (const dependency of item.question.dependsOn ?? []) {
          assert.ok(ids(exam.items.slice(0, position)).includes(dependency), item.question.id);
        }
        if (topic.category === 'survey' && topic.questions.some((q) => q.type === item.question.type && q.source === 'verified')) {
          assert.equal(item.question.source, 'verified');
        }
      });
      if (topic.category === 'survey') {
        const patternIndex = randomSetTypes.findIndex((pattern) => pattern.join() === types.join());
        assert.equal(patternIndex, variant % 4);
        assert.match(exam.items[0].comboLabel, [/2~4번형/, /5~7·8~10번형/, /11~13번형/, /14~15번형/][patternIndex]);
      } else if (!randomSetTypes.some((pattern) => pattern.join() === types.join())) {
        assert.match(exam.items[0].comboLabel, /돌발 연결 세트/);
        assert.equal(exam.items[0].question.id, topic.questions[0].id);
        const order = exam.items.map((i) => topic.questions.indexOf(i.question));
        assert.deepEqual(order, [...order].sort((a, b) => a - b));
        assert.ok(types.every((type) => !['comparison', 'issue'].includes(type)));
      }
    }
  }
  for (const topic of engine.drawableSurveyTopics) {
    assert.deepEqual([...seen.get(topic.id)].sort(), randomSetTypes.map((types) => types.join()).sort());
  }
  for (const topic of data.surpriseTopics) {
    assert.ok(seen.get(topic.id).size > 0, topic.id);
    const hasAdvanced = topic.questions.some((q) => q.type === 'comparison') && topic.questions.some((q) => q.type === 'issue');
    assert.equal(seen.get(topic.id).has('comparison,issue'), hasAdvanced, topic.id);
  }
});

test('random surprise experience sets put past experience before memorable experience', () => {
  const topic = data.topicById.get('recycling');
  const draws = [0, 0.5, 0];
  const exam = engine.buildTopicSet([topic], () => draws.shift());
  assert.deepEqual(exam.items.map((i) => i.question.type), randomSetTypes[1]);
  assert.deepEqual(ids(exam.items), ['recycling-q1', 'recycling-q4', 'recycling-q3']);
  // 연습용 추첨이 원본 문제은행의 자료 순서를 바꾸지 않는다.
  assert.deepEqual(topic.questions.map((q) => q.number), ['1', '2', '3', '4', '5-A', '5-B', '6']);
});

test('random roleplay chooses a complete connected scenario even with multiple questions per type', () => {
  const home = data.topicById.get('home');
  const questions = home.questions.filter((q) => q.type.startsWith('roleplay_'));
  const alternativeAsk = { ...questions[0], id: 'another-scenario', source: 'verified' };
  const topic = { ...home, questions: [alternativeAsk, ...questions.map((q) => ({ ...q, source: 'adapted' }))] };
  for (const value of [0, 0.5, 0.999]) {
    const exam = engine.buildTopicSet([topic], () => value);
    assert.deepEqual(ids(exam.items), questions.map((q) => q.id));
  }
  assert.throws(() => engine.buildTopicSet([{ ...topic, questions: [alternativeAsk, ...questions.slice(1)] }]), /문항이 부족/);
  assert.throws(() => engine.buildTopicSet([{ ...home, questions: [] }]), /문항이 부족/);
  assert.throws(() => engine.buildTopicSet([]));
});

test('random practice draws only from the chosen scope and records it on the exam', () => {
  const categoryOf = (id) => data.topicById.get(id).category;
  for (const mode of ['single', 'set']) {
    for (let seed = 0; seed < 300; seed++) {
      const survey = engine.buildRandomPractice(mode, 'survey', seeded(seed));
      assert.equal(survey.mode, mode);
      assert.equal(survey.randomScope, 'survey');
      assert.ok(survey.items.every((i) => categoryOf(i.topicId) === 'survey'));
      const surprise = engine.buildRandomPractice(mode, 'surprise', seeded(seed));
      assert.equal(surprise.randomScope, 'surprise');
      assert.ok(surprise.items.every((i) => categoryOf(i.topicId) === 'surprise'));
    }
    const all = engine.buildRandomPractice(mode, 'all', seeded(1));
    assert.equal(all.randomScope, 'all');
  }
  // 걷기·콘서트·조깅은 모의고사처럼 어느 범위의 랜덤 연습에도 나오지 않는다.
  for (const [scope, topics] of Object.entries(engine.RANDOM_SCOPE_TOPICS)) {
    assert.ok(topics.length > 0, scope);
    assert.ok(topics.every((t) => !EXCLUDED.includes(t.id)), scope);
  }
  for (let seed = 0; seed < 500; seed++) {
    for (const mode of ['single', 'set']) {
      for (const scope of ['all', 'survey']) {
        const exam = engine.buildRandomPractice(mode, scope, seeded(seed));
        assert.ok(exam.items.every((i) => !EXCLUDED.includes(i.topicId)), `${mode}/${scope}: ${exam.items[0].topicId}`);
      }
    }
  }
  assert.equal(engine.parseRandomScope('survey'), 'survey');
  assert.equal(engine.parseRandomScope('surprise'), 'surprise');
  for (const value of [null, undefined, '', 'all', 'SURVEY', 'roleplay']) assert.equal(engine.parseRandomScope(value), 'all');
});

test('single question mode reaches only eligible verified or provided survey questions', () => {
  const allowed = new Set(bank.surveyTopics.flatMap((t) => t.questions.filter((q) =>
    (q.source === 'verified' || q.source === 'provided') && !q.dependsOn?.length).map((q) => q.id)));
  for (let seed = 0; seed < 500; seed++) {
    const exam = engine.buildSingleQuestion(bank.surveyTopics, seeded(seed));
    assert.equal(exam.items.length, 1);
    assert.ok(allowed.has(exam.items[0].question.id));
    assert.ok(['verified', 'provided'].includes(exam.items[0].question.source));
  }
  assert.throws(() => engine.buildSingleQuestion([]));
});


test('common selection honors arbitrary declared sets and rejects cross-set dependencies', () => {
  const types = ['roleplay_ask', 'roleplay_problem', 'roleplay_experience'];
  const questions = ['a','b'].flatMap(prefix => types.map((type, index) => ({
    id: `${prefix}${index}`, type, source: 'provided', en: 'fixture', ko: 'fixture',
    dependsOn: index ? [`${prefix}${index - 1}`] : [],
  })));
  const topic = { id: 'arbitrary', category: 'survey', questions,
    fixedPracticeSets: ['a','b'].map(prefix => ({ label: prefix,
      items: types.map((_, i) => ({ slot: i + 1, questionId: `${prefix}${i}` })),
    })),
  };
  assert.deepEqual(engine.completeQuestionSets(topic, types).map(set => set.map(q => q.id)),
    [['a0','a1','a2'], ['b0','b1','b2']]);
  topic.fixedPracticeSets[0].items[1].questionId = 'b1';
  assert.deepEqual(engine.completeQuestionSets(topic, types).map(set => set.map(q => q.id)), [['b0','b1','b2']]);
  // Legacy dependency-linked questions also form complete chains before selection.
  delete topic.fixedPracticeSets;
  assert.deepEqual(engine.completeQuestionSets(topic, types).map(set => set.map(q => q.id)),
    [['a0','a1','a2'], ['b0','b1','b2']]);
});

test('unique-topic assignment backtracks for scarce eligible sets and rejects impossible exams', () => {
  const topics = ['home','music','beach','shopping'].map(id => bank.surveyTopicById.get(id));
  const previous = topics.map(t => t.fixedPracticeSets);
  const patterns = [
    ['description','routine','experience'],
    ['description','experience','memorable'],
    ['roleplay_ask','roleplay_problem','roleplay_experience'],
    ['comparison','issue'],
  ];
  const group = (topic, pattern) => ({ label: 'fixture', items: pattern.map((type, i) => ({
    slot: i + 1, questionId: topic.questions.find(q => q.type === type).id,
  })) });
  try {
    // First topic can fill every group; later topics can fill only one each and none can fill advanced.
    topics.forEach((topic, i) => {
      topic.fixedPracticeSets = (i === 0 ? patterns : [patterns[i - 1]]).map(pattern => group(topic, pattern));
    });
    const ours = new Set(topics.map(t => t.id));
    for (let seed = 0; seed < 200; seed++) {
      const exam = engine.buildFullExam({ enabledSurveyIds: topics.map(t => t.id), rng: seeded(seed) });
      const chosen = FULL_EXAM_GROUPS.map(g => ({ slots: g.slots, topicId: groupItems(exam, g)[0].topicId }));
      const survey = chosen.filter(g => ours.has(g.topicId));
      assert.equal(survey.length, FULL_EXAM_GROUPS.length - engine.FULL_EXAM_SURPRISE_GROUPS);
      assert.equal(new Set(survey.map(g => g.topicId)).size, survey.length);
      // 어드밴스 구간이 배경 설문이면 그 세트를 가진 유일한 주제여야 하므로 앞 구간이 물러나야 한다.
      const advanced = chosen.find(g => g.slots[0] === 14);
      if (ours.has(advanced.topicId)) assert.equal(advanced.topicId, 'home');
    }
    // 어느 주제도 2~4번형 말고는 채우지 못하면 배경 설문 세 구간을 만들 수 없다.
    topics.forEach(topic => { topic.fixedPracticeSets = [group(topic, patterns[0])]; });
    assert.throws(() => engine.buildFullExam({ enabledSurveyIds: topics.map(t => t.id), rng: () => 0 }), /완성된 세트/);
  } finally {
    topics.forEach((topic, i) => {
      if (previous[i] === undefined) delete topic.fixedPracticeSets;
      else topic.fixedPracticeSets = previous[i];
    });
  }
});
