"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Exam } from "@/lib/types";
import { pushHistory } from "@/lib/storage";
import { Badge, Card, SourceBadge } from "./ui";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function countWords(text: string): number {
  return (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
}

export default function ExamResult({
  exam,
  title,
  answers,
  times,
  onRetry,
  onRegenerate,
}: {
  exam: Exam;
  title: string;
  answers: Record<number, string>;
  times: Record<number, number>;
  onRetry: () => void;
  onRegenerate?: () => void;
}) {
  const answered = exam.items.filter(
    (it) => (answers[it.slot] ?? "").trim().length > 0,
  );
  const totalWords = exam.items.reduce(
    (sum, it) => sum + countWords(answers[it.slot] ?? ""),
    0,
  );
  const totalTime = exam.items.reduce((sum, it) => sum + (times[it.slot] ?? 0), 0);
  const saved = useRef(false);

  useEffect(() => {
    if (saved.current) return;
    saved.current = true;
    pushHistory({
      id: exam.id,
      finishedAt: Date.now(),
      mode: exam.mode,
      label: title,
      answered: answered.length,
      totalItems: exam.items.length,
      totalWords,
      totalSec: totalTime,
    });
    // 결과 화면 진입 시 한 번만 저장한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8 sm:px-8">
      <Link href="/" className="text-sm text-ink-400 transition hover:text-ink-100">
        ← 홈
      </Link>

      {/* 요약 */}
      <Card className="animate-fade-up mt-5 p-6 sm:p-8">
        <Badge tone="accent">연습 기록</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">
          작성한 답변을 아래에서 다시 읽어 보세요. 자동 채점은 제공하지 않습니다 —
          실제 OPIc 등급은 발음·유창성·상호작용까지 사람이 평가하는 영역이라
          텍스트만으로 매긴 점수는 오히려 감을 흐립니다.
        </p>

        <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-ink-800 pt-5 text-center">
          <div>
            <dt className="text-xs text-ink-400">작성한 문항</dt>
            <dd className="mt-1 text-lg font-medium tabular-nums">
              {answered.length}/{exam.items.length}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-400">총 단어 수</dt>
            <dd className="mt-1 text-lg font-medium tabular-nums">{totalWords}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-400">총 소요 시간</dt>
            <dd className="mt-1 text-lg font-medium tabular-nums">
              {formatTime(totalTime)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="rounded-xl border border-ink-700 px-4 py-2.5 text-sm text-ink-300 transition hover:border-ink-600 hover:text-ink-100"
          >
            같은 시험지 다시 풀기
          </button>
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              className="rounded-xl bg-accent-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-500"
            >
              새 시험지 뽑기
            </button>
          )}
        </div>
      </Card>

      {/* 문항별 답변 */}
      <h2 className="mt-10 text-sm font-semibold uppercase tracking-widest text-ink-400">
        문항별 답변
      </h2>
      <div className="mt-4 space-y-4">
        {exam.items.map((item) => (
          <ItemResult
            key={item.slot}
            slot={item.slot}
            typeLabel={item.typeLabel}
            topic={`${item.emoji} ${item.topicKo}`}
            questionEn={item.question.en}
            source={item.question.source}
            questionKo={item.question.ko}
            answer={answers[item.slot] ?? ""}
            elapsed={times[item.slot] ?? 0}
          />
        ))}
      </div>
    </main>
  );
}

function ItemResult({
  slot,
  typeLabel,
  topic,
  questionEn,
  questionKo,
  source,
  answer,
  elapsed,
}: {
  slot: number;
  typeLabel: string;
  topic: string;
  questionEn: string;
  source?: "verified" | "adapted";
  questionKo: string;
  answer: string;
  elapsed: number;
}) {
  const [open, setOpen] = useState(false);
  const words = countWords(answer);
  const written = answer.trim().length > 0;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-ink-850/60"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-800 text-sm font-semibold tabular-nums text-ink-300">
          {slot}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-ink-200">{typeLabel}</span>
          <span className="block truncate text-xs text-ink-500">{topic}</span>
        </span>
        {written ? (
          <span className="shrink-0 text-xs tabular-nums text-ink-400">
            {words}단어 · {formatTime(elapsed)}
          </span>
        ) : (
          <span className="shrink-0 text-xs text-ink-500">미작성</span>
        )}
        <span className="shrink-0 text-ink-500">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border-t border-ink-800 px-5 py-5">
          <SourceBadge source={source} />
          <p className="mt-3 text-sm leading-relaxed text-ink-200">{questionEn}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-500">{questionKo}</p>

          {written ? (
            <div className="mt-5 rounded-xl border border-ink-800 bg-ink-950/60 px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-ink-500">
                내 답변 · {words}단어 · {formatTime(elapsed)}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-300">
                {answer}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-ink-500">답변을 작성하지 않았습니다.</p>
          )}
        </div>
      )}
    </Card>
  );
}
