"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Exam } from "@/lib/types";
import { countEnglishWords } from "@/lib/answers";
import {
  estimateSpeechMs,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speak,
  startDictation,
  stopSpeaking,
  type DictationHandle,
} from "@/lib/speech";
import { mergeTranscript } from "@/lib/transcript";
import AvaAvatar from "./AvaAvatar";
import ExamResult, { type AnswerRecording } from "./ExamResult";
import { SourceBadge } from "./ui";

/** 실전에 가까운 낭독 속도. */
const SPEECH_RATE = 0.92;
/** 실제 시험과 같이 재청취는 한 번만 허용한다. */
const MAX_REPLAYS = 1;
/** 낭독이 끝난 뒤 다시 듣기를 누를 수 있는 시간(초). */
const REPLAY_WINDOW_SEC = 5;

type Phase = "ready" | "playing" | "answering";
type Reveal = "script" | "korean" | "keywords";

interface AudioSession {
  slot: number;
  recorder: MediaRecorder;
  stream: MediaStream;
  context: AudioContext;
  analyser: AnalyserNode;
  chunks: Blob[];
  frame: number;
  saveOnStop: boolean;
}

function formatTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function micMessage(code: string): string {
  if (code === "not-allowed" || code === "service-not-allowed")
    return "마이크 권한이 꺼져 있습니다. 주소창의 자물쇠 아이콘에서 마이크를 허용한 뒤 다시 눌러 주세요.";
  if (code === "audio-capture")
    return "마이크를 찾지 못했습니다. 기기에 마이크가 연결돼 있는지 확인해 주세요.";
  if (code === "network")
    return "음성 인식 서버에 연결하지 못했습니다. 네트워크를 확인하고 다시 녹음해 주세요.";
  return "음성 인식이 잠시 멈췄습니다. 다시 녹음하기를 누르거나 직접 입력으로 바꿔 주세요.";
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}

/** 첫 청취 뒤 실제 시험처럼 보이는 원형 화살표 + 재생 아이콘. */
function ReplayIcon() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.5 9.5A9.5 9.5 0 1 0 23 18" />
      <path d="M18.5 5.5h5v5" />
      <path d="M11.5 9.5v9l7-4.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function MicGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function preferredRecordingMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  return candidates.find((mime) => MediaRecorder.isTypeSupported?.(mime));
}

export default function ExamRunner({
  exam,
  title,
  onRegenerate,
}: {
  exam: Exam;
  title: string;
  onRegenerate?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [times, setTimes] = useState<Record<number, number>>({});
  const [replays, setReplays] = useState<Record<number, number>>({});
  const [hintUse, setHintUse] = useState<Record<number, number>>({});
  const [recordings, setRecordings] = useState<Record<number, AnswerRecording>>({});
  const [submitted, setSubmitted] = useState(false);

  const [phase, setPhase] = useState<Phase>("ready");
  const [progress, setProgress] = useState(0);
  const [replayLeftSec, setReplayLeftSec] = useState(0);

  const [listening, setListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [tools, setTools] = useState(false);

  const dictationRef = useRef<DictationHandle | null>(null);
  const dictationSessionRef = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef("");
  const answersRef = useRef<Record<number, string>>({});
  const audioRef = useRef<AudioSession | null>(null);
  const audioTokenRef = useRef(0);
  const recordingsRef = useRef<Record<number, AnswerRecording>>({});

  const item = exam.items[index];
  const slot = item.slot;
  const answer = answers[slot] ?? "";
  const elapsed = times[slot] ?? 0;
  const words = countEnglishWords(answer);
  const replaysLeft = MAX_REPLAYS - (replays[slot] ?? 0);
  const canReplay = phase === "answering" && replayLeftSec > 0 && replaysLeft > 0;

  answersRef.current = answers;
  recordingsRef.current = recordings;

  const speechAvailable = useMemo(() => isSpeechSynthesisSupported(), []);
  const micAvailable = useMemo(() => isSpeechRecognitionSupported(), []);
  const recordingAvailable = useMemo(
    () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined",
    [],
  );

  const disposeAudioSession = useCallback((session: AudioSession) => {
    window.cancelAnimationFrame(session.frame);
    session.stream.getTracks().forEach((track) => track.stop());
    void session.context.close().catch(() => undefined);
    setMicLevel(0);
  }, []);

  const stopAudioCapture = useCallback((save: boolean) => {
    audioTokenRef.current += 1;
    const session = audioRef.current;
    audioRef.current = null;
    setMicLevel(0);
    if (!session) return;
    session.saveOnStop = save;
    if (session.recorder.state !== "inactive") {
      session.recorder.stop();
    } else {
      disposeAudioSession(session);
    }
  }, [disposeAudioSession]);

  const beginAudioCapture = useCallback(async (targetSlot: number) => {
    if (!recordingAvailable) return;
    stopAudioCapture(false);
    const token = ++audioTokenRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (audioTokenRef.current !== token) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      context.createMediaStreamSource(stream).connect(analyser);

      const mimeType = preferredRecordingMime();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      const session: AudioSession = {
        slot: targetSlot,
        recorder,
        stream,
        context,
        analyser,
        chunks: [],
        frame: 0,
        saveOnStop: false,
      };
      audioRef.current = session;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) session.chunks.push(event.data);
      };
      recorder.onstop = () => {
        disposeAudioSession(session);
        if (!session.saveOnStop || session.chunks.length === 0) return;
        const blob = new Blob(session.chunks, { type: recorder.mimeType || "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordings((prev) => {
          const old = prev[session.slot];
          if (old) URL.revokeObjectURL(old.url);
          return { ...prev, [session.slot]: { url, mimeType: blob.type } };
        });
      };

      const samples = new Uint8Array(analyser.fftSize);
      const draw = () => {
        if (audioRef.current !== session) return;
        analyser.getByteTimeDomainData(samples);
        let squareSum = 0;
        for (const sample of samples) {
          const normalized = (sample - 128) / 128;
          squareSum += normalized * normalized;
        }
        const rms = Math.sqrt(squareSum / samples.length);
        // 일반적인 대화 음성의 RMS 범위를 세로 미터 전체에 자연스럽게 펼친다.
        setMicLevel(Math.min(1, Math.max(0, (rms - 0.01) * 7.5)));
        session.frame = window.requestAnimationFrame(draw);
      };

      recorder.start(250);
      draw();
    } catch {
      if (audioTokenRef.current === token) {
        setMicError("마이크 녹음 권한을 확인해 주세요. 음성 인식은 되더라도 녹음본 저장이 제한될 수 있습니다.");
      }
    }
  }, [disposeAudioSession, recordingAvailable, stopAudioCapture]);

  const stopDictation = useCallback((mode: "flush" | "discard") => {
    const handle = dictationRef.current;
    dictationRef.current = null;
    setListening(false);
    setInterim("");
    if (!handle) return;
    if (mode === "discard") {
      dictationSessionRef.current += 1;
      handle.abort();
      return;
    }
    handle.stop();
  }, []);

  const stopAnswerCapture = useCallback((mode: "save" | "discard") => {
    stopDictation(mode === "save" ? "flush" : "discard");
    stopAudioCapture(mode === "save");
  }, [stopAudioCapture, stopDictation]);

  const editAnswer = useCallback((targetSlot: number, text: string) => {
    dictationSessionRef.current += 1;
    baseRef.current = text;
    setAnswers((prev) => ({ ...prev, [targetSlot]: text }));
  }, []);

  const beginAnswerCapture = useCallback((targetSlot: number) => {
    stopAnswerCapture("discard");
    setMicError(null);
    baseRef.current = answersRef.current[targetSlot] ?? "";

    if (isSpeechRecognitionSupported()) {
      const session = (dictationSessionRef.current += 1);
      const handle = startDictation({
        onUpdate: ({ committed, interim: pending }) => {
          if (dictationSessionRef.current !== session) return;
          setAnswers((prev) => ({
            ...prev,
            [targetSlot]: mergeTranscript(baseRef.current, committed),
          }));
          setInterim(pending);
        },
        onError: (code) => setMicError(micMessage(code)),
        onEnd: () => {
          if (dictationSessionRef.current !== session) return;
          setListening(false);
          setInterim("");
        },
      });
      dictationRef.current = handle;
    }

    setListening(true);
    void beginAudioCapture(targetSlot);
  }, [beginAudioCapture, stopAnswerCapture]);

  const playQuestion = useCallback((targetSlot: number, text: string, isReplay: boolean) => {
    // 다시 듣기를 누르면 직전 몇 초의 답변 녹음은 버리고, 재청취가 끝난 뒤 새로 시작한다.
    stopAnswerCapture(isReplay ? "discard" : "save");
    setReplayLeftSec(0);
    setProgress(0);
    setPhase("playing");
    if (isReplay) {
      setReplays((prev) => ({ ...prev, [targetSlot]: (prev[targetSlot] ?? 0) + 1 }));
    }

    const used = (replays[targetSlot] ?? 0) + (isReplay ? 1 : 0);
    const startAnswering = () => {
      setProgress(1);
      setPhase("answering");
      setReplayLeftSec(used < MAX_REPLAYS ? REPLAY_WINDOW_SEC : 0);
      if (!typing) beginAnswerCapture(targetSlot);
    };

    speak(text, {
      rate: SPEECH_RATE,
      onEnd: startAnswering,
      onError: startAnswering,
    });
  }, [beginAnswerCapture, replays, stopAnswerCapture, typing]);

  useEffect(() => {
    stopAnswerCapture("discard");
    stopSpeaking();
    setPhase("ready");
    setProgress(0);
    setReplayLeftSec(0);
    setReveal(null);
    setMicError(null);
    // 문항 전환 때만 초기화한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, submitted]);

  useEffect(() => () => {
    dictationRef.current?.abort();
    stopAudioCapture(false);
    stopSpeaking();
    Object.values(recordingsRef.current).forEach((recording) => URL.revokeObjectURL(recording.url));
  }, [stopAudioCapture]);

  useEffect(() => {
    if (phase !== "playing") return;
    const total = estimateSpeechMs(item.question.en, SPEECH_RATE);
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setProgress(Math.min(0.97, (Date.now() - startedAt) / total));
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, item.question.en]);

  useEffect(() => {
    if (replayLeftSec <= 0) return;
    const id = window.setTimeout(() => setReplayLeftSec((sec) => sec - 1), 1000);
    return () => window.clearTimeout(id);
  }, [replayLeftSec]);

  useEffect(() => {
    if (submitted || phase !== "answering") return;
    const id = window.setInterval(() => {
      setTimes((prev) => ({ ...prev, [slot]: (prev[slot] ?? 0) + 1 }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [slot, submitted, phase]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [answer, interim]);

  function nextQuestion() {
    if (index >= exam.items.length - 1) return;
    stopAnswerCapture("save");
    stopSpeaking();
    setIndex((current) => current + 1);
  }

  function submit() {
    stopAnswerCapture("save");
    stopSpeaking();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetAttempt() {
    stopAnswerCapture("discard");
    Object.values(recordingsRef.current).forEach((recording) => URL.revokeObjectURL(recording.url));
    setRecordings({});
    setAnswers({});
    setTimes({});
    setReplays({});
    setHintUse({});
    setSubmitted(false);
    setIndex(0);
    setPhase("ready");
  }

  function holdReveal(kind: Reveal) {
    setReveal(kind);
    setHintUse((prev) => ({ ...prev, [slot]: (prev[slot] ?? 0) + 1 }));
  }

  function releaseReveal(kind: Reveal) {
    setReveal((current) => (current === kind ? null : current));
  }

  if (submitted) {
    return (
      <ExamResult
        exam={exam}
        title={title}
        answers={answers}
        times={times}
        hintUse={hintUse}
        replays={replays}
        recordings={recordings}
        onRetry={resetAttempt}
        onRegenerate={onRegenerate}
      />
    );
  }

  const bannerText = phase === "playing"
    ? "질문을 듣는 중입니다"
    : phase === "ready"
      ? "Click 'PLAY' button to Listen"
      : canReplay
        ? `Recording · REPLAY 가능 ${replayLeftSec}초`
        : "Recording · 지금 답변하세요";

  const playLabel = phase === "playing" ? "재생 중" : phase === "ready" ? "질문 듣기" : "질문 다시 듣기";
  const hints = item.question.hints ?? [];
  const replayIconVisible = phase === "answering";

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <Link href="/" className="text-sm text-fg-muted transition hover:text-fg">← 홈</Link>
        <span className="text-xs text-fg-subtle">{title}</span>
      </div>

      <div className="animate-fade-up overflow-hidden rounded-lg border border-exam-line bg-exam-frame text-exam-ink shadow-raised">
        <div className="px-4 py-5 sm:px-7 sm:py-6">
          <h1 className="text-base font-bold">Question {index + 1} of {exam.items.length}</h1>
          <div className="mt-3 border-t border-exam-line" />

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,17rem)_auto_minmax(0,1fr)] lg:gap-6">
            <div className="mx-auto w-full max-w-[20rem] lg:mx-0 lg:max-w-none">
              <div className="aspect-square overflow-hidden border border-exam-line">
                <AvaAvatar speaking={phase === "playing"} />
              </div>

              <div className="flex items-stretch border-x border-b border-exam-line">
                <button
                  type="button"
                  onClick={() => playQuestion(slot, item.question.en, phase !== "ready")}
                  disabled={phase === "playing" || (phase === "answering" && !canReplay)}
                  aria-label={playLabel}
                  className="grid w-11 place-items-center bg-exam-accent text-exam-accent-fg transition-colors enabled:hover:bg-exam-accent-hover disabled:bg-exam-accent-soft"
                >
                  {replayIconVisible ? <ReplayIcon /> : <PlayIcon />}
                </button>
                <div className="flex flex-1 items-center bg-exam-frame-2 px-3">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-exam-line">
                    <div className="h-full rounded-full bg-exam-accent transition-[width] duration-100" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                </div>
              </div>

              <p aria-live="polite" className="border-x border-b border-exam-line bg-exam-note px-3 py-2 text-center text-xs font-semibold text-exam-note-fg">
                {bannerText}
              </p>

              {!speechAvailable && (
                <p className="mt-2 text-xs leading-relaxed text-exam-ink-muted">이 브라우저는 문제 읽어주기를 지원하지 않습니다. 아래 연습 도구에서 지문을 확인해 주세요.</p>
              )}
            </div>

            {/* 실제 OPIc의 세로 표시는 조절기가 아니라 마이크 입력 레벨 확인용이다. */}
            <div className="flex flex-row items-center justify-center gap-4 lg:flex-col lg:gap-3">
              <div className="relative h-7 w-full lg:h-40 lg:w-8" aria-label={`마이크 입력 레벨 ${Math.round(micLevel * 100)}%`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(micLevel * 100)}>
                <div className="absolute left-0 top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-exam-line lg:left-1/2 lg:top-0 lg:h-full lg:w-1 lg:-translate-x-1/2 lg:translate-y-0" />
                <div
                  className={`absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-exam-frame transition-[left] duration-75 lg:left-1/2 lg:transition-[bottom] ${listening ? "border-exam-rec" : "border-exam-ink-muted"}`}
                  style={{ left: `${Math.max(4, micLevel * 100)}%`, bottom: undefined }}
                />
                <div
                  className={`absolute bottom-0 left-1/2 hidden h-5 w-5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 bg-exam-frame transition-[bottom] duration-75 lg:block ${listening ? "border-exam-rec" : "border-exam-ink-muted"}`}
                  style={{ bottom: `${Math.max(0, micLevel * 100)}%` }}
                />
              </div>
              <span title={listening ? `마이크 입력 ${Math.round(micLevel * 100)}%` : "대기 중"} className={listening ? "text-exam-rec" : "text-exam-ink-muted"}>
                <MicGlyph className={listening ? "h-5 w-5 animate-rec-pulse" : "h-5 w-5"} />
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-exam-ink-muted">문항 진행:</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {exam.items.map((it, i) => {
                  const state = i < index ? "done" : i === index ? "active" : "todo";
                  return (
                    <span
                      key={it.slot}
                      aria-current={state === "active" ? "step" : undefined}
                      title={state === "done" ? "이미 지나간 문항입니다" : state === "active" ? "현재 문항" : "아직 진행하지 않은 문항입니다"}
                      className={`grid h-7 w-8 cursor-default place-items-center border text-xs font-semibold tabular-nums ${
                        state === "active"
                          ? "border-exam-slot-active bg-exam-slot-active text-exam-slot-active-fg"
                          : state === "done"
                            ? "exam-slot-done border-exam-line text-exam-ink-muted"
                            : "border-exam-line bg-exam-slot text-exam-slot-fg"
                      }`}
                    >
                      {it.slot}
                    </span>
                  );
                })}
              </div>

              {index === 0 && (
                <div className="mt-4 bg-exam-note px-4 py-3 text-sm leading-relaxed text-exam-note-fg">
                  <p><strong className="font-bold">Play</strong> 아이콘(▶)을 눌러 질문을 청취하십시오.</p>
                  <p className="mt-3"><strong className="font-bold">중요!</strong> 5초 이내에 REPLAY 아이콘을 누르면 질문 다시듣기가 가능하며, 재청취는 한번만 가능합니다.</p>
                </div>
              )}
            </div>
          </div>

          {tools && (
            <div className="mt-6 space-y-4 border-t border-dashed border-exam-line pt-4">
              <div className="mt-4 border border-exam-line">
                <div className="flex items-center justify-between gap-2 border-b border-exam-line bg-exam-frame-2 px-3 py-2 text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    {listening ? (
                      <><span className="h-2 w-2 animate-rec-pulse rounded-full bg-exam-rec" />녹음 중 · 말하는 대로 적힙니다</>
                    ) : "내 답변"}
                  </span>
                  <span className="tabular-nums text-exam-ink-muted">{words}단어 · {formatTime(elapsed)}</span>
                </div>

                {typing ? (
                  <textarea value={answer} onChange={(e) => editAnswer(slot, e.target.value)} rows={7} spellCheck placeholder="Well, let me tell you about..." className="w-full resize-y bg-exam-frame px-3 py-3 text-sm leading-relaxed text-exam-ink outline-none placeholder:text-exam-ink-muted/70" />
                ) : (
                  <div ref={transcriptRef} className="max-h-56 min-h-[7rem] overflow-y-auto px-3 py-3 text-sm leading-relaxed">
                    {answer || interim ? (
                      <p className="whitespace-pre-wrap">{answer}{interim && <span className="text-exam-ink-muted"> {interim}</span>}</p>
                    ) : (
                      <p className="text-exam-ink-muted">{phase === "answering" ? "마이크에 대고 영어로 답해 보세요." : "재생 버튼을 눌러 질문을 들으면 녹음이 시작됩니다."}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-exam-line bg-exam-frame-2 px-3 py-2">
                  {(micAvailable || recordingAvailable) && !typing && (
                    <button
                      type="button"
                      onClick={() => listening ? stopAnswerCapture("save") : beginAnswerCapture(slot)}
                      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium transition ${listening ? "border-exam-rec text-exam-rec" : "border-exam-line text-exam-ink-muted hover:text-exam-ink"}`}
                    >
                      <MicGlyph className="h-3.5 w-3.5" />{listening ? "녹음 멈추기" : "다시 녹음하기"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!typing) stopAnswerCapture("save");
                      setTyping((value) => !value);
                    }}
                    className="rounded border border-exam-line px-2.5 py-1 text-xs text-exam-ink-muted transition hover:text-exam-ink"
                  >
                    {typing ? "마이크로 돌아가기" : "직접 입력·고쳐 쓰기"}
                  </button>
                  {answer.length > 0 && (
                    <button type="button" onClick={() => { stopAnswerCapture("discard"); editAnswer(slot, ""); }} className="ml-auto rounded border border-exam-line px-2.5 py-1 text-xs text-exam-ink-muted transition hover:text-exam-ink">지우기</button>
                  )}
                </div>
              </div>

              {micError && <p role="alert" className="mt-2 text-xs leading-relaxed text-exam-rec">{micError}</p>}
              {!micAvailable && <p className="mt-2 text-xs leading-relaxed text-exam-ink-muted">이 브라우저는 음성 받아쓰기를 지원하지 않습니다. 녹음은 가능할 수 있으며, Chrome이나 Edge에서는 받아쓰기도 사용할 수 있습니다.</p>}

              <div className="h-24 overflow-y-auto rounded border border-exam-line bg-exam-frame-2 px-3 py-2.5 text-sm leading-relaxed">
                {reveal === "script" && (
                  <div>
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-exam-ink-muted"><span className="font-semibold">{item.typeLabel}</span><span>{item.emoji} {item.topicKo}</span><SourceBadge source={item.question.source} /></div>
                    <p>{item.question.en}</p>
                  </div>
                )}
                {reveal === "korean" && <p>{item.question.ko}</p>}
                {reveal === "keywords" && <ul className="flex flex-wrap gap-1.5">{hints.map((hint) => <li key={hint} className="rounded border border-exam-line bg-exam-frame px-2 py-0.5 text-xs">{hint}</li>)}</ul>}
                {reveal === null && <p className="text-xs text-exam-ink-muted">실전처럼 듣기만으로 풀어 보세요. 막히면 아래 버튼을 꾹 누르고 있는 동안에만 지문이 보입니다.</p>}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <HoldButton label="지문 보기" active={reveal === "script"} onPress={() => holdReveal("script")} onRelease={() => releaseReveal("script")} />
                <HoldButton label="해석 보기" active={reveal === "korean"} onPress={() => holdReveal("korean")} onRelease={() => releaseReveal("korean")} />
                {hints.length > 0 && <HoldButton label="키워드 보기" active={reveal === "keywords"} onPress={() => holdReveal("keywords")} onRelease={() => releaseReveal("keywords")} />}
                <span className="ml-auto self-center text-[11px] tabular-nums text-exam-ink-muted">이 문항 힌트 {hintUse[slot] ?? 0}회 · 다시 듣기 {replays[slot] ?? 0}/{MAX_REPLAYS}회</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3 border-t border-exam-line pt-4">
            <button type="button" aria-expanded={tools} onClick={() => setTools((value) => !value)} className="text-xs text-exam-ink-muted transition hover:text-exam-ink">연습 도구 {tools ? "▴" : "▾"}</button>
            {index < exam.items.length - 1 ? (
              <button type="button" onClick={nextQuestion} className="ml-auto rounded bg-exam-accent px-7 py-2.5 text-sm font-bold text-exam-accent-fg transition-colors hover:bg-exam-accent-hover">Next ›</button>
            ) : (
              <button type="button" onClick={submit} className="ml-auto rounded bg-exam-accent px-7 py-2.5 text-sm font-bold text-exam-accent-fg transition-colors hover:bg-exam-accent-hover">답변 확인하기</button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function HoldButton({
  label,
  active,
  onPress,
  onRelease,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  onRelease: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); onPress(); }}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
      onLostPointerCapture={onRelease}
      onBlur={onRelease}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if (e.key !== " " && e.key !== "Enter") return; e.preventDefault(); if (!e.repeat) onPress(); }}
      onKeyUp={(e) => { if (e.key !== " " && e.key !== "Enter") return; e.preventDefault(); onRelease(); }}
      className={`hold-target rounded border px-3 py-1.5 text-xs font-medium transition ${active ? "border-exam-accent bg-exam-accent text-exam-accent-fg" : "border-exam-line text-exam-ink-muted hover:text-exam-ink"}`}
    >
      {label} (꾹)
    </button>
  );
}
