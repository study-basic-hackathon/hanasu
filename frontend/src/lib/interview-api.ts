import { apiRequest, jsonRequest } from "@/lib/api-client";
import type { ChatTurn, QuestionStrength } from "@/lib/domain";

export type Transcription = {
  raw_transcript: string;
  clean_transcript: string;
  filler_count: number;
  duration_ms: number;
  chars: number;
  chars_per_min: number;
};

export async function transcribeAudio(
  audio: Blob,
  signal?: AbortSignal,
): Promise<Transcription> {
  const form = new FormData();
  form.set("audio", audio, "answer.webm");
  return apiRequest<Transcription>("/interviews/stt", {
    method: "POST",
    body: form,
    signal,
  });
}

export async function requestNextQuestion(input: {
  companyId: number;
  questionStrength: QuestionStrength;
  history: ChatTurn[];
}): Promise<string> {
  const response = await jsonRequest<{ text: string }>(
    "/interviews/chat",
    "POST",
    {
      company_id: input.companyId,
      question_strength: input.questionStrength,
      history: input.history.map((turn) => ({
        role: turn.role,
        content: turn.raw_content ?? turn.content,
      })),
    },
  );
  return response.text;
}

export function synthesizeSpeech(text: string): Promise<Blob> {
  return apiRequest<Blob>(
    "/interviews/tts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
    { responseType: "blob" },
  );
}
