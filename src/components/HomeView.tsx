"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { surveyTopics, totalQuestionCount, verifiedQuestionCount } from "@/data";
import { SLOT_PLAN } from "@/lib/exam";
import {
  clearHistory,
  defaultSettings,
  loadHistory,
  loadSettings,
  saveSettings,
  type HistoryEntry,
  type Settings,
} from "@/lib/storage";
import Footer from "./Footer";
import { Badge, Card } from "./ui";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HomeView() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setHistory(loadHistory());
    setReady(true);
  }, []);

  function update(next: Settings) {
    setSettings(next);
    saveSettings(next);
  }

  function toggleTopic(id: string) {
    const has = settings.enabledSurveyIds.includes(id);
    const next = has
      ? settings.enabledSurveyIds.filter((t) => t !== id)
      : [...settings.enabledSurveyIds, id];
    // 콤보 1·2를 서로 다른 주제로 뽑으려면 최소 2개는 켜져 있어야 한다
    if (next.length < 2) return;
    update({ ...settings, enabledSurveyIds: next });
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-12 sm:px-8">
      <header className="animate-fade-up">
        <Badge tone="accent">OPIc 15문항 · 셔플 모의고사</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          매번 새로운 시험지로
          <br />
          <span className="text-accent-400">입 트이는 연습</span>을 하세요
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-300">
          서베이 주제 · 돌발 · 롤플레이 · 고난도를 실제 콤보 구조 그대로 섞어
          시험지를 만듭니다. 문제는 텍스트로 보고 (원하면 브라우저가 영어로
          읽어줍니다), 답변은 타이핑하거나 마이크로 말한 뒤 한자리에 모아
          다시 읽어볼 수 있습니다.
          현재 문제 은행에 <strong className="text-ink-100">{totalQuestionCount}문항</strong>이
          들어 있고, 그중{" "}
          <strong className="text-emerald-300">{verifiedQuestionCount}문항</strong>은
          응시자들이 복원해 공개한 실제 출제 문항입니다.
        </p>
      </header>

      {/* 모드 선택 */}
      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <ModeCard
          href="/exam?mode=full"
          emoji="📝"
          title="실전 모의고사"
          desc="2~15번 14문항을 콤보 구조대로 한 세트 생성합니다."
          primary
        />
        <ModeCard
          href="/topics"
          emoji="🎯"
          title="주제별 연습"
          desc="서베이 주제 하나를 골라 그 주제의 문항만 셔플합니다."
        />
        <ModeCard
          href="/exam?mode=single"
          emoji="🎲"
          title="랜덤 1문제"
          desc="전체 은행에서 아무 문제나 하나 뽑아 짧게 연습합니다."
        />
      </section>

      {/* 15문항 구조 */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
          시험지 구조
        </h2>
        <Card className="mt-4 overflow-hidden">
          <div className="grid grid-cols-1 divide-y divide-ink-700/60 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
            <SlotGroup combo="A" label="콤보 1 · 서베이 주제" slots={[2, 3, 4]} />
            <SlotGroup combo="B" label="콤보 2 · 서베이 주제" slots={[5, 6, 7]} />
            <SlotGroup combo="C" label="콤보 3 · 돌발 주제" slots={[8, 9, 10]} />
            <SlotGroup combo="D" label="콤보 4 · 롤플레이" slots={[11, 12, 13]} />
            <SlotGroup combo="E" label="콤보 5 · 고난도" slots={[14, 15]} />
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
                1번 · 자기소개
              </p>
              <p className="mt-3 text-sm leading-relaxed text-ink-300">
                채점 비중이 사실상 없어 기본으로 건너뜁니다. 연습하고 싶으면
                시험 시작 화면에서 켤 수 있습니다.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* 서베이 설정 */}
      <section className="mt-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
            내 서베이 주제
          </h2>
          <p className="text-xs text-ink-400">
            선택한 주제에서만 콤보 1·2가 출제됩니다 (최소 2개)
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {surveyTopics.map((topic) => {
            const on = ready && settings.enabledSurveyIds.includes(topic.id);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => toggleTopic(topic.id)}
                aria-pressed={on}
                className={`rounded-xl border px-3.5 py-2 text-sm transition ${
                  on
                    ? "border-accent-600/50 bg-accent-600/15 text-ink-100"
                    : "border-ink-700 bg-ink-900/50 text-ink-400 hover:border-ink-600"
                }`}
              >
                <span className="mr-1.5">{topic.emoji}</span>
                {topic.ko}
              </button>
            );
          })}
        </div>
      </section>

      {/* 기록 */}
      {history.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-ink-400">
              최근 기록
            </h2>
            <button
              type="button"
              onClick={() => {
                clearHistory();
                setHistory([]);
              }}
              className="text-xs text-ink-400 underline-offset-4 hover:text-ink-300 hover:underline"
            >
              기록 지우기
            </button>
          </div>
          <Card className="mt-4 divide-y divide-ink-700/60">
            {history.slice(0, 6).map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-sm"
              >
                <span className="w-28 shrink-0 tabular-nums text-ink-400">
                  {new Date(entry.finishedAt).toLocaleDateString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-300">
                  {entry.label}
                </span>
                <span className="tabular-nums text-ink-400">
                  {entry.answered}/{entry.totalItems}문항
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-ink-400">
                  {entry.totalWords ?? 0}단어
                </span>
                <span className="w-20 shrink-0 text-right text-xs tabular-nums text-ink-500">
                  {formatTime(entry.totalSec ?? 0)}
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      <Footer />
    </main>
  );
}

function ModeCard({
  href,
  emoji,
  title,
  desc,
  primary = false,
}: {
  href: string;
  emoji: string;
  title: string;
  desc: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border p-5 transition ${
        primary
          ? "border-accent-600/50 bg-accent-600/10 hover:bg-accent-600/20"
          : "border-ink-700/70 bg-ink-900/60 hover:border-ink-600 hover:bg-ink-850"
      }`}
    >
      <span className="text-2xl">{emoji}</span>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{desc}</p>
      <span
        className={`mt-4 inline-block text-sm font-medium ${
          primary ? "text-accent-400" : "text-ink-300"
        }`}
      >
        시작하기 →
      </span>
    </Link>
  );
}

function SlotGroup({
  combo,
  label,
  slots,
}: {
  combo: string;
  label: string;
  slots: number[];
}) {
  const specs = SLOT_PLAN.filter((s) => s.combo === combo);
  return (
    <div className="border-ink-700/60 p-5 sm:border-r sm:last:border-r-0">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
        {label}
      </p>
      <ul className="mt-3 space-y-2">
        {specs.map((spec, i) => (
          <li key={spec.slot} className="flex items-center gap-3 text-sm">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink-800 text-xs font-medium tabular-nums text-ink-300">
              {slots[i]}
            </span>
            <span className="text-ink-300">{spec.typeLabel}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
