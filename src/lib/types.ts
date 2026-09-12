/** Task labels describe the prompt, never a fixed position in the exam. */
export type QuestionType = "description" | "routine" | "experience" | "memorable" | "roleplay_ask" | "roleplay_problem" | "roleplay_experience" | "issue" | "comparison" | "intro";
export type TopicCategory = "survey" | "surprise" | "roleplay" | "advanced";
export type QuestionSource = "textbook" | "verified" | "adapted" | "provided";
export type SetKind = "general" | "roleplay" | "advanced";
export interface SourceReference {
  bookId: string;
  section: "general" | "roleplay" | "preface";
  unit?: number;
  page: number;
  label: string;
  wording: "verbatim";
}
export interface Question {
  id: string;
  /** 자료에 적힌 번호. 답변 저장용 slot과 구분하며 5-A/5-B도 보존합니다. */
  number?: string;
  title?: string;
  type: QuestionType;
  source?: QuestionSource;
  en: string;
  ko: string;
  hints?: string[];
  sourceRef?: SourceReference;
  /** These questions must occur earlier in the same SET. */
  dependsOn?: string[];
}
export interface QuestionSet {
  id: string;
  topicId: string;
  kind: SetKind;
  printedNumber: number;
  questionIds: string[];
  sourceRef: SourceReference;
  note?: string;
}
export interface Topic {
  id: string;
  category: TopicCategory;
  ko: string;
  en: string;
  emoji: string;
  questions: Question[];
  sets?: QuestionSet[];
}
export interface ExamItem {
  slot: number;
  topicId: string;
  topicKo: string;
  topicEn: string;
  emoji: string;
  comboLabel: string;
  typeLabel: string;
  question: Question;
  setId?: string;
  setPosition?: number;
  setSource?: SourceReference;
}
/** 랜덤 연습이 문제를 뽑는 범위. */
export type RandomScope = "all" | "survey" | "surprise";
export interface Exam {
  id: string;
  createdAt: number;
  /** single 은 1문제 랜덤 연습, set 은 한 주제에서 유형에 따라 2~3문항을 푸는 1토픽 랜덤 연습이다. */
  mode: "full" | "practice" | "single" | "set";
  items: ExamItem[];
  focusTopicId?: string;
  /** 랜덤 연습을 뽑은 범위. 기록에서 같은 범위로 다시 뽑을 때 쓴다. 예전 기록에는 없다. */
  randomScope?: RandomScope;
  bank?: "textbook" | "legacy";
  bankVersion?: string;
  setIds?: string[];
  notices?: string[];
}
export interface AnswerRecord { slot: number; text: string; elapsedSec: number }
