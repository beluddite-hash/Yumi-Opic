"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { deleteHistoryEntries, HISTORY_CHANGED_EVENT, loadHistory, type HistoryEntry } from "@/lib/storage";
import { formatHistoryStamp } from "@/lib/history";
import { feedbackCount, reportHref } from "@/lib/report";
import { Card } from "./ui";

/** 연습 기록을 읽고 지우는 공통 훅. 화면마다 필요한 모드만 골라 쓴다. */
export function usePracticeHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setHistory(loadHistory());
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener(HISTORY_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener(HISTORY_CHANGED_EVENT, refresh);
    };
  }, []);

  const removeMany = useCallback((ids: readonly string[], question: string) => {
    if (!ids.length || !window.confirm(question)) return;
    try { setHistory(deleteHistoryEntries(ids)); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "기록을 삭제하지 못했습니다."); }
  }, []);

  const remove = useCallback((id: string) => {
    removeMany([id], "이 연습 기록과 저장된 피드백을 삭제할까요?");
  }, [removeMany]);

  // 화면마다 보이는 기록만 지운다. 다른 모드의 기록은 그대로 둔다.
  const removeAll = useCallback((ids: readonly string[]) => {
    removeMany(ids, "이 목록의 연습 기록과 저장된 피드백을 모두 삭제할까요?");
  }, [removeMany]);

  const removeSelected = useCallback((ids: readonly string[]) => {
    removeMany(ids, `선택한 ${ids.length}개 기록과 저장된 피드백을 삭제할까요?`);
  }, [removeMany]);

  return { history, error, remove, removeAll, removeSelected };
}

export function HistoryList({ title, entries, error, onRemove, onRemoveAll, onRemoveSelected }: {
  title: string;
  entries: HistoryEntry[];
  error: string | null;
  onRemove: (id: string) => void;
  onRemoveAll: (ids: readonly string[]) => void;
  onRemoveSelected: (ids: readonly string[]) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<readonly string[]>([]);
  const visible = entries.slice(0, showAll ? entries.length : 6);
  // 다른 탭에서 지웠거나 접어서 사라진 기록은 선택에서 뺀다.
  const shown = new Set(visible.map((entry) => entry.id));
  const selected = picked.filter((id) => shown.has(id));
  const allPicked = visible.length > 0 && selected.length === visible.length;

  const toggle = (id: string) => setPicked((current) =>
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  if (!entries.length) return null;
  return <section className="mt-10">
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-fg-muted">{title}</h2>
      <button type="button" className="min-h-11 rounded-lg px-3 text-xs text-fg-muted transition-colors hover:bg-surface-2" onClick={() => onRemoveAll(entries.map((entry) => entry.id))}>전체 삭제</button>
    </div>
    <p className="mt-1 text-xs text-fg-subtle">기록을 누르면 답변과 저장된 피드백을 다시 볼 수 있습니다. 이 브라우저에 최근 20회까지 보관합니다.</p>
    <p className="mt-1 text-xs text-fg-subtle">시각은 답변이나 AI 피드백을 마지막으로 저장한 때입니다. 같은 날 여러 번 연습해도 분까지 보여 회차를 구분할 수 있습니다.</p>
    <p className="mt-1 text-xs text-fg-subtle">왼쪽 체크상자로 여러 회차를 골라 한 화면에 모아 보거나(PDF 저장), 한 번에 지울 수 있습니다.</p>
    {error && <p role="alert" className="mt-3 text-xs text-warn-ink">{error}</p>}

    <div className="mt-3 flex flex-wrap items-center gap-2">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-xs text-fg-muted">
        <input type="checkbox" checked={allPicked} onChange={() => setPicked(allPicked ? [] : visible.map((entry) => entry.id))} className="h-4 w-4 accent-[var(--primary)]" />
        보이는 {visible.length}개 모두 선택
      </label>
      <span aria-live="polite" className="text-xs tabular-nums text-fg-subtle">{selected.length}개 선택됨</span>
      {selected.length > 0 && <>
        <Link href={reportHref(selected)} className="inline-flex min-h-11 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-fg transition-colors hover:bg-primary-hover">모아보기 · PDF 저장 →</Link>
        <button type="button" onClick={() => { onRemoveSelected(selected); setPicked([]); }} className="min-h-11 rounded-lg border border-line px-3 text-xs text-warn-ink transition-colors hover:bg-surface-2">선택 삭제</button>
        <button type="button" onClick={() => setPicked([])} className="min-h-11 rounded-lg px-3 text-xs text-fg-muted transition-colors hover:bg-surface-2">선택 해제</button>
      </>}
    </div>

    <Card className="mt-3 divide-y divide-line overflow-hidden">{visible.map((entry) => {
      const saved = feedbackCount(entry);
      const checked = selected.includes(entry.id);
      return <div key={entry.id} className="flex items-center gap-2 pl-3 pr-3 sm:pr-4">
        <label className="grid min-h-11 w-9 shrink-0 cursor-pointer place-items-center">
          <input type="checkbox" checked={checked} onChange={() => toggle(entry.id)} className="h-4 w-4 accent-[var(--primary)]"
            aria-label={`${entry.label} (${formatHistoryStamp(entry)}) 선택`} />
        </label>
        <Link href={`/exam?history=${encodeURIComponent(entry.id)}`} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 py-4 pr-1 text-sm transition-colors hover:bg-surface-2 focus-visible:outline-offset-[-3px]">
          <span className="text-xs tabular-nums text-fg-muted">{formatHistoryStamp(entry)}</span>
          <span className="min-w-0 flex-1 basis-40 font-medium text-fg">{entry.label}</span>
          <span className="text-xs text-fg-muted">{entry.answered}/{entry.totalItems}문항 답변</span>
          {saved > 0 && <span className="text-xs text-success-ink">피드백 {saved}개</span>}
          <span className="text-xs text-primary-ink">{entry.result ? "답변·피드백 보기 →" : "요약 보기 →"}</span>
        </Link>
        <button type="button" aria-label={`${entry.label} (${formatHistoryStamp(entry)}) 기록 삭제`} onClick={() => onRemove(entry.id)} className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-xs text-fg-muted transition-colors hover:bg-surface-2">삭제</button>
      </div>;
    })}</Card>
    {entries.length > 6 && <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 min-h-11 rounded-lg border border-line px-4 text-xs text-fg-muted">{showAll ? "접기" : `기록 더 보기 (${entries.length}개)`}</button>}
  </section>;
}
