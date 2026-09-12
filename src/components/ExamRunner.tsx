"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Exam } from "@/lib/types";
import { countEnglishWords, hasAnswerText } from "@/lib/answers";
import {
  estimateSpeechMs,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  speak,
  startDictation,
  stopSpeaking,
  type DictationHandle,
} from "@/lib/speech";
import {
  createMicProbe,
  isDesktopAgent,
  isMicConflict,
  loadMicMode,
  observeMicLevel,
  observeMicResult,
  saveMicMode,
  type MicMode,
  type MicProbe,
} from "@/lib/micShare";
import { itemNumber } from "@/lib/exam";
import { examExitLink, randomPracticeLink } from "@/lib/nav";
import { joinTranscript } from "@/lib/transcript";
import AvaAvatar from "./AvaAvatar";
import MicLevelMeter from "./MicLevelMeter";
import ExamResult, { type AnswerRecording } from "./ExamResult";
import { SavedExpressionsPanel } from "./SavedExpressions";
import { SourceBadge } from "./ui";
import QuestionContextReveal from "./QuestionContextReveal";

/** 실전에 가까운 낭독 속도. */
const SPEECH_RATE = 0.92;
/** 실제 시험과 같이 재청취는 한 번만 허용한다. */
const MAX_REPLAYS = 1;
/** 낭독이 끝난 뒤 다시 듣기를 누를 수 있는 시간(초). */
const REPLAY_WINDOW_SEC = 5;
/** 기록은 결과 화면에서 처음 저장된다. 그전에 나가면 답변이 남지 않는다. */
const LEAVE_CONFIRM = "아직 저장하지 않은 답변이 있습니다. 지금 나가면 이 회차의 답변과 녹음이 사라집니다. 나갈까요?";

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
  if (code === "start-blocked")
    return "이 브라우저는 버튼을 누른 직후에만 받아쓰기를 켤 수 있습니다. 아래 다시 녹음하기를 눌러 주세요.";
  if (code === "restart-limit")
    return "음성 인식이 한 글자도 받지 못한 채 계속 끊깁니다. 다시 녹음하기를 누르거나 직접 입력으로 바꿔 주세요.";
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
  const isPractice = exam.mode === "practice";
  const isStaycationPractice = isPractice && exam.focusTopicId === "staycation";
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
  /** 낭독 파일의 실제 길이(ms). mp3 를 틀 때만 채워지고, 없으면 어림값을 쓴다. */
  const [speechMs, setSpeechMs] = useState(0);

  const [listening, setListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);
  /** 오류는 아니고 마이크를 지금 어떻게 쓰고 있는지 알리는 안내. */
  const [micNotice, setMicNotice] = useState<string | null>(null);
  /** 이 기기에서 받아쓰기와 녹음이 마이크를 함께 쓸 수 있는지. */
  const [micMode, setMicMode] = useState<MicMode>("share");
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
  const micModeRef = useRef<MicMode>("share");
  /** 함께 켜 본 뒤 받아쓰기가 소리를 못 받고 있는지 지켜보는 저울. */
  const probeRef = useRef<MicProbe | null>(null);
  const recordingsRef = useRef<Record<number, AnswerRecording>>({});
  /** 낭독을 시작한 시각. 길이가 뒤늦게 와도 진행 막대의 기준점은 여기로 고정한다. */
  const playStartedAtRef = useRef(0);

  const item = exam.items[index];
  const slot = item.slot;
  const isSurprisePractice = isPractice && item.question.source === "provided";
  const answer = answers[slot] ?? "";
  /** 질문이 나오는 동안에는 답변 시간을 세지 않는다. 음성이 끝나면 0:00 부터 다시 센다. */
  const elapsed = phase === "playing" ? 0 : times[slot] ?? 0;
  const words = countEnglishWords(answer);
  const replaysLeft = MAX_REPLAYS - (replays[slot] ?? 0);
  const canReplay = phase === "answering" && replayLeftSec > 0 && replaysLeft > 0;

  answersRef.current = answers;
  recordingsRef.current = recordings;

  const exit = useMemo(() => examExitLink(exam.mode), [exam.mode]);
  /** 답변은 결과 화면에 닿아야 저장된다. 그 전에 나가면 말한 내용이 사라진다. */
  const unsaved = !submitted && exam.items.some((entry) => hasAnswerText(answers[entry.slot]) || recordings[entry.slot]);

  // 새로고침·창 닫기에는 브라우저 기본 확인창이 뜬다. 화면 안의 나가기 링크는 아래에서 따로 묻는다.
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  const speechAvailable = useMemo(() => isSpeechSynthesisSupported(), []);
  const micAvailable = useMemo(() => isSpeechRecognitionSupported(), []);
  const recordingAvailable = useMemo(
    () => typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined",
    [],
  );

  // 마이크를 하나만 쓸 수 있는 기기인지는 브라우저에서만 알 수 있다. 서버에서 그린
  // 첫 화면과 어긋나지 않도록 붙은 뒤에 읽는다.
  useEffect(() => {
    const mode = loadMicMode();
    micModeRef.current = mode;
    setMicMode(mode);
  }, []);

  const applyMicMode = useCallback((mode: MicMode) => {
    // 다음 그림을 기다리지 않고 바로 읽는 자리가 있어 ref 도 함께 옮긴다.
    micModeRef.current = mode;
    setMicMode(mode);
    saveMicMode(mode);
  }, []);

  const disposeAudioSession = useCallback((session: AudioSession) => {
    window.cancelAnimationFrame(session.frame);
    session.stream.getTracks().forEach((track) => track.stop());
    void session.context.close().catch(() => undefined);
    setMicLevel(0);
  }, []);

  const stopAudioCapture = useCallback((save: boolean) => {
    audioTokenRef.current += 1;
    probeRef.current = null;
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

  /**
   * 받아쓰기만 새로 켠다. 녹음과 따로 떼어 두어야 마이크를 뺏긴 것을 알아챈 뒤
   * 녹음만 접고 받아쓰기를 이어서 켤 수 있다.
   */
  const startDictationFor = useCallback((targetSlot: number): boolean => {
    if (!isSpeechRecognitionSupported()) return false;
    const previous = dictationRef.current;
    dictationRef.current = null;
    // 번호를 먼저 올려 두면 지금 끊는 인식기의 늦은 결과가 새 세션에 섞이지 않는다.
    const session = (dictationSessionRef.current += 1);
    previous?.abort();

    baseRef.current = answersRef.current[targetSlot] ?? "";
    setInterim("");

    const handle = startDictation({
      onUpdate: ({ committed, interim: pending }) => {
        if (dictationSessionRef.current !== session) return;
        // 한 글자라도 왔으면 이 기기는 받아쓰기와 녹음을 함께 쓸 수 있다.
        if (probeRef.current && (committed || pending)) {
          probeRef.current = observeMicResult(probeRef.current);
        }
        setAnswers((prev) => ({
          ...prev,
          [targetSlot]: joinTranscript(baseRef.current, committed),
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

    if (!handle) {
      // 인식기는 있는데 시작이 막혔다. 버튼을 누른 직후에만 켤 수 있는 브라우저다.
      setMicError(micMessage("start-blocked"));
      return false;
    }
    dictationRef.current = handle;
    setListening(true);
    return true;
  }, []);

  /**
   * 녹음이 마이크를 쥐는 바람에 받아쓰기가 한 글자도 못 받고 있다. 녹음을 놓아
   * 주고 받아쓰기를 다시 켠 뒤, 이 기기에서는 다음부터 처음부터 받아쓰기만 쓴다.
   */
  const handleMicConflict = useCallback((targetSlot: number) => {
    probeRef.current = null;
    applyMicMode("dictation-only");
    stopAudioCapture(false);
    startDictationFor(targetSlot);
    setMicNotice("녹음이 마이크를 쥐고 있어 받아쓰기가 한 글자도 받지 못했습니다. 녹음을 끄고 받아쓰기를 다시 켰습니다.");
  }, [applyMicMode, startDictationFor, stopAudioCapture]);

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
      let smoothedLevel = 0;
      let lastFrameAt = performance.now();
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
        const now = performance.now();
        const frameSec = (now - lastFrameAt) / 1000;
        lastFrameAt = now;
        const targetLevel = Math.min(1, Math.max(0, (rms - 0.01) * 7.5));

        // 소리는 이만큼 들어오는데 받아쓰기가 한 글자도 없다면 이 녹음이 마이크를
        // 쥐고 있는 것이다. 그때는 녹음을 접고 받아쓰기에 마이크를 넘긴다.
        const probe = probeRef.current;
        if (probe) {
          probeRef.current = observeMicLevel(probe, targetLevel, now);
          if (isMicConflict(probeRef.current)) {
            handleMicConflict(session.slot);
            return;
          }
        }

        smoothedLevel += (targetLevel - smoothedLevel) * (1 - Math.exp(-frameSec / 0.08));
        setMicLevel(smoothedLevel);
        session.frame = window.requestAnimationFrame(draw);
      };

      // 받아쓰기가 실제로 돌고 있을 때만, 정말 함께 쓸 수 있는 기기인지 지켜본다.
      // 받아쓰기가 없는데 지켜보면 소리만 듣고 애먼 녹음을 끄게 된다. 데스크톱은
      // 둘을 함께 열어 주므로 지켜보지 않는다. 그곳에서 받아쓰기가 비는 까닭은 녹음이 아니다.
      probeRef.current = dictationRef.current && !isDesktopAgent(navigator) ? createMicProbe(performance.now()) : null;
      recorder.start(250);
      draw();
    } catch {
      if (audioTokenRef.current === token) {
        setMicError("마이크 녹음 권한을 확인해 주세요. 음성 인식은 되더라도 녹음본 저장이 제한될 수 있습니다.");
      }
    }
  }, [disposeAudioSession, handleMicConflict, recordingAvailable, stopAudioCapture]);

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

    const dictating = isSpeechRecognitionSupported();
    const dictationOn = dictating ? startDictationFor(targetSlot) : false;
    if (!dictating) baseRef.current = answersRef.current[targetSlot] ?? "";

    // 마이크를 한 곳에서만 쓸 수 있는 기기에서는 녹음을 열지 않는다. 열면 받아쓰기가
    // 소리를 못 받는다. 받아쓰기가 아예 없는 브라우저라면 녹음이라도 남긴다.
    const recordingOn = !dictating || micModeRef.current === "share";
    if (recordingOn) void beginAudioCapture(targetSlot);
    setListening(dictationOn || recordingOn);
  }, [beginAudioCapture, startDictationFor, stopAnswerCapture]);

  const playQuestion = useCallback((targetSlot: number, questionId: string, text: string, isReplay: boolean) => {
    // 다시 듣기를 누르면 직전 몇 초의 답변 녹음은 버리고, 재청취가 끝난 뒤 새로 시작한다.
    stopAnswerCapture(isReplay ? "discard" : "save");
    setReplayLeftSec(0);
    setProgress(0);
    setSpeechMs(0);
    playStartedAtRef.current = Date.now();
    setPhase("playing");
    if (isReplay) {
      setReplays((prev) => ({ ...prev, [targetSlot]: (prev[targetSlot] ?? 0) + 1 }));
    }

    const used = (replays[targetSlot] ?? 0) + (isReplay ? 1 : 0);
    const startAnswering = () => {
      // 답변 시간은 마지막 질문 청취가 끝난 시점부터 0:00 으로 잰다. 처음 듣기·리플레이·
      // 이미 답한 문항에 돌아와 다시 듣기 모두 같다.
      setTimes((prev) => ({ ...prev, [targetSlot]: 0 }));
      setProgress(1);
      setPhase("answering");
      setReplayLeftSec(used < MAX_REPLAYS ? REPLAY_WINDOW_SEC : 0);
      if (!typing) beginAnswerCapture(targetSlot);
    };

    speak(text, {
      // 문항 id 로 미리 만들어 둔 mp3 를 먼저 찾는다. 없으면 브라우저가 읽는다.
      audioId: questionId,
      rate: SPEECH_RATE,
      onDuration: setSpeechMs,
      onEnd: startAnswering,
      onError: startAnswering,
    });
  }, [beginAnswerCapture, replays, stopAnswerCapture, typing]);

  useEffect(() => {
    stopAnswerCapture("discard");
    stopSpeaking();
    setPhase("ready");
    setProgress(0);
    setSpeechMs(0);
    setReplayLeftSec(0);
    setReveal(null);
    setMicError(null);
    setMicNotice(null);
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
    // mp3 를 틀면 실제 길이를 알 수 있다. 브라우저 낭독일 때만 어림값으로 그린다.
    const total = speechMs > 0 ? speechMs : estimateSpeechMs(item.question.en, SPEECH_RATE);
    // 길이가 뒤늦게 오더라도 기준 시각은 재생을 시작한 그 시점 그대로 둔다.
    const startedAt = playStartedAtRef.current || Date.now();
    const id = window.setInterval(() => {
      setProgress(Math.min(0.97, (Date.now() - startedAt) / total));
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, item.question.en, speechMs]);

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

  /** 이 기기가 정말 마이크를 하나만 쓰는지 녹음을 함께 켜서 다시 겪어 본다. */
  function retryMicShare() {
    applyMicMode("share");
    setMicNotice(null);
    if (listening && !typing) beginAnswerCapture(slot);
  }

  function goToQuestion(targetIndex: number) {
    if (targetIndex < 0 || targetIndex >= exam.items.length || targetIndex === index) return;
    stopAnswerCapture("save");
    stopSpeaking();
    setIndex(targetIndex);
  }

  function nextQuestion() {
    goToQuestion(index + 1);
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
  /** 받아쓰기가 마이크를 혼자 쓰는 중이면 입력 레벨을 잴 길이 없다. */
  const micLevelBlind = micAvailable && micMode === "dictation-only";
  const micStatusLabel = !listening
    ? "대기 중"
    : micLevelBlind
      ? "받아쓰기 중 · 이 기기는 입력 레벨을 함께 볼 수 없습니다"
      : `마이크 입력 ${Math.round(micLevel * 100)}%`;
  const hints = item.question.hints ?? [];
  const replayIconVisible = phase === "answering";
  const modeLabel = exam.mode === "practice" ? "주제별 연습"
    : exam.mode === "set" || exam.mode === "single" ? randomPracticeLink(exam.mode, exam.randomScope).label
      : "실전 모의고사";

  return (
    <main className={`mx-auto w-full ${isStaycationPractice ? "max-w-6xl" : "max-w-5xl"} px-4 pb-28 pt-6 sm:px-6`}>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
        <Link
          href={exit.href}
          onClick={(event) => { if (unsaved && !window.confirm(LEAVE_CONFIRM)) event.preventDefault(); }}
          className="text-sm text-fg-muted transition hover:text-fg"
        >{exit.label}</Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-fg-subtle">{modeLabel}</span>
          <QuestionContextReveal key={slot} item={item} showSet={exam.mode === "set"} />
        </div>
      </div>

      <div className="animate-fade-up overflow-hidden rounded-lg border border-exam-line bg-exam-frame text-exam-ink shadow-raised">
        <div className="px-4 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-base font-bold">Question {index + 1} of {exam.items.length}{isSurprisePractice && <span className="ml-3 text-sm font-medium">자료 {item.question.number}번</span>}</h1>
            <div className="flex shrink-0 items-center gap-3 rounded-lg border border-exam-line bg-exam-frame-2 px-3 py-2">
              <div className="text-right text-[11px] leading-relaxed text-exam-ink-muted">
                <span className="block font-semibold">답변 시간</span>
                <span className="block">{phase === "playing" ? "질문 재생 중" : phase === "answering" ? "답변 중" : elapsed > 0 ? "일시정지" : "청취 후 시작"}</span>
              </div>
              <span role="timer" aria-label="답변 시간" aria-live="off" className="min-w-[5ch] text-right font-mono text-2xl font-semibold tabular-nums leading-none text-exam-ink">{formatTime(elapsed)}</span>
            </div>
          </div>
          <div className="mt-3 border-t border-exam-line" />

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,17rem)_auto_minmax(0,1fr)] lg:gap-6">
            <div className="mx-auto w-full max-w-[20rem] lg:mx-0 lg:max-w-none">
              <div className="aspect-square overflow-hidden border border-exam-line">
                <AvaAvatar speaking={phase === "playing"} />
              </div>

              <div className="flex items-stretch border-x border-b border-exam-line">
                <button
                  type="button"
                  onClick={() => playQuestion(slot, item.question.id, item.question.en, phase !== "ready")}
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
            <div className="flex flex-col items-center justify-center gap-3">
              <MicLevelMeter level={micLevel} active={listening} indeterminate={micLevelBlind} />
              <span title={micStatusLabel} className={listening ? "text-exam-rec" : "text-exam-ink-muted"}>
                <MicGlyph className={listening ? "h-5 w-5 animate-rec-pulse" : "h-5 w-5"} />
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold text-exam-ink-muted">{isPractice ? "문항 선택:" : "문항 진행:"}</p>
              <div className={`mt-2 flex ${isStaycationPractice ? "flex-nowrap overflow-x-auto pb-2" : "flex-wrap"} ${isPractice ? "gap-2" : "gap-1"}`}>
                {exam.items.map((it, i) => {
                  const answered = hasAnswerText(answers[it.slot]);
                  const number = itemNumber(exam.mode, it);
                  const state = i === index ? "active" : (isPractice ? answered : i < index) ? "done" : "todo";
                  const startsGroup = isStaycationPractice && i > 0 && it.comboLabel !== exam.items[i - 1].comboLabel;
                  const className = `grid place-items-center border text-xs font-semibold tabular-nums ${isStaycationPractice ? "shrink-0" : ""} ${startsGroup ? "ml-4" : ""} ${isPractice ? "min-h-11 min-w-11 transition-colors hover:border-exam-accent" : "h-7 w-8 cursor-default"} ${
                    state === "active" ? "border-exam-slot-active bg-exam-slot-active text-exam-slot-active-fg"
                      : state === "done" ? "exam-slot-done border-exam-line text-exam-ink-muted"
                        : "border-exam-line bg-exam-slot text-exam-slot-fg"
                  }`;
                  if (isPractice) return (
                    <button key={it.slot} type="button" onClick={() => goToQuestion(i)}
                      aria-current={state === "active" ? "step" : undefined}
                      aria-label={`${number}번 문항 · ${answered ? "답변함" : "미답변"}`}
                      title={`${it.typeLabel} · ${answered ? "답변함" : "미답변"}`} className={className}>
                      {number}
                    </button>
                  );
                  return (
                    <span
                      key={it.slot}
                      aria-current={state === "active" ? "step" : undefined}
                      title={state === "done" ? "이미 지나간 문항입니다" : state === "active" ? "현재 문항" : "아직 진행하지 않은 문항입니다"}
                      className={className}
                    >
                      {number}
                    </span>
                  );
                })}
              </div>

              {isPractice && (
                <p className="mt-4 text-xs leading-relaxed text-exam-ink-muted">{isStaycationPractice ? "Q2–Q4 / Q5–Q7 / Q11–Q13 / Q14–Q15 순서입니다. 좁은 화면에서는 문항 번호를 가로로 스크롤할 수 있습니다." : isSurprisePractice ? "제공 자료의 번호와 순서대로 연습합니다. 번호는 실제 시험 번호가 아닌 자료의 문항 번호입니다." : "2~15번은 선택한 주제의 문제입니다."} 이전·다음이나 번호로 이동하고, 원하는 문항만 답변한 뒤 결과를 볼 수 있습니다.</p>
              )}

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
                  <textarea aria-label="내 답변" value={answer} onChange={(e) => editAnswer(slot, e.target.value)} rows={7} spellCheck placeholder="Well, let me tell you about..." className="w-full resize-y bg-exam-frame px-3 py-3 text-sm leading-relaxed text-exam-ink outline-none placeholder:text-exam-ink-muted/70" />
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
              {micNotice && <p role="status" className="mt-2 text-xs leading-relaxed text-exam-ink-muted">{micNotice}</p>}
              {micAvailable && recordingAvailable && micMode === "dictation-only" && (
                <p className="mt-2 text-xs leading-relaxed text-exam-ink-muted">
                  이 기기는 마이크를 한 번에 한 곳에서만 쓸 수 있어 받아쓰기만 켭니다. 화면에 적히는 텍스트가 곧 답변이 되고, 녹음본이 없어 나중에 바로잡을 수 없습니다. 잘못 적힌 곳은 <strong className="font-semibold text-exam-ink">직접 입력·고쳐 쓰기</strong>로 다듬으세요. 녹음본과 발음 비교가 필요하면 노트북에서 연습하는 편이 낫습니다.{" "}
                  <button type="button" onClick={retryMicShare} className="underline underline-offset-2 transition hover:text-exam-ink">녹음도 함께 켜보기</button>
                </p>
              )}
              {!micAvailable && <p className="mt-2 text-xs leading-relaxed text-exam-ink-muted">이 브라우저는 음성 받아쓰기를 지원하지 않습니다. 녹음은 가능할 수 있으며, Chrome이나 Edge에서는 받아쓰기도 사용할 수 있습니다.</p>}

              <div className="h-24 overflow-y-auto rounded border border-exam-line bg-exam-frame-2 px-3 py-2.5 text-sm leading-relaxed">
                {reveal === "script" && (
                  <div>
                    <div className="mb-1.5 text-[11px]"><SourceBadge source={item.question.source} /></div>
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

              {/* 결과 화면에서 별표로 저장해 둔 조언. 힌트와 달리 사용 횟수를 세지 않는다. */}
              <SavedExpressionsPanel questionId={item.question.id} topicId={item.topicId} topicKo={item.topicKo} />
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-exam-line pt-4">
            <button type="button" aria-expanded={tools} onClick={() => setTools((value) => !value)} className="text-xs text-exam-ink-muted transition hover:text-exam-ink">연습 도구 {tools ? "▴" : "▾"}</button>
            {isPractice ? (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => goToQuestion(index - 1)} disabled={index === 0} className="min-h-11 rounded border border-exam-line px-4 text-sm text-exam-ink-muted disabled:cursor-not-allowed disabled:opacity-40">‹ 이전</button>
                <button type="button" onClick={nextQuestion} disabled={index === exam.items.length - 1} className="min-h-11 rounded border border-exam-line px-4 text-sm text-exam-ink-muted disabled:cursor-not-allowed disabled:opacity-40">다음 ›</button>
                <button type="button" onClick={submit} className="min-h-11 rounded bg-exam-accent px-4 text-sm font-bold text-exam-accent-fg transition-colors hover:bg-exam-accent-hover">연습 마치고 결과 보기</button>
              </div>
            ) : index < exam.items.length - 1 ? (
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
