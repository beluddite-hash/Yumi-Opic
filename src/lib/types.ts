/** OPIc 문항 유형 — 15문항 슬롯 매핑의 기준이 되는 축 */
export type QuestionType =
  | "description" // 묘사: 2, 5, 8번
  | "routine" // 활동 루틴 / 경향: 3번
  | "experience" // 과거 경험: 4, 6, 9번
  | "memorable" // 가장 기억에 남는 경험: 7, 10, 13번
  | "roleplay_ask" // 롤플레이 - 정보 요청/질문하기: 11번
  | "roleplay_problem" // 롤플레이 - 문제 상황 해결: 12번
  | "issue" // 고난도 - 이슈 / 변화: 14번
  | "comparison" // 고난도 - 비교 / 전망: 15번
  | "intro"; // 자기소개: 1번

/** 주제 분류 */
export type TopicCategory =
  | "survey" // 서베이에서 선택한 주제
  | "surprise" // 돌발 주제
  | "roleplay" // 롤플레이 전용 상황 주제
  | "advanced"; // 고난도 (이슈/변화/비교)

/**
 * 문항 출처.
 *  - verified : 응시자들이 복원해 공개한 실제 출제 문항을 그대로 옮긴 것
 *  - adapted  : 실제 출제 문항이 아니라, OPIc 형식을 따라 자체 제작한 연습 문항
 * OPIc 공식 문제은행은 공개되지 않으므로 verified 도 "복원본"이지 원본은 아니다.
 */
export type QuestionSource = "verified" | "adapted";

export interface Question {
  id: string;
  type: QuestionType;
  /** 생략하면 adapted 로 본다 */
  source?: QuestionSource;
  /** 실제 시험에서 들리는 영어 지문 */
  en: string;
  /** 한국어 요약 (무엇을 물어보는지) */
  ko: string;
  /** 답변에 넣으면 좋은 키워드/아이디어 힌트 */
  hints?: string[];
}

export interface Topic {
  id: string;
  category: TopicCategory;
  /** 한국어 주제명 */
  ko: string;
  /** 영어 주제명 */
  en: string;
  emoji: string;
  questions: Question[];
}

/** 생성된 시험지의 한 문항 */
export interface ExamItem {
  /** 1~15 */
  slot: number;
  topicId: string;
  topicKo: string;
  topicEn: string;
  emoji: string;
  /** "콤보 4 · 롤플레이" 처럼 어느 묶음인지 */
  comboLabel: string;
  /** 슬롯 기준 유형 이름 — 13번은 같은 memorable 이라도 "롤플레이 · 관련 경험" 으로 표시된다 */
  typeLabel: string;
  question: Question;
}

export interface Exam {
  id: string;
  createdAt: number;
  mode: "full" | "practice" | "single";
  items: ExamItem[];
  /** 연습 모드일 때 선택된 주제 */
  focusTopicId?: string;
}

export interface AnswerRecord {
  slot: number;
  text: string;
  /** 실제 답변에 쓴 시간(초) */
  elapsedSec: number;
}
