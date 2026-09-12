"use client";

import { useState } from "react";
import type { ExamItem } from "@/lib/types";

/** 시험 영역 바깥의 작은 표시에서만 정보를 드러낸다. 팝업은 화면 배치를 밀지 않는다. */
export default function QuestionContextReveal({ item, showSet }: { item: ExamItem; showSet: boolean }) {
  const [visible, setVisible] = useState(false);
  const context = `${item.topicKo} · ${item.typeLabel}${showSet ? ` · ${item.comboLabel}` : ""}`;

  return <button
    type="button"
    aria-label={visible ? `토픽·유형: ${context}` : "토픽·유형 확인"}
    aria-expanded={visible}
    onPointerEnter={(event) => { if (event.pointerType === "mouse") setVisible(true); }}
    onPointerLeave={() => setVisible(false)}
    onPointerDown={(event) => {
      if (event.pointerType === "mouse") return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setVisible(true);
    }}
    onPointerUp={(event) => { if (event.pointerType !== "mouse") setVisible(false); }}
    onPointerCancel={() => setVisible(false)}
    onLostPointerCapture={() => setVisible(false)}
    onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setVisible(true); }}
    onBlur={() => setVisible(false)}
    onContextMenu={(event) => event.preventDefault()}
    onKeyDown={(event) => {
      if (event.key === "Escape") setVisible(false);
      if (event.key === " " || event.key === "Enter") { event.preventDefault(); setVisible(true); }
    }}
    className="hold-target relative inline-flex min-h-11 shrink-0 items-center text-left text-xs leading-relaxed text-fg-muted sm:min-h-8 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <span aria-hidden="true" className="underline decoration-dotted underline-offset-4">토픽·유형</span>
    <span aria-hidden={!visible} className={`absolute right-0 top-full z-20 w-72 max-w-[calc(100vw-2rem)] pt-1 ${visible ? "visible" : "invisible"}`}>
      <span className="block rounded-lg border border-line bg-surface p-3 text-fg shadow-raised">
        <span className="block font-medium">{item.emoji} {item.topicKo} · {item.typeLabel}</span>
        {showSet && <span className="mt-1 block text-fg-muted">{item.comboLabel}</span>}
      </span>
    </span>
  </button>;
}
