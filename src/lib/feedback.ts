import type { QuestionType } from "./types";

/**
 * 두괄식(핵심 먼저) 도입을 요구하지 않는 유형.
 * 롤플레이는 전화 대화에 가까워 인사·상황부터 꺼내는 편이 자연스럽고,
 * 요청이나 문제 자체가 곧 핵심이라 서술형과 기준이 다르다.
 */
const FREE_OPENING_TYPES: ReadonlySet<QuestionType> = new Set([
  "roleplay_ask",
  "roleplay_problem",
  "roleplay_experience",
]);

/** 이 문항의 답변을 두괄식 기준으로 볼지. 알 수 없는 유형은 일반 서술형으로 본다. */
export function requiresFrontLoadedOpening(type: string | undefined): boolean {
  return !FREE_OPENING_TYPES.has(type as QuestionType);
}

/**
 * 피드백 유형. 코칭 우선순위 순서다. 응답 스키마, 저장된 피드백·표현 검사가 모두 이 목록을 쓴다.
 * transition 은 흐름이 바뀌는 곳에 넣는 연결 표현(What's really nice is…, As a result…)이다.
 */
export const FEEDBACK_CATEGORIES = [
  "storytelling",
  "transition",
  "detail",
  "emotion",
  "delivery",
  "pronunciation",
  "grammar",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

/** 문항 칩, 상세 피드백, 결과·오늘 집계의 공통 명칭. 저장 키는 유지한다. */
export const FEEDBACK_CRITERIA = [
  { key: "topic", label: "핵심 제시" },
  { key: "detail", label: "전개·디테일" },
  { key: "feeling", label: "감정·의미" },
] as const;

/** 예전 AI 문구도 새 명칭으로 표시한다. 저장 내용과 표현의 고정 ID는 건드리지 않는다. */
export function feedbackDisplayText(text: string): string {
  return text.replace(/두괄식 도입/g, FEEDBACK_CRITERIA[0].label)
    .replace(/활동·디테일/g, FEEDBACK_CRITERIA[1].label);
}

/** 화면과 PDF 모아보기에서 함께 쓰는 유형 이름. */
export const feedbackCategoryLabel: Record<FeedbackCategory, string> = {
  storytelling: "스토리텔링",
  transition: "연결 표현",
  detail: FEEDBACK_CRITERIA[1].label,
  emotion: FEEDBACK_CRITERIA[2].label,
  delivery: "전달력",
  pronunciation: "발음 체크",
  grammar: "문법",
};

export type FlowStatus = "good" | "needs_work";

export interface FeedbackCounts {
  evaluated: number;
  topic: number;
  detail: number;
  feeling: number;
}

export function emptyFeedbackCounts(): FeedbackCounts {
  return { evaluated: 0, topic: 0, detail: 0, feeling: 0 };
}

/** 실제 답변한 문항의 good만 센다. 미평가는 보강 판정으로 바꾸지 않는다. */
export function summarizeFeedback(
  answeredSlots: readonly number[],
  feedbackBySlot: Readonly<Record<number, OpicFeedback | undefined>>,
): FeedbackCounts {
  const counts = emptyFeedbackCounts();
  for (const slot of new Set(answeredSlots)) {
    const structure = feedbackBySlot[slot]?.structure;
    if (!structure) continue;
    counts.evaluated += 1;
    for (const { key } of FEEDBACK_CRITERIA) {
      if (structure[key] === "good") counts[key] += 1;
    }
  }
  return counts;
}

export interface OpicFeedbackItem {
  category: FeedbackCategory;
  title: string;
  message: string;
  /** 짧은 영어 개선 예시. 예시가 필요 없으면 빈 문자열이다. */
  example: string;
  /**
   * 이 항목이 고친 답변(`improvedAnswer`)에서 손댄 자리를 그대로 인용한 것.
   *
   * Before / After 는 이 자리만 진하게 칠하고 항목 번호를 붙인다. 고친 답변은 고칠 점을
   * 반영하면서 자연스러움까지 손보기 때문에, 이 인용문이 없으면 어디가 조언이고 어디가
   * 다듬은 것인지 가릴 수 없다. 텍스트를 바꾸지 않은 항목은 빈 문자열이고, 이 필드가
   * 생기기 전에 받은 피드백에는 아예 없다.
   */
  afterQuote?: string;
}

export interface OpicFeedback {
  overall: string;
  structure: {
    topic: FlowStatus;
    detail: FlowStatus;
    feeling: FlowStatus;
    note: string;
  };
  /**
   * audio_compare: 저장된 녹음본을 별도 STT로 다시 들어 브라우저 받아쓰기와 비교함.
   * browser_only: 브라우저 받아쓰기만 있어 발음 추정을 제한함.
   * none: 발음 피드백 근거가 없음.
   */
  pronunciationBasis: "audio_compare" | "browser_only" | "none";
  items: OpicFeedbackItem[];
  /**
   * 사용자가 실제로 말한 답변에 이번 피드백만 반영해 고친 버전. 새 모범답안이 아니라
   * 스토리와 표현은 그대로 두고 필요한 곳만 손본 것이다. 이 기능 전에 받은 피드백에는 없다.
   */
  improvedAnswer?: string;
  /**
   * improvedAnswer 의 바탕이 된 답변. Before 로 보여 준다. 녹음본을 다시 받아쓴 문항은 그 전사다.
   * 나중에 브라우저 받아쓰기로 되돌려도 비교가 흔들리지 않도록 함께 저장한다.
   */
  improvedFrom?: string;
}

/** Before / After 로 견줄 두 답변. 예전에 받은 피드백이거나 고친 답변이 비어 있으면 null. */
export function feedbackRewrite(feedback: OpicFeedback): { before: string; after: string } | null {
  const before = feedback.improvedFrom?.trim() ?? "";
  const after = feedback.improvedAnswer?.trim() ?? "";
  return before && after ? { before, after } : null;
}

/**
 * 고친 답변에서 고칠 점마다 손댄 자리. 순서는 `items` 와 같아 배열 위치가 곧 항목 번호
 * (1부터)이고, 텍스트를 바꾸지 않은 항목은 빈 문자열이다. `diffAnswers` 에 그대로 넘긴다.
 *
 * 인용문을 가진 항목이 하나도 없으면 `undefined` 를 돌려준다. 그런 피드백은 이 필드가
 * 생기기 전에 받은 최소 수정본이라 바뀐 곳이 모두 고칠 점에서 나온 것이고, 예전처럼 다
 * 진하게 칠하는 것이 맞다. 고칠 점이 아예 없는 피드백은 그럴 일이 없으니 빈 목록을 준다.
 */
export function feedbackItemQuotes(feedback: OpicFeedback): string[] | undefined {
  const versioned = feedback.items.length === 0
    || feedback.items.some((item) => item.afterQuote !== undefined);
  return versioned ? feedback.items.map((item) => item.afterQuote?.trim() ?? "") : undefined;
}

/**
 * 피드백 JSON 에 드는 출력 토큰. 추론 토큰도 여기서 함께 잘린다. 고칠 점마다 고친
 * 답변의 한 조각을 인용하는 `itemQuotes` 가 붙어 1,400 → 1,550 으로 올렸다. 인용문은
 * 맨 뒤에 오므로 여기가 모자라면 인용문만 잘려 나가 등급을 가릴 수 없게 된다.
 */
const FEEDBACK_OUTPUT_TOKENS = 1_550;
/** 영어는 대략 4글자에 1토큰이다. 고친 답변이 원래보다 조금 길어질 수 있어 3글자로 넉넉히 잡는다. */
const CHARS_PER_OUTPUT_TOKEN = 3;
const MAX_OUTPUT_TOKENS = 6_000;

/**
 * 한 번 요청에 허용할 출력 토큰. 고친 답변은 원래 답변만큼 길어서 답변 길이에 맞춰 늘린다.
 * 모자라면 JSON 이 중간에 잘려 피드백 전체를 잃는다. route.ts 와 cost.ts 가 함께 쓴다.
 */
export function feedbackOutputTokenLimit(answerChars: number): number {
  const answerTokens = Math.ceil(Math.max(0, answerChars) / CHARS_PER_OUTPUT_TOKEN);
  return Math.min(MAX_OUTPUT_TOKENS, FEEDBACK_OUTPUT_TOKENS + answerTokens);
}

/** `/api/feedback` 응답. 피드백과 함께 녹음본을 다시 받아쓴 결과를 돌려준다. */
export interface FeedbackResponse {
  feedback: OpicFeedback;
  /**
   * 녹음본을 OpenAI STT 로 다시 받아쓴 답변.
   * 녹음본이 없거나 전사에 실패하면 빈 문자열이다.
   */
  audioTranscript: string;
}

/** 응답을 읽는다. 형식이 어긋나면 null 을 돌려 호출한 쪽에서 오류로 처리한다. */
export function readFeedbackResponse(value: unknown): FeedbackResponse | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as { feedback?: unknown; audioTranscript?: unknown };
  if (!isOpicFeedback(payload.feedback)) return null;
  return {
    feedback: { ...payload.feedback, items: payload.feedback.items.slice(0, 5) },
    audioTranscript: typeof payload.audioTranscript === "string" ? payload.audioTranscript.trim() : "",
  };
}

export function isOpicFeedback(value: unknown): value is OpicFeedback {
  if (!value || typeof value !== "object") return false;
  const feedback = value as Partial<OpicFeedback>;
  const structure = feedback.structure;
  const statuses: unknown[] = ["good", "needs_work"];
  const categories: readonly unknown[] = FEEDBACK_CATEGORIES;
  const optionalText = (text: unknown) => text === undefined || typeof text === "string";
  return typeof feedback.overall === "string" && !!structure
    && optionalText(feedback.improvedAnswer) && optionalText(feedback.improvedFrom)
    && statuses.includes(structure.topic) && statuses.includes(structure.detail)
    && statuses.includes(structure.feeling) && typeof structure.note === "string"
    && ["audio_compare", "browser_only", "none"].includes(feedback.pronunciationBasis ?? "")
    && Array.isArray(feedback.items) && feedback.items.every((item) => item
      && categories.includes(item.category) && typeof item.title === "string"
      && typeof item.message === "string" && typeof item.example === "string"
      && optionalText(item.afterQuote));
}
