"use client";
import { useCallback, useEffect, useState } from "react";
import { feedbackCategoryLabel, feedbackDisplayText } from "@/lib/feedback";
import {
  expressionsForQuestion,
  loadExpressions,
  removeExpression,
  toggleExpression,
  type ExpressionDraft,
  type SavedExpression,
} from "@/lib/expressions";

/** 별표로 저장해 둔 피드백을 읽고 쓰는 공통 훅. 결과 화면과 연습 화면이 함께 쓴다. */
export function useSavedExpressions() {
  const [entries, setEntries] = useState<SavedExpression[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setEntries(loadExpressions());
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);

  const apply = useCallback((run: () => SavedExpression[]) => {
    try { setEntries(run()); setError(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "표현을 저장하지 못했습니다."); }
  }, []);

  const toggle = useCallback((draft: ExpressionDraft) => apply(() => toggleExpression(draft)), [apply]);
  const remove = useCallback((id: string) => apply(() => removeExpression(id)), [apply]);

  return { entries, error, toggle, remove, savedIds: new Set(entries.map((entry) => entry.id)) };
}

/** 결과 화면의 별표 버튼. 누른 조언은 같은 문항을 다시 풀 때 연습 도구에 나온다. */
export function SaveExpressionButton({ draft, saved, onToggle }: {
  draft: ExpressionDraft;
  saved: boolean;
  onToggle: (draft: ExpressionDraft) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={saved}
      title={saved ? "저장 해제하면 연습 화면에서 사라집니다" : "저장하면 이 문항을 다시 풀 때 연습 도구에 나옵니다"}
      onClick={() => onToggle(draft)}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${saved ? "border-primary/50 bg-primary-tint text-primary-ink" : "border-line text-fg-subtle hover:text-fg"}`}
    >
      <span aria-hidden="true">{saved ? "★" : "☆"}</span>
      {saved ? "저장됨" : "저장"}
    </button>
  );
}

/**
 * 응시 화면의 연습 도구에 붙는 저장한 표현 목록.
 * 실전에 없는 도움이라 기본은 접혀 있고, 펼쳐야 내용이 보인다.
 */
export function SavedExpressionsPanel({ questionId, topicId, topicKo }: {
  questionId: string;
  topicId: string;
  topicKo: string;
}) {
  const { entries, error, remove } = useSavedExpressions();
  const [open, setOpen] = useState(false);
  const { thisQuestion, sameTopic } = expressionsForQuestion(entries, questionId, topicId);
  const total = thisQuestion.length + sameTopic.length;

  return (
    <div className="mt-4 border border-exam-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 bg-exam-frame-2 px-3 py-2 text-xs text-exam-ink transition-colors hover:bg-exam-frame"
      >
        <span className="font-semibold">저장한 표현 · 피드백 {total}개</span>
        <span className="text-exam-ink-muted">{open ? "접기 ▴" : "펼치기 ▾"}</span>
      </button>

      {open && (
        <div className="space-y-3 px-3 py-3">
          {error && <p role="alert" className="text-xs text-exam-rec">{error}</p>}
          {total === 0 ? (
            <p className="text-xs leading-relaxed text-exam-ink-muted">
              아직 저장한 표현이 없습니다. 연습을 마친 뒤 결과 화면의 AI 피드백에서 <strong className="font-semibold text-exam-ink">☆ 저장</strong>을 누르면, 같은 문항이나 같은 주제를 다시 풀 때 여기에 모아 보여 줍니다.
            </p>
          ) : (
            <>
              {thisQuestion.length > 0 && <ExpressionGroup title="이 문항에서 저장한 것" entries={thisQuestion} onRemove={remove} />}
              {sameTopic.length > 0 && <ExpressionGroup title={`${topicKo} 주제의 다른 문항`} entries={sameTopic} onRemove={remove} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ExpressionGroup({ title, entries, onRemove }: {
  title: string;
  entries: readonly SavedExpression[];
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-wide text-exam-ink-muted">{title}</p>
      <ul className="mt-2 space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="border border-exam-line bg-exam-frame-2 px-3 py-2">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-exam-ink-muted">
                  {entry.category ? `${feedbackCategoryLabel[entry.category]} · ` : ""}{feedbackDisplayText(entry.title)}
                </p>
                {entry.example && <p className="mt-1 text-sm leading-relaxed text-exam-ink">{entry.example}</p>}
                {entry.body && <p className="mt-1 text-xs leading-relaxed text-exam-ink-muted">{feedbackDisplayText(entry.body)}</p>}
              </div>
              <button
                type="button"
                onClick={() => onRemove(entry.id)}
                aria-label={`${feedbackDisplayText(entry.title)} 저장 해제`}
                className="shrink-0 rounded border border-exam-line px-2 py-0.5 text-[11px] text-exam-ink-muted transition hover:text-exam-ink"
              >
                지우기
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
