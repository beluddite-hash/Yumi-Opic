"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hasAnswerText, sameSpokenText } from "@/lib/answers";
import { diffAnswers, type DiffPiece } from "@/lib/answerDiff";
import {
  feedbackCategoryLabel,
  feedbackDisplayText,
  feedbackItemQuotes,
  feedbackRewrite,
  FEEDBACK_CRITERIA,
  type FeedbackCategory,
  type OpicFeedback,
  type OpicFeedbackItem,
} from "@/lib/feedback";
import {
  countReadWords,
  coverageRatio,
  markReadWords,
  splitForReading,
  READ_COVERAGE_PASS,
  READ_IDLE_STOP_MS,
} from "@/lib/readAloud";
import { isSpeechRecognitionSupported, startDictation, type DictationHandle } from "@/lib/speech";
import {
  draftId,
  expressionFromFeedbackItem,
  expressionFromOverall,
  type ExpressionContext,
  type ExpressionDraft,
} from "@/lib/expressions";
import { SaveExpressionButton } from "./SavedExpressions";

/** 조언을 ☆ 로 저장하는 데 필요한 것. 결과 화면만 넘기고, 모아보기·인쇄에서는 버튼을 그리지 않는다. */
export interface ExpressionControls {
  context: ExpressionContext;
  savedIds: ReadonlySet<string>;
  onToggle: (draft: ExpressionDraft) => void;
  error: string | null;
}

/** 따라 읽기를 세어 기록에 남기는 데 필요한 것. 결과 화면만 넘긴다. */
export interface ReadingControls {
  /** 받아쓰기로 확인된 따라 읽기 횟수. */
  reads: number;
  onRead: () => void;
}

/**
 * `report` 는 피드백 모아보기와 그 인쇄본이다. 넘겨 볼 화면이 아니라 남겨 두는 기록이라
 * Before 를 접지 않고 다듬은 곳도 처음부터 보여 준다. 인쇄하면 접힌 내용과 버튼은
 * 종이에 남지 않기 때문이다.
 */
type Variant = "screen" | "report";

/**
 * 스토리 흐름에 해당하는 유형은 강조색으로, 전달·발음·문법은 차분한 색으로 칠한다.
 * 코칭이 흐름을 먼저 보고 문법을 마지막에 본다는 우선순위를 색으로도 드러낸다.
 */
const FLOW_CATEGORIES: ReadonlySet<FeedbackCategory> = new Set(["storytelling", "transition", "detail", "emotion"]);

/*
 * 바뀐 곳의 두 등급을 칠하는 법.
 *
 * 색은 진한 등급(고칠 점이 요구해서 바뀐 곳)만 쓴다. 연한 등급(자연스러움만 손본 곳)은
 * 한 답변에서 열 곳을 넘기기도 해서, 옅게라도 칠하면 답변이 다시 얼룩져 "다 틀렸다"로
 * 읽힌다. 그래서 화면에서는 기본으로 끄고, 버튼을 누를 때만 점선으로 보여 준다.
 */
const DELETED = "rounded-sm bg-danger-tint px-0.5 text-danger-ink line-through decoration-danger-ink/60 box-decoration-clone";
const INSERTED = "rounded-sm bg-success-tint px-0.5 font-medium text-success-ink no-underline box-decoration-clone";
const SOFT_SHOWN = "text-fg-muted underline decoration-dotted decoration-line-strong underline-offset-[3px]";
/** 따라 읽기에서 아직 받아쓰기가 따라오지 않은 낱말. */
const UNREAD = "opacity-50 motion-safe:transition-opacity";
/** 끈 상태. del 의 기본 취소선까지 지워 평범한 글자로 만든다. */
const SOFT_HIDDEN = "no-underline";

/**
 * AI 피드백 한 문항 분량. 결과 화면과 피드백 모아보기가 함께 쓴다.
 *
 * 총평과 흐름 점검 → 고칠 점 → Before / After 순서다. 무엇이 문제인지 먼저 읽고,
 * 그것을 내 답변에 반영하면 어디가 달라지는지 바로 아래에서 확인하게 한다.
 */
export default function FeedbackDetails({ feedback, answer, expressions, reading, variant = "screen" }: {
  feedback: OpicFeedback;
  /** 평가 기준은 유형별로 다르지만, 화면의 세 항목 명칭은 공통이다. */
  questionType: string;
  /** 지금 화면에 보이는 답변. Before 가 이와 다르면(브라우저 받아쓰기로 되돌린 경우 등) 한 줄로 알린다. */
  answer?: string;
  expressions?: ExpressionControls;
  reading?: ReadingControls;
  variant?: Variant;
}) {
  const overallDraft = expressions && expressionFromOverall(feedback, expressions.context);
  const rewrite = feedbackRewrite(feedback);
  const items = feedback.items.slice(0, 5);
  // 고친 답변에서 번호 위에 손을 올리면 그 고칠 점이, 고칠 점 위에 올리면 그 자리가 밝아진다.
  const [activeItem, setActiveItem] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      <section aria-label="총평" className="rounded-xl bg-primary-tint px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-1 text-[11px] font-semibold tracking-widest text-primary-ink">총평</p>
          {overallDraft && expressions && (
            <SaveExpressionButton draft={overallDraft} saved={expressions.savedIds.has(draftId(overallDraft))} onToggle={expressions.onToggle} />
          )}
        </div>
        <p className="mt-1.5 text-sm font-medium leading-relaxed text-fg">{feedbackDisplayText(feedback.overall)}</p>
        <ol aria-label="답변 흐름 점검" className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {FEEDBACK_CRITERIA.map(({ key, label }, index) =>
            <FlowStep key={key} label={label} good={feedback.structure[key] === "good"} arrow={index > 0} />)}
        </ol>
        {feedback.structure.note && <p className="mt-2.5 text-xs leading-relaxed text-fg-muted">{feedbackDisplayText(feedback.structure.note)}</p>}
        {expressions?.error && <p role="alert" className="mt-2 text-xs text-warn-ink">{expressions.error}</p>}
      </section>

      <section aria-label="고칠 점">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-fg">{items.length ? `고칠 점 ${items.length}가지` : "고칠 점"}</h3>
          {items.length > 1 && <p className="text-[11px] text-fg-subtle">전달력에 영향이 큰 것부터</p>}
        </div>
        {items.length ? (
          <ol className="mt-2.5 space-y-2.5">
            {items.map((detail, index) => (
              <FeedbackItem
                key={`${detail.category}-${index}`}
                detail={detail}
                index={index}
                expressions={expressions}
                active={activeItem === index + 1}
                onHover={setActiveItem}
              />
            ))}
          </ol>
        ) : (
          <p className="mt-2 rounded-xl bg-surface-2 px-3.5 py-3 text-xs text-fg-muted">지금 답변에서 꼭 고칠 만한 큰 문제는 찾지 않았습니다.</p>
        )}
      </section>

      {rewrite && (
        <RewriteCompare
          before={rewrite.before}
          after={rewrite.after}
          feedback={feedback}
          answer={answer}
          reading={reading}
          variant={variant}
          activeItem={activeItem}
          onHoverItem={setActiveItem}
        />
      )}

      <div className="space-y-1 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-subtle">
        <p>
          {feedback.pronunciationBasis === "audio_compare"
            ? "발음 항목은 녹음본을 별도로 재전사해 브라우저 받아쓰기와 비교한 점검 신호입니다. 두 음성인식 모두 틀릴 수 있으므로 확정 판정으로 보지는 마세요."
            : "별도 녹음 재전사가 없으면 텍스트만 보고 발음 오류를 추정하지 않습니다."}
        </p>
        {expressions && <p>☆ 저장을 누른 조언은 같은 문항이나 같은 주제를 다시 풀 때 연습 도구에 나옵니다.</p>}
      </div>
    </div>
  );
}

function FlowStep({ label, good, arrow = false }: { label: string; good: boolean; arrow?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      {arrow && <span aria-hidden="true" className="text-xs text-fg-subtle">→</span>}
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${good ? "bg-success-tint text-success-ink ring-success-ink/30" : "bg-warn-tint text-warn-ink ring-warn-ink/30"}`}>
        <span aria-hidden="true">{good ? "✓" : "△"}</span>
        {label} {good ? "좋음" : "보강"}
      </span>
    </li>
  );
}

function FeedbackItem({ detail, index, expressions, active, onHover }: {
  detail: OpicFeedbackItem;
  index: number;
  expressions?: ExpressionControls;
  active: boolean;
  onHover: (item: number | null) => void;
}) {
  const draft = expressions && expressionFromFeedbackItem(detail, expressions.context);
  const flow = FLOW_CATEGORIES.has(detail.category);
  return (
    <li
      className={`rounded-xl px-3.5 py-3 transition-colors ${active ? "bg-primary-tint-strong" : "bg-surface-2"}`}
      onMouseEnter={() => onHover(index + 1)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-surface text-[11px] font-semibold tabular-nums ring-1 ring-inset ${active ? "text-primary-ink ring-primary-ink" : "text-fg-muted ring-line"}`}>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${flow ? "bg-primary-tint text-primary-ink" : "bg-surface-3 text-fg-muted"}`}>
            {feedbackCategoryLabel[detail.category]}
          </span>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-fg">{feedbackDisplayText(detail.title)}</p>
          {detail.message && <p className="mt-1 text-xs leading-relaxed text-fg-muted">{feedbackDisplayText(detail.message)}</p>}
          {detail.example && (
            <div className="mt-2.5 rounded-lg border-l-2 border-primary bg-surface px-3 py-2">
              <p className="text-[10px] font-semibold tracking-wider text-primary-ink">이렇게 말해 보세요</p>
              <p lang="en" className="mt-0.5 text-sm leading-relaxed text-fg">{detail.example}</p>
            </div>
          )}
        </div>
        {draft && expressions && (
          <SaveExpressionButton draft={draft} saved={expressions.savedIds.has(draftId(draft))} onToggle={expressions.onToggle} />
        )}
      </div>
    </li>
  );
}

/**
 * 내가 말한 답변과 고친 답변을 견준다.
 *
 * 소리 내어 읽을 것은 After 라서 After 를 먼저 두고 Before 는 접는다. Before 의 빨간
 * 취소선이 화면에서 가장 무거워, 위에 두면 고친 답변보다 먼저 눈에 들어온다.
 */
function RewriteCompare({ before, after, feedback, answer, reading: readingControls, variant, activeItem, onHoverItem }: {
  before: string;
  after: string;
  feedback: OpicFeedback;
  answer?: string;
  reading?: ReadingControls;
  variant: Variant;
  activeItem: number | null;
  onHoverItem: (item: number | null) => void;
}) {
  const diff = useMemo(() => diffAnswers(before, after, feedbackItemQuotes(feedback)), [before, after, feedback]);
  const [showFluency, setShowFluency] = useState(variant === "report");
  const basisDiffers = answer !== undefined && hasAnswerText(answer) && !sameSpokenText(before, answer);

  /*
   * 따라 읽기.
   *
   * 읽는 박자는 사람이 만든다. 글자를 정해진 속도로 흘려보내면 낱말마다 같은 시간이
   * 걸려 어차피 사람이 읽는 결과 어긋나고, 무엇보다 입을 떼지 않아도 끝까지 흘러가
   * 읽었다는 근거가 남지 않는다. 그래서 받아쓰기가 따라온 낱말만 또렷해지게 하고,
   * 어디까지 왔는지도 그 표시에서 읽는다.
   *
   * 받아쓰기가 없는 브라우저에서는 재생기를 아예 그리지 않는다. 읽었는지 알 길이
   * 없는데 단추만 두면 눌러도 아무 일이 일어나지 않는다. 모아보기·인쇄본도 읽는
   * 화면이 아니라 남겨 두는 기록이라 그리지 않는다.
   */
  const totalWords = useMemo(() => countReadWords(after), [after]);
  /** 받아쓰기가 따라온 낱말. null 은 아직 한 번도 읽지 않은 상태다. */
  const [marks, setMarks] = useState<boolean[] | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [micError, setMicError] = useState(false);

  /*
   * 인식 결과는 콜백으로 오고, 인식 중인 임시 문장은 확정되기 전까지 통째로 다시
   * 쓰인다. 그래서 앞의 표시를 여기에 들고 있다가 다음 결과에 넘겨, 한 번 읽은 낱말이
   * 깜빡이며 사라지지 않게 한다.
   */
  const readSoFar = useRef<boolean[] | null>(null);
  /** 이번 읽기에서 횟수를 이미 셌는지. 통과선을 넘는 순간 한 번만 센다. */
  const counted = useRef(false);
  /** 지금까지 표시된 낱말 수. 새 낱말이 붙었는지 보는 데 쓴다. */
  const coveredSoFar = useRef(0);
  /** 통과선을 넘긴 뒤 읽기가 멈췄는지 재는 시계. */
  const idleStop = useRef(0);
  const dictation = useRef<DictationHandle | null>(null);
  // 프롭은 렌더마다 새 객체로 온다. 콜백이 낡은 값을 잡지 않도록 여기에 담아 둔다.
  const onRead = useRef(readingControls?.onRead);
  onRead.current = readingControls?.onRead;
  const target = useRef(after);
  target.current = after;

  // 브라우저에만 있는 값이라 서버가 그린 첫 화면과 어긋나지 않도록 나중에 읽는다.
  useEffect(() => { setSupported(isSpeechRecognitionSupported()); }, []);

  const clearIdleStop = () => {
    if (!idleStop.current) return;
    window.clearTimeout(idleStop.current);
    idleStop.current = 0;
  };

  /** 읽기가 멈춘 것으로 볼 시각을 지금부터 다시 잰다. */
  const armIdleStop = () => {
    clearIdleStop();
    idleStop.current = window.setTimeout(() => {
      idleStop.current = 0;
      stopReading();
    }, READ_IDLE_STOP_MS);
  };

  // 화면을 떠나면 마이크를 놓아 준다. 문항 카드를 접어도 여기를 지난다.
  useEffect(() => () => {
    if (idleStop.current) window.clearTimeout(idleStop.current);
    dictation.current?.abort();
    dictation.current = null;
  }, []);

  const stopReading = () => {
    clearIdleStop();
    setListening(false);
    // stop() 은 말하던 마지막 문장까지 받아 적고 끝난다.
    dictation.current?.stop();
  };

  const startReading = () => {
    readSoFar.current = null;
    counted.current = false;
    coveredSoFar.current = 0;
    clearIdleStop();
    setMarks(null);
    setMicError(false);
    dictation.current?.abort();
    dictation.current = startDictation({
      onUpdate: (draft) => {
        const said = [draft.committed, draft.interim].filter(Boolean).join(" ");
        const next = markReadWords(target.current, said, readSoFar.current ?? undefined);
        readSoFar.current = next;
        setMarks(next);

        /* 읽은 횟수는 여기서만 센다. 통과선을 넘은 순간 한 번 센다. */
        if (!counted.current && coverageRatio(next) >= READ_COVERAGE_PASS) {
          counted.current = true;
          onRead.current?.();
        }

        /*
         * 통과선을 넘긴 뒤로는 새 낱말이 붙을 때마다 시계를 되돌린다. 남은 대목을
         * 마저 읽는 동안에는 끊기지 않고, 읽기를 멈추면 그때부터 시계가 흘러 마이크가
         * 닫힌다. 무음으로 인식 세션이 끊겼다 다시 켜질 때도 `onUpdate` 는 같은
         * 텍스트를 한 번 더 넘기므로, 시계를 되돌릴 일은 새 낱말이 붙은 때로 한정한다.
         */
        const coveredNow = next.reduce((sum, mark) => (mark ? sum + 1 : sum), 0);
        if (coveredNow > coveredSoFar.current) {
          coveredSoFar.current = coveredNow;
          if (counted.current) armIdleStop();
        }
      },
      onError: (code) => {
        if (code !== "not-allowed" && code !== "service-not-allowed" && code !== "audio-capture") return;
        clearIdleStop();
        setMicError(true);
        setListening(false);
      },
      onEnd: () => {
        clearIdleStop();
        dictation.current = null;
        setListening(false);
      },
    });
    if (!dictation.current) { setMicError(true); return; }
    setListening(true);
  };

  const reading = variant === "screen" && totalWords > 0 && supported;
  const covered = marks ? marks.filter(Boolean).length : 0;
  const percent = totalWords > 0 ? Math.round((covered / totalWords) * 100) : 0;
  const missing = totalWords - covered;
  const passed = marks !== null && coverageRatio(marks) >= READ_COVERAGE_PASS;
  const reads = readingControls?.reads ?? 0;

  const readControls = reading ? (
    <div className="print-hide mt-3 space-y-2 border-t border-line pt-2.5">
      <div
        className="h-1 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-label="읽은 부분"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary motion-safe:transition-[width] motion-safe:duration-150" style={{ width: `${percent}%` }} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={listening ? stopReading : startReading}
          className="min-h-9 rounded-lg bg-primary px-3.5 text-xs font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
        >
          {listening ? "멈춤" : marks === null ? "따라 읽기" : "다시 읽기"}
        </button>
        <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-fg-subtle">
          {listening
            ? `소리 내어 읽으세요. 따라온 낱말이 또렷해집니다 · ${percent}%`
            : marks === null
              ? "누르고 소리 내어 읽으세요. 같은 곳을 여러 번 읽거나 앞으로 되돌아가도 됩니다."
              : passed
                ? `다 읽었습니다 · ${percent}%`
                : `${missing}개 낱말이 확인되지 않았습니다. 받아쓰기가 놓쳤을 수도 있습니다.`}
        </p>
      </div>
      {(reads > 0 || micError) && (
        <p className="text-[11px] leading-relaxed text-fg-subtle">
          {reads > 0 && `읽음 ${reads}회`}
          {micError && `${reads > 0 ? " · " : ""}마이크를 쓸 수 없어 읽은 곳을 확인하지 못했습니다`}
        </p>
      )}
    </div>
  ) : undefined;

  const summary = diff.locatedItems.length
    ? `고칠 점 ${diff.locatedItems.length}가지 반영${diff.fluencyChanges ? ` · 다듬은 곳 ${diff.fluencyChanges}군데` : ""}`
    : diff.changes ? `고친 곳 ${diff.changes}군데` : "고친 곳 없음";

  const beforePanel = (
    <AnswerPanel
      label="Before"
      caption="내가 말한 답변"
      pieces={diff.before}
      showFluency={showFluency}
      activeItem={activeItem}
      onHoverItem={onHoverItem}
    />
  );

  return (
    <section aria-label="Before / After">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold text-fg">Before / After</h3>
        <p className="text-[11px] text-fg-subtle">{summary}</p>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-fg-muted">내가 말한 답변에 위 피드백을 반영하고, 소리 내어 읽을 수 있게 문장을 다듬었습니다. 내 단어와 스토리는 그대로 두었습니다.</p>

      {diff.changes === 0 ? (
        <p className="mt-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-xs text-fg-muted">피드백을 반영해도 고칠 곳이 거의 없는 답변입니다.</p>
      ) : (
        <>
          <div className="mt-2.5 space-y-2">
            <AnswerPanel
              label="After"
              caption="소리 내어 읽을 문장"
              pieces={diff.after}
              after
              showFluency={showFluency}
              activeItem={activeItem}
              onHoverItem={onHoverItem}
              readMarks={reading ? marks : null}
              footer={readControls}
            />
            {variant === "report" ? beforePanel : (
              <details className="group rounded-xl border border-line bg-surface-2">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3.5 text-[11px] font-semibold text-fg-muted [&::-webkit-details-marker]:hidden">
                  내가 말한 답변 (Before)
                  <span aria-hidden="true" className="ml-auto font-normal text-fg-subtle group-open:hidden">펼치기</span>
                  <span aria-hidden="true" className="ml-auto hidden font-normal text-fg-subtle group-open:inline">접기</span>
                </summary>
                <div className="px-2 pb-2">{beforePanel}</div>
              </details>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-fg-subtle">
            {diff.locatedItems.length > 0 && (
              <span><ins className={INSERTED}>초록</ins> 고칠 점이 손댄 자리 · 번호가 위 목록과 이어집니다</span>
            )}
            {diff.fluencyChanges > 0 && variant === "screen" && (
              <button
                type="button"
                aria-pressed={showFluency}
                onClick={() => setShowFluency((value) => !value)}
                className={`print-hide min-h-8 rounded-lg border px-2.5 text-[11px] font-medium transition ${showFluency ? "border-primary-ink/30 bg-primary-tint text-primary-ink" : "border-line text-fg-muted hover:text-fg"}`}
              >
                다듬은 곳 {diff.fluencyChanges}군데 {showFluency ? "숨기기" : "보기"}
              </button>
            )}
            {diff.fluencyChanges > 0 && showFluency && (
              <span><span className={SOFT_SHOWN}>점선</span> 자연스럽게 다듬은 곳</span>
            )}
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">
            {reading
              ? "소리 내어 읽으면 받아쓰기가 따라온 낱말이 또렷해집니다. 한 번 읽은 뒤 같은 질문에 다시 답해 보세요."
              : "After 를 소리 내어 두세 번 읽어 본 뒤, 같은 질문에 다시 답해 보세요."}
          </p>
        </>
      )}

      {basisDiffers && (
        <p className="mt-1 text-[11px] leading-relaxed text-fg-subtle">Before 는 AI 가 고칠 때 바탕으로 삼은 받아쓰기라 위의 내 답변과 조금 다를 수 있습니다.</p>
      )}
    </section>
  );
}

/**
 * 한 고칠 점이 여러 조각으로 갈린 것을 한 덩어리로 잇는다. After 에만 쓴다.
 *
 * 긴 문장을 고치면 그 안의 몇 단어가 예전 답변과 우연히 맞아 조각이 갈린다. 갈린 채로
 * 칠하면 한 자리가 초록 세 덩이로 보여 읽기도 세기도 어렵다. 사이에 낀 것이 바뀌지 않은
 * 말뿐일 때만 잇고, 다른 등급의 변경을 만나면 거기서 멈춘다.
 *
 * Before 에는 쓰지 않는다. 저쪽은 무엇을 뺐는지 보는 곳이라, 빼지 않은 말에 취소선을
 * 그으면 거짓말이 된다.
 */
function itemSpans(pieces: readonly DiffPiece[]): (number | undefined)[] {
  const spans = Array<number | undefined>(pieces.length).fill(undefined);
  pieces.forEach((piece, start) => {
    const number = piece.tier === "item" ? piece.itemNumber : undefined;
    if (number === undefined || spans[start] !== undefined) return;
    let end = start;
    for (let index = start + 1; index < pieces.length; index++) {
      const next = pieces[index];
      if (next.tier === "item" && next.itemNumber === number) { end = index; continue; }
      if (!next.changed) continue;
      break;
    }
    for (let index = start; index <= end; index++) spans[index] ??= number;
  });
  return spans;
}

/** 고칠 점 번호. 한 자리를 여러 번 가리키지 않도록 그 항목의 첫 조각에만 붙인다. */
function ItemBadge({ number, after }: { number: number; after?: boolean }) {
  return (
    <sup className={`ml-px text-[0.62em] font-bold tabular-nums ${after ? "text-success-ink" : "text-danger-ink"}`}>
      {number}
    </sup>
  );
}

/** 화면에 그릴 한 덩어리. 같은 등급·같은 번호가 이어지면 한 요소로 합쳐 이음매를 없앤다. */
interface PanelGroup {
  text: string;
  kind: "plain" | "item" | "fluency";
  number?: number;
}

function panelGroups(pieces: readonly DiffPiece[], after: boolean): PanelGroup[] {
  const spans = after ? itemSpans(pieces) : [];
  const groups: PanelGroup[] = [];
  pieces.forEach((piece, index) => {
    // 이은 구간에 든 말과, 번호가 없는 예전 피드백의 바뀐 말이 진한 등급이다.
    const number = after ? spans[index] : piece.itemNumber;
    const item = number !== undefined || (piece.changed && piece.tier === "item");
    const kind: PanelGroup["kind"] = item ? "item" : piece.changed ? "fluency" : "plain";
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && last.number === number) {
      last.text += piece.text;
      return;
    }
    groups.push({ text: piece.text, kind, number });
  });
  return groups;
}

function AnswerPanel({ label, caption, pieces, after = false, showFluency, activeItem, onHoverItem, readMarks = null, footer }: {
  label: string;
  caption: string;
  pieces: readonly DiffPiece[];
  after?: boolean;
  showFluency: boolean;
  activeItem: number | null;
  onHoverItem: (item: number | null) => void;
  /** 따라 읽기에서 받아쓰기가 따라온 낱말. 아직 읽지 않았으면 null. */
  readMarks?: readonly boolean[] | null;
  footer?: React.ReactNode;
}) {
  const groups = panelGroups(pieces, after);
  // 이 패널에서 이미 번호를 그린 항목. 같은 자리를 여러 번 가리키지 않는다.
  const numbered = new Set<number>();
  // 패널을 통틀어 낱말마다 붙는 번호. 조각을 그리는 차례대로 센다.
  let word = -1;

  /*
   * 아직 받아쓰기가 따라오지 않은 낱말을 흐리게 두어, 읽은 쪽이 또렷하게 남게 한다.
   * 읽은 쪽에 색을 덧칠하지 않는 이유는 이 글에 이미 초록(고칠 점이 손댄 자리)과
   * 점선(다듬은 곳)이 얹혀 있어서다. 그 위에 배경색을 더 깔면 정작 봐야 할 표시가
   * 묻힌다. 흐리게 하는 것은 색을 빼앗지 않아 두 표시가 함께 남는다.
   *
   * 안팎 여백은 주지 않는다. 표시가 바뀔 때마다 글자가 밀려 읽던 자리를 잃는다.
   */
  const readable = (text: string) => splitForReading(text).map((token, index) => {
    if (!token.word) return <span key={index}>{token.text}</span>;
    word += 1;
    if (!readMarks || readMarks[word]) return <span key={index}>{token.text}</span>;
    return <span key={index} className={UNREAD}>{token.text}</span>;
  });

  return (
    <div className={`rounded-xl border px-3.5 py-3 ${after ? "border-success-ink/30 bg-surface" : "border-line bg-surface-2"}`}>
      <p className="text-[11px] font-semibold tracking-wide">
        <span className={after ? "text-success-ink" : "text-fg-muted"}>{label}</span>
        <span className="ml-1.5 font-normal text-fg-subtle">{caption}</span>
      </p>
      <p lang="en" className={`mt-1.5 whitespace-pre-wrap text-sm leading-relaxed ${after ? "text-fg" : "text-fg-muted"}`}>
        {groups.map((group, index) => {
          if (group.kind === "plain") return <span key={index}>{readable(group.text)}</span>;

          if (group.kind === "fluency") {
            const className = showFluency ? SOFT_SHOWN : SOFT_HIDDEN;
            return after
              ? <ins key={index} className={className}>{readable(group.text)}</ins>
              : <del key={index} className={className}>{readable(group.text)}</del>;
          }

          const number = group.number;
          const first = number !== undefined && !numbered.has(number);
          if (number !== undefined) numbered.add(number);
          const active = number !== undefined && number === activeItem;
          const className = `${after ? INSERTED : DELETED}${active ? " ring-1 ring-inset ring-fg-muted" : ""}`;
          const hover = number === undefined ? undefined : {
            onMouseEnter: () => onHoverItem(number),
            onMouseLeave: () => onHoverItem(null),
          };
          const badge = first && number !== undefined ? <ItemBadge number={number} after={after} /> : null;

          return after
            ? <ins key={index} className={className} {...hover}>{readable(group.text)}{badge}</ins>
            : <del key={index} className={className} {...hover}>{readable(group.text)}{badge}</del>;
        })}
      </p>
      {footer}
    </div>
  );
}
