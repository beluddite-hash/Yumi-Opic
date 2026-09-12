import { FEEDBACK_CRITERIA, type FeedbackCounts } from "@/lib/feedback";

/** 완료한 답변 수를 분모로 쓰는 공통 집계. 별도 AI 요청 없이 저장된 평가만 표시한다. */
export default function FeedbackProgress({ counts, total }: { counts: FeedbackCounts; total: number }) {
  const missing = Math.max(0, total - counts.evaluated);

  return <div>
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-sm font-semibold text-fg">답변 완성도</h2>
      {missing > 0 && <span className="text-xs tabular-nums text-fg-subtle">미평가 {missing.toLocaleString("ko-KR")}문항</span>}
    </div>
    <dl className="space-y-4">
      {FEEDBACK_CRITERIA.map(({ key, label }) => {
        const good = counts[key];
        const pct = total > 0 ? Math.min(100, Math.max(0, good / total * 100)) : 0;
        return <div key={key}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <dt className="text-xs font-medium text-fg-muted sm:text-sm">{label}</dt>
            <dd className="whitespace-nowrap text-sm tabular-nums text-fg-subtle">
              <strong className="text-lg font-semibold text-primary-ink">{good.toLocaleString("ko-KR")}</strong>
              {" / "}{total.toLocaleString("ko-KR")}
            </dd>
          </div>
          <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total || 1} aria-valuenow={good}
            aria-valuetext={`완료 ${total}문항 중 좋음 ${good}문항${missing ? `, 미평가 ${missing}문항` : ""}`}
            className="h-1.5 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>;
      })}
    </dl>
  </div>;
}
