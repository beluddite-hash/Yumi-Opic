"use client";
import {
  DEFAULT_SINGLE_CHOICE_IDS,
  DEFAULT_SURVEY_CHOICE_IDS,
  DEFAULT_SURVEY_IDS,
  choiceIdsForTopics,
  surveyChoiceById,
  topicIdsForChoices,
} from "../data";
import type { Exam, ExamItem } from "./types";
import { emptyFeedbackCounts, FEEDBACK_CRITERIA, isOpicFeedback, type FeedbackCounts, type OpicFeedback } from "./feedback";
import { mergeDailySpeaking, totalDailySpeaking, type DailySpeaking, type ReadPractice, type SpeakingTotals } from "./speakingActivity";
const SETTINGS_KEY = "yumi-opic:settings";
const HISTORY_KEY = "yumi-opic:history";
const DAILY_SPEAKING_KEY = "yumi-opic:daily-speaking";
export const HISTORY_CHANGED_EVENT = "yumi-opic:history-changed";
/**
 * surveyChoiceIds 는 배경 설문 화면에서 고른 항목 전부다. 문제은행이 없는 항목도 그대로 남긴다.
 * enabledSurveyIds 는 그 가운데 문제은행이 있는 주제만 추린 값이라 늘 함께 움직인다.
 * volume 은 문제 낭독 음량(0~1)이다. 시험 화면의 음량 슬라이더가 여기에 저장된다.
 */
export interface Settings { enabledSurveyIds: string[]; surveyChoiceIds: string[]; volume: number }
export const defaultSettings: Settings = {
  enabledSurveyIds: [...DEFAULT_SURVEY_IDS],
  surveyChoiceIds: [...DEFAULT_SURVEY_CHOICE_IDS],
  volume: 1,
};

function freshSettings(): Settings {
  return { ...defaultSettings, enabledSurveyIds: [...DEFAULT_SURVEY_IDS], surveyChoiceIds: [...DEFAULT_SURVEY_CHOICE_IDS] };
}

function idList(value: unknown): string[] | undefined {
  return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === "string"))] : undefined;
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return freshSettings();
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return freshSettings();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return freshSettings();
    const value = parsed as Partial<Settings>;
    // 이전 버전은 주제 ID만 저장했다. 그 선택을 실제 서베이 항목으로 되살린다.
    const choiceIds = idList(value.surveyChoiceIds)
      ?? [...new Set([...DEFAULT_SINGLE_CHOICE_IDS, ...choiceIdsForTopics(idList(value.enabledSurveyIds) ?? DEFAULT_SURVEY_IDS)])];
    const volume = typeof value.volume === "number" && Number.isFinite(value.volume)
      ? Math.min(1, Math.max(0, value.volume))
      : defaultSettings.volume;
    // 모르는 항목도 저장해 둔 그대로 둔다. 나중에 문제은행이 생기면 그 선택이 다시 살아난다.
    return { enabledSurveyIds: topicIdsForChoices(choiceIds), surveyChoiceIds: choiceIds, volume };
  } catch { return freshSettings(); }
}
export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* Storage can be unavailable. */ }
}

/**
 * 이 브라우저에서 배경 설문 화면을 한 번이라도 거쳤는지. 첫 방문만 설문으로 보내고,
 * 그 뒤에는 홈에서 바로 연습을 고르게 하는 데 쓴다.
 */
export function hasSavedSettings(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(SETTINGS_KEY) !== null; }
  catch { return false; }
}

/**
 * 설문 화면에 들어온 사실만 남긴다. 저장이 없으면 홈이 계속 설문으로 되돌려 보내,
 * 아무것도 고치지 않고 나가면 다시 설문에 갇히기 때문이다. 고른 값은 바꾸지 않는다.
 */
export function markSurveySeen(): void {
  if (!hasSavedSettings()) saveSettings(loadSettings());
}

/** 배경 설문에서 고른 항목을 저장한다. 시험에 쓸 주제 목록도 여기서 함께 맞춘다. */
export function saveSurveyChoices(choiceIds: readonly string[]): Settings {
  const next: Settings = {
    ...loadSettings(),
    surveyChoiceIds: [...new Set(choiceIds)],
    enabledSurveyIds: topicIdsForChoices(choiceIds),
  };
  saveSettings(next);
  return next;
}

/** 시험 화면에서 주제만 켜고 끌 때 쓴다. 문제은행이 없는 서베이 선택은 건드리지 않는다. */
export function saveEnabledTopics(topicIds: readonly string[]): Settings {
  const kept = loadSettings().surveyChoiceIds.filter((id) => !surveyChoiceById.get(id)?.topicId);
  return saveSurveyChoices([...kept, ...choiceIdsForTopics(topicIds)]);
}

export interface HistoryEntry {
  id: string; finishedAt: number; mode: Exam["mode"];
  label: string; answered: number; totalItems: number;
  /** 답변이나 AI 피드백을 마지막으로 저장한 시각. 저장을 한 번도 덧붙이지 않은 기록에는 없다. */
  updatedAt?: number;
  /** 이전 버전은 요약만 저장했다. 녹음 Blob/URL은 저장하지 않는다. */
  result?: SavedResult;
}
export interface SavedResult {
  exam: Exam;
  /** 화면과 통계에 쓰는 답변 정본. 녹음본을 OpenAI 로 다시 받아쓰면 그 텍스트로 바뀐다. */
  answers: Record<number, string>;
  /** OpenAI 받아쓰기가 덮어쓰기 전의 브라우저 받아쓰기. 되돌리기와 발음 비교에 쓴다. */
  browserAnswers?: Record<number, string>;
  times: Record<number, number>;
  hintUse: Record<number, number>;
  replays: Record<number, number>;
  feedback: Record<number, OpicFeedback>;
  /** 문항별로 고친 답변을 따라 읽은 횟수. 한 번도 읽지 않은 기록에는 없다. */
  readCounts?: Record<number, number>;
  /** 날짜와 당시 문장 수를 가진 따라 읽기 기록. 빈 배열도 날짜 집계를 시작했다는 뜻이다. */
  readPractices?: ReadPractice[];
}

/** 저장된 기록에서 받아들이는 연습 방식. 모르는 값이 적힌 기록은 버린다. */
const EXAM_MODES: readonly string[] = ["full", "practice", "single", "set"] satisfies Exam["mode"][];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isExamItem(value: unknown): value is ExamItem {
  if (!isRecord(value) || !isRecord(value.question)) return false;
  return Number.isInteger(value.slot) && isCount(value.slot) && value.slot > 0
    && (value.displayNumber === undefined || typeof value.displayNumber === "string")
    && [value.topicId, value.topicKo, value.topicEn, value.emoji, value.comboLabel, value.typeLabel,
      value.question.id, value.question.type, value.question.en, value.question.ko]
      .every((field) => typeof field === "string");
}

function readResult(value: unknown): SavedResult | undefined {
  if (!isRecord(value) || !isRecord(value.exam)) return undefined;
  const exam = value.exam;
  if (typeof exam.id !== "string" || !isCount(exam.createdAt)
    || !EXAM_MODES.includes(String(exam.mode))
    || !Array.isArray(exam.items) || exam.items.length === 0 || !exam.items.every(isExamItem)
    || new Set(exam.items.map((item) => item.slot)).size !== exam.items.length) return undefined;
  const numbers = (record: unknown): Record<number, number> => Object.fromEntries(
    Object.entries(isRecord(record) ? record : {}).filter(([, count]) => isCount(count)),
  ) as Record<number, number>;
  const texts = (record: unknown): Record<number, string> => Object.fromEntries(
    Object.entries(isRecord(record) ? record : {}).filter(([, text]) => typeof text === "string"),
  ) as Record<number, string>;
  // 원본 받아쓰기는 OpenAI 로 다시 받아쓴 문항에만 있다. 없는 기록에 빈 값을 만들지 않는다.
  const browserAnswers = texts(value.browserAnswers);
  // 읽은 횟수도 없는 기록에 빈 값을 만들지 않는다. 이 기능 전에 쌓인 기록이 그렇다.
  const readCounts = numbers(value.readCounts);
  const slots = new Set(exam.items.map((item) => item.slot));
  const readPractices = Array.isArray(value.readPractices) ? value.readPractices.filter((practice): practice is ReadPractice =>
    isRecord(practice) && slots.has(Number(practice.slot)) && typeof practice.slot === "number"
    && isCount(practice.completedAt) && Number.isFinite(new Date(practice.completedAt).getTime())
    && Number.isSafeInteger(practice.sentences) && Number(practice.sentences) > 0
    && Number.isSafeInteger(practice.count) && Number(practice.count) > 0) : undefined;
  return {
    exam: exam as unknown as Exam,
    answers: texts(value.answers),
    ...(Object.keys(browserAnswers).length ? { browserAnswers } : {}),
    ...(Object.keys(readCounts).length ? { readCounts } : {}),
    ...(readPractices ? { readPractices } : {}),
    times: numbers(value.times), hintUse: numbers(value.hintUse), replays: numbers(value.replays),
    feedback: Object.fromEntries(Object.entries(isRecord(value.feedback) ? value.feedback : {})
      .filter(([, feedback]) => isOpicFeedback(feedback))) as Record<number, OpicFeedback>,
  };
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.flatMap((entry: unknown, index: number): HistoryEntry[] => {
      if (!isRecord(entry) || typeof entry.id !== "string" || !entry.id
        || typeof entry.label !== "string" || !isCount(entry.finishedAt)
        || !isCount(entry.answered) || !isCount(entry.totalItems)
        || !EXAM_MODES.includes(String(entry.mode))) return [];
      // 이전 버전은 같은 시험을 다시 풀 때 ID를 재사용했다. 그 요약도 보존한다.
      let id = entry.id;
      while (seen.has(id)) id = `${id}:legacy:${entry.finishedAt}:${index}`;
      seen.add(id);
      return [{
        id, finishedAt: entry.finishedAt, label: entry.label,
        mode: entry.mode as HistoryEntry["mode"], answered: entry.answered, totalItems: entry.totalItems,
        ...(isCount(entry.updatedAt) ? { updatedAt: entry.updatedAt } : {}),
        result: readResult(entry.result),
      }];
    }).slice(0, 20);
  } catch { return []; }
}

function readDailySpeaking(): DailySpeaking | null {
  if (typeof window === "undefined") return null;
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(DAILY_SPEAKING_KEY) ?? "null");
    if (!isRecord(raw) || typeof raw.day !== "string" || !isRecord(raw.entries)) return null;
    const fields = ["questions", "answerSentences", "readCount", "readSentences"] as const;
    const entries = Object.fromEntries(Object.entries(raw.entries).flatMap(([id, entry]) => {
      if (!isRecord(entry) || !fields.every((field) => Number.isSafeInteger(entry[field]) && Number(entry[field]) >= 0)) return [];
      const saved = entry.feedback;
      // 이전 공부량 캐시는 살리고, 없는/손상된 평가는 미평가로 둔다.
      const valid = isRecord(saved) && Number.isSafeInteger(saved.evaluated)
        && Number(saved.evaluated) >= 0 && Number(saved.evaluated) <= Number(entry.questions)
        && FEEDBACK_CRITERIA.every(({ key }) => Number.isSafeInteger(saved[key])
          && Number(saved[key]) >= 0 && Number(saved[key]) <= Number(saved.evaluated));
      return [[id, {
        questions: Number(entry.questions), answerSentences: Number(entry.answerSentences),
        readCount: Number(entry.readCount), readSentences: Number(entry.readSentences),
        feedback: valid ? saved as unknown as FeedbackCounts : emptyFeedbackCounts(),
      }]];
    }));
    return { day: raw.day, entries };
  } catch { return null; }
}

export function loadTodaySpeaking(history = loadHistory(), now = Date.now()): SpeakingTotals {
  return totalDailySpeaking(mergeDailySpeaking(readDailySpeaking(), history, now));
}

function saveHistory(history: HistoryEntry[], removedIds: readonly string[] = []): void {
  if (typeof window === "undefined") throw new Error("이 브라우저에서 기록을 저장할 수 없습니다.");
  try {
    // 20회 밖으로 밀려나는 기록도 오늘 합계에는 먼저 남긴다.
    const daily = mergeDailySpeaking(readDailySpeaking(), [...loadHistory(), ...history], Date.now());
    for (const id of removedIds) delete daily.entries[id];
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    window.localStorage.setItem(DAILY_SPEAKING_KEY, JSON.stringify(daily));
  } catch {
    throw new Error("기록을 저장하지 못했습니다. 브라우저 저장 공간이나 저장 권한을 확인해 주세요.");
  }
  window.dispatchEvent?.(new Event(HISTORY_CHANGED_EVENT));
}

export function pushHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory().filter((item) => item.id !== entry.id)].slice(0, 20);
  saveHistory(next);
  return next;
}

/**
 * 피드백이 늦게 도착해도 다른 탭에서 삭제한 기록을 되살리지 않는다.
 * 연습을 마친 시각은 그대로 두고, 목록에 보여 줄 시각만 지금으로 옮긴다.
 */
export function updateHistoryResult(id: string, result: SavedResult): void {
  const history = loadHistory();
  if (!history.some((entry) => entry.id === id)) throw new Error("이 연습 기록이 삭제되어 변경 내용을 저장하지 못했습니다.");
  saveHistory(history.map((entry) => entry.id === id ? {
    ...entry, result, updatedAt: Date.now(),
    answered: result.exam.items.filter((item) => (result.answers[item.slot] ?? "").trim()).length,
  } : entry));
}

export function deleteHistory(id: string): HistoryEntry[] {
  return deleteHistoryEntries([id]);
}

/** 고른 기록을 함께 지우고 오늘의 말하기 합계에서도 뺀다. */
export function deleteHistoryEntries(ids: readonly string[]): HistoryEntry[] {
  const removed = new Set(ids);
  const next = loadHistory().filter((entry) => !removed.has(entry.id));
  saveHistory(next, ids);
  return next;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
    window.localStorage.removeItem(DAILY_SPEAKING_KEY);
  }
  catch { throw new Error("기록을 삭제하지 못했습니다. 브라우저 저장 권한을 확인해 주세요."); }
  window.dispatchEvent?.(new Event(HISTORY_CHANGED_EVENT));
}
