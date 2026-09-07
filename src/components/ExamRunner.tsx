"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Exam, QuestionType } from "@/lib/types";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speak,
  startDictation,
  stopSpeaking,
  type DictationHandle,
} from "@/lib/speech";
import { loadSettings, saveSettings } from "@/lib/storage";
import { Badge, Card, ProgressBar, SourceBadge } from "./ui";
import ExamResult from "./ExamResult";

/** 유형별 권장 답변 시간(초) — 실전 감각을 잡기 위한 기준선 */
const TIME_TARGET: Record<QuestionType, number> = {
  intro: 60,
  description: 90,
  routine: 90,
  experience: 105,
  memorable: 110,
  roleplay_ask: 60,
  roleplay_problem: 80,
  issue: 120,
  comparison: 120,
};

/** 유형별 권장 분량(단어) — 점수가 아니라 "이 정도는 말해 보자"는 기준선 */
const WORD_TARGET: Record<QuestionType, number> = {
  intro: 95,
  description: 130,
  routine: 130,
  experience: 160,
  memorable: 170,
  roleplay_ask: 90,
  roleplay_problem: 120,
  issue: 175,
  comparison: 175,
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function countWords(text: string): number {
  return (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
}

export default function ExamRunner({
  exam,
  title,
  onRegenerate,
}: {
  exam: Exam;
  title: string;
  onRegenerate?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [times, setTimes] = useState<Record<number, number>>({});
  const [showKorean, setShowKorean] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [timerOn, setTimerOn] = useState(true);

  const dictationRef = useRef<DictationHandle | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const item = exam.items[index];
  const slot = item.slot;
  const answer = answers[slot] ?? "";
  const elapsed = times[slot] ?? 0;
  const type = item.question.type;
  const timeTarget = TIME_TARGET[type];
  const wordTarget = WORD_TARGET[type];
  const words = countWords(answer);

  const speechAvailable = useMemo(() => isSpeechSynthesisSupported(), []);
  const micAvailable = useMemo(() => isSpeechRecognitionSupported(), []);

  /* 저장된 설정 불러오기 */
  useEffect(() => {
    const s = loadSettings();
    setShowKorean(s.showKorean);
    setAutoSpeak(s.autoSpeak);
  }, []);

  /* 문제가 바뀌면 받아쓰기를 멈추고 낭독을 정리한다 */
  const stopDictation = useCallback(() => {
    dictationRef.current?.stop();
    dictationRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  useEffect(() => {
    stopDictation();
    stopSpeaking();
    if (autoSpeak && !submitted) speak(item.question.en);
    return () => stopSpeaking();
    // 문제가 바뀔 때만 실행한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, submitted]);

  useEffect(() => () => stopDictation(), [stopDictation]);

  /* 타이머 */
  useEffect(() => {
    if (submitted || !timerOn) return;
    const id = window.setInterval(() => {
      setTimes((prev) => ({ ...prev, [slot]: (prev[slot] ?? 0) + 1 }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [slot, submitted, timerOn]);

  function toggleMic() {
    if (listening) {
      stopDictation();
      return;
    }
    setMicError(null);
    const handle = startDictation({
      onFinal: (text) => {
        setAnswers((prev) => {
          const current = prev[slot] ?? "";
          const joiner = current && !/\s$/.test(current) ? " " : "";
          return { ...prev, [slot]: `${current}${joiner}${text}` };
        });
        setInterim("");
      },
      onInterim: setInterim,
      onError: (code) => {
        setMicError(
          code === "not-allowed"
            ? "마이크 권한이 거부됐습니다. 브라우저 주소창의 자물쇠 아이콘에서 허용해 주세요."
            : `음성 인식 오류: ${code}`,
        );
        stopDictation();
      },
      onEnd: () => setListening(false),
    });
    if (!handle) {
      setMicError("이 브라우저는 음성 인식을 지원하지 않습니다. Chrome이나 Edge에서 사용해 주세요.");
      return;
    }
    dictationRef.current = handle;
    setListening(true);
  }

  function submit() {
    stopDictation();
    stopSpeaking();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (submitted) {
    return (
      <ExamResult
        exam={exam}
        title={title}
        answers={answers}
        times={times}
        onRetry={() => {
          setSubmitted(false);
          setIndex(0);
        }}
        onRegenerate={onRegenerate}
      />
    );
  }

  const answeredCount = exam.items.filter(
    (it) => (answers[it.slot] ?? "").trim().length > 0,
  ).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-32 pt-8 sm:px-8">
      {/* 상단 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm text-ink-400 transition hover:text-ink-100"
        >
          ← 홈
        </Link>
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <span className="tabular-nums">
            {index + 1} / {exam.items.length}
          </span>
          <span className="text-ink-600">·</span>
          <span className="tabular-nums">{answeredCount}문항 작성됨</span>
        </div>
      </div>

      <div className="mt-3">
        <ProgressBar value={index + 1} max={exam.items.length} />
      </div>

      {/* 문제 카드 */}
      <Card key={slot} className="animate-fade-up mt-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent-600/20 text-sm font-semibold tabular-nums text-accent-400">
            {slot}
          </span>
          <Badge tone="accent">{item.typeLabel}</Badge>
          <Badge>
            {item.emoji} {item.topicKo}
          </Badge>
          <SourceBadge source={item.question.source} />
          <span className="ml-auto flex items-center gap-2 text-xs tabular-nums">
            <span
              className={
                elapsed > timeTarget + 30
                  ? "text-rose-400"
                  : elapsed >= timeTarget
                    ? "text-emerald-400"
                    : "text-ink-400"
              }
            >
              {formatTime(elapsed)} / 목표 {formatTime(timeTarget)}
            </span>
            <button
              type="button"
              onClick={() => setTimerOn((v) => !v)}
              className="rounded-md border border-ink-700 px-2 py-0.5 text-ink-400 transition hover:text-ink-100"
            >
              {timerOn ? "일시정지" : "재개"}
            </button>
          </span>
        </div>

        <p className="mt-5 text-[17px] leading-[1.75] text-ink-100 sm:text-lg">
          {item.question.en}
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {speechAvailable && (
            <button
              type="button"
              onClick={() => speak(item.question.en)}
              className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs text-ink-300 transition hover:border-ink-600 hover:text-ink-100"
            >
              🔊 읽어주기
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowKorean((v) => !v)}
            className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs text-ink-300 transition hover:border-ink-600 hover:text-ink-100"
          >
            {showKorean ? "한국어 숨기기" : "한국어 보기"}
          </button>
          {item.question.hints && item.question.hints.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHints((v) => !v)}
              className="rounded-lg border border-ink-700 bg-ink-850 px-3 py-1.5 text-xs text-ink-300 transition hover:border-ink-600 hover:text-ink-100"
            >
              {showHints ? "힌트 숨기기" : "💡 표현 힌트"}
            </button>
          )}
          {speechAvailable && (
            <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-ink-400">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => {
                  setAutoSpeak(e.target.checked);
                  saveSettings({ ...loadSettings(), autoSpeak: e.target.checked });
                }}
                className="h-3.5 w-3.5 accent-[var(--color-accent-500)]"
              />
              문제 자동 낭독
            </label>
          )}
        </div>

        {showKorean && (
          <p className="mt-4 rounded-xl border border-ink-700/70 bg-ink-850 px-4 py-3 text-sm leading-relaxed text-ink-300">
            {item.question.ko}
          </p>
        )}

        {showHints && item.question.hints && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {item.question.hints.map((hint) => (
              <li
                key={hint}
                className="rounded-lg bg-accent-600/10 px-2.5 py-1 text-xs text-accent-400 ring-1 ring-inset ring-accent-600/20"
              >
                {hint}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 답변 입력 */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <label
            htmlFor="answer"
            className="text-xs font-semibold uppercase tracking-widest text-ink-400"
          >
            내 답변 (영어)
          </label>
          <div className="flex items-center gap-3 text-xs">
            <span
              className={`tabular-nums ${
                words >= wordTarget ? "text-emerald-400" : "text-ink-400"
              }`}
            >
              {words} / {wordTarget}단어
            </span>
            {micAvailable && (
              <button
                type="button"
                onClick={toggleMic}
                className={`rounded-lg border px-3 py-1.5 transition ${
                  listening
                    ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
                    : "border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-600 hover:text-ink-100"
                }`}
              >
                {listening ? "⏹ 받아쓰기 중지" : "🎙 마이크로 말하기"}
              </button>
            )}
          </div>
        </div>

        <textarea
          id="answer"
          ref={textareaRef}
          value={answer}
          onChange={(e) =>
            setAnswers((prev) => ({ ...prev, [slot]: e.target.value }))
          }
          placeholder="Well, let me tell you about..."
          rows={10}
          spellCheck
          className="w-full resize-y rounded-2xl border border-ink-700/70 bg-ink-900/70 px-4 py-3.5 text-[15px] leading-relaxed text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-accent-600/60 focus:ring-2 focus:ring-accent-600/20"
        />

        <div className="mt-2">
          <ProgressBar value={words} max={wordTarget} />
        </div>

        {listening && (
          <p className="mt-2 text-xs text-rose-300">
            🎙 듣는 중… {interim && <span className="text-ink-400">{interim}</span>}
          </p>
        )}
        {micError && <p className="mt-2 text-xs text-amber-300">{micError}</p>}
        {micAvailable === false && (
          <p className="mt-2 text-xs text-ink-500">
            마이크 받아쓰기는 Chrome · Edge에서만 동작합니다. 타이핑으로 연습해도
            됩니다.
          </p>
        )}
      </div>

      {/* 하단 내비게이션 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-ink-800 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-5 py-4 sm:px-8">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-xl border border-ink-700 px-4 py-2.5 text-sm text-ink-300 transition enabled:hover:border-ink-600 enabled:hover:text-ink-100 disabled:opacity-30"
          >
            이전
          </button>
          <span className="min-w-0 flex-1 truncate text-center text-xs text-ink-500">
            {title}
          </span>
          {index < exam.items.length - 1 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="rounded-xl bg-accent-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-500"
            >
              다음 문항
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-emerald-400"
            >
              답변 모아 보기
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
