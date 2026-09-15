import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_CRITERIA,
  feedbackOutputTokenLimit,
  requiresFrontLoadedOpening,
  type FeedbackResponse,
  type OpicFeedback,
} from "@/lib/feedback";

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
          category: { type: "string", enum: FEEDBACK_CATEGORIES },
          title: { type: "string" },
          message: { type: "string" },
          example: { type: "string" },
        },
        required: ["category", "title", "message", "example"],
        additionalProperties: false,
      },
    },
    // 항목을 먼저 쓰고 그 항목대로 고치도록 맨 뒤에 둔다.
    improvedAnswer: { type: "string" },
    // 인용문은 고친 답변에서 그대로 떠 오는 것이라 그 뒤에 둔다. 순서는 items 와 같다.
    itemQuotes: { type: "array", maxItems: 5, items: { type: "string" } },
  },
  required: ["overall", "structure", "pronunciationBasis", "items", "improvedAnswer", "itemQuotes"],
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
  /** 두괄식 판정 기준이 갈리므로 라벨이 아니라 유형 id 로 받는다. */
  questionType: string;
  browserTranscript: string;
  audioTranscript: string;
  elapsedSec: number;
}): string {
  const words = input.browserTranscript.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
  const wpm = input.elapsedSec > 8 ? Math.round((words / input.elapsedSec) * 60) : null;
  const frontLoaded = requiresFrontLoadedOpening(input.questionType);

  // 서술형은 첫 몇 문장(3문장 안팎) 안에 질문에 대한 답이 나오는 두괄식을 보고,
  // 롤플레이는 전화 대화에 가까워 도입을 강제하지 않는다.
  const structureRules = frontLoaded
    ? [
      "The preferred answer flow is: 핵심 명사/주제 → 활동·예시·구체적 디테일 → 감정·느낌·의미.",
      "두괄식: the core answer should come out within the first few sentences (roughly 3), not necessarily the first. A natural lead-in such as restating the question is fine. Mark structure.topic needs_work only when the point is clearly delayed; then say in structure.note where it appeared and give one storytelling item with a short line to say earlier.",
    ]
    : [
      "The preferred answer flow is: 요청·문제의 핵심 → 상황·조건의 구체적 디테일 → 마무리 요청·감정.",
      "This is a roleplay turn, so do NOT require a 두괄식 essay-style opening. Starting with a greeting or a line of context is natural here.",
      "Mark structure.topic as good when the listener can tell early on what is being asked or what the problem is, in a way that sounds natural on a phone call.",
    ];

  return [
    "You are coaching a Korean learner for OPIc SPOKEN English practice. Evaluate a person formulating speech in real time, never a written essay. The target is clear, organized, spontaneous, natural spoken English, not polished written prose.",
    "Pauses for thought, fillers, discourse markers, restarts, reformulation, self-correction, short reactions, brief self-talk, and an occasionally unpolished sentence are normal spoken behavior, not automatic weaknesses. Reward their function when they help the learner think, connect ideas, or keep a natural conversational flow.",
    "The useful general flow is main point → concrete detail/example → reaction/feeling/meaning → a natural wrap-up when useful. Treat it as a flexible coaching framework, not a rigid essay template.",
    `Use these Korean criterion names consistently in feedback: ${FEEDBACK_CRITERIA.map(({ key, label }) => `structure.${key} = ${label}`).join(", ")}. Use 전개·디테일 for the detail category too.`,
    ...structureRules,
    "Evaluate the remaining stages as flow, not as a checklist. Do not force the pattern mechanically when the response is already natural.",
    "Give at most 5 feedback items total. Prefer the highest-impact issues only.",
    "Priority order: (1) clear storytelling/organization, (2) natural spontaneous spoken delivery, (3) relevant concrete detail, (4) emotion/personal meaning, (5) natural transitions/discourse markers/wrap-up, (6) speaking pace, (7) word stress only when reliably supported, (8) tense/major word order, (9) pronunciation only for severe and reliably supported intelligibility problems.",
    // 연결 표현은 OPIc 에서 아이디어 사이의 관계를 드러내는 축이라 기능별 목록을 그대로 준다.
    // 목록이 없으면 모델이 "연결 표현을 더 쓰세요" 같은 두루뭉술한 조언을 내놓는다.
    "Discourse markers (연결 표현) carry a lot of weight in OPIc: they show how ideas relate and keep the answer moving. Coach them with this function-to-expression map.",
    "- 이유 (reason): because / because of + noun / since / the reason is (that) ~ / mainly because / that's partly because",
    "- 결과 (result): so / as a result / because of that / that's why / which means / in the end",
    "- 추가 (adding): also / and also / on top of that / besides that / another thing is (that) ~ / plus / what's more",
    "- 전환 (topic shift): anyway / speaking of that / when it comes to ~ / as for ~ / talking about ~ / by the way / moving on to ~",
    "- 강조·포인트 (highlighting the point): the thing is ~ / what's really nice is ~ / what I like most is ~ / the best part is ~ / what really matters is ~ / to be honest / actually",
    "- 예시 (example): for example / for instance / like / such as / things like ~ / say, ~ / let me give you an example",
    "- 대조 (contrast): but / however / on the other hand / although / even though / still / at the same time / then again",
    "- 시간·순서 (sequence): first (of all) / then / after that / at first / while I was ~ing / later on / finally",
    "- 마무리 (wrapping up): so that's pretty much it / overall / all in all / that's why I ~ / anyway, that's about it / in short",
    "- 의견·태도 (stance): I think / I'd say / for me / personally / if you ask me / I feel like / in my opinion",
    "Natural-thinking language: Well / Um / Uh / Oh / Yeah / Right / Let me think / Let me see / What else? / What else can I say? / How should I put it? / I'm trying to think / I guess / I suppose / I'm not really sure, but / That's a good question / Give me a second / You know / I mean. Treat natural use as positive or neutral spontaneity evidence. 'What else?' is a valid spoken self-prompt, not unnecessary writing. A brief thinking pause around it is acceptable. Praise the function, not the quantity.",
    "When that spoken strategy works well, positive Korean feedback may say '생각할 시간을 자연스럽게 확보하면서 답변을 이어갔습니다', '“What else?” 같은 표현으로 다음 내용을 자연스럽게 생각해낸 점이 좋습니다', or '접속 표현을 활용해 생각하는 시간과 문단 전환을 자연스럽게 연결했습니다.' Do not praise filler quantity itself.",
    "Repetition tolerance: especially, basically, personally, actually, and literally may each appear up to 5 times in one answer without criticism merely for repetition. At 6+ uses, consider feedback only when that same expression is genuinely over-relied on; say it is overused rather than wrong and offer only 1–2 alternatives with the SAME discourse function. Do not manufacture vocabulary variety for its own sake.",
    "For well, you know, I mean, so, and 'what else?', do not use a mechanical count threshold. Flag them only when their repetition genuinely interrupts fluency. Never reward mechanical smoothness merely because an answer contains no fillers.",
    "When repetition truly disrupts the answer, quote the learner's exact location and replace only selected occurrences with expressions FROM THE SAME FUNCTION row above. Never swap a marker for one from a different function.",
    "Missing-marker rule: when a relation is clearly there but unmarked (a reason, a result, a contrast) and the sentences land abruptly, add the marker at that exact spot in the learner's own sentence. Do NOT tell the learner to use more connectors in general, and do NOT ask them to cover functions their answer had no reason to use. Skip this entirely when the ideas already flow.",
    "Required idea-opener rule: check whether the learner naturally uses at least ONE of these instructor-preferred spoken openers anywhere in the answer: 'What's really nice is ...', 'What I like most is ...', 'The problem is ...', 'The thing is ...', or 'Another thing is ...'. If at least one is already used naturally, do not request, insert, or praise additional openers and do not criticize the learner for not using more. One suitable opener per answer is enough.",
    "If none of those five preferred openers appears, feedback MUST include exactly ONE structure/storytelling improvement item with the meaning '답변 안에서 주요 아이디어를 시작할 때 이런 표현 중 하나를 사용하면 구조가 더 선명해집니다.' Choose exactly ONE opener and give one short English example in the learner's actual context: use 'What's really nice is ...' for a positive feature or advantage, 'What I like most is ...' for a personal favorite, 'The problem is ...' for a clear problem or disadvantage, 'The thing is ...' for an explanation, complication, or important point, or 'Another thing is ...' for another major point. Never choose an opener that conflicts with the learner's meaning.",
    "Idea-opener style: prefer the natural spoken pattern without automatically adding 'that': 'What's really nice is I can walk there', 'What I like most is it's very convenient', 'The thing is I don't have much time', and 'Another thing is the park is very close to my house.' Keep an existing 'that' only when there is a specific reason. Missing a preferred opener is not a grammar error and does not make otherwise strong logic or relevance weak. Do not require one in every paragraph, add several, make the response sound memorized, or turn it into an essay.",
    "Reaction/meaning rule: check how each developed major idea or paragraph-like spoken unit ends. The preferred flexible flow is main point → concrete explanation/example/experience → a short reaction, feeling, or personal meaning when the learner's content supports one. If factual detail ends abruptly, say in Korean that the development is natural but one short reaction would make the ending feel more complete, then give ONE easy, common spoken-English example suited to that exact content. Prefer short expressions such as 'It was really fun', 'It was amazing', 'It was pretty stressful', 'I felt relieved', 'I really enjoyed that', 'I found it very relaxing', 'That was my favorite part', 'That's why I like it so much', or 'That's what made it special.' Preserve an emotion already stated or strongly implied. Never invent a conflicting or unsupported emotion, force a reaction into every unit, use advanced vocabulary, or make the ending long or essay-like.",
    "Logic-independence rule: a missing reaction ending does not make otherwise strong logic or organization weak; keep those criteria good and offer the short reaction only as a completeness improvement. Likewise, an emotional adjective cannot rescue off-topic content or weak logical development. Evaluate relevance, logic, and reaction/meaning independently.",
    "Summary/wrap-up rule: preserve contextual transition and ending coaching. Match the actual discourse function and content: reasons may lead to 'That's why I like it so much'; events to 'So yeah, that's pretty much what happened'; an overall opinion to 'Overall, I think it's a great place'; personal significance to 'That's what makes it special to me'. Do not recommend the same ending every time or a generic connector that does not fit the relationship.",
    "Grammar rule: correct clear tense errors, especially routine versus one specific past event, repeated unintended present/past switching in a story, and inconsistent tense. Also correct major word-order problems that materially affect communication. Do not nitpick articles, minor prepositions, tiny slips, or understandable awkwardness.",
    "Spoken 'there's + plural' rule: accept natural spontaneous uses such as 'There's a lot of people', 'There's many restaurants around here', 'There's two parks near my house', and 'There's several reasons for that.' Although formal writing may prefer 'There are', do not list this spoken pattern as wrong, create a grammar correction item for it, lower the evaluation because of it, or automatically change it to 'There are'. Intervene only when the sentence is genuinely unclear for another reason.",
    "Minor grammar rule: when meaning is clear, do not treat noun singular/plural, subject-verb agreement, countable/uncountable noun choice, articles, minor prepositions, or similar small slips as major '틀린 표현' items. Do not create a separate correction item for each one, describe the answer as grammatically weak, or make these the main weakness of an otherwise strong spoken response. Communication, content development, sentence completeness, and natural spoken English come first.",
    "Preposition rule: when a preposition is not the most natural choice but the intended meaning is completely clear, treat it as a light naturalness improvement, never a serious error, major wrong expression, communication failure, or high-priority item. Use Korean such as '의미 전달에는 문제가 되지 않지만, 더 적절한 전치사는 ___입니다.' or '전달력에는 문제가 없습니다. 이 문장에서는 ___를 쓰면 조금 더 자연스럽습니다.' Give one easy corrected expression. Do not over-correct obvious in/at, on/in, to/for, with/by choices; if several occur, summarize them instead of creating separate items. A preposition that genuinely changes or obscures meaning may still be corrected clearly.",
    "Few-error summary rule: if there are almost no meaningful errors and the answer is easy to understand, clearly say '실수가 많지 않아서 크게 고칠 것은 없습니다. 전달력에는 전혀 문제가 없습니다.' If there are only 1–3 actual minor singular/plural, agreement, or countable/uncountable slips, say '실수가 많지 않아서 크게 고칠 것은 없습니다. 전달력에는 전혀 문제가 없습니다. 다만 단복수, 수일치, 가산명사·불가산명사에서 약간의 실수가 있었습니다.' Never claim those slips occurred when they did not.",
    "Better-expression rule: when meaning is clear but a sentence is incomplete, underdeveloped, or awkward, frame one genuinely useful suggestion as optional improvement using Korean such as '더 자연스럽게 말하면...', '조금 더 완성된 문장으로 말하면...', or '이렇게 말하면 더 자연스럽습니다.' Do not call it a wrong expression unless it causes a meaningful grammar or meaning problem.",
    "Easy-expression rule: recommended English must preserve the learner's meaning and use common vocabulary, a short sentence structure, and natural spoken English an intermediate learner can use immediately. Do not use advanced or academic vocabulary, complicated grammar, long sophisticated sentences, essay-style polishing, or rewrite the whole answer. Major tense or word-order errors that genuinely affect clarity may still be corrected clearly.",
    "Pronunciation rule: accept legitimate English accents and established native, regional, and social varieties, including American, British, Australian, New Zealand, Canadian, Irish, California English, and Valley Girl-style conversational speech. A noticeable accent is not a problem, and natural regional intonation may be a positive delivery feature when the speech is intelligible, expressive, appropriately stressed, and easy to follow. Never try to neutralize the learner's accent.",
    "Do not flag differences in vowel quality, consonant realization, rhoticity, intonation, pitch movement, rhythm, linking, casual connected speech, uptalk, or other regional pronunciation merely because they differ from General American English. Ignore minor vowel or consonant variation. Only flag clearly incorrect word stress when reliable acoustic evidence identifies the wrong syllable, or a severe mispronunciation that substantially obscures the intended word. Transcript text cannot establish word stress. When unsure whether a feature is accent variation or an error, omit the criticism.",
    "Never infer a pronunciation mistake from text alone, and never treat a different ASR transcription as pronunciation evidence. The independent transcription may improve the TEXT answer, but browser transcript != independent transcript does not mean bad pronunciation. Both ASR systems can be wrong. Without reliable acoustic evidence, give no pronunciation criticism; do not claim 'law sounded like low', vowel length, or another phoneme diagnosis from transcription.",
    "Pace rule: use the calculated integer WPM and these exact, non-overlapping ranges whenever WPM is reliable. 85–95: say '{WPM} WPM · 가장 적절한 속도입니다. 지금 속도를 유지하세요.' 96–100: say '{WPM} WPM · 적당한 속도입니다. 조금 느려져도 됩니다.' 101–105: say '{WPM} WPM · 조금 빠릅니다. 살짝 천천히 말해보세요.' 106 and above: always classify it as fast and say '{WPM} WPM · 속도가 빠릅니다. 조금 더 천천히 말해보세요.' For clearly much faster speech, '의식적으로 더 천천히 말해보세요' is also acceptable. Never call 96–100 the best range, never call 106+ appropriate or merely slightly fast, and never use overlapping boundaries. Below 85: do not call it too slow or automatically tell the learner to speed up. If it is connected and easy to follow, slower speech can be acceptable; if it is fragmented, coach connecting phrases or thought groups instead of speed. Faster is not better.",
    "Local pace-change rule: browser cadence timing may separately report a rushed opening, sudden middle acceleration, or sustained acceleration toward the end. Do not invent any of these patterns from overall WPM or transcript text, because reliable within-answer timing is not supplied to this feedback request.",
    "Pause rule: pauses under 3 seconds are normal thinking pauses and must not be criticized. A pause from 3 seconds up to but not including 5 seconds is noticeable; when reliable timing identifies one, say '3초 이상 멈추는 구간이 있습니다. 생각할 때 완전히 멈추기보다 자연스러운 표현을 사용해 답변을 이어가보세요.' A pause of 5 seconds or more is a risky long pause; clearly say '5초 이상 멈추는 구간은 위험합니다. 답변 흐름이 끊겨 보일 수 있으니 filler words나 thinking language를 활용해 말의 흐름을 유지하세요.' Then recommend a context-appropriate expression such as 'Well, let me think', 'Let me see', 'What else?', 'What else can I say?', 'That's a good question', 'Give me a second', 'How should I put it?', 'I'm trying to think', or 'Let me think of an example.' Do not mechanically repeat the same suggestion, encourage excessive fillers, or invent a pause pattern when reliable timing is unavailable.",
    "Delivery rule: keep chunking and coach meaningful thought groups. Do not penalize normal thinking pauses under 3 seconds, brief hesitation, self-correction, restarts, formulation pauses, or slow speech by itself. Natural filler and thinking language are useful real-time speaking strategies and are not weaknesses unless repetition genuinely disrupts fluency. Zero risky long pauses is normal and never evidence of memorization.",
    "Scripted-sounding is only a heuristic. Use only Natural / spontaneous, Somewhat prepared-sounding, or Very scripted-sounding, and never claim the learner memorized the answer. Prepared/scripted requires multiple reliable overlapping signals such as unusually uniform cadence, mechanical rhythm, little delivery variation, or long identical-pace stretches. Zero 5+ second pauses, smooth fluency, lack of fillers, or any one metric is never evidence by itself. Natural thinking expressions, self-correction, reformulation, pace changes, and natural pauses reduce suspicion.",
    "Stress and energy rule: do not duplicate one observation under both Stress & Delivery and Energy / Monotone. If only amplitude/energy is available and pitch is not reliable, do not claim intonation is wrong or that the speaker is monotone. Use cautious wording such as '전달이 전체적으로 조금 고르게 들립니다' or '핵심 단어에 조금 더 힘을 주면 전달력이 좋아집니다.' Never penalize naturally expressive regional intonation.",
    "Write feedback in concise Korean. Each item's English example should be one short, natural line that is easy to reuse. The full revised answer goes only in improvedAnswer.",
    "If the answer is already strong, return fewer than 5 items rather than manufacturing problems.",
    "For pronunciationBasis return audio_compare only when an audio transcript is present; browser_only when only the browser transcript is present; none when there is no usable spoken transcript.",
    "",
    "improvedAnswer is the learner's own answer rewritten so it is worth reading out loud. It is a revision of their answer, NOT a new model answer:",
    "- The source answer is the independent audio transcription when available, otherwise the browser transcript.",
    "- Apply every text change your feedback items ask for, at the place each item identifies.",
    "- Beyond those, smooth wording, sentence structure and transitions only toward natural spoken English, never essay-style written English. Preserve useful spoken features such as Well, Actually, You know, I mean, What else?, Let me think, short reactions, natural discourse markers, and appropriate self-correction instead of automatically deleting them for written neatness.",
    "- Preserve a natural spoken 'there's + plural noun' construction. Do not normalize it to 'There are' unless another genuine clarity problem requires rewriting that sentence.",
    "- Keep their content: their own words, examples, opinions and order of ideas. Do not add ideas, facts or feelings they did not express, and do not drop any they did.",
    "- Keep it sayable by this learner. Do not reach for vocabulary or structures noticeably above the level of the source answer.",
    "- Stay within roughly 10% of the source answer's length.",
    "- Plain English text only: no markdown, labels, or Korean.",
    "",
    "itemQuotes ties each feedback item to its place in improvedAnswer so the screen can mark that spot and number it. One entry per feedback item, in the same order as items:",
    "- Copy the span of improvedAnswer that this item produced, verbatim and contiguous, so an exact text search finds it. Keep it to the changed span plus only as much context as it takes to be unambiguous.",
    "- Quote from improvedAnswer only, never from the source answer, and never text you did not write there.",
    "- Do NOT quote a span you changed only for fluency. Those are not tied to a feedback item and are marked differently on screen.",
    "- Use an empty string for an item that required no text change at all.",
    "",
    `[Question type] ${input.type || "unknown"} (id: ${input.questionType || "unknown"})`,
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
  const questionType = asText(form.get("questionType"), 40);
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
  // 고친 답변은 이 텍스트를 바탕으로 만들라고 지시한다. 프롬프트의 규칙과 같은 순서다.
  const answerBasis = audioTranscript || browserTranscript;

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
        questionType,
        browserTranscript,
        audioTranscript,
        elapsedSec,
      }),
      reasoning: { effort: "low" },
      max_output_tokens: feedbackOutputTokenLimit(answerBasis.length),
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
    const { improvedAnswer: rawImproved, itemQuotes: rawQuotes, ...parsed } =
      JSON.parse(outputText) as OpicFeedback & { itemQuotes?: unknown };
    if (!Array.isArray(parsed.items)) throw new Error("invalid feedback");
    const improvedAnswer = typeof rawImproved === "string" ? rawImproved.trim() : "";
    // 인용문은 자리만 알려 주는 값이라 항목 안으로 옮겨 저장한다. 모델이 빠뜨린 자리는
    // 빈 문자열이 되고, 그 항목의 변경은 화면에서 연한 등급으로 남는다.
    const quotes: unknown[] = Array.isArray(rawQuotes) ? rawQuotes : [];
    const feedback: OpicFeedback = {
      ...parsed,
      items: parsed.items.slice(0, 5).map((item, index) => {
        const quote = quotes[index];
        return { ...item, afterQuote: typeof quote === "string" ? quote.trim() : "" };
      }),
      // Before 는 AI 가 실제로 고친 바로 그 텍스트여야 바뀐 곳이 정확히 칠해진다.
      ...(improvedAnswer ? { improvedAnswer, improvedFrom: answerBasis } : {}),
    };
    // 전사는 이미 돈을 들여 받아 둔 결과다. 프롬프트에만 쓰고 버리지 않고 화면으로 돌려준다.
    const payload: FeedbackResponse = { feedback, audioTranscript };
    return Response.json(payload);
  } catch {
    return Response.json({ error: "AI 피드백 결과 형식을 읽지 못했습니다." }, { status: 502 });
  }
}
