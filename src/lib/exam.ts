import type { Exam, ExamItem, Question, QuestionType, RandomScope, Topic } from "./types";
import { DEFAULT_SURVEY_IDS, SURVEY_BANK_VERSION, allTopics, introQuestion, surpriseTopics, surveyTopics } from "../data";

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
  return topic.questions.filter((q) => (q.source === "verified" || q.source === "provided") && !q.dependsOn?.length);
}

function questionOfType(topic: Topic, type: QuestionType, rng: RandomSource): Question {
  const typed = topic.questions.filter((q) => q.type === type);
  const verified = typed.filter((q) => q.source === "verified");
  return pickRandom(verified.length ? verified : typed, rng);
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
 * 화면에 적는 문항 번호. 돌발 주제별 연습만 자료 번호를 그대로 보여 준다. 모의고사나
 * 랜덤 연습에 섞여 들어간 돌발 문항까지 자료 번호로 적히면 순서가 어긋나 보인다.
 */
export function itemNumber(mode: Exam["mode"], entry: ExamItem): string {
  return mode === "practice" ? entry.question.number ?? String(entry.slot) : String(entry.slot);
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
  rng?: RandomSource;
}

/** 실전 모의고사와 랜덤 연습에서는 뽑지 않는 배경 설문 주제. 주제별 연습에서만 푼다. */
export const DRAW_EXCLUDED_TOPIC_IDS: readonly string[] = ["walking", "concert", "jogging"];
/** 모의고사 2~7번 세트·롤플레이·비교·이슈와 랜덤 연습에서 뽑을 수 있는 배경 설문 주제. */
export const drawableSurveyTopics = surveyTopics.filter((topic) => !DRAW_EXCLUDED_TOPIC_IDS.includes(topic.id));

const ADVANCED_TYPES: QuestionType[] = ["comparison", "issue"];

/**
 * 8~10번 돌발 세트. 늘 자료의 첫 묘사 문항으로 열고, 뒤의 두 문항은 비교·이슈를 뺀
 * 나머지에서 자료 순서대로 고른다. 앞 문항의 답을 전제로 하는 문항은 그 앞 문항이
 * 먼저 나온 조합에서만 낸다.
 */
function surpriseSets(topic: Topic): Question[][] {
  const [first, ...rest] = topic.questions.filter((q) => !ADVANCED_TYPES.includes(q.type));
  if (!first) return [];
  const sets = rest.flatMap((second, i) => rest.slice(i + 1).map((third) => [first, second, third]));
  return sets.filter((set) => set.every((q, i) =>
    (q.dependsOn ?? []).every((id) => set.slice(0, i).some((earlier) => earlier.id === id))));
}

function surpriseSet(topic: Topic, rng: RandomSource): Question[] {
  return pickRandom(surpriseSets(topic), rng);
}

export function buildFullExam(options: BuildExamOptions = {}): Exam {
  const { includeIntro = true, rng = Math.random } = options;
  const requested = [...new Set(options.enabledSurveyIds ?? DEFAULT_SURVEY_IDS)];
  const enabled = drawableSurveyTopics.filter((topic) => requested.includes(topic.id));
  if (enabled.length < 3) {
    const excluded = surveyTopics.filter((topic) => DRAW_EXCLUDED_TOPIC_IDS.includes(topic.id)).map((topic) => topic.ko).join("·");
    throw new Error(`실전 모의고사를 만들려면 서베이 주제를 3개 이상 선택해 주세요. ${excluded} 주제는 모의고사에 나오지 않아 개수에서 빠집니다.`);
  }

  const [a, b] = shuffle(enabled, rng).slice(0, 2);
  const surprise = pickRandom(surpriseTopics, rng);
  const items: ExamItem[] = [
    item(2, a, questionOfType(a, "description", rng), "세트 1"),
    item(3, a, questionOfType(a, "routine", rng), "세트 1"),
    item(4, a, questionOfType(a, "experience", rng), "세트 1"),
    item(5, b, questionOfType(b, "description", rng), "세트 2"),
    item(6, b, questionOfType(b, "experience", rng), "세트 2"),
    item(7, b, questionOfType(b, "memorable", rng), "세트 2"),
    ...surpriseSet(surprise, rng).map((question, i) => item(8 + i, surprise, question, "돌발 세트")),
  ];

  const roleplayTopic = pickRandom(enabled, rng);
  items.push(item(11, roleplayTopic, questionOfType(roleplayTopic, "roleplay_ask", rng), "롤플레이 세트"));
  items.push(item(12, roleplayTopic, questionOfType(roleplayTopic, "roleplay_problem", rng), "롤플레이 세트"));
  items.push(item(13, roleplayTopic, questionOfType(roleplayTopic, "roleplay_experience", rng), "롤플레이 세트"));

  const comparisonTopic = pickRandom(enabled, rng);
  const issueTopic = pickRandom(enabled, rng);
  items.push(item(14, comparisonTopic, questionOfType(comparisonTopic, "comparison", rng), "어드밴스"));
  items.push(item(15, issueTopic, questionOfType(issueTopic, "issue", rng), "어드밴스"));

  if (includeIntro) items.unshift(introItem());

  return {
    ...base("full"),
    items,
    notices: ["기출 복원 기반 문항을 먼저 출제하고, 선택한 주제에 그 유형의 복원 문항이 없을 때만 출제 유형 기반 문항으로 채웁니다.", "8~10번은 돌발 주제 한 개에서 제공 자료 순서대로 세 문항을 내는 돌발 세트입니다.", "11~13번은 실제 시험처럼 한 주제에서 질문하기 → 문제 해결 → 관련 경험으로 이어지는 롤플레이 세트입니다."],
  };
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
  if (topic.id === "staycation") {
    const groups = [[2, 3, 4], [5, 6, 7], [11, 12, 13], [14, 15]];
    const items = groups.flatMap((slots) => slots.map((slot) => {
      const question = topic.questions.find((q) => q.id === `staycation-q${slot}`);
      if (!question) throw new Error("집에서 보내는 휴가 연습에 필요한 문항이 부족합니다.");
      return item(slot, topic, question, `Q${slots[0]}–Q${slots[slots.length - 1]}`);
    }));
    return { ...base("practice"), focusTopicId: topic.id, items,
      notices: ["Q2–Q4 / Q5–Q7 / Q11–Q13 / Q14–Q15 순서로 연습합니다. 원하는 문항만 답변할 수 있습니다."] };
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
  if (topic.category === "surprise" && !patterns.some((pattern) => pattern.types[0] === "description")) {
    const sets = surpriseSets(topic);
    if (sets.length) patterns.unshift({ label: "돌발 연결 세트 · 제공 자료의 흐름에 따른 3문항", types: [], sets });
  }
  if (!patterns.length) throw new Error("이 주제에는 랜덤 연습 세트를 만들 문항이 부족합니다.");
  const pattern = pickRandom(patterns, rng);
  // 연결이 성립하는 세트 안에서 기출 복원 문항을 우선한다.
  const verifiedCount = (set: Question[]) => set.filter((q) => q.source === "verified").length;
  const mostVerified = Math.max(...pattern.sets.map(verifiedCount));
  const questions = pickRandom(pattern.sets.filter((set) => verifiedCount(set) === mostVerified), rng);
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
