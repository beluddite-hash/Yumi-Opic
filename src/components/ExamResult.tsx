"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Exam, ExamItem } from "@/lib/types";
import {
  countEnglishSentences,
  countEnglishWords,
  countUniqueEnglishWords,
  englishWords,
} from "@/lib/answers";
import { pushHistory } from "@/lib/storage";
import { Badge, Card, SourceBadge } from "./ui";
import Footer from "./Footer";

function formatTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

export interface AnswerRecording {
  url: string;
  mimeType: string;
}

export default function ExamResult({
  exam,
  title,
  answers,
  times,
  hintUse = {},
  replays = {},
  recordings = {},
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
  onRetry: () => void;
  onRegenerate?: () => void;
}) {
  const answeredCount = exam.items.filter((it) => (answers[it.slot] ?? "").trim().length > 0).length;
  const totalWords = exam.items.reduce((sum, it) => sum + countEnglishWords(answers[it.slot] ?? ""), 0);
  const totalSentences = exam.items.reduce((sum, it) => sum + countEnglishSentences(answers[it.slot] ?? ""), 0);
  const uniqueWords = new Set(
    exam.items.flatMap((it) => englishWords(answers[it.slot] ?? "").map((word) => word.toLowerCase())),
  ).size;
  const saved = useRef(false);

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    pushHistory({
      id: exam.id,
      finishedAt: Date.now(),
      mode: exam.mode,
      label: title,
      answered: answeredCount,
      totalItems: exam.items.length,
    });
  }, [exam.id, exam.mode, exam.items.length, title, answeredCount]);

  const totalTime = exam.items.reduce((sum, it) => sum + (times[it.slot] ?? 0), 0);
  const totalHints = exam.items.reduce((sum, it) => sum + (hintUse[it.slot] ?? 0), 0);
  const totalReplays = exam.items.reduce((sum, it) => sum + (replays[it.slot] ?? 0), 0);
  const recordingCount = exam.items.filter((it) => recordings[it.slot]).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <Link href="/" className="text-sm text-fg-muted transition hover:text-fg">← 홈</Link>
      <Card className="animate-fade-up mt-5 p-6 sm:p-8">
        <Badge tone="accent">{title}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">연습 결과</h1>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          문항별 질문, 받아쓰기 결과, 녹음본을 확인해 보세요.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-line pt-5 text-center sm:grid-cols-4">
          <div><dt className="text-xs text-fg-muted">답변한 문항</dt><dd className="mt-1 text-lg font-medium tabular-nums">{answeredCount}/{exam.items.length}</dd></div>
          <div><dt className="text-xs text-fg-muted">전체 단어</dt><dd className="mt-1 text-lg font-medium tabular-nums">{totalWords}</dd></div>
          <div><dt className="text-xs text-fg-muted">고유 단어</dt><dd className="mt-1 text-lg font-medium tabular-nums">{uniqueWords}</dd></div>
          <div><dt className="text-xs text-fg-muted">문장 수</dt><dd className="mt-1 text-lg font-medium tabular-nums">{totalSentences}</dd></div>
          <div><dt className="text-xs text-fg-muted">말한 시간</dt><dd className="mt-1 text-lg font-medium tabular-nums">{formatTime(totalTime)}</dd></div>
          <div><dt className="text-xs text-fg-muted">다시 듣기</dt><dd className="mt-1 text-lg font-medium tabular-nums">{totalReplays}회</dd></div>
          <div><dt className="text-xs text-fg-muted">힌트 사용</dt><dd className="mt-1 text-lg font-medium tabular-nums">{totalHints}회</dd></div>
          <div><dt className="text-xs text-fg-muted">녹음본</dt><dd className="mt-1 text-lg font-medium tabular-nums">{recordingCount}개</dd></div>
        </dl>

        <p className="mt-4 text-xs leading-relaxed text-fg-muted">
          전체 단어는 반복을 포함하고, 고유 단어는 대소문자를 무시한 중복 제거 기준입니다. 문장 수는 받아쓰기 텍스트의 문장부호를 기준으로 계산합니다.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-fg-muted">
          실전에는 지문 보기가 없습니다. 힌트 사용이 0회에 가까워질수록 실제 시험에 가까운 연습입니다.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={onRetry} className="rounded-xl border border-line px-4 py-2.5 text-sm text-fg-muted">같은 문제 다시 풀기</button>
          {onRegenerate && (
            <button type="button" onClick={onRegenerate} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover">문제 다시 뽑기</button>
          )}
        </div>
      </Card>

      <h2 className="mt-10 text-sm font-semibold tracking-widest text-fg-muted">문항별 답변 다시 보기</h2>
      <div className="mt-4 space-y-4">
        {exam.items.map((item) => (
          <ItemResult
            key={item.slot}
            item={item}
            answer={answers[item.slot] ?? ""}
            elapsed={times[item.slot] ?? 0}
            hints={hintUse[item.slot] ?? 0}
            replays={replays[item.slot] ?? 0}
            recording={recordings[item.slot]}
          />
        ))}
      </div>
      <Footer />
    </main>
  );
}

function ItemResult({
  item,
  answer,
  elapsed,
  hints,
  replays,
  recording,
}: {
  item: ExamItem;
  answer: string;
  elapsed: number;
  hints: number;
  replays: number;
  recording?: AnswerRecording;
}) {
  const [open, setOpen] = useState(false);
  const hasAnswer = answer.trim().length > 0;
  const extension = recording?.mimeType.includes("ogg") ? "ogg" : "webm";

  return (
    <Card className="overflow-hidden">
      <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-surface-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-sm font-semibold text-fg-muted">{item.slot}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-fg">{item.typeLabel}</span>
          <span className="block truncate text-xs text-fg-subtle">{item.emoji} {item.topicKo}</span>
        </span>
        <span className="shrink-0 text-xs text-fg-muted">{hasAnswer ? "답변함" : "답변 없음"}</span>
        <span className="shrink-0 text-fg-subtle">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-line px-5 py-5">
          <SourceBadge source={item.question.source} />
          <p className="mt-3 text-sm leading-relaxed text-fg">{item.question.en}</p>
          <p className="mt-2 text-xs leading-relaxed text-fg-subtle">{item.question.ko}</p>

          {recording && (
            <div className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <audio controls preload="metadata" src={recording.url} className="max-w-full flex-1" />
                <a
                  href={recording.url}
                  download={`yumi-opic-question-${item.slot}.${extension}`}
                  className="rounded-lg border border-line px-3 py-2 text-xs font-medium text-fg-muted transition hover:text-fg"
                >
                  녹음본 다운로드
                </a>
              </div>
            </div>
          )}

          {hasAnswer ? (
            <div className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3">
              <p className="text-[11px] tracking-widest text-fg-subtle">
                내 답변 · {countEnglishWords(answer)}단어 · 고유 {countUniqueEnglishWords(answer)}단어 · {countEnglishSentences(answer)}문장 · {formatTime(elapsed)} · 다시 듣기 {replays}회 · 힌트 {hints}회
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{answer}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-fg-subtle">아직 답변하지 않았습니다.</p>
          )}
        </div>
      )}
    </Card>
  );
}
