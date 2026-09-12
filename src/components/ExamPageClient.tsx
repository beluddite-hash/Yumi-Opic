"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Exam } from "@/lib/types";
import { surpriseTopics, surveyTopics, topicById } from "@/data";
import { buildFullExam, buildPracticeExam, buildRandomPractice, EXAM_GROUPS, MIN_FULL_EXAM_SURVEY_TOPICS, DRAW_EXCLUDED_TOPIC_IDS, drawableSurveyTopics, parseRandomScope } from "@/lib/exam";
import { defaultSettings, loadHistory, loadSettings, saveEnabledTopics, type HistoryEntry } from "@/lib/storage";
import { formatHistoryStamp } from "@/lib/history";
import { examExitLink, randomPracticeLink } from "@/lib/nav";
import { Badge, Card } from "./ui";
import ExamRunner from "./ExamRunner";
import ExamResult from "./ExamResult";
import Footer from "./Footer";
import { HistoryList, usePracticeHistory } from "./PracticeHistory";

export default function ExamPageClient() {
  const params = useSearchParams();
  const historyId = params.get("history");
  return historyId !== null ? <SavedHistoryResult key={historyId} id={historyId} /> : <NewExamPageClient />;
}

function SavedHistoryResult({ id }: { id: string }) {
  const [entry, setEntry] = useState<HistoryEntry | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setEntry(loadHistory().find((item) => item.id === id) ?? null);
    setReady(true);
  }, [id]);

  if (!ready) return <main className="mx-auto max-w-3xl px-5 pt-16 text-sm text-fg-muted">연습 기록을 불러오는 중…</main>;
  if (entry?.result) return <ExamResult
    exam={entry.result.exam} title={entry.label} answers={entry.result.answers}
    times={entry.result.times} hintUse={entry.result.hintUse} replays={entry.result.replays}
    historyEntry={entry}
  />;

  const exit = entry ? examExitLink(entry.mode) : { href: "/", label: "← 홈" };
  return <main className="mx-auto max-w-3xl px-5 pb-24 pt-8">
    <Link href={exit.href} className="text-sm text-fg-muted">{exit.label}</Link>
    <Card className="mt-5 p-6">
      <h1 className="text-xl font-semibold">{entry ? "지난 연습 기록" : "기록을 찾을 수 없습니다"}</h1>
      {entry ? <>
        <p className="mt-3 text-sm text-fg-muted">{entry.label} · {formatHistoryStamp(entry)}</p>
        <p className="mt-2 text-sm text-fg-muted">{entry.answered}/{entry.totalItems}문항 답변</p>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">이전 버전에서 저장한 기록에는 질문·답변·피드백이 남아 있지 않습니다. 새로 완료하는 연습부터 상세 결과가 저장됩니다.</p>
      </> : <p className="mt-3 text-sm text-fg-muted">삭제된 기록이거나 다른 브라우저에서 저장한 기록입니다.</p>}
    </Card>
  </main>;
}

function NewExamPageClient() {
  const params = useSearchParams();
  const mode = params.get("mode") ?? "full";
  const topicId = params.get("topic");
  const scope = parseRandomScope(params.get("scope"));
  const [exam, setExam] = useState<Exam | null>(null);
  const [started, setStarted] = useState(mode !== "full");
  const [includeIntro, setIncludeIntro] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // 배경 설문 주제는 실전 모의고사 시작 화면에서 고른다. 모의고사에 나오는 주제는 처음에 모두 켜져 있다.
  const [enabledIds, setEnabledIds] = useState<string[]>(defaultSettings.enabledSurveyIds);
  const { history, error: historyError, remove, removeAll, removeSelected } = usePracticeHistory();
  const fullHistory = useMemo(() => history.filter((entry) => entry.mode === "full"), [history]);
  const build = useCallback((withIntro: boolean) => {
    setError(null);
    try {
      if (mode === "practice") {
        const topic = topicId ? topicById.get(topicId) : undefined;
        if (!topic) throw new Error("연습할 주제를 찾지 못했습니다. 주제 목록에서 다시 골라 주세요.");
        setExam(buildPracticeExam(topic));
        return;
      }
      if (mode === "single" || mode === "set") { setExam(buildRandomPractice(mode, scope)); return; }
      if (mode !== "full") throw new Error("지원하지 않는 연습 방식입니다.");
      setExam(buildFullExam({ enabledSurveyIds: loadSettings().enabledSurveyIds, includeIntro: withIntro }));
    } catch (cause) {
      setExam(null);
      setError(cause instanceof Error ? cause.message : "문제를 만들지 못했습니다.");
    }
  }, [mode, topicId, scope]);

  useEffect(() => { setEnabledIds(loadSettings().enabledSurveyIds); }, []);
  useEffect(() => { setStarted(mode !== "full"); build(true); }, [build, mode]);

  // 모의고사에 나오지 않는 주제도 목록에는 남기지만, 최소 선택 개수를 셀 때는 넣지 않는다.
  const selectedCount = drawableSurveyTopics.filter((topic) => enabledIds.includes(topic.id)).length;

  function toggleTopic(id: string) {
    const selected = enabledIds.includes(id);
    if (selected && !DRAW_EXCLUDED_TOPIC_IDS.includes(id) && selectedCount <= MIN_FULL_EXAM_SURVEY_TOPICS) return;
    const next = selected ? enabledIds.filter((value) => value !== id) : [...enabledIds, id];
    setEnabledIds(saveEnabledTopics(next).enabledSurveyIds);
    build(includeIntro);
  }

  // 모의고사 시작 화면은 문제를 못 만들어도 그린다. 주제를 다시 골라 풀어야 하기 때문이다.
  if (!started) return <main className="mx-auto w-full max-w-2xl px-5 pb-24 pt-8 sm:px-8">
    <Link href="/" className="text-sm text-fg-muted transition-colors hover:text-fg">← 홈</Link>
    <Card className="mt-5 p-6 sm:p-8">
      <Badge tone="accent">실전 모의고사</Badge>
      {error && <p role="alert" className="mt-4 text-sm text-warn-ink">{error}</p>}
      {exam && <>
        <h1 className="mt-4 text-2xl font-semibold">{exam.items.length}문항이 준비됐습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">2~4·5~7·8~10번 세트와 11~13번 롤플레이 세트, 14~15번 비교·이슈까지 다섯 구간을 만듭니다. 실제 시험처럼 세 구간은 선택한 배경 설문 주제에서, 두 구간은 돌발 주제에서 나오며 같은 주제는 한 번만 나옵니다.</p>
        <p className="mt-3 text-xs leading-relaxed text-fg-muted">돌발 {surpriseTopics.length}개 주제 가운데 둘을 뽑아 어느 구간에 넣을지는 회차마다 달라집니다. 롤플레이는 늘 배경 설문 주제에서 나옵니다. 번호와 유형은 실제 시험에서 늘 똑같이 맞아떨어지지는 않습니다.</p>
        <ul className="mt-5 space-y-1.5 border-t border-line pt-4 text-xs leading-relaxed text-fg-muted">
          <li>· 실제 응시 화면과 같습니다. 문항마다 <strong className="text-fg">▶ 를 눌러야</strong> 질문이 나옵니다.</li>
          <li>· 질문이 끝난 뒤 <strong className="text-fg">5초 안에</strong> 같은 버튼을 누르면 한 번 더 들을 수 있고, 재청취는 문항당 한 번뿐입니다.</li>
          <li>· 지문은 화면에 없습니다. 막히면 아래 <strong className="text-fg">힌트 버튼을 꾹 누르고 있는 동안에만</strong> 볼 수 있습니다.</li>
          <li>· 답변은 마이크로 합니다. 말하는 대로 실시간으로 적히고, 필요하면 직접 고쳐 쓸 수 있습니다.</li>
        </ul>
        {exam.notices?.map((notice) => <p key={notice} className="mt-3 text-xs leading-relaxed text-warn-ink">{notice}</p>)}
      </>}

      <details className="mt-5 border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-fg-muted">문제 유형 살펴보기</summary>
        <p className="mt-2 text-xs text-fg-subtle">자주 나오는 순서를 기준으로 정리한 번호입니다. 시험마다 번호와 유형이 그대로 맞아떨어지지는 않습니다.</p>
        <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-fg-muted">{EXAM_GROUPS.map((group) => <li key={group.label}><strong className="font-medium text-fg">{group.slots.join("·")}번 · {group.label}</strong> — {group.note}</li>)}</ul>
      </details>

      <div className="mt-6 border-t border-line pt-5">
        <h2 className="text-sm font-semibold text-fg-muted">배경 설문 주제</h2>
        <p className="mt-2 text-xs text-fg-muted">모의고사에 쓸 주제를 고르세요. <strong className="font-medium text-fg">모의고사 제외</strong> 표시가 없는 주제를 {MIN_FULL_EXAM_SURVEY_TOPICS}개 이상 선택해야 하며, 처음에는 {surveyTopics.length}개가 모두 켜져 있습니다.</p>
        <div className="mt-4 flex flex-wrap gap-2">{surveyTopics.map((topic) => {
          const on = enabledIds.includes(topic.id);
          const excluded = DRAW_EXCLUDED_TOPIC_IDS.includes(topic.id);
          return <button key={topic.id} type="button" aria-pressed={on} onClick={() => toggleTopic(topic.id)} className={`rounded-xl border px-3.5 py-2 text-sm ${on ? "border-primary/50 bg-primary-tint text-primary-ink" : "border-line text-fg-muted"}`}>{topic.emoji} {topic.ko}{excluded && <span className="ml-1.5 text-[11px] text-fg-subtle">모의고사 제외</span>}</button>;
        })}</div>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
          <span>모의고사 제외 주제는 따로 연습할 수 있습니다.</span>
          {surveyTopics.filter((topic) => DRAW_EXCLUDED_TOPIC_IDS.includes(topic.id)).map((topic) => <Link key={topic.id} href={`/exam?mode=practice&topic=${encodeURIComponent(topic.id)}`} className="text-primary-ink">{topic.emoji} {topic.ko} 연습 →</Link>)}
        </p>
      </div>

      <label className="mt-6 flex cursor-pointer items-center gap-3 text-sm text-fg-muted"><input type="checkbox" checked={includeIntro} onChange={(e) => { setIncludeIntro(e.target.checked); build(e.target.checked); }} />1번 자기소개 문항 포함하기</label>
      <div className="mt-7 flex flex-wrap gap-3"><button type="button" disabled={!exam} onClick={() => setStarted(true)} className="rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-50">시작하기</button><button type="button" onClick={() => build(includeIntro)} className="rounded-xl border border-line px-4 py-3 text-sm text-fg-muted">문제 다시 뽑기</button></div>
    </Card>

    <HistoryList title="모의고사 기록" entries={fullHistory} error={historyError} onRemove={remove} onRemoveAll={removeAll} onRemoveSelected={removeSelected} />
    <Footer />
  </main>;

  if (error) return <main className="mx-auto max-w-3xl px-5 pt-16"><p role="alert" className="text-sm text-warn-ink">{error}</p><Link href="/" className="mt-4 inline-block text-sm text-primary-ink">← 홈</Link><Link href="/topics" className="ml-6 text-sm text-primary-ink">주제별 연습 →</Link></main>;
  if (!exam) return <main className="mx-auto max-w-3xl px-5 pt-16 text-sm text-fg-muted">문제를 준비하는 중…</main>;

  const topicName = topicById.get(exam.focusTopicId ?? "")?.ko ?? "";
  const title = mode === "practice" ? `주제별 연습 · ${topicName}`
    : mode === "set" ? `${randomPracticeLink("set", exam.randomScope).label} · ${topicName}`
      : mode === "single" ? randomPracticeLink("single", exam.randomScope).label : "실전 모의고사";
  return <ExamRunner key={exam.id} exam={exam} title={title} onRegenerate={() => { build(includeIntro); setStarted(mode !== "full"); }} />;
}
