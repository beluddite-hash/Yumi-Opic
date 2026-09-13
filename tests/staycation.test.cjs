const test = require('node:test');
const assert = require('node:assert/strict');
const { surveyTopicById } = require('../.test-build/data/survey-bank');
const { buildPracticeExam } = require('../.test-build/lib/exam');
const { questionAudioUrl } = require('../.test-build/lib/questionAudio');

const expected = [
  [
    2,
    "You indicated that you take vacations at home. Who are the people you would like to see and spend time with on your vacation?"
  ],
  [
    3,
    "Describe some of the things that you would like to do with people you visit or see during your vacation."
  ],
  [
    4,
    "Describe exactly what you did during the last vacation that you spent at home. Give me a description of what you did from the first to the last day. Talk about all the people you saw and everything that you did."
  ],
  [
    5,
    "You indicated that you take vacations at home. Who are the people you would like to see and spend time with on your vacation?"
  ],
  [
    6,
    "Describe exactly what you did during the last vacation that you spent at home. Give me a description of what you did from the first to the last day. Talk about all the people you saw and everything that you did."
  ],
  [
    7,
    "Could you tell me about an unusual or unexpected experience you had during a vacation you had at home? What happened? Who was involved? And why was this experience so memorable?"
  ],
  [
    8,
    "You indicated that you take vacations at home. Who are the people you would like to see and spend time with on your vacation?"
  ],
  [
    9,
    "Describe exactly what you did during the last vacation that you spent at home. Give me a description of what you did from the first to the last day. Talk about all the people you saw and everything that you did."
  ],
  [
    10,
    "Could you tell me about an unusual or unexpected experience you had during a vacation you had at home? What happened? Who was involved? And why was this experience so memorable?"
  ],
  [
    11,
    "I'd like to give you a situation and ask you to act it out. You want to get two tickets to see a performance during your vacation. Call the box office and ask three or four questions to get tickets."
  ],
  [
    12,
    "I'm sorry, but there is a problem that I need you to resolve. On the day of the performance, you are very sick. Call your friend, explain the situation, and offer two different options to resolve the situation."
  ],
  [
    13,
    "That's the end of the situation. Have you ever bought concert tickets or made plans for a trip, or made plans for other things, but had to cancel at the last minute because you could not make it? When was it? What exactly happened? Tell me everything that you did to resolve the situation"
  ],
  [
    14,
    "You indicated in the survey that you stay at home for vacations. How do most people spend their vacation in your country? How does that compare to the way people spent their vacation when they were growing up? Are they doing things differently? How have things changed and why have things changed? Please, take a minute to discuss this topic."
  ],
  [
    15,
    "Experts state that vacations are important for every individual. Take a minute and report for me the important benefits of vacation time to a person's health, relationships, and personal growth."
  ]
];

test('staycation preserves the supplied wording, fixed slots and combo boundaries without random draws', () => {
  const topic = surveyTopicById.get('staycation');
  const exam = buildPracticeExam(topic, () => { throw new Error('Fixed practice must not draw randomly'); });
  assert.equal(topic.questions.length, 14);
  assert.deepEqual(exam.items.map(({ slot, question }) => [slot, question.en]), expected);
  assert.deepEqual(exam.items.map((item) => item.comboLabel), [
    'Q2–Q4', 'Q2–Q4', 'Q2–Q4', 'Q5–Q7', 'Q5–Q7', 'Q5–Q7',
    'Q8–Q10', 'Q8–Q10', 'Q8–Q10', 'Q11–Q13', 'Q11–Q13', 'Q11–Q13', 'Q14–Q15', 'Q14–Q15',
  ]);
  for (const [index, item] of exam.items.entries()) {
    assert.equal(item.topicId, 'staycation');
    assert.doesNotMatch(item.question.en, /^Q\d+[.\s]/);
    for (const id of item.question.dependsOn ?? []) {
      assert.ok(exam.items.slice(0, index).some((earlier) => earlier.question.id === id));
    }
  }
});

test('new staycation prompts cannot select the old recordings', () => {
  for (const q of surveyTopicById.get('staycation').questions) {
    assert.match(q.id, /^staycation-q\d+$/);
    const url = questionAudioUrl(q.id);
    assert.ok(url === null || url.startsWith('/audio/' + q.id + '.mp3?'));
  }
});

test('staycation rejects a missing fixed prompt', () => {
  const topic = surveyTopicById.get('staycation');
  assert.throws(() => buildPracticeExam({ ...topic, questions: topic.questions.slice(1) }), /문항이 부족/);
});
