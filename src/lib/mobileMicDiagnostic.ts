/** Isolated Web Speech harness: no recording, application storage or AI API. */
export type MicExperiment = "single-auto" | "continuous-auto" | "continuous-manual";
export interface DiagnosticResult { isFinal: boolean; transcript: string }
export interface DiagnosticRecognition {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onstart: (() => void) | null; onend: (() => void) | null;
  onaudiostart: (() => void) | null; onaudioend: (() => void) | null;
  onspeechstart: (() => void) | null; onspeechend: (() => void) | null;
  onsoundstart: (() => void) | null; onsoundend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; [index: number]: { transcript: string } }> }) => void) | null;
}
export interface DiagnosticEvent { ms: number; session: number; type: string; detail?: string }
export interface DiagnosticState {
  running: boolean; waiting: boolean; text: string; events: DiagnosticEvent[];
  starts: number; ends: number; errors: number; sounds: number; requests: number;
  raw: DiagnosticResult[];
}
export const initialDiagnosticState = (): DiagnosticState => ({
  running: false, waiting: false, text: "", events: [], starts: 0, ends: 0,
  errors: 0, sounds: 0, requests: 0, raw: [],
});
const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(" ");
export function diagnosticSessionText(results: DiagnosticResult[], cumulative: boolean): string {
  // Chromium Android dictation hypotheses are revisions, not independent sentences.
  if (cumulative) return [...results].reverse().find((r) => r.transcript.trim())?.transcript.trim() ?? "";
  return results.map((r) => r.transcript.trim()).filter(Boolean).join(" ");
}
export function diagnosticPreviewAllowed(env: string | undefined, branch: string | undefined, development: boolean): boolean {
  return development || (env === "preview" && branch === "test/mobile-mic-sound-ab-20261011");
}
export function createMicDiagnostic(options: {
  mode: MicExperiment; androidChromium: boolean; create: () => DiagnosticRecognition;
  now: () => number; visible: () => boolean;
  schedule: (fn: () => void, ms: number) => number; cancel: (id: number) => void;
  update: (state: DiagnosticState) => void;
}) {
  const state = initialDiagnosticState();
  const origin = options.now();
  let active: DiagnosticRecognition | null = null;
  let timer = 0;
  let enabled = false;
  let disposed = false;
  let settled = "";
  let currentText = "";
  let emptyEnds = 0;
  const publish = () => options.update({ ...state, events: [...state.events], raw: [...state.raw] });
  const log = (type: string, detail?: string) => {
    state.events.push({ ms: Math.round(options.now() - origin), session: state.requests, type, detail });
    state.events = state.events.slice(-200);
    publish();
  };
  const cancelRestart = () => {
    if (timer) options.cancel(timer);
    timer = 0; state.waiting = false;
  };
  const launch = () => {
    cancelRestart();
    if (disposed || active) return;
    if (!options.visible()) { enabled = false; log("paused", "화면 숨김: 수동으로 다시 시작"); return; }
    enabled = true;
    const recognition = options.create();
    active = recognition;
    currentText = "";
    state.requests += 1;
    state.running = true;
    recognition.lang = "en-US";
    recognition.continuous = options.mode !== "single-auto";
    recognition.interimResults = true;
    const valid = () => !disposed && active === recognition;
    recognition.onstart = () => { if (valid()) { state.starts += 1; log("start"); } };
    recognition.onaudiostart = () => { if (valid()) log("audiostart"); };
    recognition.onaudioend = () => { if (valid()) log("audioend"); };
    recognition.onsoundstart = () => { if (valid()) log("soundstart"); };
    recognition.onsoundend = () => { if (valid()) log("soundend"); };
    recognition.onspeechstart = () => { if (valid()) log("speechstart"); };
    // No restart or stop on a speech boundary, regardless of mode.
    recognition.onspeechend = () => { if (valid()) log("speechend"); };
    recognition.onresult = (event) => {
      if (!valid()) return;
      const raw = Array.from(event.results, (r) => ({ isFinal: r.isFinal, transcript: r[0]?.transcript ?? "" }));
      state.raw = raw;
      const text = diagnosticSessionText(raw, options.androidChromium && recognition.continuous);
      if (text) { currentText = text; emptyEnds = 0; }
      state.text = join(settled, currentText);
      log("result", `${raw.length}칸 / ${raw.filter((r) => r.isFinal).length} final`);
    };
    recognition.onerror = (event) => {
      if (!valid()) return;
      state.errors += 1;
      const code = event.error ?? "unknown";
      if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"].includes(code)) enabled = false;
      log("error", code);
    };
    recognition.onend = () => {
      if (!valid()) return;
      active = null; state.running = false; state.ends += 1;
      settled = join(settled, currentText); state.text = settled;
      emptyEnds = currentText ? 0 : emptyEnds + 1;
      log("end");
      if (!enabled || options.mode === "continuous-manual" || !options.visible() || emptyEnds >= 4) {
        enabled = false;
        log("restart-skipped", emptyEnds >= 4 ? "빈 세션 4회: 반복 시작 중단" : "자동 재시작 안 함");
        return;
      }
      state.waiting = true;
      log("restart-scheduled", "120ms (A/B 동일)");
      timer = options.schedule(() => { timer = 0; launch(); }, 120);
    };
    log("start-request", recognition.continuous ? "continuous=true" : "continuous=false");
    try { recognition.start(); }
    catch {
      active = null; enabled = false; state.running = false; state.errors += 1;
      log("start-rejected", "시작 거절: 자동 재시도 없음");
    }
  };
  return {
    start: launch,
    stop: () => {
      enabled = false; cancelRestart();
      log("stop-request");
      try { active?.stop(); } catch { log("stop-rejected"); }
      publish();
    },
    markSound: () => { state.sounds += 1; log("sound-heard", "사용자가 들은 신호음"); },
    hide: () => {
      enabled = false; cancelRestart();
      const previous = active; active = null;
      settled = join(settled, currentText); currentText = ""; state.text = settled;
      state.running = false;
      try { previous?.abort(); } catch { /* browser already closed */ }
      log("hidden-abort", "복귀 후 수동 시작");
    },
    dispose: () => {
      disposed = true; enabled = false; cancelRestart();
      const previous = active; active = null;
      try { previous?.abort(); } catch { /* browser already closed */ }
    },
  };
}
