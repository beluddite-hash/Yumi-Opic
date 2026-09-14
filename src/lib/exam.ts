import type { Exam, ExamItem, FixedPracticeSet, Question, QuestionType, RandomScope, Topic } from "./types";
import { DEFAULT_SURVEY_IDS, SURVEY_BANK_VERSION, allTopics, introQuestion, surpriseTopics, surveyTopics } from "../data";

import { questionExposureKey, type ExamExposure } from "./examExposure";

export type RandomSource = () => number;

export const TYPE_LABELS: Record<QuestionType, string> = {
  intro: "자기소개 · 1번",
  description: "묘사 · 2·5·8번",
  routine: "습관 · 3번",
  experience: "경험 · 4·6·9번",
  memorable: "기억에 남는 경험 · 7·10번",
  comparison: "비교 · 14번",
  issue: "이슈 · 15번",
  roleplay_ask: "롤플레이 질문하기 · 11번",
  roleplay_problem: "롤플레이 문제 해결 · 12번",
  roleplay_experience: "롤플레이 관련 경험 · 13번",
};

export const EXAM_GROUPS = [
  { slots: [2, 5, 8], label: "묘사", note: "장소나 사람의 특징을 현재 시제로 안정적으로 설명합니다." },
  { slots: [3], label: "습관", note: "평소 언제, 누구와, 무엇을 하는지 자연스럽게 이어서 말합니다." },
  { slots: [4, 6, 9], label: "경험", note: "과거 시제를 중심으로 있었던 일을 시간 순서대로 풀어냅니다." },
  { slots: [7, 10], label: "기억에 남는 경험", note: "배경 → 사건 → 행동 → 결과와 감정 순서로 이야기합니다." },
  { slots: [11], label: "롤플레이 질문하기", note: "상황을 짧게 밝힌 뒤 필요한 정보를 3~4가지 질문합니다." },
  { slots: [12], label: "롤플레이 문제 해결", note: "문제 상황을 설명하고 해결책이나 대안을 2~3가지 제안합니다." },
  { slots: [13], label: "롤플레이 관련 경험", note: "11~12번과 이어지는 실제 경험을 배경 → 문제 → 해결 → 결과로 말합니다." },
  { slots: [14], label: "비교", note: "과거와 현재, 또는 두 대상의 공통점과 차이점을 짚습니다." },
  { slots: [15], label: "이슈", note: "요즘의 문제나 변화에 대해 내 의견을 근거와 함께 말합니다." },
] as const;

export function pickRandom<T>(items: readonly T[], rng: RandomSource = Math.random): T {
  if (!items.length) throw new Error("고를 수 있는 문제가 없습니다.");
  const r = rng();
  if (!Number.isFinite(r) || r < 0 || r >= 1) throw new RangeError("Random source must return a number in [0, 1).");
  return items[Math.floor(r * items.length)];
}

export function shuffle<T>(items: readonly T[], rng: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const r = rng();
    if (!Number.isFinite(r) || r < 0 || r >= 1) throw new RangeError("Invalid random source.");
    const j = Math.floor(r * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function singleCandidates(topic: Topic): Question[] {
  return topic.questions.filter((q) => !q.dependsOn?.length);
}

function questionOfType(topic: Topic, type: QuestionType, rng: RandomSource): Question {
  const typed = topic.questions.filter((q) => q.type === type);
  return pickRandom(typed, rng);
}

function item(slot: number, topic: Topic, question: Question, comboLabel: string): ExamItem {
  return {
    slot,
    topicId: topic.id,
    topicKo: topic.ko,
    topicEn: topic.en,
    emoji: topic.emoji,
    comboLabel,
    typeLabel: topic.category === "surprise" ? TYPE_LABELS[question.type].split(" · ")[0] : TYPE_LABELS[question.type],
    question,
  };
}

/**
 * 주제별 연습은 문항별 표시 번호, 자료 번호, 내부 slot 순으로 표시한다.
 * 모의고사와 랜덤 연습은 항상 기존 slot 번호를 표시한다.
 */
export function itemNumber(mode: Exam["mode"], entry: ExamItem): string {
  return mode === "practice" ? entry.displayNumber ?? entry.question.number ?? String(entry.slot) : String(entry.slot);
}

function introItem(): ExamItem {
  return {
    slot: 1,
    topicId: "intro",
    topicKo: "자기소개",
    topicEn: "Self-introduction",
    emoji: "👋",
    comboLabel: "자기소개",
    typeLabel: TYPE_LABELS.intro,
    question: introQuestion,
  };
}

let serial = 0;
function base(mode: Exam["mode"]): Pick<Exam, "id" | "createdAt" | "mode" | "bankVersion"> {
  return {
    id: `${mode}-${Date.now()}-${++serial}`,
    createdAt: Date.now(),
    mode,
    bankVersion: SURVEY_BANK_VERSION,
  };
}

export interface BuildExamOptions {
  enabledSurveyIds?: string[];
  includeIntro?: boolean;
  /** 실제 청취·지문 열기로 쌓은 누적 출제 기록. 준비 화면의 추첨은 기록하지 않는다. */
  exposure?: ExamExposure;
  rng?: RandomSource;
}

/** 실전 모의고사와 랜덤 연습에서는 뽑지 않는 배경 설문 주제. 주제별 연습에서만 푼다. */
export const DRAW_EXCLUDED_TOPIC_IDS: readonly string[] = ["walking", "concert", "jogging"];
/** 모의고사 2~7번 세트·롤플레이·비교·이슈와 랜덤 연습에서 뽑을 수 있는 배경 설문 주제. */
export const drawableSurveyTopics = surveyTopics.filter((topic) => !DRAW_EXCLUDED_TOPIC_IDS.includes(topic.id));

const ADVANCED_TYPES: QuestionType[] = ["comparison", "issue"];

const GENERAL_TYPES: QuestionType[][] = [
  ["description", "routine", "experience"],
  ["description", "experience", "memorable"],
];
const ROLEPLAY_TYPES: QuestionType[] = ["roleplay_ask", "roleplay_problem", "roleplay_experience"];

/**
 * 실전 모의고사의 다섯 구간. 실제 시험처럼 세 구간은 배경 설문에서, 두 구간은 돌발에서 뽑고
 * 어느 구간이 돌발이 될지는 보유 세트와 출제 이력에 따라 정한다. 고정 세트는 자료의
 * 표시 번호로 구간을 정하고 원래 유형·순서를 보존한다. types 는 고정 세트가 없는
 * 배경 설문의 유형 기준이며, 고정 세트 없는 돌발 일반 구간은 자료 순서를 따른다.
 */
const FULL_EXAM_GROUPS = [
  { slot: 2, label: "세트 1", types: GENERAL_TYPES[0] },
  { slot: 5, label: "세트 2", types: GENERAL_TYPES[1] },
  { slot: 8, label: "세트 3", types: GENERAL_TYPES[1] },
  { slot: 11, label: "롤플레이 세트", types: ROLEPLAY_TYPES },
  { slot: 14, label: "어드밴스 세트", types: ADVANCED_TYPES },
] as const;

/** 한 회차에 돌발에서 뽑는 구간 수. 나머지 구간은 모두 배경 설문에서 뽑는다. */
export const FULL_EXAM_SURPRISE_GROUPS = 2;
export const MIN_FULL_EXAM_SURVEY_TOPICS = FULL_EXAM_GROUPS.length - FULL_EXAM_SURPRISE_GROUPS;

/** 다섯 구간 중 두 곳을 돌발에 배정한다. 해당 구간을 완성할 수 있는 주제만 쓴다. */
const SURPRISE_GROUP_CHOICES: number[][] = FULL_EXAM_GROUPS
  .map((_, index) => index)
  .flatMap((first, i, eligible) => eligible.slice(i + 1).map((second) => [first, second]));

function coherentSet(questions: readonly Question[]): boolean {
  return new Set(questions.map(q => q.id)).size === questions.length && questions.every((q, i) =>
    (q.dependsOn ?? []).every(id => questions.slice(0, i).some(earlier => earlier.id === id)));
}

/** 제공 자료의 번호가 있으면 일반 구간의 비교·습관 등 변형도 원래 세트에 포함한다. */
function fixedSetMatches(group: FixedPracticeSet, questions: readonly Question[], types: readonly QuestionType[]): boolean {
  const patterns = FULL_EXAM_GROUPS.filter(candidate => candidate.types.length === types.length
    && candidate.types.every((type, index) => type === types[index]));
  if (patterns.length && group.items.every(entry => entry.displayNumber !== undefined)) {
    return patterns.some(pattern => group.items.length === pattern.types.length
      && group.items.every((entry, index) => entry.displayNumber === String(pattern.slot + index)));
  }
  // 표시 번호가 없는 기존/사용자 정의 세트는 유형으로 구간을 판단한다.
  return questions.length === types.length && questions.every((question, index) => question.type === types[index]);
}

/** Resolve declared sets intact. Legacy banks enumerate complete eligible bundles before any draw. */
export function completeQuestionSets(topic: Topic, types?: readonly QuestionType[]): Question[][] {
  let sets: Question[][];
  let enforced = types;
  if (topic.fixedPracticeSets) {
    sets = topic.fixedPracticeSets.flatMap(group => {
      const questions = group.items.map(({ questionId }) => {
        const question = topic.questions.find(q => q.id === questionId);
        if (!question) throw new Error(`${topic.id}: missing set question ${questionId}`);
        return question;
      });
      return !types || fixedSetMatches(group, questions, types) ? [questions] : [];
    });
    enforced = undefined;
  } else if (topic.category === "surprise" && types?.length
      && types.every(type => ADVANCED_TYPES.includes(type) || ROLEPLAY_TYPES.includes(type))) {
    /*
     * 비교·이슈와 롤플레이 구간만 유형 순서를 지킨다. 두 구간은 자료 순서 세트로 대신할 수
     * 없으므로, 해당 유형을 모두 가진 돌발 주제만 들어간다. 유형이 없으면 세트가 비어
     * 자연히 후보에서 빠진다.
     */
    sets = types.reduce<Question[][]>((built, type) => built.flatMap(set =>
      topic.questions.filter(q => q.type === type && !set.some(earlier => earlier.id === q.id)).map(q => [...set, q])), [[]]);
  } else if (topic.category === "surprise") {
    /*
     * 돌발은 주제마다 가진 유형이 제각각이라 번호별 유형을 강요하지 않는다. 자료의 첫
     * 문항으로 시작하고 나머지 둘은 자료 순서를 지켜 무작위로 고른다. 1·2·3 뿐 아니라
     * 1·3·4, 1·3·5도 나온다. 비교·이슈와 롤플레이는 각 구간 몫이라 위에서 처리한다.
     */
    const [first, ...rest] = topic.questions.filter(q => !ADVANCED_TYPES.includes(q.type));
    sets = first ? rest.flatMap((second, i) => rest.slice(i + 1).map(third => [first, second, third])) : [];
    // 자료 순서 세트는 번호별 유형과 무관하므로 요청 유형으로 거르지 않는다.
    enforced = undefined;
  } else {
    sets = [[]];
    for (const type of types ?? []) {
      const typed = topic.questions.filter(q => q.type === type);
      // 기출 복원과 보완 문항을 모두 후보에 둔다. 출처만으로 도달 불가능한 문항을 만들지 않는다.
      sets = sets.flatMap(set => typed.map(q => [...set, q]));
    }
  }
  return sets.filter(set => set.length > 0 && coherentSet(set) && (!enforced ||
    (set.length === enforced.length && set.every((q, i) => q.type === enforced[i]))));
}

/** 앞의 값부터 비교: 미출제 문항 수 → 적게 본 문항 → 오래전에 본 문항. */
type DrawPriority = readonly [number, number, number];
const ZERO_PRIORITY: DrawPriority = [0, 0, 0];
const addPriority = (a: DrawPriority, b: DrawPriority): DrawPriority => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
function comparePriority(a: DrawPriority, b: DrawPriority): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
  return 0;
}

interface GroupCandidate { topic: Topic; sets: Question[][]; priority: DrawPriority }
interface GroupAssignment { groups: GroupCandidate[]; priority: DrawPriority }

function groupCandidates(survey: readonly Topic[], exposure: ExamExposure): GroupCandidate[][] {
  const priorityByKey = new Map<string, DrawPriority>();
  for (const topic of [...survey, ...surpriseTopics]) {
    for (const question of topic.questions) {
      const key = questionExposureKey(question);
      const seen = exposure[key];
      priorityByKey.set(key, seen ? [0, -seen.count, -seen.lastSeen] : [1, 0, 0]);
    }
  }
  return FULL_EXAM_GROUPS.map(group => [...survey, ...surpriseTopics].flatMap(topic => {
    let priority: DrawPriority | undefined;
    let sets: Question[][] = [];
    for (const set of completeQuestionSets(topic, group.types)) {
      const keys = new Set(set.map(questionExposureKey));
      const score = [...keys].reduce<DrawPriority>((sum, key) => addPriority(sum, priorityByKey.get(key)!), ZERO_PRIORITY);
      const compared = priority ? comparePriority(score, priority) : 1;
      if (compared > 0) { priority = score; sets = [set]; }
      else if (compared === 0) sets.push(set);
    }
    return priority ? [{ topic, sets, priority }] : [];
  }));
}

/**
 * 한 구간이 쓸 수 있는 주제는 자기 후보 가운데 앞선 다섯이면 충분하다. 구간이 다섯뿐이라
 * 그 다섯 중 많아야 넷을 다른 구간이 가져가고, 늘 하나는 남는다. 남은 쪽이 우선순위가
 * 같거나 높으므로 바꿔치면 배정이 나빠지지 않는다. 동점은 섞은 순서가 앞선 쪽을 고르는데
 * 안정 정렬이 그 순서를 지키므로, 잘라 내기 전과 같은 배정이 나온다.
 *
 * 이 가지치기가 없으면 탐색이 "이미 쓴 주제"의 조합으로 커진다. 주제 33개 기준으로
 * 모의고사 한 번에 재귀 48만 번이 돌았고, 주제를 늘릴수록 더 나빠진다.
 */
function preferredCandidates(pool: readonly GroupCandidate[], keep: number): GroupCandidate[] {
  if (pool.length <= keep) return [...pool];
  // 고르기만 하고 순서는 건드리지 않는다. 재귀는 섞인 순서로 동점을 가르므로,
  // 우선순위 순으로 돌려주면 같은 최적해 중 다른 것이 뽑힌다.
  const kept = new Set([...pool].sort((a, b) => comparePriority(b.priority, a.priority)).slice(0, keep));
  return pool.filter(candidate => kept.has(candidate));
}

/** 뒤 구간의 희소한 주제까지 고려해, 주제 중복 없이 전체 우선순위가 가장 높은 배정을 찾는다. */
function assignGroupTopics(
  surpriseGroups: readonly number[], candidates: readonly GroupCandidate[][], rng: RandomSource,
): GroupAssignment | undefined {
  const pools = candidates.map((pool, index) => preferredCandidates(shuffle(pool.filter(candidate =>
    (candidate.topic.category === "surprise") === surpriseGroups.includes(index)), rng), candidates.length));
  const topicIds = [...new Set(pools.flat().map(candidate => candidate.topic.id))];
  const bits = new Map(topicIds.map((id, i) => [id, 1n << BigInt(i)]));
  const cache = new Map<string, GroupAssignment | undefined>();
  function assign(index: number, used: bigint): GroupAssignment | undefined {
    if (index === pools.length) return { groups: [], priority: ZERO_PRIORITY };
    const key = `${index}:${used}`;
    if (cache.has(key)) return cache.get(key);
    let best: GroupAssignment | undefined;
    for (const candidate of pools[index]) {
      const bit = bits.get(candidate.topic.id)!;
      if (used & bit) continue;
      const rest = assign(index + 1, used | bit);
      if (!rest) continue;
      const priority = addPriority(candidate.priority, rest.priority);
      if (!best || comparePriority(priority, best.priority) > 0) {
        best = { groups: [candidate, ...rest.groups], priority };
      }
    }
    cache.set(key, best);
    return best;
  }
  return assign(0, 0n);
}

export function buildFullExam(options: BuildExamOptions = {}): Exam {
  const { includeIntro = true, exposure = {}, rng = Math.random } = options;
  const requested = new Set(options.enabledSurveyIds ?? DEFAULT_SURVEY_IDS);
  const enabled = drawableSurveyTopics.filter(topic => requested.has(topic.id));
  if (enabled.length < MIN_FULL_EXAM_SURVEY_TOPICS) {
    const excluded = surveyTopics.filter(topic => DRAW_EXCLUDED_TOPIC_IDS.includes(topic.id)).map(topic => topic.ko).join("·");
    throw new Error(`실전 모의고사를 만들려면 서베이 주제를 ${MIN_FULL_EXAM_SURVEY_TOPICS}개 이상 선택해 주세요. ${excluded} 주제는 모의고사에 나오지 않아 개수에서 빠집니다.`);
  }
  const candidates = groupCandidates(enabled, exposure);
  let selected: GroupAssignment | undefined;
  // 돌발 위치도 함께 비교해야 일반·롤플레이에 밀려 드문 비교 문항이 계속 빠지지 않는다.
  // 같은 우선순위의 위치·주제·세트는 무작위로 고른다.
  for (const surpriseGroups of shuffle(SURPRISE_GROUP_CHOICES, rng)) {
    const assignment = assignGroupTopics(surpriseGroups, candidates, rng);
    if (assignment && (!selected || comparePriority(assignment.priority, selected.priority) > 0)) selected = assignment;
  }
  if (selected) {
    const items = selected.groups.flatMap(({ topic, sets }, index) => {
      const group = FULL_EXAM_GROUPS[index];
      const label = topic.category === "surprise" ? `${group.label} · 돌발` : group.label;
      return pickRandom(sets, rng).map((question, i) => item(group.slot + i, topic, question, label));
    });
    if (includeIntro) items.unshift(introItem());
    return {
      ...base("full"), items,
      // 어느 구간이 돌발인지는 미리 알려 주지 않는다. 실제 시험처럼 문항을 열어야 알 수 있다.
      notices: [
        "각 구간은 한 주제의 완성된 세트로 출제하며, 같은 주제는 한 회차에 한 번만 나옵니다.",
        "아직 듣거나 지문을 열어 보지 않은 문제가 많은 세트를 우선합니다. 모두 본 문제라면 적게 본 문제, 오래전에 본 문제 순으로 고릅니다.",
        `다섯 구간 가운데 ${FULL_EXAM_SURPRISE_GROUPS}개가 돌발 세트입니다. 어느 구간에 들어갈지는 회차마다 달라집니다.`,
        "11~13번은 실제 시험처럼 한 주제에서 질문하기 → 문제 해결 → 관련 경험으로 이어지는 롤플레이 세트입니다.",
      ],
    };
  }
  throw new Error("선택한 주제의 완성된 세트로 주제 중복 없는 모의고사를 구성할 수 없습니다. 다른 서베이 주제를 추가해 주세요.");
}

const PRACTICE_TYPES: QuestionType[] = [
  "description", "routine", "experience", "memorable",
  "roleplay_ask", "roleplay_problem", "roleplay_experience", "comparison", "issue",
];

/** 주제 목록을 펼쳤을 때 보여 줄 유형별 예시 문항. 실제 연습은 14문항이다. */
export function selectPracticeQuestions(topic: Topic, rng: RandomSource = Math.random): Question[] {
  if (topic.category === "surprise") return [...topic.questions];
  return PRACTICE_TYPES.filter((type) => topic.questions.some((q) => q.type === type))
    .map((type) => questionOfType(topic, type, rng));
}

export function buildPracticeExam(topic: Topic, rng: RandomSource = Math.random): Exam {
  if (topic.category === "surprise") {
    if (!topic.questions.length) throw new Error("이 돌발 주제에는 연습할 문항이 없습니다.");
    return { ...base("practice"), bankVersion: "surprise-2026-09-11", focusTopicId: topic.id,
      items: topic.questions.map((question, index) => item(index + 1, topic, question, "돌발 주제별 연습")),
      notices: ["제공 자료의 번호와 순서대로 모든 문항을 연습합니다. 5-A와 5-B는 각각 별도 문항입니다."] };
  }
  if (topic.category === "survey" && topic.fixedPracticeSets) {
    const groups = topic.fixedPracticeSets;
    if (!groups.length || groups.some((group) => !group.items.length)) {
      throw new Error(`${topic.ko} 연습에 필요한 문항이 부족합니다.`);
    }
    const usedSlots = new Set<number>();
    const items = groups.flatMap((group) => group.items.map(({ slot, questionId, displayNumber }) => {
      if (!Number.isInteger(slot) || slot < 1 || usedSlots.has(slot)) {
        throw new Error(`${topic.ko} 연습의 고정 문항 번호가 올바르지 않습니다.`);
      }
      usedSlots.add(slot);
      if (displayNumber !== undefined && (typeof displayNumber !== "string" || !displayNumber.trim())) {
        throw new Error(`${topic.ko} 연습의 표시 번호가 올바르지 않습니다.`);
      }
      const question = topic.questions.find((q) => q.id === questionId);
      if (!question) throw new Error(`${topic.ko} 연습에 필요한 문항이 부족합니다.`);
      return { ...item(slot, topic, question, group.label), displayNumber: displayNumber ?? String(slot) };
    }));
    return { ...base("practice"), focusTopicId: topic.id, items,
      notices: [`${groups.map((group) => group.label).join(" / ")} 순서로 연습합니다. 원하는 문항만 답변할 수 있습니다.`] };
  }
  // 실제 번호에 맞는 유형에서 각각 뽑는다. 같은 질문의 중복 출제도 허용한다.
  const slotTypes: QuestionType[] = [
    "description", "routine", "experience", "description", "experience", "memorable",
    "description", "experience", "memorable", "roleplay_ask", "roleplay_problem",
    "roleplay_experience", "comparison", "issue",
  ];
  if (slotTypes.some((type) => !topic.questions.some((q) => q.type === type))) {
    throw new Error("이 주제에는 2~15번 연습에 필요한 유형의 문항이 부족합니다.");
  }
  const items = slotTypes.map((type, index) =>
    item(index + 2, topic, questionOfType(topic, type, rng), "주제별 연습"));
  return { ...base("practice"), focusTopicId: topic.id, items,
    notices: ["선택한 주제의 문제를 실제 시험 번호인 2~15번에 배정합니다. 같은 유형은 중복 출제될 수 있으며 원하는 문항만 답변할 수 있습니다."] };
}

/** 5~7번과 8~10번은 같은 유형 구성이므로 하나의 추첨 후보로 둔다. */
const RANDOM_SET_PATTERNS: { label: string; types: QuestionType[] }[] = [
  { label: "2~4번형 · 묘사 → 루틴 → 경험", types: ["description", "routine", "experience"] },
  { label: "5~7·8~10번형 · 묘사 → 과거·최초 경험 → 기억에 남는 경험", types: ["description", "experience", "memorable"] },
  { label: "11~13번형 · 롤플레이 질문하기 → 문제 해결 → 관련 경험", types: ["roleplay_ask", "roleplay_problem", "roleplay_experience"] },
  { label: "14~15번형 · 변화·비교 → 이슈", types: ["comparison", "issue"] },
];

/** 유형 순서와 선행 질문을 모두 만족하는 세트만 만든다. */
function questionSetsOfTypes(topic: Topic, types: readonly QuestionType[]): Question[][] {
  if (topic.fixedPracticeSets) return completeQuestionSets(topic, types);
  return types.reduce<Question[][]>((sets, type) => sets.flatMap((set) =>
    topic.questions.filter((q) => q.type === type && !set.some((earlier) => earlier.id === q.id)
      && (q.dependsOn ?? []).every((id) => set.some((earlier) => earlier.id === id)))
      .map((q) => [...set, q])), [[]]);
}

/**
 * 주제 하나와 그 주제에서 가능한 세트 유형을 각각 무작위로 고른다. 일반·롤플레이는
 * 3문항, 변화·이슈는 2문항이다. 일반 유형을 채울 수 없는 돌발은 자료의 연결 세트를 쓴다.
 */
export function buildTopicSet(topics: readonly Topic[] = allTopics, rng: RandomSource = Math.random): Exam {
  const topic = pickRandom(topics, rng);
  const patterns = RANDOM_SET_PATTERNS.map((pattern) => ({
    ...pattern, sets: questionSetsOfTypes(topic, pattern.types),
  })).filter((pattern) => pattern.sets.length > 0);
  if (topic.category === "surprise") {
    // 제공 자료의 연결 흐름도 늘 후보로 둔다. 유형별 세트만 두면 자료의 이어지는 질문이 묻힌다.
    const sets = completeQuestionSets(topic);
    if (sets.length) patterns.unshift({ label: "돌발 연결 세트 · 제공 자료의 흐름에 따른 3문항", types: [], sets });
  }
  if (!patterns.length) throw new Error("이 주제에는 랜덤 연습 세트를 만들 문항이 부족합니다.");
  const pattern = pickRandom(patterns, rng);
  const questions = pickRandom(pattern.sets, rng);
  return { ...base("set"), focusTopicId: topic.id,
    items: questions.map((question, i) => item(i + 1, topic, question, pattern.label)) };
}

export function buildSingleQuestion(topics: readonly Topic[] = allTopics, rng: RandomSource = Math.random): Exam {
  const candidates = topics.flatMap((topic) => singleCandidates(topic).map((question) => ({ topic, question })));
  const { topic, question } = pickRandom(candidates, rng);
  return { ...base("single"), items: [item(1, topic, question, "1문제 연습")] };
}

/** 랜덤 연습이 범위마다 뽑는 주제. 걷기·콘서트·조깅은 모의고사처럼 빠진다. */
export const RANDOM_SCOPE_TOPICS: Record<RandomScope, readonly Topic[]> = {
  all: [...drawableSurveyTopics, ...surpriseTopics],
  survey: drawableSurveyTopics,
  surprise: surpriseTopics,
};

/** 주소의 scope 값. 모르는 값이나 빈 값은 서베이와 돌발 전체로 본다. */
export function parseRandomScope(value: string | null | undefined): RandomScope {
  return value === "survey" || value === "surprise" ? value : "all";
}

/** 1문제·1토픽 랜덤 연습. 뽑은 범위를 시험에 적어 두어야 기록에서 같은 범위로 다시 뽑을 수 있다. */
export function buildRandomPractice(mode: "single" | "set", scope: RandomScope = "all", rng: RandomSource = Math.random): Exam {
  const topics = RANDOM_SCOPE_TOPICS[scope];
  const exam = mode === "single" ? buildSingleQuestion(topics, rng) : buildTopicSet(topics, rng);
  return { ...exam, randomScope: scope };
}
