import { historyTopicId } from "./history";
import type { HistoryEntry } from "./storage";
import type { Exam, RandomScope } from "./types";

export interface NavLink { href: string; label: string }

export const RANDOM_SCOPES: readonly RandomScope[] = ["all", "survey", "surprise"];
export const RANDOM_SCOPE_LABELS: Record<RandomScope, string> = { all: "서베이+돌발", survey: "서베이", surprise: "돌발" };

/**
 * 랜덤 연습 링크. single 은 한 문항, set 은 한 주제의 2~3문항 세트를 고른 범위에서 뽑는다.
 * 전체 범위는 scope 를 붙이지 않아 예전 주소(`/exam?mode=single`)가 그대로 통한다.
 */
export function randomPracticeLink(mode: "single" | "set", scope: RandomScope = "all"): NavLink {
  return {
    href: scope === "all" ? `/exam?mode=${mode}` : `/exam?mode=${mode}&scope=${scope}`,
    label: `${mode === "single" ? "1문제" : "1토픽"} 랜덤 연습 (${RANDOM_SCOPE_LABELS[scope]})`,
  };
}

interface TopicRef { id: string; ko: string; emoji?: string }

/**
 * 연습 화면에서 빠져나갈 곳. 늘 홈으로 보내면 다음 주제를 고르러 배경 설문 화면을
 * 다시 지나야 해서, 그 연습을 고른 목록으로 되돌린다.
 */
export function examExitLink(mode: Exam["mode"]): NavLink {
  return mode === "full"
    ? { href: "/exam?mode=full", label: "← 실전 모의고사" }
    : { href: "/topics", label: "← 주제별 연습" };
}

/** 연습을 마친 뒤 이어서 하기 좋은 곳. 결과 화면에서 다음 행동으로 보여 준다. */
export function nextPracticeLink(mode: Exam["mode"]): NavLink {
  return mode === "full"
    ? { href: "/topics", label: "주제별 연습 →" }
    : { href: "/topics", label: "다른 주제 연습하기 →" };
}

/**
 * 홈에서 마지막 연습을 그대로 다시 시작하는 링크.
 * 주제를 되짚지 못하는 예전 주제별 기록은 링크를 만들지 않는다.
 */
export function repeatPracticeLink(entry: HistoryEntry, topics: readonly TopicRef[]): NavLink | undefined {
  if (entry.mode === "full") return { href: "/exam?mode=full", label: "실전 모의고사" };
  // 랜덤 연습은 같은 문제가 아니라 같은 범위에서 새로 뽑아 이어 간다.
  if (entry.mode === "single" || entry.mode === "set") return randomPracticeLink(entry.mode, entry.result?.exam.randomScope);
  const topic = topics.find((candidate) => candidate.id === historyTopicId(entry, topics));
  if (!topic) return undefined;
  return {
    href: `/exam?mode=practice&topic=${encodeURIComponent(topic.id)}`,
    label: `${topic.emoji ? `${topic.emoji} ` : ""}${topic.ko}`,
  };
}
