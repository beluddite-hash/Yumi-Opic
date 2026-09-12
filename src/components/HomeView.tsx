"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MIN_PRACTICE_TOPICS, allTopics } from "@/data";
import { formatHistoryStamp } from "@/lib/history";
import { loadMicMode } from "@/lib/micShare";
import { RANDOM_SCOPE_LABELS, RANDOM_SCOPES, randomPracticeLink, repeatPracticeLink } from "@/lib/nav";
import { defaultSettings, hasSavedSettings, loadSettings } from "@/lib/storage";
import Footer from "./Footer";
import DailySpeakingCard from "./DailySpeakingCard";
import { usePracticeHistory } from "./PracticeHistory";
import ThemeToggle from "./ThemeToggle";
import { Card } from "./ui";

const MODE_LABELS: Record<string, string> = {
  full: "실전 모의고사",
  practice: "주제별 연습",
  single: "1문제 랜덤 연습",
  set: "1토픽 랜덤 연습",
};

/**
 * 홈은 연습을 고르는 자리다. 배경 설문은 한 번 정하면 브라우저에 남는 설정이라
 * `/survey` 로 따로 두고, 저장된 설정이 없는 첫 방문에만 그 화면으로 보낸다.
 */
export default function HomeView() {
  const router = useRouter();
  const [enabledIds, setEnabledIds] = useState<string[]>(defaultSettings.enabledSurveyIds);
  const [ready, setReady] = useState(false);
  /** 마이크를 한 곳에서만 쓰는 기기(휴대폰·태블릿). 여기서는 녹음본이 남지 않는다. */
  const [dictationOnly, setDictationOnly] = useState(false);
  const { history } = usePracticeHistory();

  useEffect(() => {
    if (!hasSavedSettings()) { router.replace("/survey"); return; }
    setEnabledIds(loadSettings().enabledSurveyIds);
    setDictationOnly(loadMicMode() === "dictation-only");
    setReady(true);
  }, [router]);

  const last = history[0];
  const repeat = useMemo(() => last && repeatPracticeLink(last, allTopics), [last]);
  const recent = history.slice(0, 5);
  const practiceCount = enabledIds.length;
  const canContinue = practiceCount >= MIN_PRACTICE_TOPICS;

  // 설문을 거치지 않은 브라우저는 곧바로 설문 화면으로 옮겨 간다. 그 사이 홈을 그리지 않는다.
  if (!ready) return <main className="mx-auto max-w-3xl px-5 pt-16 text-sm text-fg-muted">준비하는 중…</main>;

  return <main className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10 sm:px-8">
    <div className="flex items-center justify-between gap-3">
      <h1 className="text-sm font-semibold tracking-tight text-fg-muted">Yumi OPIc</h1>
      <ThemeToggle />
    </div>

    <p className="mt-5 text-2xl font-semibold leading-snug tracking-tight">오늘은 어떤 연습을 할까요?</p>
    <p className="mt-2 text-sm leading-relaxed text-fg-muted">서베이 주제와 돌발 주제를 골라 질문을 듣고 답변하는 연습을 합니다.</p>

    {/*
      휴대폰에서도 연습은 되지만 받아쓰기 텍스트 하나에 모든 게 걸린다. 그 텍스트가
      틀리면 AI 피드백도 틀린 문장을 고쳐 주므로, 연습을 고르기 전에 미리 알린다.
    */}
    {dictationOnly && (
      <p className="mt-5 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-fg-muted">
        <strong className="font-semibold text-fg">노트북에서 연습하시길 권합니다.</strong> 휴대폰은 마이크를 한 곳에서만 쓸 수 있어 받아쓰기만
        켜지고 녹음본이 남지 않습니다. 받아쓰기가 잘못 적어도 바로잡을 길이 없어 AI 피드백까지 그 텍스트를 그대로 믿습니다.
      </p>
    )}

    {last && repeat && <Card className="mt-7 p-5 sm:p-6">
      <p className="text-xs text-fg-subtle">마지막 연습 · {formatHistoryStamp(last)}</p>
      <p className="mt-1.5 text-base font-medium">{repeat.label}{!repeat.label.includes(MODE_LABELS[last.mode] ?? last.mode) && <span className="ml-2 text-xs font-normal text-fg-muted">{MODE_LABELS[last.mode] ?? last.mode}</span>}</p>
      <p className="mt-1 text-xs text-fg-muted">{last.answered}/{last.totalItems}문항 답변</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={repeat.href} className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover">이어서 연습하기 →</Link>
        <Link href={`/exam?history=${encodeURIComponent(last.id)}`} className="inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-muted transition-colors hover:bg-surface-2">지난 결과 보기</Link>
      </div>
    </Card>}

    <section className="mt-4 grid gap-4 sm:grid-cols-2">
      <ModeButton href="/topics" title="주제별 연습" desc="서베이 11개·돌발 7개 주제를 골라 연습합니다." disabled={!canContinue} />
      <ModeButton href="/exam?mode=full" title="실전 모의고사" desc="고른 주제와 돌발 주제를 섞어 실제 시험과 같은 1~15번을 봅니다." primary disabled={!canContinue} />
    </section>

    <section className="mt-4 rounded-xl border border-line px-5 py-4">
      <h2 className="text-sm font-medium">랜덤 연습</h2>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">1문제는 한 문항, 1토픽은 한 주제와 세트 유형을 무작위로 골라 2~3문항을 냅니다.</p>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">2~4번형(묘사·루틴·경험), 5~7·8~10번형(묘사·과거/최초·기억에 남는 경험), 11~13번형(롤플레이·관련 경험), 14~15번형(변화·이슈) 중 해당 주제에서 가능한 구성이 나옵니다. 변화·이슈는 2문항이며, 돌발은 제공 문항으로 구성합니다.</p>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">걷기·콘서트·조깅은 모의고사처럼 빠지고 주제별 연습에서 풀 수 있습니다.</p>
      <div className="mt-2 divide-y divide-line">{RANDOM_SCOPES.map((scope) => (
        <div key={scope} className="flex flex-wrap items-center justify-between gap-2 py-2">
          <span className="text-sm text-fg-muted">{RANDOM_SCOPE_LABELS[scope]}</span>
          <div className="flex gap-2">{(["single", "set"] as const).map((mode) => {
            const link = randomPracticeLink(mode, scope);
            return <Link key={mode} href={link.href} aria-label={link.label} className="inline-flex min-h-11 items-center rounded-lg bg-primary-tint px-3 text-xs font-medium text-primary-ink transition-colors hover:bg-surface-3">{mode === "single" ? "1문제" : "1토픽"} →</Link>;
          })}</div>
        </div>
      ))}</div>
    </section>

    <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-sm font-semibold text-fg-muted">배경 설문</h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        {canContinue
          ? `연습 문제가 준비된 주제 ${practiceCount}개를 고른 상태입니다. 이 가운데 걷기·콘서트·조깅을 뺀 주제와 돌발 주제가 모의고사의 출제 범위입니다.`
          : `연습 문제가 준비된 주제가 ${practiceCount}개뿐입니다. ${MIN_PRACTICE_TOPICS}개 이상 골라야 연습을 시작할 수 있습니다.`}
      </p>
      <Link href="/survey" className="mt-3 inline-flex min-h-11 items-center rounded-xl border border-line px-4 text-sm text-fg-muted transition-colors hover:bg-surface-2">배경 설문 수정 →</Link>
    </section>

    {recent.length > 0 && <section className="mt-10 border-t border-line pt-6">
      <h2 className="text-sm font-semibold text-fg-muted">최근 기록</h2>
      <p className="mt-1 text-xs text-fg-subtle">기록을 지우거나 여러 회차를 모아 보려면 각 연습 화면 아래의 기록 목록을 쓰세요.</p>
      <Card className="mt-3 divide-y divide-line overflow-hidden">{recent.map((entry) => (
        <Link key={entry.id} href={`/exam?history=${encodeURIComponent(entry.id)}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-4 text-sm transition-colors hover:bg-surface-2">
          <span className="text-xs tabular-nums text-fg-muted">{formatHistoryStamp(entry)}</span>
          <span className="min-w-0 flex-1 basis-40 font-medium">{entry.label}</span>
          <span className="text-xs text-fg-muted">{entry.answered}/{entry.totalItems}문항</span>
        </Link>
      ))}</Card>
    </section>}

    <DailySpeakingCard history={history} />

    <Footer />
  </main>;
}

function ModeButton({ href, title, desc, primary = false, disabled = false }: { href: string; title: string; desc: string; primary?: boolean; disabled?: boolean }) {
  const className = `flex min-h-36 flex-col rounded-2xl border p-6 shadow-card transition ${primary ? "border-primary/40 bg-primary-tint hover:bg-primary-tint-strong" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"}`;

  if (disabled) return <div className={`${className} cursor-not-allowed opacity-45`} aria-disabled="true">
    <span className="text-xl font-semibold tracking-tight">{title}</span>
    <span className="mt-2 text-sm leading-relaxed text-fg-muted">{desc}</span>
    <span className="mt-auto pt-5 text-sm font-medium text-fg-muted">연습 가능한 설문 {MIN_PRACTICE_TOPICS}개 이상 선택 필요</span>
  </div>;

  return <Link href={href} className={className}>
    <span className="text-xl font-semibold tracking-tight">{title}</span>
    <span className="mt-2 text-sm leading-relaxed text-fg-muted">{desc}</span>
    <span className="mt-auto pt-5 text-sm font-medium text-primary-ink">시작하기 →</span>
  </Link>;
}
