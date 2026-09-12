const test = require('node:test');
const assert = require('node:assert/strict');
const { surveyTopicById } = require('../.test-build/data/survey-bank');
const { buildPracticeExam, buildTopicSet, itemNumber } = require('../.test-build/lib/exam');

function seeded(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const expectedSets = [
  {
    label: 'COMBO 1',
    numbers: ['2', '3', '4'],
    questions: [
      'You indicated in the survey that you listen to music. What kinds of music do you listen to? Who are some of your favorite musicians or composer?',
      'When and where do you usually listen to music? Do you listen to the radio? Do you go to concerts? Tell me about the different ways you enjoy music.',
      'When did you first become interested in music? What kinds of music did you like at first? Tell me about how your interest in music developed from your childhood until today.',
    ],
  },
  {
    label: 'COMBO 2',
    numbers: ['5', '6', '7'],
    questions: [
      'You indicated in the survey that you listen to music. What kinds of music do you listen to? Who are some of your favorite musicians or composer?',
      'When did you first become interested in music? What kinds of music did you like at first? Tell me about how your interest in music developed from your childhood until today.',
      'Could you think back to a particularly memorable time when you heard live music? When was it? Where were you? Who were you with? What happened that made that performance so memorable?',
    ],
  },
  {
    label: 'COMBO 3',
    numbers: ['8', '9', '10'],
    questions: [
      'You indicated in the survey that you listen to music. What kinds of music do you listen to? Who are some of your favorite musicians or composer?',
      'When did you first become interested in music? What kinds of music did you like at first? Tell me about how your interest in music developed from your childhood until today.',
      'Could you think back to a particularly memorable time when you heard live music? When was it? Where were you? Who were you with? What happened that made that performance so memorable?',
    ],
  },
  {
    label: 'ROLE-PLAY COMBO',
    numbers: ['11', '12', '13'],
    questions: [
      "I'd like to give you a situation and ask you to act it out. You want to buy an MP3 player. You have a friend who knows a lot about MP3 players. Call your friend and ask three or four questions to get information about buying an MP3 player.",
      "I'm sorry, but there's a problem that I need you to resolve. You have borrowed your friend's MP3 player, but broke it by accident. Call your friend, explain how you broke it and what the current condition is like, and then give two or three alternatives in order to get another working MP3 player for your friend.",
      "That's the end of the situation. Tell me about a time when a piece of equipment broke. What exactly happened, and how did you fix the problem? Tell me everything about that experience.",
    ],
  },
  {
    label: 'ADVANCED COMBO',
    numbers: ['14', '15'],
    questions: [
      'You indicated in the survey that you listen to music. Pick two different types of music or composers. Describe each in as much detail as possible. Compare the similarities and differences between them.',
      'What new electronic gadgets or equipment are people who like music interested in these days? What new products excite them and why?',
    ],
  },
];

test('MUSIC preserves the supplied 14 questions in five complete fixed COMBOs', () => {
  const topic = surveyTopicById.get('music');
  assert.ok(topic);
  assert.equal(topic.questions.length, 14);
  assert.equal(topic.fixedPracticeSets.length, 5);
  assert.deepEqual(topic.fixedPracticeSets.map((set) => set.label), expectedSets.map((set) => set.label));

  const practice = buildPracticeExam(topic, () => { throw new Error('fixed practice must not draw randomly'); });
  assert.deepEqual(practice.items.map((item) => item.slot), Array.from({ length: 14 }, (_, index) => index + 1));
  assert.equal(new Set(practice.items.map((item) => item.question.id)).size, 14);
  assert.deepEqual(practice.items.map((item) => itemNumber('practice', item)), expectedSets.flatMap((set) => set.numbers));
  assert.deepEqual(practice.items.map((item) => item.question.en), expectedSets.flatMap((set) => set.questions));
});

test('MUSIC random set practice selects only complete declared COMBOs', () => {
  const topic = surveyTopicById.get('music');
  const declared = topic.fixedPracticeSets.map((set) => set.items.map((item) => item.questionId).join(','));
  const reached = new Set();
  for (let seed = 0; seed < 200; seed += 1) {
    const exam = buildTopicSet([topic], seeded(seed));
    const selected = exam.items.map((item) => item.question.id).join(',');
    assert.ok(declared.includes(selected));
    reached.add(selected);
  }
  assert.equal(reached.size, declared.length);
});
