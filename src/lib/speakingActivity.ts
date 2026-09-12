import { countEnglishSentences, hasAnswerText } from "./answers";
import { emptyFeedbackCounts, summarizeFeedback, type FeedbackCounts } from "./feedback";
import type { HistoryEntry } from "./storage";

/** 읽은 당시의 문장 수를 남겨, 피드백을 다시 받아도 지난 연습량은 바뀌지 않는다. */
export interface ReadPractice {
  slot: number;
  completedAt: number;
  sentences: number;
  count: number;
}

export interface SpeakingTotals {
  questions: number;
  answerSentences: number;
  readCount: number;
  readSentences: number;
  feedback: FeedbackCounts;
}

export interface DailySpeaking {
  day: string;
  /** 회차별로 교체하므로 새로고침·재분석으로 중복 합산되지 않는다. */
  entries: Record<string, SpeakingTotals>;
}

export function localDay(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function emptySpeakingTotals(): SpeakingTotals {
  return { questions: 0, answerSentences: 0, readCount: 0, readSentences: 0, feedback: emptyFeedbackCounts() };
}

/**
 * 날짜가 없던 읽기 횟수는 연습 종료와 마지막 저장이 같은 날일 때만 복원한다.
 * 여러 날에 걸친 누적 횟수를 마지막 저장일에 전부 몰아넣지 않는다.
 */
export function savedReadPractices(entry: HistoryEntry): ReadPractice[] {
  const result = entry.result;
  if (!result) return [];
  if (result.readPractices) return result.readPractices;
  const completedAt = Math.max(entry.finishedAt, entry.updatedAt ?? 0);
  if (localDay(entry.finishedAt) !== localDay(completedAt)) return [];
  return result.exam.items.flatMap(({ slot }) => {
    const count = result.readCounts?.[slot] ?? 0;
    const sentences = countEnglishSentences(result.feedback[slot]?.improvedAnswer ?? "");
    return Number.isSafeInteger(count) && count > 0 && sentences > 0
      ? [{ slot, completedAt, sentences, count }] : [];
  });
}

export function speakingForDay(entry: HistoryEntry, day: string): SpeakingTotals {
  const totals = emptySpeakingTotals();
  const result = entry.result;
  // 직접 입력도 포함하는 저장된 답변 기준. 문장 수가 없는 옛 요약은 문제 수만 센다.
  if (localDay(entry.finishedAt) === day) {
    if (result) {
      const answeredSlots: number[] = [];
      for (const { slot } of result.exam.items) {
        if (!hasAnswerText(result.answers[slot])) continue;
        answeredSlots.push(slot);
        totals.questions += 1;
        totals.answerSentences += countEnglishSentences(result.answers[slot]);
      }
      totals.feedback = summarizeFeedback(answeredSlots, result.feedback);
    } else totals.questions = Math.floor(entry.answered);
  }
  for (const practice of savedReadPractices(entry)) {
    if (localDay(practice.completedAt) !== day) continue;
    totals.readCount += practice.count;
    totals.readSentences += practice.sentences * practice.count;
  }
  return totals;
}

/** 오늘의 가벼운 합계만 별도로 보관해, 상세 기록 20회 제한에 합계가 줄지 않게 한다. */
export function mergeDailySpeaking(
  saved: DailySpeaking | null,
  history: readonly HistoryEntry[],
  now: number,
): DailySpeaking {
  const day = localDay(now);
  const entries = Object.fromEntries(Object.entries(saved?.day === day ? saved.entries : {}));
  for (const entry of history) {
    const totals = speakingForDay(entry, day);
    // ID가 객체 프로퍼티 이름과 같아도 안전하게 저장한다.
    Object.defineProperty(entries, entry.id, { value: totals, enumerable: true, configurable: true, writable: true });
  }
  return { day, entries };
}

export function totalDailySpeaking(daily: DailySpeaking): SpeakingTotals {
  return Object.values(daily.entries).reduce((total, entry) => ({
    questions: total.questions + entry.questions,
    answerSentences: total.answerSentences + entry.answerSentences,
    readCount: total.readCount + entry.readCount,
    readSentences: total.readSentences + entry.readSentences,
    feedback: {
      evaluated: total.feedback.evaluated + entry.feedback.evaluated,
      topic: total.feedback.topic + entry.feedback.topic,
      detail: total.feedback.detail + entry.feedback.detail,
      feeling: total.feedback.feeling + entry.feedback.feeling,
    },
  }), emptySpeakingTotals());
}
