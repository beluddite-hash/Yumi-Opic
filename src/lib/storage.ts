"use client";

import { surveyTopics } from "@/data";

const SETTINGS_KEY = "yumi-opic:settings";
const HISTORY_KEY = "yumi-opic:history";

export interface Settings {
  /** 서베이에서 선택한 주제 id 목록 */
  enabledSurveyIds: string[];
  /** 문제를 자동으로 읽어줄지 */
  autoSpeak: boolean;
  /** 한국어 요약을 기본으로 펼칠지 */
  showKorean: boolean;
}

export const defaultSettings: Settings = {
  enabledSurveyIds: surveyTopics.map((t) => t.id),
  autoSpeak: false,
  showKorean: false,
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const known = new Set(surveyTopics.map((t) => t.id));
    const ids = (parsed.enabledSurveyIds ?? []).filter((id) => known.has(id));
    return {
      enabledSurveyIds: ids.length > 0 ? ids : defaultSettings.enabledSurveyIds,
      autoSpeak: parsed.autoSpeak ?? defaultSettings.autoSpeak,
      showKorean: parsed.showKorean ?? defaultSettings.showKorean,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* 사파리 프라이빗 모드 등에서는 조용히 무시한다 */
  }
}

export interface HistoryEntry {
  id: string;
  finishedAt: number;
  mode: "full" | "practice" | "single";
  label: string;
  answered: number;
  totalItems: number;
  /** 작성한 답변의 총 단어 수 */
  totalWords: number;
  /** 총 소요 시간(초) */
  totalSec: number;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function pushHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, 20);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* 저장 실패는 무시 */
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* 무시 */
  }
}
