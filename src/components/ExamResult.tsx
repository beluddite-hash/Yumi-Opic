"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Exam, ExamItem } from "@/lib/types";
import {
  feedbackRewrite,
  FEEDBACK_CRITERIA,
  readFeedbackResponse,
  summarizeFeedback,
  type FeedbackResponse,
  type OpicFeedback,
} from "@/lib/feedback";
import { runInPool, slotsAwaitingFeedback } from "@/lib/feedbackBatch";
import {
  applyAnswerRewrites,
  countEnglishSentences,
  countEnglishWords,
  countUniqueEnglishWords,
  defaultResultFilter,
  filterItemsByAnswer,
  hasAnswerText,
  sameSpokenText,
  summarizeAnswers,
  type ResultFilter,
} from "@/lib/answers";
import { itemNumber } from "@/lib/exam";
import { formatHistoryStamp } from "@/lib/history";
import { savedReadPractices, type ReadPractice } from "@/lib/speakingActivity";
import { recordingExtension, recordingFileName, recordingToMp3 } from "@/lib/mp3";
import { examExitLink, nextPracticeLink } from "@/lib/nav";
import { pushHistory, updateHistoryResult, type HistoryEntry, type SavedResult } from "@/lib/storage";
import type { ExpressionDraft } from "@/lib/expressions";
import { useSavedExpressions } from "./SavedExpressions";
import FeedbackDetails from "./FeedbackDetails";
import FeedbackProgress from "./FeedbackProgress";
import { Badge, Card, ProgressBar, SourceBadge } from "./ui";
import Footer from "./Footer";

function formatTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export interface AnswerRecording {
  url: string;
  mimeType: string;
}

const FEEDBACK_ERROR = "AI 피드백을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요.";

/**
 * 한 번에 받기로 동시에 보내는 문항 수. 한 문항에 녹음 전사와 피드백 생성이 이어져
 * 수십 초가 걸리므로 차례로만 보내면 너무 오래 기다린다. 너무 많이 겹치면 서버가 버거워한다.
 */
const BATCH_CONCURRENCY = 3;

/** 서버에 키가 없을 때처럼 다른 문항도 똑같이 실패할 오류. 한 번에 받기는 여기서 멈춘다. */
class FeedbackRequestError extends Error {
  readonly stopsBatch: boolean;

  constructor(message: string, stopsBatch: boolean) {
    super(message);
    this.stopsBatch = stopsBatch;
  }
}

/** 한 문항을 `/api/feedback` 에 보낸다. 개별 버튼과 한 번에 받기가 모두 이 요청을 쓴다. */
async function fetchFeedback({ item, transcript, elapsed, recording }: {
  item: ExamItem;
  /** 발음 점검에 쓰는 받아쓰기. 이미 다시 받아쓴 문항은 원래 브라우저 받아쓰기다. */
  transcript: string;
  elapsed: number;
  recording?: AnswerRecording;
}): Promise<FeedbackResponse> {
  const body = new FormData();
  body.append("question", item.question.en);
  body.append("topic", `${item.topicKo} / ${item.topicEn}`);
  body.append("type", item.typeLabel);
  body.append("questionType", item.question.type);
  body.append("transcript", transcript);
  body.append("elapsedSec", String(elapsed));

  if (recording) {
    try {
      const blob = await (await fetch(recording.url)).blob();
      if (blob.size > 0) {
        body.append("audio", blob, recordingFileName(item.slot, recordingExtension(recording.mimeType)));
      }
    } catch {
      // 녹음본 전송이 실패해도 텍스트 피드백은 받을 수 있다.
    }
  }

  const response = await fetch("/api/feedback", { method: "POST", body });
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  const result = response.ok ? readFeedbackResponse(payload) : null;
  // 503 은 서버에 키가 설정되지 않았다는 뜻이라 남은 문항을 보내도 소용이 없다.
  if (!result) throw new FeedbackRequestError(payload?.error || FEEDBACK_ERROR, response.status === 503);
  return result;
}

/** 한 문항 요청의 결과. 한 번에 받기가 진행률과 멈춤을 정하는 데 쓴다. */
type FeedbackOutcome =
  | { status: "done" | "skipped" }
  | { status: "failed"; message: string; stopsBatch: boolean };

/** 한 번에 받기의 진행 상황. 끝난 뒤에도 남겨 결과를 한 줄로 알린다. */
interface FeedbackBatch {
  total: number;
  /** 끝난 문항 수. 받았든, 실패했든, 그 사이 개별 버튼으로 먼저 받아 건너뛰었든 모두 센다. */
  settled: number;
  received: number;
  failed: number;
  running: boolean;
  /** 사용자가 멈췄거나, 남은 문항도 똑같이 실패할 오류를 만났을 때. */
  stop: "user" | "fatal" | null;
  fatalMessage?: string;
}

/**
 * 결과 화면에서 바꿔 쓴 답변.
 *
 * AI 분석은 녹음본을 OpenAI 로 한 번 더 받아쓴다. 그쪽이 브라우저 받아쓰기보다
 * 정확한 편이라 답변 정본을 그 텍스트로 바꾸고, 원래 받아쓰기는 되돌리기와
 * 발음 비교용으로 남겨 둔다. 두 값을 한 상태로 묶어 두 문항을 동시에 분석해도
 * 서로의 결과를 덮어쓰지 않는다.
 */
interface AnswerRewrites {
  /** 문항별로 바꿔 쓴 답변. 저장된 답변 위에 이 값이 덮인다. */
  texts: Record<number, string>;
  /** OpenAI 로 다시 받아쓴 문항의 원래 브라우저 받아쓰기. 되돌리면 사라진다. */
  browser: Record<number, string>;
}

export default function ExamResult({
  exam,
  title,
  answers,
  times,
  hintUse = {},
  replays = {},
  recordings = {},
  historyEntry,
  onRetry,
  onRegenerate,
}: {
  exam: Exam;
  title: string;
  answers: Record<number, string>;
  times: Record<number, number>;
  /** 문항별로 힌트를 꾹 눌러 본 횟수. 실전에서는 없는 도움이라 따로 보여 준다. */
  hintUse?: Record<number, number>;
  /** 문항별 다시 듣기 사용 횟수. */
  replays?: Record<number, number>;
  /** 브라우저에서 녹음한 문항별 답변. URL은 현재 페이지 세션 동안만 유지된다. */
  recordings?: Record<number, AnswerRecording>;
  historyEntry?: HistoryEntry;
  onRetry?: () => void;
  onRegenerate?: () => void;
}) {
  const [attempt] = useState(() => ({
    id: historyEntry?.id ?? crypto.randomUUID(),
    finishedAt: historyEntry?.finishedAt ?? Date.now(),
  }));
  const [rewrites, setRewrites] = useState<AnswerRewrites>(() => ({
    texts: {},
    browser: { ...(historyEntry?.result?.browserAnswers ?? {}) },
  }));
  // 넘겨받은 답변이 바탕이다. 마이크가 늦게 확정한 받아쓰기는 여기로 들어오고,
  // 다시 받아쓴 문항만 위에서 덮으므로 두 경로가 서로를 지우지 않는다.
  const answerBySlot = useMemo(() => applyAnswerRewrites(answers, rewrites.texts), [answers, rewrites.texts]);
  const { answeredSlots, answeredCount, skippedCount, totalWords, averageWords, totalSentences,
    uniqueWords, totalTime, totalHints, totalReplays } = summarizeAnswers(exam.items, answerBySlot, times, hintUse, replays);
  const [feedbackBySlot, setFeedbackBySlot] = useState<Record<number, OpicFeedback>>(historyEntry?.result?.feedback ?? {});
  // 고친 답변을 끝까지 따라 읽은 횟수. 답변·피드백과 같은 회차에 함께 쌓인다.
  const [readCounts, setReadCounts] = useState<Record<number, number>>(historyEntry?.result?.readCounts ?? {});
  const [readPractices, setReadPractices] = useState<ReadPractice[]>(() => historyEntry ? savedReadPractices(historyEntry) : []);
  // 한 번에 받기가 차례를 기다리는 사이 개별 버튼으로 먼저 받은 문항을, 렌더를 기다리지 않고 알아보려고 둔다.
  // 피드백은 이 값을 고친 뒤 그대로 상태에 넘기므로 둘은 늘 같다.
  const feedbackRef = useRef(feedbackBySlot);
  // 지금 서버에 요청 중인 문항. 같은 문항을 겹쳐 보내지 않도록 렌더와 상관없이 바로 읽고 쓴다.
  const inFlight = useRef(new Set<number>());
  const [pendingSlots, setPendingSlots] = useState<ReadonlySet<number>>(() => new Set());
  const [feedbackErrors, setFeedbackErrors] = useState<Record<number, string>>({});
  const [batch, setBatch] = useState<FeedbackBatch | null>(null);
  const batchStop = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(!!historyEntry);
  const [savedAt, setSavedAt] = useState(() => Math.max(attempt.finishedAt, historyEntry?.updatedAt ?? 0));
  const saved = useRef(!!historyEntry);
  const latestResult = useRef<SavedResult>({ exam, answers: answerBySlot, times, hintUse, replays, feedback: feedbackBySlot });
  // 되돌려서 원본이 하나도 남지 않으면 키 자체를 빼 예전 기록과 같은 모양으로 저장한다.
  latestResult.current = {
    exam, answers: answerBySlot, times, hintUse, replays, feedback: feedbackBySlot,
    ...(Object.keys(rewrites.browser).length ? { browserAnswers: rewrites.browser } : {}),
    ...(Object.keys(readCounts).length ? { readCounts } : {}),
    readPractices,
  };

  const persist = useCallback((result: SavedResult) => {
    try {
      if (saved.current) updateHistoryResult(attempt.id, result);
      else {
        pushHistory({ ...attempt, mode: exam.mode, label: title,
          answered: result.exam.items.filter((item) => hasAnswerText(result.answers[item.slot])).length,
          totalItems: exam.items.length, result });
        saved.current = true;
      }
      setPersisted(true);
      setSaveError(null);
      setSavedAt(Date.now());
    } catch (error) {
      setPersisted(false);
      setSaveError(error instanceof Error ? error.message : "기록을 저장하지 못했습니다.");
    }
  }, [attempt, exam, title]);

  /**
   * 지난 기록을 열어 보기만 할 때는 다시 저장하지 않는다. 답변을 다시 받아쓰거나
   * AI 피드백을 받은 뒤부터 같은 회차에 덧붙인다.
   */
  const readOnly = useRef(!!historyEntry);

  // 저장은 이 한 곳에서만 한다. 초기 저장, 늦게 확정되는 받아쓰기, 다시 받아쓴 답변,
  // AI 피드백이 모두 같은 회차로 모인다.
  useEffect(() => {
    if (readOnly.current) return;
    persist(latestResult.current);
  }, [persist, answerBySlot, times, rewrites, feedbackBySlot, readCounts, readPractices]);

  /** 한 문항을 끝까지 따라 읽었다. 지난 기록을 열어 읽어도 그 회차에 쌓인다. */
  const countRead = useCallback((slot: number) => {
    const sentences = countEnglishSentences(feedbackRef.current[slot]?.improvedAnswer ?? "");
    if (!sentences) return;
    const practice = { slot, completedAt: Date.now(), sentences, count: 1 };
    readOnly.current = false;
    setReadCounts((current) => ({ ...current, [slot]: (current[slot] ?? 0) + 1 }));
    setReadPractices((current) => [...current, practice]);
  }, []);

  /**
   * AI 분석 결과를 반영한다. 녹음본 전사가 오면 답변 정본도 그 텍스트로 바꾼다.
   * 브라우저 받아쓰기와 사실상 같은 문장이면 굳이 바꾸지 않는다.
   */
  function applyFeedback(slot: number, response: FeedbackResponse) {
    readOnly.current = false;
    feedbackRef.current = { ...feedbackRef.current, [slot]: response.feedback };
    setFeedbackBySlot(feedbackRef.current);
    const transcript = response.audioTranscript;
    if (!hasAnswerText(transcript)) return;
    setRewrites((current) => {
      const shown = applyAnswerRewrites(answers, current.texts)[slot] ?? "";
      if (sameSpokenText(transcript, shown)) return current;
      return {
        texts: { ...current.texts, [slot]: transcript },
        // 다시 분석해도 맨 처음 브라우저 받아쓰기를 원본으로 지킨다.
        browser: current.browser[slot] === undefined ? { ...current.browser, [slot]: shown } : current.browser,
      };
    });
  }

  /** 다시 받아쓴 답변을 물리고 브라우저 받아쓰기로 돌아간다. */
  function revertAnswer(slot: number) {
    readOnly.current = false;
    setRewrites((current) => {
      const original = current.browser[slot];
      if (original === undefined) return current;
      const browser = { ...current.browser };
      delete browser[slot];
      return { texts: { ...current.texts, [slot]: original }, browser };
    });
  }

  /**
   * 한 문항의 AI 피드백을 받는다. 개별 버튼과 한 번에 받기가 모두 이 함수를 거친다.
   * 같은 문항이 이미 요청 중이면 겹쳐 보내지 않는다. 답변은 늘 마지막으로 그린 값을 읽는다.
   */
  async function requestFeedback(item: ExamItem): Promise<FeedbackOutcome> {
    const slot = item.slot;
    const answer = latestResult.current.answers[slot] ?? "";
    if (!hasAnswerText(answer) || inFlight.current.has(slot)) return { status: "skipped" };
    inFlight.current.add(slot);
    setPendingSlots(new Set(inFlight.current));
    setFeedbackErrors((current) => {
      if (!(slot in current)) return current;
      const next = { ...current };
      delete next[slot];
      return next;
    });

    try {
      applyFeedback(slot, await fetchFeedback({
        item,
        // 발음 점검은 브라우저 받아쓰기와 새 전사를 견주어 본다. 이미 바꿔 쓴 문항은
        // 원래 받아쓰기를 보내야 두 인식 결과의 차이가 그대로 남는다.
        transcript: latestResult.current.browserAnswers?.[slot] ?? answer,
        elapsed: times[slot] ?? 0,
        recording: recordings[slot],
      }));
      return { status: "done" };
    } catch (error) {
      // 연결이 끊긴 경우 브라우저의 영어 오류 문구 대신 안내 문구를 보여 준다.
      const message = error instanceof FeedbackRequestError ? error.message : FEEDBACK_ERROR;
      setFeedbackErrors((current) => ({ ...current, [slot]: message }));
      return { status: "failed", message, stopsBatch: error instanceof FeedbackRequestError && error.stopsBatch };
    } finally {
      inFlight.current.delete(slot);
      setPendingSlots(new Set(inFlight.current));
    }
  }

  /** 문항 카드의 버튼. 이미 받은 문항을 다시 분석할 때만 한 번 묻는다. */
  function requestItemFeedback(item: ExamItem) {
    if (feedbackRef.current[item.slot] && !window.confirm(
      "이 문항은 이미 AI 피드백을 받았습니다.\n다시 분석하면 지금 피드백과 Before / After 가 새 결과로 바뀝니다. 계속할까요?",
    )) return;
    void requestFeedback(item);
  }

  /**
   * 답변한 문항 가운데 아직 피드백이 없는 것만 모아 한 번에 받는다. 문항마다 개별 버튼과
   * 같은 요청을 보내고, 끝나는 대로 그 문항 카드에 붙는다.
   */
  async function requestAllFeedback() {
    if (batch?.running) return;
    const targets = slotsAwaitingFeedback(answeredSlots, feedbackRef.current, inFlight.current);
    if (targets.length === 0) return;
    const itemBySlot = new Map(exam.items.map((item) => [item.slot, item]));
    let fatalMessage: string | undefined;
    batchStop.current = false;
    setBatch({ total: targets.length, settled: 0, received: 0, failed: 0, running: true, stop: null });

    try {
      await runInPool(targets, BATCH_CONCURRENCY, async (slot) => {
        const item = itemBySlot.get(slot);
        // 차례를 기다리는 사이 개별 버튼으로 먼저 받았거나 지금 받는 중인 문항은 건너뛴다.
        const waiting = item && slotsAwaitingFeedback([slot], feedbackRef.current, inFlight.current).length > 0;
        const outcome: FeedbackOutcome = waiting ? await requestFeedback(item) : { status: "skipped" };
        if (outcome.status === "failed" && outcome.stopsBatch) {
          batchStop.current = true;
          fatalMessage ??= outcome.message;
        }
        setBatch((current) => current && {
          ...current,
          settled: current.settled + 1,
          received: current.received + (outcome.status === "done" ? 1 : 0),
          failed: current.failed + (outcome.status === "failed" ? 1 : 0),
        });
      }, () => batchStop.current);
    } finally {
      setBatch((current) => current && {
        ...current,
        running: false,
        ...(fatalMessage ? { stop: "fatal" as const, fatalMessage } : {}),
      });
    }
  }

  /** 새 문항은 더 보내지 않는다. 이미 보낸 문항은 마저 받는다. */
  function stopBatch() {
    batchStop.current = true;
    setBatch((current) => current && { ...current, stop: current.stop ?? "user" });
  }

  // 결과 화면을 떠나면 한 번에 받기가 남은 문항을 더 보내지 않는다.
  useEffect(() => () => { batchStop.current = true; }, []);

  // 별표로 저장한 피드백은 회차가 아니라 문항에 붙는다. 같은 문항을 다시 풀 때 연습 도구에 나온다.
  const expressions = useSavedExpressions();

  const recordingCount = answeredSlots.filter((slot) => recordings[slot]).length;
  // 미답변 문항이 목록을 채우면 실제로 말한 답변을 다시 보기 어렵다. 기본은 답변한 문항만 보여 준다.
  const [filter, setFilter] = useState<ResultFilter>(() => defaultResultFilter(answeredCount, exam.items.length));
  const visibleItems = filterItemsByAnswer(exam.items, answerBySlot, filter);
  const rewrittenCount = Object.keys(rewrites.browser).length;
  const waitingSlots = slotsAwaitingFeedback(answeredSlots, feedbackBySlot, pendingSlots);
  const feedbackCount = answeredSlots.filter((slot) => feedbackBySlot[slot]).length;
  const feedbackCounts = summarizeFeedback(answeredSlots, feedbackBySlot);
  const exit = examExitLink(exam.mode);
  const next = nextPracticeLink(exam.mode);
  // 연습을 마친 뒤 답변이나 피드백을 덧붙였다면 언제 저장한 회차인지 함께 적는다.
  const finishedStamp = formatHistoryStamp({ finishedAt: attempt.finishedAt });
  const savedStamp = formatHistoryStamp({ finishedAt: attempt.finishedAt, updatedAt: savedAt });

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={exit.href} className="text-sm text-fg-muted transition hover:text-fg">{exit.label}</Link>
        <Link href="/" className="text-sm text-fg-muted transition hover:text-fg">홈 →</Link>
      </div>
      <Card className="animate-fade-up mt-5 p-6 sm:p-8">
        <Badge tone="accent">{title}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{historyEntry ? "지난 연습 결과" : "연습 결과"}</h1>
        <p className="mt-2 text-xs text-fg-subtle">{savedStamp}{savedStamp === finishedStamp ? "" : ` 저장 · 연습 ${finishedStamp}`}</p>
        <p className="mt-3 text-sm text-fg-muted">답변 {answeredCount}문항 · 말한 시간 {formatTime(totalTime)} · 녹음 {recordingCount}개</p>
        <div className="mt-5 border-t border-line pt-5">
          <FeedbackProgress counts={feedbackCounts} total={answeredCount} />
        </div>
        {saveError && <p role="alert" className="mt-3 text-xs text-warn-ink">{saveError}</p>}

        {/* 결과를 열면 문항 피드백부터 보이게 한다. 통계와 안내는 지우지 않고 접어 둔다. */}
        <details className="mt-5 border-t border-line pt-1">
          <summary className="cursor-pointer select-none py-3 text-sm font-semibold text-fg-muted">연습 통계</summary>
          {answeredCount > 0 && <AnswerTimeline exam={exam} answeredSlots={answeredSlots} times={times} />}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
            <div><dt className="text-xs text-fg-muted">답변한 문항</dt><dd className="mt-1 text-lg font-medium tabular-nums">{answeredCount}/{exam.items.length}</dd></div>
            <div><dt className="text-xs text-fg-muted">전체 단어</dt><dd className="mt-1 text-lg font-medium tabular-nums">{totalWords}</dd></div>
            <div><dt className="text-xs text-fg-muted">답변당 평균 단어</dt><dd className="mt-1 text-lg font-medium tabular-nums">{averageWords === null ? "—" : Number(averageWords.toFixed(1))}</dd></div>
            <div><dt className="text-xs text-fg-muted">고유 단어</dt><dd className="mt-1 text-lg font-medium tabular-nums">{uniqueWords}</dd></div>
            <div><dt className="text-xs text-fg-muted">문장 수</dt><dd className="mt-1 text-lg font-medium tabular-nums">{totalSentences}</dd></div>
            <div><dt className="text-xs text-fg-muted">말한 시간</dt><dd className="mt-1 text-lg font-medium tabular-nums">{formatTime(totalTime)}</dd></div>
            <div><dt className="text-xs text-fg-muted">다시 듣기</dt><dd className="mt-1 text-lg font-medium tabular-nums">{totalReplays}회</dd></div>
            <div><dt className="text-xs text-fg-muted">힌트 사용</dt><dd className="mt-1 text-lg font-medium tabular-nums">{totalHints}회</dd></div>
            <div><dt className="text-xs text-fg-muted">녹음본</dt><dd className="mt-1 text-lg font-medium tabular-nums">{recordingCount}개</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-fg-muted">미답변 {skippedCount}문항은 평균 단어 수를 포함한 모든 답변 통계와 AI 분석에서 제외합니다. 녹음본이 있어도 답변 텍스트가 비어 있으면 미답변으로 처리합니다.</p>
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">전체 단어는 반복을 포함하고, 고유 단어는 대소문자를 무시한 중복 제거 기준입니다. 문장 수는 받아쓰기 텍스트의 문장부호를 기준으로 계산합니다.</p>
        </details>

        <details className="mt-2 border-t border-line pt-1">
          <summary className="cursor-pointer select-none py-3 text-sm font-semibold text-fg-muted">저장·분석 안내</summary>
          <p className="mt-3 text-xs leading-relaxed text-fg-muted">문항별 질문, 받아쓰기 결과, 녹음본을 확인해 보세요. AI 코칭은 아래에서 한 번에 받거나 문항마다 따로 받을 수 있습니다.</p>
          {persisted && <p className="mt-2 text-xs leading-relaxed text-fg-muted">질문·답변·AI 피드백은 이 브라우저에 최근 20회까지 저장됩니다. 주제별 연습·실전 모의고사 화면 아래의 연습 기록에서 다시 볼 수 있습니다. 녹음본은 현재 화면에서만 재생되므로 필요하면 다운로드해 주세요.</p>}
          {rewrittenCount > 0 && <p className="mt-2 text-xs leading-relaxed text-fg-muted">AI 분석에 녹음본을 보낸 {rewrittenCount}문항은 OpenAI 가 다시 받아쓴 텍스트를 답변으로 씁니다. 위 통계도 그 텍스트 기준이며, 문항을 펼치면 원래 브라우저 받아쓰기를 보거나 되돌릴 수 있습니다.</p>}
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            AI 코칭은 문법 채점보다 <strong className="font-semibold text-fg">{FEEDBACK_CRITERIA.map(({ label }) => label).join(" → ")}</strong> 흐름과 전달력을 우선합니다. 답변 첫 몇 문장 안에 질문에 대한 답이 나오는 <strong className="font-semibold text-fg">두괄식</strong>인지도 함께 봅니다. 꼭 첫 문장일 필요는 없습니다. 롤플레이 11~13번은 전화 대화에 가까워 두괄식을 요구하지 않고, 요청·문제가 일찍 드러나는지만 봅니다. 생각과 생각을 자연스럽게 잇는 <strong className="font-semibold text-fg">연결 표현</strong>도 짚어 줍니다. 문법은 의미 전달을 크게 방해하는 경우만 지적하도록 설정했습니다.
          </p>
        </details>
      </Card>

      {answeredCount > 0 && (
        <BatchFeedbackPanel
          answeredCount={answeredCount}
          feedbackCount={feedbackCount}
          waitingCount={waitingSlots.length}
          pendingCount={pendingSlots.size}
          batch={batch}
          onStart={requestAllFeedback}
          onStop={stopBatch}
        />
      )}

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-widest text-fg-muted">문항별 답변 다시 보기</h2>
        {skippedCount > 0 && (
          <div role="group" aria-label="문항 보기 범위" className="inline-flex gap-1 rounded-xl border border-line bg-surface p-1">
            <FilterButton active={filter === "answered"} onClick={() => setFilter("answered")}>답변한 문항 {answeredCount}</FilterButton>
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>전체 {exam.items.length}</FilterButton>
          </div>
        )}
      </div>
      {filter === "answered" && skippedCount > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-fg-subtle">답변 없는 {skippedCount}문항은 숨겼습니다. <strong className="font-medium text-fg-muted">전체</strong>를 누르면 다시 볼 수 있습니다.</p>
      )}
      <div className="mt-4 space-y-4">
        {visibleItems.map((item) => (
          <ItemResult
            key={item.slot}
            item={item}
            number={itemNumber(exam.mode, item)}
            answer={answerBySlot[item.slot] ?? ""}
            browserAnswer={rewrites.browser[item.slot]}
            elapsed={times[item.slot] ?? 0}
            hints={hintUse[item.slot] ?? 0}
            replays={replays[item.slot] ?? 0}
            recording={recordings[item.slot]}
            feedback={feedbackBySlot[item.slot]}
            feedbackLoading={pendingSlots.has(item.slot)}
            feedbackError={feedbackErrors[item.slot] ?? null}
            onRequestFeedback={() => requestItemFeedback(item)}
            onRevertAnswer={() => revertAnswer(item.slot)}
            reads={readCounts[item.slot] ?? 0}
            onRead={() => countRead(item.slot)}
            savedIds={expressions.savedIds}
            onToggleExpression={expressions.toggle}
            expressionError={expressions.error}
          />
        ))}
        {visibleItems.length === 0 && (
          <Card className="px-5 py-6">
            <p className="text-sm text-fg-muted">답변한 문항이 없습니다. <strong className="font-medium text-fg">전체</strong>를 누르면 이번에 받은 질문을 볼 수 있습니다.</p>
          </Card>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        {onRetry && <button type="button" onClick={onRetry} className="rounded-xl border border-line px-4 py-2.5 text-sm text-fg-muted">같은 문제 다시 풀기</button>}
        {onRegenerate && (
          <button type="button" onClick={onRegenerate} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover">문제 다시 뽑기</button>
        )}
        {/* 여기까지 왔으면 다음 연습으로 가는 길이 있어야 한다. 없으면 뒤로가기가 유일한 다음 행동이 된다. */}
        <Link href={next.href} className="inline-flex items-center rounded-xl border border-line px-4 py-2.5 text-sm text-primary-ink transition-colors hover:bg-surface-2">{next.label}</Link>
      </div>

      <Footer />
    </main>
  );
}

/** 막대를 가득 채우는 시간. 회차마다 눈금이 달라지지 않도록 고정값으로 둔다. */
const TIMELINE_FULL_SEC = 150;
/** 넉넉하게 잡은 적정 답변 길이. 1:20 ~ 2:00 이며 트랙에 음영으로 표시한다. */
const TIMELINE_RANGE_SEC = [80, 120] as const;

/**
 * 답변한 문항의 말한 시간을 순서대로 늘어놓는다.
 *
 * 막대는 2:30 을 가득 찬 것으로 잡은 고정 눈금이다. 회차에서 가장 긴 답변을
 * 기준으로 삼으면 같은 1분 답변이 회차마다 다른 길이로 보여 서로 견줄 수 없다.
 *
 * 길이를 색으로 판정하지 않는다. 막대는 언제나 브랜드색 한 가지고, 적정 구간만
 * 트랙에 음영으로 표시해 사용자가 스스로 견주게 한다. 건너뛰거나 짧게 끝낸 데는
 * 본인 사정이 있다.
 *
 * 번호는 문항 카드와 같은 값을 써서 두 목록이 어긋나지 않는다.
 */
function AnswerTimeline({ exam, answeredSlots, times }: {
  exam: Exam;
  answeredSlots: readonly number[];
  times: Record<number, number>;
}) {
  const itemBySlot = new Map(exam.items.map((item) => [item.slot, item]));

  return (
    <div className="mt-5 border-t border-line pt-5">
      <ul aria-label="문항별 말한 시간" className="space-y-3">
        {answeredSlots.map((slot) => {
          const item = itemBySlot.get(slot);
          if (!item) return null;
          const elapsed = times[slot] ?? 0;
          return (
            <li key={slot} className="flex items-center gap-3">
              <span className="shrink-0 rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-fg-muted">{itemNumber(exam.mode, item)}</span>
              <span className="min-w-0 flex-1">
                <span className="mb-1.5 block truncate text-xs text-fg-muted">{item.typeLabel} · {item.emoji} {item.topicKo}</span>
                <AnswerTimeBar seconds={elapsed} />
              </span>
              <span className="shrink-0 text-xs tabular-nums text-fg-muted">{formatTime(elapsed)}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">막대는 2:30 을 가득 찬 것으로 잡았고, 옅게 칠한 구간이 1:20 ~ 2:00 입니다.</p>
    </div>
  );
}

/**
 * 고정 눈금 막대.
 *
 * 적정 구간 음영은 채운 막대에 덮이므로, 구간의 양 끝은 눈금선으로 한 번 더
 * 그린다. 눈금선을 맨 위에 두어 막대가 길어도 목표 위치가 보이게 한다.
 */
function AnswerTimeBar({ seconds }: { seconds: number }) {
  const pct = (value: number) => (value / TIMELINE_FULL_SEC) * 100;
  const filled = Math.min(100, Math.max(0, pct(seconds)));
  const [rangeStart, rangeEnd] = TIMELINE_RANGE_SEC;
  return (
    <span className="relative block h-2 w-full overflow-hidden rounded-full bg-surface-3">
      <span aria-hidden className="absolute inset-y-0 block bg-time-zone" style={{ left: `${pct(rangeStart)}%`, width: `${pct(rangeEnd - rangeStart)}%` }} />
      <span className="absolute inset-y-0 left-0 block rounded-full bg-primary" style={{ width: `${filled}%` }} />
      {TIMELINE_RANGE_SEC.map((mark) => (
        <span key={mark} aria-hidden className="absolute inset-y-0 block w-px bg-canvas" style={{ left: `${pct(mark)}%` }} />
      ))}
    </span>
  );
}

/**
 * 녹음본 재생과 mp3 내려받기.
 *
 * 녹음 원본은 webm/opus 라 휴대폰이나 기본 음악 앱에서 열리지 않는 일이 잦다.
 * 그래서 받는 순간에 브라우저가 mp3 로 다시 만든다. 몇 초가 걸리므로 버튼에
 * 진행률을 적고, 한 번 만든 파일은 들고 있다가 다시 누르면 그대로 내려 준다.
 * 변환이 실패해도 녹음을 못 받는 일은 없어야 하므로 원본 내려받기를 남겨 둔다.
 */
function RecordingPlayer({ recording, slot }: { recording: AnswerRecording; slot: number }) {
  const [progress, setProgress] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const mp3UrlRef = useRef<string | null>(null);
  const extension = recordingExtension(recording.mimeType);

  // 문항을 접거나 결과 화면을 떠나면 만들어 둔 mp3 주소를 놓아 준다.
  useEffect(() => () => {
    if (mp3UrlRef.current) URL.revokeObjectURL(mp3UrlRef.current);
  }, []);

  const converting = progress !== null;

  async function downloadMp3() {
    if (converting) return;
    setFailed(false);
    try {
      if (!mp3UrlRef.current) {
        setProgress(0);
        const source = await (await fetch(recording.url)).blob();
        const mp3 = await recordingToMp3(source, (ratio) => setProgress(ratio));
        mp3UrlRef.current = URL.createObjectURL(mp3);
      }
      const link = document.createElement("a");
      link.href = mp3UrlRef.current;
      link.download = recordingFileName(slot, "mp3");
      link.click();
    } catch {
      setFailed(true);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <audio controls preload="metadata" src={recording.url} className="max-w-full flex-1" />
        <button
          type="button"
          onClick={downloadMp3}
          disabled={converting}
          className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-fg-muted transition hover:text-fg disabled:cursor-progress disabled:opacity-70"
        >
          {converting ? `mp3로 바꾸는 중 ${Math.round((progress ?? 0) * 100)}%` : "녹음본 mp3 다운로드"}
        </button>
      </div>
      {failed && (
        <p className="mt-2 text-xs leading-relaxed text-fg-muted">
          mp3로 바꾸지 못했습니다.{" "}
          <a href={recording.url} download={recordingFileName(slot, extension)} className="underline">
            원본({extension}) 파일로 받기
          </a>
        </p>
      )}
    </div>
  );
}

function ItemResult({
  item,
  number,
  answer,
  browserAnswer,
  elapsed,
  hints,
  replays,
  recording,
  feedback,
  feedbackLoading,
  feedbackError,
  onRequestFeedback,
  onRevertAnswer,
  reads,
  onRead,
  savedIds,
  onToggleExpression,
  expressionError,
}: {
  item: ExamItem;
  /** 머리에 적는 문항 번호. 모의고사는 시험 번호, 돌발 주제별 연습은 자료 번호다. */
  number: string;
  /** 화면에 보여 줄 답변 정본. 다시 받아쓴 문항은 OpenAI 텍스트다. */
  answer: string;
  /** 다시 받아쓰기 전의 브라우저 받아쓰기. 값이 있으면 답변이 바뀐 문항이다. */
  browserAnswer?: string;
  elapsed: number;
  hints: number;
  replays: number;
  recording?: AnswerRecording;
  feedback?: OpicFeedback;
  /** 이 문항을 지금 분석 중인지. 개별 버튼과 한 번에 받기 어느 쪽에서 보냈든 같다. */
  feedbackLoading: boolean;
  feedbackError: string | null;
  onRequestFeedback: () => void;
  onRevertAnswer: () => void;
  /** 고친 답변을 끝까지 따라 읽은 횟수. */
  reads: number;
  onRead: () => void;
  /** 이미 저장한 조언의 키. 별표 버튼의 켜짐/꺼짐을 정한다. */
  savedIds: ReadonlySet<string>;
  onToggleExpression: (draft: ExpressionDraft) => void;
  expressionError: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [showBrowserAnswer, setShowBrowserAnswer] = useState(false);
  const hasAnswer = hasAnswerText(answer);
  const expressionContext = {
    questionId: item.question.id, questionEn: item.question.en,
    topicId: item.topicId, topicKo: item.topicKo,
  };

  return (
    <Card className="overflow-hidden">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="grid w-full grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-4 text-left transition hover:bg-surface-2 sm:px-5">
        <span className="col-start-1 row-start-1 grid h-8 w-8 place-items-center rounded-lg bg-surface-3 text-sm font-semibold text-fg-muted">{number}</span>
        <span className="col-start-2 row-start-1 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate text-sm text-fg">{item.typeLabel}</span>
            <span className="block truncate text-xs text-fg-subtle">{item.emoji} {item.topicKo}</span>
          </span>
          <ItemStatus loading={feedbackLoading} failed={!!feedbackError} feedback={!!feedback} answered={hasAnswer} />
        </span>
        <span className="col-span-3 row-start-2 flex flex-wrap gap-1.5 sm:col-span-2 sm:col-start-2">
          {FEEDBACK_CRITERIA.map(({ key, label }) => {
            const status = hasAnswer ? feedback?.structure[key] : undefined;
            const good = status === "good";
            return <span key={key} aria-label={`${label}: ${status ? good ? "좋음" : "보강" : "미평가"}`}
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium ring-1 ring-inset sm:text-xs ${status ? good ? "bg-success-tint text-success-ink ring-success-ink/30" : "bg-warn-tint text-warn-ink ring-warn-ink/30" : "bg-surface-2 text-fg-subtle ring-line"}`}>
              <span aria-hidden="true">{status ? good ? "✓" : "△" : "—"}</span>{label}
            </span>;
          })}
        </span>
        <span aria-hidden="true" className="col-start-3 row-start-1 text-fg-subtle">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-line px-5 py-5">
          <SourceBadge source={item.question.source} />
          <p className="mt-3 text-sm leading-relaxed text-fg">{item.question.en}</p>
          <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{item.question.ko}</p>

          {recording && <RecordingPlayer recording={recording} slot={item.slot} />}

          {/*
            녹음본이 없다는 말은 "재생만 안 된다"가 아니다. 답변 텍스트를 바로잡을
            수단이 함께 사라진다는 뜻이라, 무엇이 빠졌는지보다 남은 텍스트를 얼마나
            믿을 수 있는지를 먼저 밝힌다.
          */}
          {hasAnswer && !recording && (
            <p className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-fg-muted">
              이 문항에는 녹음본이 없습니다. 아래 답변은 <strong className="font-semibold text-fg">브라우저 받아쓰기 그대로</strong>이고,
              녹음본이 없어 OpenAI 재전사로 바로잡을 수 없습니다. 브라우저 받아쓰기는 발음이 조금만 흐려도 다른 단어를 적으므로
              (<span className="whitespace-nowrap">gym → dreams</span>) 실제로 말한 것과 다를 수 있습니다. 녹음본과 발음 비교가 필요하면
              노트북(크롬·엣지)에서 연습하세요.
            </p>
          )}

          {hasAnswer ? (
            <>
              <div className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3">
                <p className="text-[11px] tracking-widest text-fg-subtle">
                  내 답변 · {countEnglishWords(answer)}단어 · 고유 {countUniqueEnglishWords(answer)}단어 · {countEnglishSentences(answer)}문장 · {formatTime(elapsed)} · 다시 듣기 {replays}회 · 힌트 {hints}회
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{answer}</p>

                {browserAnswer !== undefined && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="text-[11px] leading-relaxed text-fg-subtle">
                      <span className="mr-1.5 rounded-md border border-line bg-surface px-1.5 py-0.5 font-semibold text-fg-muted">OpenAI 받아쓰기</span>
                      AI 분석에 보낸 녹음본을 다시 받아쓴 결과입니다. 브라우저 받아쓰기보다 정확한 편이라 위 답변과 단어 수를 이 텍스트로 바꿔 저장했습니다.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" aria-expanded={showBrowserAnswer} onClick={() => setShowBrowserAnswer((value) => !value)}
                        className="min-h-9 rounded-lg border border-line px-2.5 text-[11px] text-fg-muted transition hover:text-fg">
                        브라우저 받아쓰기 {showBrowserAnswer ? "접기" : "보기"}
                      </button>
                      <button type="button" onClick={() => { setShowBrowserAnswer(false); onRevertAnswer(); }}
                        className="min-h-9 rounded-lg border border-line px-2.5 text-[11px] text-fg-muted transition hover:text-fg">
                        브라우저 받아쓰기로 되돌리기
                      </button>
                    </div>
                    {showBrowserAnswer && (
                      <p className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-fg-subtle">
                        {browserAnswer}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-line px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-fg">AI 스토리텔링 코치</p>
                    <p className="mt-1 text-xs leading-relaxed text-fg-subtle">최대 5개만, 전달력에 영향이 큰 것부터 봅니다. 내 답변에 피드백을 반영한 버전도 Before / After 로 함께 보여 줍니다.</p>
                    {recording ? (
                      <p className="mt-1 text-xs leading-relaxed text-fg-subtle">녹음본을 함께 보내 OpenAI 가 답변을 다시 받아씁니다. 브라우저 받아쓰기보다 정확하면 위 답변도 그 텍스트로 바뀝니다.</p>
                    ) : (
                      /* 요청 버튼 바로 옆이다. 무엇을 근거로 조언이 나오는지 여기서 한 번 더 밝힌다. */
                      <p className="mt-1 text-xs leading-relaxed text-fg-subtle">녹음본이 없어 <strong className="font-semibold text-fg-muted">브라우저 받아쓰기 그대로</strong> 분석합니다. 받아쓰기가 잘못 적은 곳은 조언도 그 문장을 기준으로 나옵니다.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onRequestFeedback}
                    disabled={feedbackLoading}
                    className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                  >
                    {feedbackLoading ? "분석 중…" : feedback ? "다시 분석" : "AI 피드백 받기"}
                  </button>
                </div>

                {feedbackError && (
                  <p role="alert" className="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-fg-muted">
                    {feedbackError}
                  </p>
                )}

                {feedback && (
                  <div className="mt-4 border-t border-line pt-4">
                    <FeedbackDetails
                      feedback={feedback}
                      questionType={item.question.type}
                      answer={answer}
                      expressions={{ context: expressionContext, savedIds, onToggle: onToggleExpression, error: expressionError }}
                      reading={{ reads, onRead }}
                    />
                    {!feedbackRewrite(feedback) && (
                      <p className="mt-3 text-[11px] leading-relaxed text-fg-subtle">
                        Before / After 비교가 생기기 전에 받은 피드백입니다. <strong className="font-medium text-fg-muted">다시 분석</strong>하면 내 답변에 피드백을 반영한 버전도 볼 수 있습니다.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-xl border border-line bg-surface-2 p-4">
              <p className="text-sm text-fg-muted">답변 텍스트가 없어 통계와 AI 분석에서 제외한 문항입니다.</p>
              <button type="button" disabled className="mt-3 min-h-11 cursor-not-allowed rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-fg opacity-50">AI 피드백 받기</button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium tabular-nums transition ${active ? "bg-primary text-primary-fg" : "text-fg-muted hover:text-fg"}`}
    >
      {children}
    </button>
  );
}

/** 접힌 문항 머리의 상태. 한 번에 받기가 도는 동안 어느 문항이 끝났는지 여기서 바로 보인다. */
function ItemStatus({ loading, failed, feedback, answered }: {
  loading: boolean;
  failed: boolean;
  feedback: boolean;
  answered: boolean;
}) {
  const pill = "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset";
  if (loading) return <span className={`${pill} bg-primary-tint text-primary-ink ring-primary/25 motion-safe:animate-pulse`}>분석 중…</span>;
  if (feedback) return null;
  if (failed) return <span className={`${pill} bg-warn-tint text-warn-ink ring-warn-ink/30`}>분석 실패</span>;
  return <span className="shrink-0 text-xs text-fg-muted">{answered ? "답변함" : "답변 없음"}</span>;
}

/**
 * 답변한 문항 전체의 AI 피드백을 버튼 하나로 받는다. 문항마다 개별 버튼과 같은 요청을
 * 보내며, 이미 받은 문항과 지금 분석 중인 문항은 보내지 않는다.
 */
function BatchFeedbackPanel({ answeredCount, feedbackCount, waitingCount, pendingCount, batch, onStart, onStop }: {
  answeredCount: number;
  /** 답변한 문항 가운데 이미 피드백이 있는 문항 수. */
  feedbackCount: number;
  /** 지금 누르면 요청할 문항 수. */
  waitingCount: number;
  /** 개별 버튼이나 한 번에 받기로 지금 분석 중인 문항 수. */
  pendingCount: number;
  batch: FeedbackBatch | null;
  onStart: () => void;
  onStop: () => void;
}) {
  const running = batch?.running ? batch : null;
  const summary = running
    ? `${running.settled}/${running.total}문항 분석 중… 끝난 문항부터 아래 목록에 표시됩니다.`
    : waitingCount > 0
      ? `답변한 ${answeredCount}문항 중 아직 피드백이 없는 ${waitingCount}문항을 한 번에 분석합니다.${feedbackCount > 0 ? ` 이미 받은 ${feedbackCount}문항은 다시 요청하지 않습니다.` : ""}`
      : pendingCount > 0
        ? "분석 중인 문항이 끝나면 답변한 문항 모두 피드백을 받게 됩니다."
        : `답변한 ${answeredCount}문항 모두 AI 피드백을 받았습니다. 문항을 펼쳐 확인해 보세요.`;

  return (
    <Card className="mt-6 px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-fg">AI 피드백 한 번에 받기</h2>
          <p aria-live="polite" className="mt-1 text-xs leading-relaxed text-fg-muted">{summary}</p>
        </div>
        {running ? (
          <button
            type="button"
            onClick={onStop}
            disabled={running.stop !== null}
            className="rounded-xl border border-line px-4 py-2.5 text-sm text-fg-muted transition hover:text-fg disabled:cursor-wait disabled:opacity-60"
          >
            {running.stop ? "멈추는 중…" : "멈추기"}
          </button>
        ) : waitingCount > 0 && (
          <button
            type="button"
            onClick={onStart}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover"
          >
            {feedbackCount > 0 ? `남은 ${waitingCount}문항 피드백 받기` : `전체 AI 피드백 받기 · ${waitingCount}문항`}
          </button>
        )}
      </div>

      {running && <div className="mt-4"><ProgressBar value={running.settled} max={running.total} /></div>}
      {batch && !running && <p role="status" className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-fg-muted">{batchResultText(batch)}</p>}
    </Card>
  );
}

function batchResultText(batch: FeedbackBatch): string {
  if (batch.stop === "fatal") return `${batch.fatalMessage ?? FEEDBACK_ERROR} 그래서 남은 문항은 요청하지 않았습니다.`;
  if (batch.stop === "user") return `멈췄습니다. ${batch.received}문항은 받았고, 남은 문항은 요청하지 않았습니다. 다시 누르면 이어서 받습니다.`;
  if (batch.failed > 0) return `${batch.received}문항은 받았고 ${batch.failed}문항은 받지 못했습니다. 다시 누르면 받지 못한 문항만 요청합니다.`;
  if (batch.received === 0) return "기다리는 사이 문항마다 따로 받아서 새로 요청한 문항은 없습니다.";
  return `${batch.received}문항 분석을 마쳤습니다. 문항을 펼쳐 피드백과 Before / After 를 확인해 보세요.`;
}
