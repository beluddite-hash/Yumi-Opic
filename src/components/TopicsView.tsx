"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { allTopics, surveyTopics, surpriseTopics, surpriseQuestionCount } from "@/data";
import { DRAW_EXCLUDED_TOPIC_IDS, selectPracticeQuestions, TYPE_LABELS } from "@/lib/exam";
import { topicPracticeCounts } from "@/lib/history";
import { RANDOM_SCOPE_LABELS, randomPracticeLink } from "@/lib/nav";
import Footer from "./Footer";
import { HistoryList, usePracticeHistory } from "./PracticeHistory";
import ThemeToggle from "./ThemeToggle";
import { Badge, Card, SourceBadge } from "./ui";

/** 모의고사와 랜덤 연습에서 빠지는 주제 이름. 랜덤 링크 옆에 알린다. */
const excludedNames = surveyTopics.filter((topic) => DRAW_EXCLUDED_TOPIC_IDS.includes(topic.id)).map((topic) => topic.ko).join("·");

export default function TopicsView() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [category, setCategory] = useState<"survey" | "surprise">("survey");
  const { history, error, remove, removeAll, removeSelected } = usePracticeHistory();
  const entries = useMemo(() => history.filter((entry) => entry.mode !== "full"), [history]);
  const counts = useMemo(() => topicPracticeCounts(history, allTopics), [history]);
  const topics = category === "survey" ? surveyTopics : surpriseTopics;

  return <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-10 sm:px-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/" className="text-sm text-fg-muted transition-colors hover:text-fg">← 홈</Link>
      <ThemeToggle />
    </div>
    <header className="mt-5">
      <Badge tone="accent">서베이 · 돌발 주제 연습</Badge>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">주제별 연습</h1>
        <div className="flex flex-wrap gap-4">
          {(["single", "set"] as const).map((mode) => {
            const link = randomPracticeLink(mode);
            return <Link key={mode} href={link.href} className="text-xs text-primary-ink">{link.label} →</Link>;
          })}
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">서베이와 돌발 중 연습할 주제를 골라 보세요. 질문을 듣고 답변한 뒤 기존과 같이 결과와 피드백을 확인할 수 있습니다.</p>
    </header>

    <div role="group" aria-label="주제 분류" className="mt-7 flex flex-wrap gap-2">
      {(["survey", "surprise"] as const).map((value) => <button key={value} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); setOpenId(null); }} className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${category === value ? "border-primary/50 bg-primary-tint text-primary-ink" : "border-line text-fg-muted hover:bg-surface-2"}`}>
        {value === "survey" ? `서베이 주제 ${surveyTopics.length}개` : `돌발 주제 ${surpriseTopics.length}개`}
      </button>)}
    </div>
    <p className="mt-4 text-sm leading-relaxed text-fg-muted">{category === "surprise"
      ? `돌발 ${surpriseQuestionCount}문항을 제공 자료의 번호와 순서대로 연습합니다. 5-A·5-B도 각각 선택할 수 있습니다. 질문은 MP3로 들을 수 있으며, 원하는 번호로 이동해 답변할 수 있습니다.`
      : "선택한 주제의 문제를 2~15번에 유형별로 배정하며 같은 질문이 중복될 수 있습니다. 집에서 보내는 휴가는 지정된 11문항을 순서대로 연습합니다. 원하는 문항만 답변하고 나머지는 건너뛰어도 됩니다."}</p>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
      <span>{RANDOM_SCOPE_LABELS[category]} 주제에서 랜덤으로{category === "survey" && ` (${excludedNames} 제외)`}</span>
      {(["single", "set"] as const).map((mode) => {
        const link = randomPracticeLink(mode, category);
        return <Link key={mode} href={link.href} aria-label={link.label} className="inline-flex min-h-11 items-center rounded-lg bg-primary-tint px-3 font-medium text-primary-ink transition-colors hover:bg-surface-3">{mode === "single" ? "1문제" : "1토픽"} →</Link>;
      })}
    </div>

    <div className="mt-5 grid items-start gap-3 sm:grid-cols-2">{topics.map((topic) => {
      const open = openId === topic.id;
      const count = counts[topic.id] ?? 0;
      const questions = selectPracticeQuestions(topic, () => 0);
      return <Card key={topic.id} className="overflow-hidden">
        <div className="flex items-center gap-3 p-5">
          <button type="button" aria-expanded={open} aria-controls={`${topic.id}-questions`} onClick={() => setOpenId(open ? null : topic.id)} className="min-h-11 min-w-0 flex-1 text-left">
            <span className="block text-sm font-medium">{topic.emoji} {topic.ko}{count > 0 && <span className="ml-2 text-xs font-normal text-primary-ink">{count}회 연습</span>}</span>
            <span className="mt-1 block text-xs leading-relaxed text-fg-subtle">{topic.en} · {topic.category === "surprise" ? `${topic.questions.length}문항` : topic.id === "staycation" ? "지정 순서 11문항" : "2~15번 14문항"} · {open ? "접기" : topic.category === "surprise" ? "전체 문항 보기" : "유형별 예시 보기"}</span>
          </button>
          <Link aria-label={`${topic.ko} 연습하기`} className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-primary-tint px-3 py-2 text-xs font-medium text-primary-ink transition-colors hover:bg-surface-3" href={`/exam?mode=practice&topic=${encodeURIComponent(topic.id)}`}>연습하기 →</Link>
        </div>
        <div id={`${topic.id}-questions`} hidden={!open} className="divide-y divide-line border-t border-line">{open && questions.map((q) => <div key={q.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">{q.number && <span className="text-sm font-semibold text-fg">{q.number}번</span>}<span className="text-xs font-semibold text-primary-ink">{topic.category === "surprise" ? TYPE_LABELS[q.type].split(" · ")[0] : TYPE_LABELS[q.type]}</span><SourceBadge source={q.source} /></div>
          {q.title && <p className="mt-2 text-sm font-medium text-fg">{q.title}</p>}
          <p className="mt-2 text-sm leading-relaxed text-fg">{q.en}</p>
          <p className="mt-1 text-xs leading-relaxed text-fg-subtle">{q.ko}</p>
        </div>)}</div>
      </Card>;
    })}</div>

    <HistoryList title="연습 기록" entries={entries} error={error} onRemove={remove} onRemoveAll={removeAll} onRemoveSelected={removeSelected} />
    <Footer />
  </main>;
}
