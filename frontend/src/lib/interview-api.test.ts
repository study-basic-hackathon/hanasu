import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  requestNextQuestion,
  synthesizeSpeech,
  transcribeAudio,
} from "@/lib/interview-api";
import { storeAccessToken } from "@/lib/token-storage";

describe("interview-api", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    window.sessionStorage.clear();
    storeAccessToken("jwt-token");
    vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000");
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("録音を multipart/form-data で STT API へ送る", async () => {
    const transcription = {
      raw_transcript: "えー、回答です。",
      clean_transcript: "回答です。",
      filler_count: 1,
      duration_ms: 2_000,
      chars: 5,
      chars_per_min: 150,
    };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(transcription), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      transcribeAudio(new Blob(["audio"], { type: "audio/webm" })),
    ).resolves.toEqual(transcription);

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect((init?.body as FormData).get("audio")).toBeInstanceOf(File);
    expect(new Headers(init?.headers).has("Content-Type")).toBe(false);
  });

  it("質問強度と未加工 STT テキストを chat API へ送る", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ text: "次の質問です。" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      requestNextQuestion({
        companyId: 3,
        questionStrength: "hard",
        history: [
          {
            role: "user",
            content: "回答です。",
            raw_content: "えー、回答です。",
          },
        ],
      }),
    ).resolves.toBe("次の質問です。");

    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      company_id: 3,
      question_strength: "hard",
      history: [{ role: "user", content: "えー、回答です。" }],
    });
  });

  it("TTS API の音声レスポンスを Blob で返す", async () => {
    fetchMock.mockResolvedValue(
      new Response(new Blob(["mp3"], { type: "audio/mpeg" }), {
        status: 200,
        headers: { "Content-Type": "audio/mpeg" },
      }),
    );

    const audio = await synthesizeSpeech("質問です。");
    expect(audio).toBeInstanceOf(Blob);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Accept")).toBe(
      "audio/mpeg",
    );
  });
});
