import axios, { AxiosError } from 'axios';
import { BACKEND_URL } from '../config';
import { MentorExplanation } from '../types';

/**
 * Single place where the frontend talks to the IntelliBuild backend. Keeping the
 * endpoints here means pages only deal with typed results and one error helper.
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function extractErrorMessage(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const err = e as AxiosError<{ error?: string }>;
    if (err.code === 'ERR_NETWORK') {
      return 'Cannot reach the IntelliBuild server. Make sure the backend is running on ' + BACKEND_URL + '.';
    }
    return err.response?.data?.error ?? fallback;
  }
  return (e as Error)?.message ?? fallback;
}

export const isCancelled = axios.isCancel;

export async function fetchTemplate(prompt: string, signal?: AbortSignal) {
  const { data } = await axios.post<{ prompts: string[]; uiPrompts: string[] }>(
    `${BACKEND_URL}/template`,
    { prompt: prompt.trim() },
    { signal }
  );
  return data;
}

export async function sendChat(messages: ChatMessage[], signal?: AbortSignal) {
  const { data } = await axios.post<{ response: string }>(`${BACKEND_URL}/chat`, { messages }, { signal });
  return data.response;
}

const EMPTY_EXPLANATION: MentorExplanation = {
  projectOverview: '',
  folderStructure: [],
  keyFiles: [],
  componentRelationships: '',
  dataFlow: '',
  architectureRationale: '',
  beginnerExplanation: '',
  suggestedImprovements: [],
  interviewQuestions: [],
  bestPractices: [],
};

/** Guards the UI against a model response that omits or mistypes a section. */
export function normalizeMentorExplanation(raw: unknown): MentorExplanation {
  const value = (raw ?? {}) as Partial<MentorExplanation>;
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const strings = (v: unknown) => (Array.isArray(v) ? v.filter((i): i is string => typeof i === 'string') : []);
  const pairs = <T extends object>(v: unknown) => (Array.isArray(v) ? (v.filter(Boolean) as T[]) : []);

  return {
    ...EMPTY_EXPLANATION,
    projectOverview: text(value.projectOverview),
    folderStructure: pairs<{ path: string; purpose: string }>(value.folderStructure),
    keyFiles: pairs<{ path: string; purpose: string }>(value.keyFiles),
    componentRelationships: text(value.componentRelationships),
    dataFlow: text(value.dataFlow),
    architectureRationale: text(value.architectureRationale),
    beginnerExplanation: text(value.beginnerExplanation),
    suggestedImprovements: strings(value.suggestedImprovements),
    interviewQuestions: pairs<{ question: string; answer: string }>(value.interviewQuestions),
    bestPractices: strings(value.bestPractices),
  };
}

export async function fetchMentorExplanation(
  payload: { prompt: string; projectName: string; files: Array<{ path: string; content: string }> },
  signal?: AbortSignal
): Promise<MentorExplanation> {
  const { data } = await axios.post<{ explanation: unknown }>(`${BACKEND_URL}/mentor`, payload, { signal });
  return normalizeMentorExplanation(data.explanation);
}
