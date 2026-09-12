/**
 * 고친 답변을 따라 읽는 화면의 순수 로직.
 *
 * 결과 화면은 그냥 두면 읽을거리로 끝난다. 그래서 소리 내어 읽게 하되, 읽는 박자는
 * 사람이 만들고 화면은 받아쓰기가 따라온 낱말을 표시하는 일만 맡는다. 글을 낱말과 그
 * 사이로 쪼개는 일과, 받아쓰기가 어디까지 따라왔는지 세는 일이 여기에 있다.
 *
 * 브라우저 API 를 쓰지 않으므로 테스트에서 그대로 부를 수 있다.
 */


export interface ReadToken {
  text: string;
  /** 표시가 붙는 낱말인지. 띄어쓰기·문장부호는 앞말에 딸려 흐른다. */
  word: boolean;
}

const READ_TOKEN = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*|[^\p{L}\p{N}]+/gu;
const WORD_START = /^[\p{L}\p{N}]/u;

/**
 * 따라 읽기용으로 글을 낱말과 그 사이로 쪼갠다. 낱말이 아닌 것은 한 덩어리로 묶어
 * 표시를 붙일 조각 수를 줄인다.
 */
export function splitForReading(text: string): ReadToken[] {
  return (text.match(READ_TOKEN) ?? []).map((token) => ({ text: token, word: WORD_START.test(token) }));
}

/** 따라 읽을 낱말 수. */
export function countReadWords(text: string): number {
  return splitForReading(text).filter((token) => token.word).length;
}

/* ------------------------------------------------------------------ */
/* 읽었는지 확인하기                                                     */
/* ------------------------------------------------------------------ */

/**
 * 다 읽은 것으로 볼 커버리지.
 *
 * 브라우저 받아쓰기는 제대로 읽어도 곧잘 틀린다(그래서 이 앱에 녹음본 재전사가 있다).
 * 그래서 넉넉히 잡고, 못 넘겨도 막지 않는다. 판정이 아니라 신호다.
 */
export const READ_COVERAGE_PASS = 0.7;

/**
 * 통과선을 넘긴 뒤 새 낱말이 이만큼 붙지 않으면 마이크를 놓아 준다.
 *
 * 브라우저의 인식기는 사실상 하나뿐이라, 한 문항이 마이크를 쥔 채로 있으면 다음
 * 문항의 따라 읽기가 그 자리를 두고 다툰다. 그렇다고 통과선을 넘는 즉시 끊으면
 * 통과선이 0.7 이라 남은 대목을 마저 읽던 사람이 문장 중간에 끊긴다. 그래서 읽기를
 * 멈춘 것으로 보일 때까지 기다린다.
 *
 * 15초는 다음 문장을 고르며 쉬는 시간보다 길고, 다른 문항으로 내려가 단추를 누르는
 * 시간보다는 짧다.
 */
export const READ_IDLE_STOP_MS = 15_000;

/** 너무 긴 입력에서 화면이 멈추지 않게 하는 상한. */
const MAX_COVERAGE_WORDS = 1_200;

/**
 * 읽었다고 인정할 최소 연속 낱말 수.
 *
 * 흩어져 하나씩 맞는 낱말은 읽은 증거가 아니다. "I", "a", "the" 는 어디서나 맞아
 * 커버리지를 헛부풀린다. 사람이 소리 내어 읽으면 낱말이 이어져 나오므로 두 낱말부터
 * 센다. 받아쓰기가 만드는 중복을 걷어낼 때도 같은 이유로 두 낱말을 쓴다(`./transcript`).
 */
const MIN_RUN_WORDS = 2;

function coverageKeys(text: string): string[] {
  return splitForReading(text)
    .filter((token) => token.word)
    .map((token) => token.text.toLowerCase().replace(/’/g, "'"));
}

/**
 * 한 낱말이 글에 여러 번 나올 때 후보로 살펴볼 자리 수의 상한.
 *
 * 같은 낱말이 수없이 나오는 글에서 일이 불어나지 않게 한다. 보통 글에서 한 낱말이
 * 나오는 자리는 몇 곳뿐이라 이 상한에 닿지 않는다.
 */
const MAX_CANDIDATES = 64;

/** 낱말마다 그 낱말이 나오는 자리를 모아 둔다. */
function wordPlaces(words: readonly string[]): Map<string, number[]> {
  const places = new Map<string, number[]>();
  for (let i = 0; i < words.length; i++) {
    const at = places.get(words[i]);
    if (at) at.push(i);
    else places.set(words[i], [i]);
  }
  return places;
}

/**
 * 받아쓰기가 따라온 낱말을 읽을 글의 낱말마다 표시한다.
 *
 * 규칙은 둘이다.
 *
 *  1. 이어진 낱말이 `MIN_RUN_WORDS` 개 이상 그대로 겹치는 구간만 읽은 것으로 본다.
 *  2. **한 번 말한 낱말은 한 자리만 켠다.** 말한 쪽과 읽을 쪽을 짝지어 쓰고, 쓴
 *     자리는 다시 쓰지 않는다.
 *
 * 2번이 없으면 겹치는 자리를 모두 켜 버린다. `the beach` 를 한 번 말했는데 글 안의
 * `the beach` 세 곳이 함께 켜지고, 두 낱말을 말해 여섯 낱말을 읽은 것이 된다.
 * 되풀이되는 구가 흔한 답변에서 커버리지가 2~3배로 부풀어, 글의 절반만 읽고도
 * 통과선을 넘는다. 짝지어 쓰면 켜진 낱말 수가 말한 낱말 수를 넘지 못한다.
 *
 * 이 두 규칙이 실제로 읽을 때 일어나는 일을 함께 감당한다.
 *
 *  - 되풀이: 같은 대목을 두 번 읽으면 두 번째는 갈 자리가 없어 그냥 지나간다.
 *  - 되돌아가 읽기: 읽던 자리를 앞으로 되돌려도 그 대목이 따로 이어져 나오므로 잡힌다.
 *    순서를 지킨 최장 부분열만 세면 되돌아간 쪽을 통째로 잃는다.
 *  - 잘못 들어온 말: 받아쓰기가 끼워 넣은 엉뚱한 낱말은 이어지지 않아 세지 않는다.
 *  - 되풀이되는 구: 같은 구가 여러 곳에 있으면 읽던 자리에서 가까운 쪽을 켠다.
 *
 * `previous` 를 주면 거기에 더한다. 인식 중인 임시 문장은 확정되기 전까지 계속 고쳐
 * 쓰이므로, 한 번 표시한 낱말이 다음 결과에서 사라지지 않으려면 앞의 표시를 넘겨야
 * 한다. 넘어온 표시는 짝짓기가 끝난 뒤에 얹는다. 먼저 얹으면 그 자리가 찬 것으로
 * 보여 이번에 읽은 대목이 엉뚱한 자리로 밀린다.
 */
export function markReadWords(target: string, heard: string, previous?: readonly boolean[]): boolean[] {
  const a = coverageKeys(target).slice(0, MAX_COVERAGE_WORDS);
  // 받아쓰기는 읽는 동안 계속 길어진다. 넘칠 때 남길 쪽은 방금 읽은 끝이다.
  const b = coverageKeys(heard).slice(-MAX_COVERAGE_WORDS);

  // 표시가 곧 자리를 썼다는 표다. 켠 자리는 다음 말이 다시 쓰지 못한다.
  const marks = Array<boolean>(a.length).fill(false);
  const places = wordPlaces(a);
  /** 읽던 자리. 같은 구가 여러 곳에 있을 때 가까운 쪽을 고르는 데 쓴다. */
  let cursor = 0;

  let j = 0;
  while (j < b.length) {
    /*
     * 지금 말에서 시작하는 구간을 빈 자리마다 재어 보고 가장 긴 것을 고른다. 길수록
     * 그 자리를 읽었다는 근거가 세다. 길이가 같으면 읽던 자리에서 가까운 쪽이다.
     */
    let bestAt = -1;
    let bestRun = 0;
    let seen = 0;
    for (const at of places.get(b[j]) ?? []) {
      if (marks[at]) continue; // 앞의 말이 이미 쓴 자리
      if (++seen > MAX_CANDIDATES) break;
      let run = 0;
      while (
        at + run < a.length &&
        j + run < b.length &&
        a[at + run] === b[j + run] &&
        !marks[at + run]
      ) {
        run++;
      }
      if (run < MIN_RUN_WORDS) continue;
      if (run > bestRun || (run === bestRun && Math.abs(at - cursor) < Math.abs(bestAt - cursor))) {
        bestAt = at;
        bestRun = run;
      }
    }

    if (bestRun === 0) {
      j += 1; // 갈 자리가 없는 말이다. 흘려보낸다.
      continue;
    }
    for (let k = 0; k < bestRun; k++) marks[bestAt + k] = true;
    cursor = bestAt + bestRun;
    j += bestRun;
  }

  if (previous) {
    const carried = Math.min(a.length, previous.length);
    for (let i = 0; i < carried; i++) if (previous[i]) marks[i] = true;
  }
  return marks;
}

/** 표시한 낱말의 비율. 0~1. */
export function coverageRatio(marks: readonly boolean[]): number {
  if (marks.length === 0) return 0;
  let covered = 0;
  for (const mark of marks) if (mark) covered++;
  return covered / marks.length;
}
