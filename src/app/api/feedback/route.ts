import type { OpicFeedback } from "@/lib/feedback";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_TRANSCRIPT_CHARS = 12_000;

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    overall: { type: "string" },
    structure: {
      type: "object",
      properties: {
        topic: { type: "string", enum: ["good", "needs_work"] },
        detail: { type: "string", enum: ["good", "needs_work"] },
        feeling: { type: "string", enum: ["good", "needs_work"] },
        note: { type: "string" },
      },
      required: ["topic", "detail", "feeling", "note"],
      additionalProperties: false,
    },
    pronunciationBasis: {
      type: "string",
      enum: ["audio_compare", "browser_only", "none"],
    },
    items: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "storytelling",
              "detail",
              "emotion",
              "delivery",
              "pronunciation",
              "grammar",
            ],
          },
          title: { type: "string" },
          message: { type: "string" },
          example: { type: "string" },
        },
        required: ["category", "title", "message", "example"],
        additionalProperties: false,
      },
    },
  },
  required: ["overall", "structure", "pronunciationBasis", "items"],
  additionalProperties: false,
} as const;

function asText(value: FormDataEntryValue | null, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function extractOutputText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;

  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as Record<string, unknown>).text;
      if (typeof text === "string") return text;
    }
  }
  return "";
}

async function transcribeAudio(apiKey: string, audio: File): Promise<string> {
  const body = new FormData();
  body.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe");
  body.append("language", "en");
  body.append("file", audio, audio.name || "answer.webm");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  if (!response.ok) {
    throw new Error(`transcription_failed:${response.status}`);
  }

  const payload = (await response.json()) as { text?: unknown };
  return typeof payload.text === "string" ? payload.text.trim() : "";
}

function buildPrompt(input: {
  question: string;
  topic: string;
  type: string;
  browserTranscript: string;
  audioTranscript: string;
  elapsedSec: number;
}): string {
  const words = input.browserTranscript.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
  const wpm = input.elapsedSec > 8 ? Math.round((words / input.elapsedSec) * 60) : null;

  return [
    "You are coaching a Korean learner for OPIc speaking practice.",
    "The learner's main goal is storytelling and communicative delivery, NOT grammatical perfection.",
    "The preferred answer flow is: 핵심 명사/주제 → 활동·예시·구체적 디테일 → 감정·느낌·의미.",
    "Evaluate whether the answer naturally moves through those three stages. Do not force the pattern mechanically when the response is already natural.",
    "Give at most 5 feedback items total. Prefer the highest-impact issues only.",
    "Priority order: storytelling/organization first, concrete activity-example-detail second, emotion/personal reaction third, delivery fourth, pronunciation fifth, grammar last.",
    "Grammar rule: do NOT nitpick articles, prepositions, small tense slips, or awkward but understandable phrasing. Mention grammar only when an error seriously hurts meaning or repeats enough to disrupt communication.",
    "Pronunciation rule: never infer a pronunciation mistake from text alone. If an audio transcript is provided, compare it with the browser transcript. Only flag a concrete word/phrase when the mismatch gives a reasonable pronunciation-check signal. Phrase it cautiously: ASR can also be wrong. Do not invent a phonetic diagnosis such as a specific consonant/vowel error unless the evidence supports it.",
    "Delivery rule: use duration/WPM only as a weak signal. Do not criticize a natural pause merely because it exists.",
    "Write feedback in concise Korean. English examples should be short, natural, and easy to reuse. Do not rewrite the entire answer.",
    "If the answer is already strong, return fewer than 5 items rather than manufacturing problems.",
    "For pronunciationBasis return audio_compare only when an audio transcript is present; browser_only when only the browser transcript is present; none when there is no usable spoken transcript.",
    "",
    `[Question type] ${input.type || "unknown"}`,
    `[Topic] ${input.topic || "unknown"}`,
    `[Question] ${input.question}`,
    `[Browser speech-recognition transcript] ${input.browserTranscript || "(none)"}`,
    `[Independent audio transcription] ${input.audioTranscript || "(not available)"}`,
    `[Speaking duration] ${input.elapsedSec}s`,
    `[Approx. WPM] ${wpm ?? "not reliable"}`,
  ].join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY가 서버 환경변수에 설정되어 있지 않습니다." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "요청 형식을 읽을 수 없습니다." }, { status: 400 });
  }

  const question = asText(form.get("question"), 3_000);
  const topic = asText(form.get("topic"), 300);
  const type = asText(form.get("type"), 300);
  const browserTranscript = asText(form.get("transcript"), MAX_TRANSCRIPT_CHARS);
  const elapsedRaw = asText(form.get("elapsedSec"), 16);
  const elapsedSec = Math.max(0, Math.min(1_800, Number(elapsedRaw) || 0));
  const audioEntry = form.get("audio");
  const audio = audioEntry instanceof File && audioEntry.size > 0 ? audioEntry : null;

  if (!question || !browserTranscript) {
    return Response.json({ error: "질문과 답변 받아쓰기가 필요합니다." }, { status: 400 });
  }

  if (audio && audio.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "녹음 파일이 너무 큽니다. 12MB 이하만 분석할 수 있습니다." }, { status: 413 });
  }

  let audioTranscript = "";
  if (audio) {
    try {
      audioTranscript = await transcribeAudio(apiKey, audio);
    } catch {
      // 발음 비교만 건너뛰고 텍스트 기반 피드백은 계속 제공한다.
      audioTranscript = "";
    }
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_FEEDBACK_MODEL || "gpt-5.6-terra",
      input: buildPrompt({
        question,
        topic,
        type,
        browserTranscript,
        audioTranscript,
        elapsedSec,
      }),
      reasoning: { effort: "low" },
      max_output_tokens: 1_200,
      store: false,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "opic_feedback",
          strict: true,
          schema: FEEDBACK_SCHEMA,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("OpenAI feedback request failed", response.status, detail.slice(0, 500));
    return Response.json(
      { error: "AI 피드백을 생성하지 못했습니다. 잠시 뒤 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);
  if (!outputText) {
    return Response.json({ error: "AI 피드백 결과가 비어 있습니다." }, { status: 502 });
  }

  try {
    const feedback = JSON.parse(outputText) as OpicFeedback;
    if (!Array.isArray(feedback.items)) throw new Error("invalid feedback");
    feedback.items = feedback.items.slice(0, 5);
    return Response.json(feedback);
  } catch {
    return Response.json({ error: "AI 피드백 결과 형식을 읽지 못했습니다." }, { status: 502 });
  }
}
