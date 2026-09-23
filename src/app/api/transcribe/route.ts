export const runtime = "nodejs";
export const maxDuration = 60;
// Leave room for multipart overhead within the hosting request-body limit.
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "AI 전사 설정을 확인해 주세요." }, { status: 503 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return Response.json({ error: "녹음 파일을 읽을 수 없습니다." }, { status: 400 }); }
  const audio = form.get("audio");
  if (!(audio instanceof File) || !audio.size) return Response.json({ error: "녹음 파일이 필요합니다." }, { status: 400 });
  if (audio.size > MAX_AUDIO_BYTES) return Response.json({ error: "녹음 파일이 너무 큽니다. 답변을 나누어 녹음해 주세요." }, { status: 413 });
  const body = new FormData();
  body.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-transcribe");
  body.append("language", "en");
  body.append("file", audio, audio.name);
  try {
    const result = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body,
      signal: AbortSignal.timeout(50_000),
    });
    if (!result.ok) throw new Error("transcription_failed");
    const data = await result.json() as { text?: unknown };
    const text = typeof data.text === "string" ? data.text.trim() : "";
    if (!text) return Response.json({ error: "녹음에서 말을 인식하지 못했습니다. 다시 전사하거나 녹음해 주세요." }, { status: 422 });
    return Response.json({ text });
  } catch {
    return Response.json({ error: "AI 전사를 완료하지 못했습니다. 녹음은 보관되어 있으니 다시 시도해 주세요." }, { status: 502 });
  }
}
