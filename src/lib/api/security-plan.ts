import type { BlueprintLayout } from "@/types";

import { getActiveEventSlug } from "@/lib/services/events";



const BASE = "/api/v1";



export interface SecurityPlanProposal {

  type: "guard" | "camera";

  x: number;

  y: number;

  label: string;

  reason: string;

  proposed?: boolean;

}



export interface SecurityPlanRecommendation {

  type: string;

  title: string;

  description: string;

  priority: string;

}



export interface SecurityFinding {

  severity: string;

  title: string;

  detail: string;

}



export interface SecurityAnalysis {

  blueprint: {

    walls: number;

    doors: number;

    windows: number;

    columns: number;

    entrances: number;

    objectCounts: Record<string, number>;

    detectionMethod: string;

    confidence?: number;

  };

  findings: SecurityFinding[];

  advisories: string[];

}



export interface SecurityPlanPayload {

  summary: string;

  blueprintUnderstanding: string;

  constraints: {

    minGuards: number;

    minCameras: number;

    threatPosture: string;

    instructions: string;

  };

  layout: BlueprintLayout;

  securityAnalysis: SecurityAnalysis;

  coverageBefore: { coveragePercentage: number; vulnerabilityScore: number; blindSpotsFound: number };

  coverageAfter: { coveragePercentage: number; vulnerabilityScore: number; blindSpotsFound: number };

  proposedGuards: SecurityPlanProposal[];

  proposedCameras: SecurityPlanProposal[];

  recommendations: SecurityPlanRecommendation[];

  securityMeasures: string[];

  agentReview: {

    reasoningSteps: { phase: string; detail: string }[];

    modifications: string[];

  };

}



export interface SecurityPlanResponse {

  ok: boolean;

  persisted?: boolean;

  plan: SecurityPlanPayload;

}



export interface ChatMessage {

  role: "user" | "assistant";

  content: string;

}



export interface SecurityPlanChatResponse {

  ok: boolean;

  reply: string;

  plan: SecurityPlanPayload;

  history: ChatMessage[];

  persisted?: boolean;

}



async function postJson<T>(path: string, payload: unknown): Promise<T> {

  const res = await fetch(path, {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(payload),

    cache: "no-store",

  });

  if (!res.ok) {

    const body = await res.json().catch(() => ({}));

    const msg = (body as { detail?: string }).detail ?? `Security plan API error ${res.status}`;

    throw new Error(msg);

  }

  return res.json() as Promise<T>;

}



export const securityPlanApi = {

  generate: (

    payload: {

      instructions: string;

      persist?: boolean;

    },

    slug = getActiveEventSlug()

  ): Promise<SecurityPlanResponse> =>

    postJson(`${BASE}/events/${slug}/security/plan`, payload),



  chat: (

    payload: {

      message: string;

      history?: ChatMessage[];

      instructions?: string;

      previousPlan?: SecurityPlanPayload;

      persist?: boolean;

    },

    slug = getActiveEventSlug()

  ): Promise<SecurityPlanChatResponse> =>

    postJson(`${BASE}/events/${slug}/security/plan/chat`, payload),

};

