const test = require('node:test');
const assert = require('node:assert/strict');
const fixture = require('./fixtures/survey-batch-questions.json');
const { surveyTopicById } = require('../.test-build/data/survey-bank');
const { buildPracticeExam, buildFullExam, buildTopicSet, buildSingleQuestion, itemNumber } = require('../.test-build/lib/exam');
const { questionAudioUrl } = require('../.test-build/lib/questionAudio');
function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}
for (const [id, sets] of Object.entries(fixture)) {
  test(id + ': exact supplied wording, unique slots and intact fixed sets', () => {
    const topic = surveyTopicById.get(id);
    const expected = sets.flatMap(s => s.questions);
    const counts = { beach: [23, 8], overseas: [17, 6], gym: [14, 5] };
    assert.deepEqual([topic.questions.length, topic.fixedPracticeSets.length], counts[id]);
    const practice = buildPracticeExam(topic, () => { throw Error('Unexpected random draw'); });
    assert.equal(topic.questions.length, expected.length);
    assert.equal(new Set(topic.questions.map(q => q.id)).size, expected.length);
    assert.deepEqual(practice.items.map(i => i.slot), Array.from({ length: expected.length }, (_, i) => i + 1));
    assert.deepEqual(practice.items.map(i => itemNumber('practice', i)), expected.map(q => q.displayNumber));
    assert.deepEqual(practice.items.map(i => i.question.en), expected.map(q => q.en));
    assert.deepEqual(practice.items.map(i => i.question.id), expected.map(q => q.id));
    assert.deepEqual(topic.fixedPracticeSets.map(s => s.label), sets.map(s => s.label));
    assert.deepEqual(topic.fixedPracticeSets.map(s => s.items.length), sets.map(s => s.questions.length));
    for (const q of topic.questions) {
      assert.equal(q.source, 'provided');
      assert.ok(q.ko.length > 0);
      const { createHash } = require('node:crypto');
      const fs = require('node:fs');
      const path = require('node:path');
      const manifest = require('../src/data/audio-manifest.json');
      const seed = JSON.stringify([q.en.trim(), manifest.model, manifest.voice,
        /^gpt-/.test(manifest.model) ? null : manifest.speed,
        /^gpt-/.test(manifest.model) ? manifest.instructions : null]);
      const hash = createHash('sha256').update(seed).digest('hex').slice(0, 12);
      assert.equal(manifest.questions[q.id], hash);
      assert.equal(questionAudioUrl(q.id), '/audio/' + q.id + '.mp3?v=' + hash);
      const audio = fs.readFileSync(path.join(__dirname, '..', 'public/audio', q.id + '.mp3'));
      assert.ok(audio.length > 1000);
      assert.ok(audio.subarray(0, 3).toString() === 'ID3' ||
        (audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0));
    }
  });
  test(id + ': full and random practice select declared sets without mixing, and full topics never repeat', () => {
    const topic = surveyTopicById.get(id);
    const expected = sets.map(s => JSON.stringify(s.questions.map(q => q.id)));
    const fullReached = new Set(), randomReached = new Set();
    for (let seed = 0; seed < 700; seed++) {
      const exam = buildFullExam({ enabledSurveyIds: [id, 'home', 'music', 'park'], rng: seeded(seed) });
      const starts = [2,5,8,11,14];
      assert.equal(new Set(exam.items.filter(i => starts.includes(i.slot)).map(i => i.topicId)).size, 5);
      const selected = exam.items.filter(i => i.topicId === id);
      const fullIndex = expected.indexOf(JSON.stringify(selected.map(i => i.question.id)));
      assert.notEqual(fullIndex, -1);
      fullReached.add(fullIndex);
      const random = buildTopicSet([topic], seeded(seed));
      const randomIndex = expected.indexOf(JSON.stringify(random.items.map(i => i.question.id)));
      assert.notEqual(randomIndex, -1);
      randomReached.add(randomIndex);
    }
    assert.equal(fullReached.size, sets.length);
    assert.equal(randomReached.size, sets.length);
    const standalone = topic.questions.filter(q => !q.dependsOn?.length);
    standalone.forEach((q, i) => assert.equal(buildSingleQuestion([topic], () => (i + 0.5) / standalone.length).items[0].question.id, q.id));
  });
}


test('current banks match the latest original attachment without normalizing English or COMBO boundaries', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, 'fixtures/survey-latest-source.txt'), 'utf8');
  const supplied = {};
  let topicId;
  for (const line of source.split(/\r?\n/)) {
    const heading = line.match(/^([123])\. /);
    if (heading) {
      topicId = { 1: 'beach', 2: 'overseas', 3: 'gym' }[heading[1]];
      supplied[topicId] = [];
      continue;
    }
    if (/^(COMBO|ROLE-PLAY COMBO|ADVANCED? COMBO)( \d+)?$/.test(line)) {
      supplied[topicId].push({ label: line, questions: [] });
      continue;
    }
    const question = line.match(/^Q(\d+)\. (.*)$/);
    if (question) supplied[topicId].at(-1).questions.push({ number: question[1], en: question[2] });
  }
  assert.deepEqual(Object.keys(supplied), ['beach', 'overseas', 'gym']);
  for (const [id, groups] of Object.entries(supplied)) {
    const topic = surveyTopicById.get(id);
    const actual = topic.fixedPracticeSets.map(group => ({
      label: group.label,
      questions: group.items.map(item => ({
        number: item.displayNumber,
        en: topic.questions.find(q => q.id === item.questionId)?.en,
      })),
    }));
    assert.deepEqual(actual, groups, id);
    const references = topic.fixedPracticeSets.flatMap(group => group.items.map(i => i.questionId));
    assert.equal(new Set(references).size, references.length, id);
    assert.deepEqual([...references].sort(), topic.questions.map(q => q.id).sort(), id);
  }
});
