"use client";

/**
 * 음성 입출력 래퍼.
 *
 * 문제 낭독은 두 단을 둔다.
 *  1. `npm run tts` 로 미리 만들어 둔 mp3 (`./questionAudio`). 사람 목소리에
 *     가깝고 기기가 달라도 같게 들려서 기본으로 쓴다.
 *  2. 그 파일이 없거나 재생이 막히면 브라우저 내장 speechSynthesis 로 읽는다.
 *
 * 받아쓰기는 SpeechRecognition (Chrome/Edge 계열) 하나뿐이다. 결과를 잇는 규칙은
 * `./transcript` 에 있고, 그 규칙이 기대하는 모양으로 결과가 오도록 인식기를 켜는
 * 일은 아래 `startDictation` 이 맡는다.
 */

import { isDesktopAgent } from "./micShare";
import { questionAudioUrl } from "./questionAudio";
import {
  collectTranscript,
  joinTranscript,
  type TranscriptChunk,
  type TranscriptDraft,
} from "./transcript";

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string };
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function isSpeechRecognitionSupported(): boolean {
  return getRecognitionCtor() !== null;
}

/* ------------------------------------------------------------------ */
/* 문제 낭독                                                            */
/* ------------------------------------------------------------------ */

let cachedVoice: SpeechSynthesisVoice | null = null;
let voiceListenerAttached = false;

/**
 * 브라우저 낭독은 mp3 가 없을 때만 쓰는 대비책이다. 그래도 기기에 깔려 있는
 * 가장 사람다운 목소리를 골라 준다.
 *
 * `localService === false` 는 서버에서 만들어 오는 신경망 목소리라 기기 안에서
 * 합성하는 목소리보다 훨씬 낫다. 이름으로 거르는 건 그다음이다.
 *  - Windows: Microsoft Aria/Jenny/Emma Online (Natural)
 *  - macOS/iOS: Ava (Premium), Samantha (Enhanced), Zoe
 *  - Chrome: Google US English
 */
const PREFERRED_VOICE_PATTERNS = [
  /natural|premium|enhanced/i,
  /\b(ava|zoe|jenny|aria|emma|samantha)\b/i,
  /google/i,
];

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSynthesisSupported()) return null;
  if (!voiceListenerAttached) {
    voiceListenerAttached = true;
    // 목소리 목록은 늦게 채워진다. 바뀌면 다시 고르도록 캐시를 비운다.
    window.speechSynthesis.addEventListener?.("voiceschanged", () => {
      cachedVoice = null;
    });
  }
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const us = voices.filter((v) => /en[-_]US/i.test(v.lang));
  const english = voices.filter((v) => /^en/i.test(v.lang));
  const online = (list: SpeechSynthesisVoice[]) => list.filter((v) => v.localService === false);

  cachedVoice =
    online(us).find((v) => PREFERRED_VOICE_PATTERNS.some((p) => p.test(v.name))) ??
    online(us)[0] ??
    us.find((v) => PREFERRED_VOICE_PATTERNS.some((p) => p.test(v.name))) ??
    online(english)[0] ??
    us[0] ??
    english[0] ??
    null;
  return cachedVoice;
}

/**
 * 낭독에 걸릴 시간을 어림한다. 진행 막대를 그리고, onend 가 오지 않는 기기에서
 * 낭독이 끝난 것으로 볼 시점을 잡는 데 쓴다.
 *
 * mp3 를 재생할 때는 어림하지 않고 파일의 실제 길이를 `onDuration` 으로 알린다.
 */
export function estimateSpeechMs(text: string, rate = 1): number {
  const perChar = 62; // 보통 속도로 읽을 때 한 글자에 걸리는 밀리초
  return Math.max(1200, (text.trim().length * perChar) / Math.max(0.5, rate));
}

export interface SpeakHandlers {
  /** 브라우저 낭독 속도. 미리 만들어 둔 mp3 는 만들 때 이미 속도가 정해져 있다. */
  rate?: number;
  /** 0~1. 실제 시험 화면의 볼륨 슬라이더와 이어져 있다. */
  volume?: number;
  /**
   * 문항 id. 이 id 로 만들어 둔 mp3 가 있으면 그쪽을 먼저 튼다.
   * 없으면 브라우저 낭독으로 돌아간다.
   */
  audioId?: string;
  onStart?: () => void;
  /** 실제 낭독 길이(ms). mp3 를 틀 때만 온다. 진행 막대를 정확히 그리는 데 쓴다. */
  onDuration?: (ms: number) => void;
  onEnd?: () => void;
  onError?: () => void;
}

/** 낭독이 시작되기를 기다려 보는 시간. 이보다 늦으면 낭독을 건너뛴다. */
const START_TIMEOUT_MS = 2500;

/** 지금 살아 있는 낭독을 가리키는 표. 늦게 도착한 콜백을 걸러낸다. */
let speakToken = 0;
let speakFallbackTimer = 0;
let currentRecording: HTMLAudioElement | null = null;

function clearSpeakFallback(): void {
  if (speakFallbackTimer) {
    window.clearTimeout(speakFallbackTimer);
    speakFallbackTimer = 0;
  }
}

/** 틀고 있던 mp3 를 놓아 준다. 콜백을 먼저 떼야 늦은 error 가 되돌아오지 않는다. */
function releaseRecording(): void {
  const audio = currentRecording;
  if (!audio) return;
  currentRecording = null;
  audio.onloadedmetadata = null;
  audio.onplaying = null;
  audio.onended = null;
  audio.onerror = null;
  try {
    audio.pause();
    audio.removeAttribute("src");
    audio.load(); // 남은 내려받기를 여기서 끊는다
  } catch {
    /* 이미 정리된 경우 */
  }
}

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, volume));
}

/**
 * 미리 만들어 둔 mp3 를 튼다. 파일이 없거나 자동재생이 막히면 `fallback` 으로
 * 넘겨 브라우저 낭독이 대신 읽게 한다.
 */
function playRecording(
  src: string,
  token: number,
  handlers: SpeakHandlers,
  fallback: () => void,
): void {
  const { volume = 1, onStart, onDuration, onEnd } = handlers;
  let started = false;
  let done = false;

  const audio = new Audio(src);
  audio.preload = "auto";
  audio.volume = clampVolume(volume);
  currentRecording = audio;

  const finish = () => {
    if (done || token !== speakToken) return;
    done = true;
    releaseRecording();
    onEnd?.();
  };

  // 파일이 없거나 재생이 거절됐다. 아직 한 글자도 안 나왔으면 브라우저 낭독으로
  // 돌아가고, 이미 읽고 있었다면 앞부분을 두 번 듣게 되므로 그대로 끝낸다.
  const giveUp = () => {
    if (done || token !== speakToken) return;
    done = true;
    releaseRecording();
    if (started) onEnd?.();
    else fallback();
  };

  audio.onloadedmetadata = () => {
    if (token !== speakToken) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      onDuration?.(audio.duration * 1000);
    }
  };
  audio.onplaying = () => {
    if (token !== speakToken || started) return;
    started = true;
    onStart?.();
  };
  audio.onended = finish;
  audio.onerror = giveUp;

  // 자동재생을 막는 브라우저에서는 이 약속이 거절된다. play() 가 아무것도
  // 돌려주지 않는 구형 브라우저도 있어 Promise 로 감싼다.
  Promise.resolve(audio.play()).catch(giveUp);
}

/** 브라우저 내장 합성으로 읽는다. mp3 가 없을 때 쓰는 대비책이다. */
function speakWithSynthesis(text: string, token: number, handlers: SpeakHandlers): void {
  const { rate = 0.92, volume = 1, onStart, onEnd, onError } = handlers;
  if (!isSpeechSynthesisSupported()) {
    if (token === speakToken) onError?.();
    return;
  }

  let done = false;
  const finish = (failed: boolean) => {
    if (done || token !== speakToken) return;
    done = true;
    clearSpeakFallback();
    if (failed) onError?.();
    else onEnd?.();
  };

  const arm = (ms: number) => {
    clearSpeakFallback();
    speakFallbackTimer = window.setTimeout(() => finish(false), ms);
  };

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  utterance.volume = clampVolume(volume);
  const voice = pickEnglishVoice();
  if (voice) utterance.voice = voice;
  utterance.onstart = () => {
    if (token !== speakToken) return;
    // 낭독이 실제로 시작된 시점부터 다시 재니 남은 시간을 정확히 잡을 수 있다.
    arm(estimateSpeechMs(text, rate) * 1.5 + 3000);
    onStart?.();
  };
  utterance.onend = () => finish(false);
  utterance.onerror = () => finish(true);

  // 목소리가 하나도 깔려 있지 않은 기기에서는 낭독이 시작조차 하지 않는다.
  // 잠깐 기다려도 시작하지 않으면 낭독을 건너뛰고 답변 단계로 넘어간다.
  // 시작하면 위 onstart 가 이 시계를 낭독 길이에 맞춰 다시 맞춘다.
  arm(START_TIMEOUT_MS);

  window.speechSynthesis.speak(utterance);
}

/**
 * 문제 지문을 영어로 읽어준다.
 *
 * `audioId` 로 미리 만들어 둔 mp3 를 먼저 찾고, 없을 때만 브라우저 낭독으로
 * 읽는다. 어느 쪽이든 끝나면 `onEnd` 가 한 번 온다.
 */
export function speak(text: string, handlers: SpeakHandlers = {}): void {
  const token = ++speakToken;
  clearSpeakFallback();
  releaseRecording();
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();

  const src = questionAudioUrl(handlers.audioId);
  if (src) {
    playRecording(src, token, handlers, () => speakWithSynthesis(text, token, handlers));
    return;
  }
  speakWithSynthesis(text, token, handlers);
}

export function stopSpeaking(): void {
  speakToken += 1; // 남아 있는 콜백을 모두 무효로 만든다
  clearSpeakFallback();
  releaseRecording();
  if (!isSpeechSynthesisSupported()) return;
  window.speechSynthesis.cancel();
}

/* ------------------------------------------------------------------ */
/* 받아쓰기                                                             */
/* ------------------------------------------------------------------ */

/** 곧바로 다시 켜면 인식기가 두 개 겹쳐 도는 기기가 있어 한 박자 쉰다. */
const RESTART_DELAY_MS = 300;
/** 마이크가 아예 안 잡히는 환경에서 무한 재시작을 막는 한도. */
const MAX_RESTARTS = 60;

/*
 * 마이크는 한 번에 한 곳만 쓰는 기기가 있다. 휴대폰에서 이 인식기와 녹음용
 * getUserMedia 를 함께 열면 나중에 연 녹음이 마이크를 가져가 인식기는 조용한
 * 소리만 받는다. 누가 마이크를 쓸지는 부르는 쪽에서 정한다. `./micShare` 참고.
 */

/*
 * continuous 는 데스크톱에서만 켠다.
 *
 * 안드로이드 크롬은 continuous 를 켜면 인식 중인 가설이 올 때마다 그것을 final 로
 * 굳혀 results 에 새 칸으로 쌓는다(Chromium SpeechRecognitionImpl.handleResults).
 * 가설은 발화 앞부분을 품은 채 자라므로 한 발화가 "I", "I like", "I like running"
 * 세 칸의 확정 결과가 되고, 조각을 잇는 순간 같은 말이 여러 벌 쌓인다.
 *
 * continuous 를 끄면 가설은 interim 으로 오고 final 은 발화 끝에 한 번만 온다.
 * 표준이 continuous 가 꺼진 세션에 final 을 하나까지만 허용하기 때문이다. 안드로이드는
 * 켜 두어도 결과를 한 번 내면 세션을 닫으므로 끈다고 잃는 것이 없고, 끊긴 뒤 이어
 * 받는 일은 원래부터 onend 의 재시작이 맡고 있었다. 아이폰·태블릿도 같은 방식으로
 * 받아, 기기마다 continuous 를 어떻게 흉내 내는지에 기대지 않는다.
 *
 * 한 세션 안에서 발화를 겹치지 않는 조각으로 나눠 주는 데스크톱은 켜 둔다.
 * 발화 사이에 다시 켜느라 말을 흘릴 일이 없다.
 */

export interface DictationHandlers {
  /** 세션이 시작된 뒤 지금까지 받아 적은 전체 텍스트를 매번 통째로 넘긴다. */
  onUpdate: (draft: TranscriptDraft) => void;
  onError?: (code: string) => void;
  onEnd?: () => void;
}

export interface DictationHandle {
  /** 말하던 마지막 문장까지 받아 적고 끝낸다. */
  stop: () => void;
  /** 남은 결과를 버리고 즉시 끊는다. 문제를 넘길 때 쓴다. */
  abort: () => void;
}

/**
 * 지금 마이크를 쥐고 있는 받아쓰기.
 *
 * 브라우저의 인식기는 사실상 하나뿐이다. 두 번째를 start 하면 첫 번째가 `aborted`
 * 로 끊기는데, 아래 onerror 는 그 코드를 「onend 가 알아서 다시 켠다」는 신호로 보고
 * 넘긴다. 그래서 첫 번째가 300ms 뒤 되살아나 두 번째를 끊고, 두 번째도 같은 이유로
 * 되살아난다. 결과 화면에서 두 문항의 따라 읽기를 잇따라 켜면 둘이 서로를 0.3초마다
 * 걷어차며 어느 쪽도 받아 적지 못한다.
 *
 * 그래서 새로 켜는 쪽이 앞의 것을 여기서 확실히 끊고(`abort`) 자리를 넘겨받는다.
 * 부르는 쪽마다 따로 챙기게 하면 화면이 늘어날 때마다 같은 실수가 되풀이된다.
 */
let liveDictation: DictationHandle | null = null;

/**
 * 마이크 받아쓰기를 시작한다.
 *
 * `onUpdate` 는 조각이 아니라 **세션 전체 텍스트**를 넘긴다. 부르는 쪽은 매번
 * 덮어쓰기만 하면 되고, 같은 결과가 두 번 와도 답변이 늘어나지 않는다.
 *
 * 한 번에 하나만 돈다. 앞의 받아쓰기는 여기서 끊긴다.
 */
export function startDictation(handlers: DictationHandlers): DictationHandle | null {
  const Ctor = getRecognitionCtor();
  if (!Ctor) return null;
  liveDictation?.abort();
  const continuous = isDesktopAgent(window.navigator);

  /** 이 세션이 돌려준 손잡이. 자리를 내놓을 때 저것이 나인지 보는 데 쓴다. */
  let handle: DictationHandle | null = null;

  /** 사용자가 멈췄다. 더는 자동으로 다시 켜지 않는다. */
  let closing = false;
  /** 통째로 버린 상태. 늦게 도착하는 결과도 무시한다. */
  let dead = false;
  /** 끝났다고 알린 뒤인지. onEnd 를 두 번 부르지 않게 한다. */
  let ended = false;
  /** 재시작을 건너 확정된 텍스트. */
  let settled = "";
  /** 지금 돌고 있는 인식 세션의 결과. 인덱스를 그대로 자리로 쓴다. */
  let chunks: TranscriptChunk[] = [];
  let restarts = 0;
  let restartTimer = 0;
  let active: SpeechRecognitionLike | null = null;

  const emit = () => {
    const draft = collectTranscript(chunks);
    handlers.onUpdate({
      committed: joinTranscript(settled, draft.committed),
      interim: draft.interim,
    });
  };

  /** 지금 세션의 결과를 settled 로 옮긴다. 다시 켜면 인덱스가 0 부터 시작하기 때문이다. */
  const foldRun = () => {
    const { committed } = collectTranscript(chunks);
    settled = joinTranscript(settled, committed);
    chunks = [];
  };

  const finish = () => {
    if (ended) return;
    ended = true;
    if (restartTimer) {
      window.clearTimeout(restartTimer);
      restartTimer = 0;
    }
    if (liveDictation === handle) liveDictation = null;
    handlers.onEnd?.();
  };

  const detach = (recognition: SpeechRecognitionLike | null) => {
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
  };

  const create = (): SpeechRecognitionLike => {
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = continuous;
    recognition.interimResults = true;
    try {
      recognition.maxAlternatives = 1;
    } catch {
      /* 설정을 막아 둔 기기가 있다 */
    }

    recognition.onresult = (event) => {
      if (dead) return;
      // results 는 이 세션에서 받아 적은 전부다. resultIndex 부터 골라 이어 붙이지 않고
      // 매번 통째로 다시 읽어 덮어쓰면, 같은 결과가 몇 번을 와도 한 번만 남는다.
      const next: TranscriptChunk[] = [];
      const results = event.results;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (!result) continue;
        const transcript = result[0]?.transcript ?? "";
        next.push({ isFinal: result.isFinal, transcript });
        // 한 글자라도 받아 적는 중이면 재시작 한도를 되돌린다
        if (transcript.trim()) restarts = 0;
      }
      chunks = next;
      emit();
    };

    recognition.onerror = (event) => {
      const code = (event as Event & { error?: string }).error ?? "unknown";
      // 말을 고르는 동안 흔히 나는 값이라 알리지 않는다. onend 가 알아서 다시 켠다.
      if (code === "no-speech" || code === "aborted") return;
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        closing = true;
      }
      handlers.onError?.(code);
    };

    recognition.onend = () => {
      foldRun();
      if (!dead) emit();
      detach(recognition);
      if (active === recognition) active = null;

      if (dead || closing) {
        finish();
        return;
      }
      if (restarts >= MAX_RESTARTS) {
        // 한 글자도 못 받은 채 계속 끊기고 있다. 조용히 멈추면 사용자는 계속 받아
        // 적히는 줄 알고 말하게 되므로 여기서만은 알린다.
        handlers.onError?.("restart-limit");
        finish();
        return;
      }
      // 휴대폰은 발화마다, 데스크톱도 한참 조용하면 세션이 끝난다. 사용자가 멈추기
      // 전이면 다시 켠다.
      restarts += 1;
      restartTimer = window.setTimeout(() => {
        restartTimer = 0;
        if (dead || closing) {
          finish();
          return;
        }
        try {
          active = create();
          active.start();
        } catch {
          finish();
        }
      }, RESTART_DELAY_MS);
    };

    return recognition;
  };

  try {
    active = create();
    active.start();
  } catch {
    detach(active);
    return null;
  }

  handle = {
    stop: () => {
      if (dead || closing) return;
      closing = true;
      if (restartTimer) {
        window.clearTimeout(restartTimer);
        restartTimer = 0;
      }
      // stop() 은 인식 중이던 마지막 문장을 final 로 흘려보낸 뒤 onend 를 부른다.
      if (!active) {
        foldRun();
        emit();
        finish();
        return;
      }
      try {
        active.stop();
      } catch {
        foldRun();
        emit();
        finish();
      }
    },
    abort: () => {
      if (dead) return;
      dead = true;
      closing = true;
      if (restartTimer) {
        window.clearTimeout(restartTimer);
        restartTimer = 0;
      }
      const current = active;
      active = null;
      detach(current);
      try {
        current?.abort();
      } catch {
        /* 이미 끝난 경우 */
      }
      foldRun();
      // 마지막까지 받아 적은 값을 넘긴 뒤 끝낸다. 문제를 넘겨도 답변은 남는다.
      handlers.onUpdate({ committed: settled, interim: "" });
      finish();
    },
  };
  liveDictation = handle;
  return handle;
}

export type { TranscriptDraft };
