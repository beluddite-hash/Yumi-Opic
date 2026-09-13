const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { buildPracticeExam } = require('../.test-build/lib/exam');
const { surveyTopicById } = require('../.test-build/data/survey-bank');

const source = fs.readFileSync(path.join(__dirname, '../src/components/FixedPracticeNavigation.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const componentExports = {};
vm.runInNewContext(compiled, { exports: componentExports, require(name) {
  if (name === '@/lib/exam') return require('../.test-build/lib/exam');
  if (name === '@/lib/answers') return require('../.test-build/lib/answers');
  return require(name);
} });
const Navigation = componentExports.default;
const children = element => React.Children.toArray(element.props.children);
const buttons = element => element.type === 'button' ? [element]
  : children(element).filter(React.isValidElement).flatMap(buttons);

function fixture() {
  const topic = { id: 'navigation-fixture', category: 'survey', ko: '테스트', en: 'Fixture', emoji: '', questions: [], fixedPracticeSets: [] };
  let slot = 0;
  for (const numbers of [[2,3,4], [5,6,7], [8,9,10], [11,12,13], [11,12,13], [14,15], [14,15]]) {
    topic.fixedPracticeSets.push({ label: numbers.join('·'), items: numbers.map(number => {
      const questionId = `navigation-${++slot}`;
      topic.questions.push({ id: questionId, type: 'description', en: `Fixture ${slot}`, ko: `테스트 ${slot}` });
      return { slot, questionId, displayNumber: String(number) };
    }) });
  }
  return topic;
}

test('fixed navigation renders two explicit rows, preserving all seven separate sets', () => {
  const topic = fixture();
  const exam = buildPracticeExam(topic);
  const root = Navigation({ items: exam.items, sets: topic.fixedPracticeSets, currentSlot: 1, answers: {}, onSelect() {} });
  const rows = children(root);
  assert.equal(rows.length, 2);
  assert.deepEqual(buttons(rows[0]).map(b => b.props.children), ['2','3','4','5','6','7','8','9','10']);
  assert.deepEqual(buttons(rows[1]).map(b => b.props.children), ['11','12','13','11','12','13','14','15','14','15']);
  assert.deepEqual(rows.map(row => children(children(row)[0]).length), [3, 4]);
  for (const row of rows) {
    assert.match(row.props.className, /overflow-x-auto/);
    assert.match(row.props.className, /max-w-full/);
    assert.match(children(row)[0].props.className, /gap-4/);
    for (const group of children(children(row)[0])) assert.match(group.props.className, /gap-1/);
  }
});

test('repeated display numbers select distinct indices and have independent active/answered states', () => {
  const topic = fixture();
  const exam = buildPracticeExam(topic);
  const selected = [];
  const root = Navigation({ items: exam.items, sets: topic.fixedPracticeSets, currentSlot: 13,
    answers: { 10: 'First Q11 answer' }, onSelect: index => selected.push(index) });
  const all = buttons(root);
  all.forEach(button => button.props.onClick());
  assert.deepEqual(selected, Array.from({ length: 19 }, (_, i) => i));
  assert.equal(new Set(all.map(button => button.key)).size, 19);
  const [first, second] = all.filter(button => button.props.children === '11');
  assert.match(first.props.className, /exam-slot-done/);
  assert.equal(first.props['aria-current'], undefined);
  assert.match(second.props.className, /border-exam-slot-active bg-exam-slot-active text-exam-slot-active-fg/);
  assert.equal(second.props['aria-current'], 'step');
  assert.notEqual(first.props['aria-label'], second.props['aria-label']);
});

test('staycation retains its fourteen numbers, active styling and navigation targets', () => {
  const topic = surveyTopicById.get('staycation');
  const exam = buildPracticeExam(topic);
  const selected = [];
  const root = Navigation({ items: exam.items, sets: topic.fixedPracticeSets, currentSlot: 11, answers: {}, onSelect: i => selected.push(i) });
  const rows = children(root);
  assert.deepEqual(buttons(rows[0]).map(b => b.props.children), ['2','3','4','5','6','7','8','9','10']);
  assert.deepEqual(buttons(rows[1]).map(b => b.props.children), ['11','12','13','14','15']);
  const all = buttons(root);
  all.forEach(button => button.props.onClick());
  assert.deepEqual(selected, Array.from({ length: 14 }, (_, i) => i));
  assert.equal(all.filter(b => b.props['aria-current'] === 'step').length, 1);
  assert.match(all[9].props.className, /border-exam-slot-active bg-exam-slot-active text-exam-slot-active-fg/);
});
