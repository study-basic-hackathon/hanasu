import { apiRequest } from "@/lib/api-client";
import type { ChatTurn, QuestionStrength } from "@/lib/domain";

export type Transcription = {
  raw_transcript: string;
  clean_transcript: string;
  filler_count: number;
  filler_count_per_min: number;
  duration_ms: number;
  chars: number;
  chars_per_min: number;
};

const AUDIO_EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

function recordingFileName(audio: Blob): string {
  const mimeType = audio.type.toLowerCase().split(";", 1)[0];
  return `answer.${AUDIO_EXTENSION_BY_MIME[mimeType] ?? "webm"}`;
}

export async function transcribeAudio(
  audio: Blob,
  signal?: AbortSignal,
): Promise<Transcription> {
  const form = new FormData();
  form.set("audio", audio, recordingFileName(audio));
  return apiRequest<Transcription>("/interviews/stt", {
    method: "POST",
    body: form,
    signal,
  });
}

export async function requestNextQuestion(
  input: {
    companyId: number;
    questionStrength: QuestionStrength;
    customQuestionStrength?: string;
    maxTurns: number;
    history: ChatTurn[];
  },
  signal?: AbortSignal,
): Promise<string> {
  const response = await apiRequest<{ text: string }>("/interviews/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      company_id: input.companyId,
      question_strength: input.questionStrength,
      ...(input.questionStrength === "custom"
        ? { custom_question_strength: input.customQuestionStrength }
        : {}),
      max_turns: input.maxTurns,
      history: input.history.map((turn) => ({
        role: turn.role,
        content: turn.raw_content ?? turn.content,
      })),
    }),
    signal,
  });
  return response.text;
}

export function synthesizeSpeech(text: string, signal?: AbortSignal): Promise<Blob> {
  return apiRequest<Blob>(
    "/interviews/tts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal,
    },
    { responseType: "blob" },
  );
}
