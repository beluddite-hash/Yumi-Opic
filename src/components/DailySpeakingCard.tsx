"use client";

import { useEffect, useState } from "react";
import { localDay, type SpeakingTotals } from "@/lib/speakingActivity";
import { loadTodaySpeaking, type HistoryEntry } from "@/lib/storage";
import FeedbackProgress from "./FeedbackProgress";

const number = (value: number) => value.toLocaleString("ko-KR");

export default function DailySpeakingCard({ history }: { history: HistoryEntry[] }) {
  const [today, setToday] = useState<SpeakingTotals | null>(null);
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    let midnightTimer: number;
    const refresh = () => {
      window.clearTimeout(midnightTimer);
      const now = new Date();
      setToday(loadTodaySpeaking(undefined, now.getTime()));
      setDate(now);
      // 홈을 켜 둔 채 자정을 지나도 어제의 숫자를 오늘처럼 보여 주지 않는다.
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      midnightTimer = window.setTimeout(refresh, midnight.getTime() - now.getTime() + 50);
    };
    refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [history]);

  const totalSentences = today ? today.answerSentences + today.readSentences : 0;
  const hasActivity = !!today && (today.questions > 0 || today.readCount > 0);
  const metrics = today ? [
    { label: "총 말한 문장 수", value: totalSentences, unit: "문장" },
    { label: "오늘 푼 문제 수", value: today.questions, unit: "문제" },
    { label: "따라 읽기 횟수", value: today.readCount, unit: "회" },
  ] : [];

  return <section aria-labelledby="daily-speaking-title" className="mt-4 overflow-hidden break-keep rounded-2xl border border-line bg-linear-to-br from-surface to-primary-tint p-5 shadow-card sm:p-7">
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <span className="text-base font-bold tracking-tight text-fg">Yumi-Opic</span>
      <time dateTime={date ? localDay(date.getTime()) : undefined}
        className="text-xs tabular-nums text-fg-subtle">
        {date ? date.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }) : "—"}
      </time>
    </header>
    <div aria-live="polite" aria-atomic="true" aria-busy={!today}>
      {/* 아직 아무것도 하지 않은 날에 "0문제에 답했어요!"를 띄우지 않는다. */}
      {!hasActivity
        ? <h2 id="daily-speaking-title" className="mt-7 text-base font-medium leading-relaxed sm:mt-8 sm:text-lg">
          {today ? "오늘은 한 문제부터 가볍게 말해 볼까요?" : "오늘의 연습을 확인하고 있어요…"}
        </h2>
        : <h2 id="daily-speaking-title" className="mt-7 text-lg font-medium leading-tight sm:mt-8 sm:text-xl">
          <span className="block text-sm text-fg-muted">오늘</span>
          {/* 조사가 붙는 자리라 "문제"와 "에" 사이는 띄우지 않는다. */}
          <span className="mt-2 flex flex-wrap items-baseline gap-y-1">
            <strong className="inline-flex items-baseline gap-1 font-bold tracking-tight text-primary-ink">
              <span className="text-6xl tabular-nums sm:text-7xl">{number(today.questions)}</span>
              <span className="text-2xl sm:text-3xl">문제</span>
            </strong>
            <span className="whitespace-nowrap">에 답했어요!</span>
          </span>
        </h2>}
      {hasActivity && today && <>
        <dl className="mt-6 grid grid-cols-3 gap-2 sm:mt-7 sm:gap-3">
          {metrics.map(({ label, value, unit }) => <div key={label} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface/70 px-2 py-4 sm:px-4">
            <dt className="mt-2 text-[11px] font-medium leading-relaxed text-fg-muted sm:text-xs">{label}</dt>
            <dd className="order-first flex flex-wrap items-baseline gap-x-1 text-xs font-medium text-fg-muted">
              <strong className="text-2xl font-bold tracking-tight tabular-nums text-fg sm:text-3xl">{number(value)}</strong>{unit}
            </dd>
          </div>)}
        </dl>
        <div className="mt-6 border-t border-line pt-5 sm:mt-7">
          <FeedbackProgress counts={today.feedback} total={today.questions} />
        </div>
      </>}
    </div>
  </section>;
}
