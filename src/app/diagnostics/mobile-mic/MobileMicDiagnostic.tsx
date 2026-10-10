"use client";

import { useEffect, useRef, useState } from "react";
import { createMicDiagnostic, initialDiagnosticState, type DiagnosticRecognition, type MicExperiment } from "@/lib/mobileMicDiagnostic";

const modes: { id: MicExperiment; title: string; detail: string }[] = [
  { id: "single-auto", title: "A · 기존 단발 인식", detail: "continuous=false · 실제 종료 후 자동 재시작" },
  { id: "continuous-auto", title: "B · 연속 인식", detail: "continuous=true · 실제 종료 후 자동 재시작" },
  { id: "continuous-manual", title: "C · 연속 인식 / 수동 재시작", detail: "continuous=true · 종료되면 멈춤, 버튼으로 이어 말하기" },
];
function ctor() {
  const w = window as unknown as { SpeechRecognition?: new () => DiagnosticRecognition; webkitSpeechRecognition?: new () => DiagnosticRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export default function MobileMicDiagnostic() {
  const [mode, setMode] = useState<MicExperiment>("continuous-manual");
  const [state, setState] = useState(initialDiagnosticState);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [agent, setAgent] = useState("");
  const [soundMode, setSoundMode] = useState("소리");
  const harness = useRef<ReturnType<typeof createMicDiagnostic> | null>(null);
  const busy = state.running || state.waiting;
  const button = "min-h-12 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold disabled:opacity-40";
  useEffect(() => {
    setSupported(!!ctor()); setAgent(navigator.userAgent);
    const hidden = () => { if (document.visibilityState === "hidden") harness.current?.hide(); };
    document.addEventListener("visibilitychange", hidden);
    return () => { document.removeEventListener("visibilitychange", hidden); harness.current?.dispose(); };
  }, []);
  const start = () => {
    const Ctor = ctor(); if (!Ctor) return;
    if (!harness.current) harness.current = createMicDiagnostic({
      mode, androidChromium: /Android/i.test(navigator.userAgent) && /Chrome\//i.test(navigator.userAgent),
      create: () => new Ctor(), now: () => performance.now(), visible: () => document.visibilityState !== "hidden",
      schedule: (fn, ms) => window.setTimeout(fn, ms), cancel: (id) => window.clearTimeout(id), update: setState,
    });
    harness.current.start();
  };
  const reset = (next = mode) => {
    harness.current?.dispose(); harness.current = null; setState(initialDiagnosticState()); setMode(next);
  };
  const download = () => {
    // No audio or dictated text in the exported report. Browser metadata is useful for A/B comparisons.
    const report = { mode, soundMode, userAgent: agent, createdAt: new Date().toISOString(),
      counts: { starts: state.starts, ends: state.ends, errors: state.errors, sounds: state.sounds, requests: state.requests }, events: state.events };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `mobile-mic-${mode}.json`; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-7 text-fg">
    <div><p className="text-sm font-semibold text-primary">YUMIOPIC · 미리보기 전용</p><h1 className="mt-2 text-2xl font-bold">모바일 신호음 비교</h1>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">Chrome과 삼성 인터넷에서 같은 문장을 말하고, 소리가 들릴 때 버튼을 눌러 주세요. 시작·종료 기록과 소리 시점을 비교합니다.</p></div>
    <div className="rounded-xl border border-line bg-surface-2 p-4 text-sm leading-relaxed">
      <p><strong>비용 정책:</strong> PC는 기존 녹음 후 AI 전사 방식을 유지합니다. 모바일은 사이트가 부담하는 추가 전사 API 비용 없이 브라우저 음성인식만 사용합니다.</p>
      <p className="mt-2 text-fg-muted">이 페이지는 녹음·AI 전사·채점·질문 음성을 실행하지 않습니다. 브라우저 자체 인식은 브라우저 제공자의 서버를 사용할 수 있습니다. 기존 모의고사와 답변 저장에는 영향을 주지 않습니다.</p>
    </div>
    <fieldset disabled={busy} className="space-y-2"><legend className="mb-2 font-semibold">비교 방식</legend>
      {modes.map((m) => <label key={m.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${mode === m.id ? "border-primary bg-primary-tint" : "border-line"}`}>
        <input type="radio" name="mode" checked={mode === m.id} onChange={() => reset(m.id)} className="mt-1" />
        <span><span className="block text-sm font-semibold">{m.title}</span><span className="mt-1 block text-xs text-fg-muted">{m.detail}</span></span>
      </label>)}
    </fieldset>
    <p className="text-sm text-fg-muted">A/B의 재시작 간격은 모두 120ms입니다. C는 자동 시작을 없애 신호음 감소와 수동 조작의 불편을 함께 확인합니다. 설정 변경 시 진단 기록이 초기화됩니다.</p>
    <label className="flex items-center gap-3 text-sm">휴대폰 소리 설정 <select disabled={busy} value={soundMode} onChange={(e) => setSoundMode(e.target.value)} className="rounded border border-line bg-surface p-2"><option>소리</option><option>진동</option><option>무음</option></select></label>
    {supported === false && <p role="alert" className="text-red-600">이 브라우저는 Web Speech 음성인식을 지원하지 않습니다. 유료 API로 대체하지 않습니다.</p>}
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={!supported || busy} onClick={start}>{state.requests ? "이어 말하기" : "영어 받아쓰기 시작"}</button>
      <button className={button} disabled={!busy} onClick={() => harness.current?.stop()}>정지</button>
      <button className={`${button} border-primary`} disabled={!state.requests} onClick={() => harness.current?.markSound()}>소리 들림 +1</button>
      <button className={button} disabled={busy} onClick={() => reset()}>기록 초기화</button>
    </div>
    <p role="status" aria-live="polite" className="text-sm font-semibold">{state.waiting ? "자동 재시작 대기" : state.running ? "인식 중" : state.requests ? "인식 종료 · 이어 말하기로 다시 시작" : "시작 대기"}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[["시작 요청",state.requests],["실제 시작",state.starts],["종료",state.ends],["오류",state.errors],["들은 소리",state.sounds]].map(([label,value]) => <div key={label} className="rounded-xl border border-line p-3"><p className="text-xs text-fg-muted">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}</div>
    <section><h2 className="font-semibold">진단용 받아쓰기</h2><p className="mt-2 min-h-24 whitespace-pre-wrap rounded-xl border border-line p-4 text-sm">{state.text || "여기에 영어가 표시됩니다. 모의고사 답변으로 저장되지 않습니다."}</p>
      <details className="mt-2 text-sm"><summary>브라우저가 보낸 원본 결과 보기</summary><pre className="mt-2 overflow-x-auto rounded bg-surface-2 p-3 text-xs">{JSON.stringify(state.raw, null, 2)}</pre></details></section>
    <section className="rounded-xl border border-line p-4 text-sm leading-relaxed"><h2 className="font-semibold">같은 조건으로 세 번 비교하세요</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5"><li>소리 모드에서 각 방식으로 60초 말하고, 문장 사이 2~3초씩 쉬세요.</li><li>띠리링이 들릴 때마다 “소리 들림 +1”을 누르세요.</li><li>“I go to the gym every morning.”을 포함해 서로 다른 문장 세 개와 “very very good”을 말하세요. 앞 문장 유실·중복도 확인하세요.</li><li>정지 후 기록을 내려받고, 다른 방식과 다른 브라우저에서 반복하세요.</li></ol>
      <p className="mt-3 text-fg-muted">시스템 신호음을 웹페이지에서 끄는 표준 설정은 없습니다. continuous=true도 기기 인식 서비스가 종료하면 끝날 수 있습니다. C에서 시작 횟수와 소리가 함께 줄면 자동 재시작이 신호음의 주요 유발 요인임을 뒷받침합니다.</p>
    </section>
    <section><div className="flex items-center justify-between gap-2"><h2 className="font-semibold">이벤트 기록 · 최근 200개</h2><button className={button} disabled={busy || !state.requests} onClick={download}>진단 기록 내려받기</button></div>
      <p className="mt-2 text-xs text-fg-muted">내려받는 파일에는 이벤트·횟수·브라우저 정보만 포함됩니다. 음성이나 받아쓴 문장은 포함하지 않습니다.</p>
      <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-line"><table className="w-full text-left text-xs"><thead><tr><th className="p-2">초</th><th className="p-2">세션</th><th className="p-2">이벤트</th><th className="p-2">내용</th></tr></thead><tbody>{[...state.events].reverse().map((e,i) => <tr key={i} className="border-t border-line"><td className="p-2">{(e.ms/1000).toFixed(2)}</td><td className="p-2">{e.session}</td><td className="p-2">{e.type}</td><td className="p-2">{e.detail}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
