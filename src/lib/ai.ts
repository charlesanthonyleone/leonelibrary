/**
 * AI ENGINE PLACEHOLDER — no model is connected and no API key is embedded in this site.
 * Every Studio action resolves to a stub so the flows can be designed and tested end to end.
 */
export const AI_CONNECTED = false;
export type AIJob = { kind: 'translate' | 'remix' | 'continue'; input: string; options: Record<string, string> };
export async function runAI(_job: AIJob): Promise<{ ok: false; message: string }> {
  await new Promise(r => setTimeout(r, 900));
  return { ok: false, message: 'AI engine connecting soon. Your project and settings are saved; output will appear here once the engine is live.' };
}
