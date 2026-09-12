const test = require('node:test');
const assert = require('node:assert/strict');
const {
  splitForReading, countReadWords, markReadWords, coverageRatio, READ_COVERAGE_PASS,
} = require('../.test-build/lib/readAloud');

/** 받아쓰기가 읽을 글을 얼마나 따라왔는지. 화면이 진행 막대에 쓰는 값과 같다. */
const coverage = (target, heard) => coverageRatio(markReadWords(target, heard));
/** 표시된 낱말의 자리만 뽑는다. 어디를 읽은 것으로 봤는지 그대로 보려고 쓴다. */
const markedAt = (marks) => marks.flatMap((mark, index) => (mark ? [index] : []));

test('낱말과 그 사이를 번갈아 쪼개고 한 글자도 잃지 않는다', () => {
  const text = "What's really nice is that it clears my head — every day.";
  const tokens = splitForReading(text);
  assert.equal(tokens.map((t) => t.text).join(''), text);
  assert.equal(tokens[0].text, "What's");
  assert.ok(tokens[0].word);
  assert.ok(!tokens[1].word);
});

test('낱말 수는 문장부호를 세지 않는다', () => {
  assert.equal(countReadWords('I go jogging, and then I run.'), 7);
  assert.equal(countReadWords('   '), 0);
  assert.equal(countReadWords(''), 0);
});

/* ── 읽었는지 확인하기 ───────────────────────────────────────────── */

/*
 * 읽을 글의 낱말 자리:
 * I(0) go(1) jogging(2) about(3) three(4) times(5) a(6) week(7)
 * usually(8) in(9) the(10) morning(11) before(12) work(13)
 */
const TARGET = 'I go jogging about three times a week, usually in the morning before work.';

test('그대로 읽으면 전부 따라온 것으로 본다', () => {
  assert.equal(coverage(TARGET, TARGET), 1);
  // 대소문자와 문장부호는 보지 않는다.
  assert.equal(coverage(TARGET, 'i go jogging about three times a week usually in the morning before work'), 1);
});

test('건너뛴 만큼 커버리지가 내려간다', () => {
  const half = 'I go jogging about three times a week';
  const value = coverage(TARGET, half);
  assert.ok(value > 0.5 && value < 0.7, `got ${value}`);
});

test('받아쓰기가 끼워 넣은 엉뚱한 말은 점수를 올리지 않는다', () => {
  const noisy = 'I go jogging about three times a week usually in the morning before work um yeah okay so anyway';
  assert.equal(coverage(TARGET, noisy), 1);
  assert.ok(coverage(TARGET, 'completely different words here') < 0.3);
});

test('아무 말도 안 들리면 0이다', () => {
  assert.equal(coverage(TARGET, ''), 0);
  assert.equal(coverage(TARGET, '   '), 0);
  assert.equal(coverage('', 'anything'), 0);
});

test('순서가 뒤집힌 말은 그만큼만 센다', () => {
  // 뒤에서부터 읽으면 낱말이 이어지는 자리가 없어 읽은 것으로 보지 않는다.
  const reversed = TARGET.split(' ').reverse().join(' ');
  assert.ok(coverage(TARGET, reversed) < READ_COVERAGE_PASS);
});

/* ── 실제로 읽을 때 일어나는 일 ──────────────────────────────────── */

test('이어진 낱말이 둘부터 읽은 것으로 본다', () => {
  // 한 낱말만 맞은 것은 읽은 증거가 아니다.
  assert.equal(coverage(TARGET, 'jogging'), 0);
  assert.deepEqual(markedAt(markReadWords(TARGET, 'go jogging')), [1, 2]);
});

test('흩어져 하나씩 맞는 낱말은 커버리지를 올리지 않는다', () => {
  // 읽을 글에 있는 낱말이지만 읽을 때의 순서로 이어지지 않는다.
  assert.equal(coverage(TARGET, 'I a the'), 0);
  assert.equal(coverage(TARGET, 'work jogging in'), 0);
});

test('같은 대목을 두 번 읽어도 손해가 없다', () => {
  assert.equal(coverage(TARGET, `${TARGET} ${TARGET}`), 1);
  // 앞에서 한 번 더듬고 다시 이어 읽은 경우
  const stumble = 'I go jogging I go jogging about three times a week usually in the morning before work';
  assert.equal(coverage(TARGET, stumble), 1);
});

test('되돌아가 읽어도 읽은 만큼 센다', () => {
  // 가운데를 읽다가 앞으로 되돌아갔다가 끝을 읽는다. 순서를 지킨 최장 부분열만
  // 세면 되돌아간 쪽을 통째로 잃어 통과선(0.7) 아래로 떨어진다.
  const middle = 'times a week usually in';
  const head = 'I go jogging about three';
  const tail = 'the morning before work';
  assert.equal(coverage(TARGET, `${middle} ${head} ${tail}`), 1);
});

/*
 * 되풀이되는 구가 있는 글. `the beach` 가 세 곳에 나온다.
 * I(0) like(1) the(2) beach(3) near(4) my(5) home(6)
 * We(7) walk(8) along(9) the(10) beach(11) every(12) evening(13)
 * and(14) we(15) eat(16) near(17) the(18) beach(19)
 */
const REPEATED = 'I like the beach near my home. We walk along the beach every evening, and we eat near the beach.';

test('한 번 말한 구는 한 자리만 켠다', () => {
  // 겹치는 자리를 모두 켜면 두 낱말을 말해 여섯 낱말을 읽은 것이 된다.
  assert.deepEqual(markedAt(markReadWords(REPEATED, 'the beach')), [2, 3]);
  assert.equal(coverage(REPEATED, 'the beach'), 2 / 20);
});

test('같은 구를 두 번 말하면 두 자리가 켜진다', () => {
  // 말한 만큼만 늘어난다. 켜는 자리는 읽던 자리에서 가까운 쪽부터다.
  assert.deepEqual(markedAt(markReadWords(REPEATED, 'the beach the beach')), [2, 3, 10, 11]);
});

test('이어진 구간이 긴 자리를 고른다', () => {
  // `the beach` 만 보면 세 곳이 똑같다. 앞뒤로 더 이어지는 자리가 실제로 읽은 자리다.
  assert.deepEqual(markedAt(markReadWords(REPEATED, 'along the beach')), [9, 10, 11]);
  assert.deepEqual(markedAt(markReadWords(REPEATED, 'we eat near the beach')), [15, 16, 17, 18, 19]);
});

test('켜진 낱말은 말한 낱말 수를 넘지 못한다', () => {
  /*
   * 부풀림이 없다는 것을 글 전체에서 확인한다. 이 규칙이 깨지면 글의 절반만 읽고도
   * 통과선을 넘는다.
   */
  const words = splitForReading(REPEATED).filter((t) => t.word).map((t) => t.text);
  for (let at = 0; at < words.length; at++) {
    for (const length of [2, 3, 5, 8]) {
      const heard = words.slice(at, at + length).join(' ');
      const said = countReadWords(heard);
      if (said === 0) continue;
      const covered = markReadWords(REPEATED, heard).filter(Boolean).length;
      assert.ok(covered <= said, `"${heard}" → 말한 ${said}, 켜진 ${covered}`);
    }
  }
});

test('되풀이되는 구가 있어도 다 읽으면 전부 따라온 것으로 본다', () => {
  assert.equal(coverage(REPEATED, REPEATED), 1);
  // 읽은 비율과 커버리지가 어긋나지 않는다.
  const words = splitForReading(REPEATED).filter((t) => t.word).map((t) => t.text);
  const half = words.slice(0, 10).join(' ');
  assert.equal(coverage(REPEATED, half), 0.5);
});

test('표시는 읽을 글의 낱말 자리를 그대로 따른다', () => {
  const marks = markReadWords(TARGET, 'usually in the morning');
  assert.equal(marks.length, countReadWords(TARGET));
  assert.deepEqual(markedAt(marks), [8, 9, 10, 11]);
});

test('앞의 표시를 넘기면 인식이 흔들려도 지워지지 않는다', () => {
  const first = markReadWords(TARGET, 'I go jogging about three');
  assert.deepEqual(markedAt(first), [0, 1, 2, 3, 4]);
  // 임시 문장은 확정되기 전까지 통째로 다시 쓰인다.
  assert.deepEqual(markReadWords(TARGET, 'uh', first), first);
  const rest = markReadWords(TARGET, 'times a week usually in the morning before work', first);
  assert.equal(coverageRatio(rest), 1);
});

test('넘어온 표시가 읽을 글보다 길어도 자리에 맞춰 자른다', () => {
  assert.equal(markReadWords('go jogging', '', [true, true, true, true]).length, 2);
  assert.deepEqual(markReadWords('go jogging', '', [true]), [true, false]);
});

test('커버리지 비율은 표시한 낱말의 몫이다', () => {
  assert.equal(coverageRatio([]), 0);
  assert.equal(coverageRatio([false, false]), 0);
  assert.equal(coverageRatio([true, false, true, false]), 0.5);
  assert.equal(coverageRatio([true, true]), 1);
});
