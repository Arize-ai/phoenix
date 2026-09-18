import { withSpan } from "@arizeai/openinference-core";

interface Visit {
  id: string;
  patient: { id: string; fullName: string; birthDate: string };
  notes: { diagnosis: string; plan: string };
}
declare const history: { forPatient(id: string): Promise<string[]> };
declare const llm: {
  summarize(
    text: string
  ): Promise<{ text: string; usage: { totalTokens: number } }>;
};

// A keyword denylist gets this file wrong in both directions: it flags
// `token_count` ("token") and misses `patient_dob` and `chief_complaint`.
export function traceVisit(visit: Visit, tokenCount: number) {
  return withSpan(
    async () => {
      const prior = await history.forPatient(visit.patient.id);
      return llm.summarize([...prior, visit.notes.plan].join("\n"));
    },
    {
      name: "summarize-visit",
      kind: "CHAIN",
      attributes: {
        "metadata.token_count": tokenCount,
        "metadata.patient_dob": visit.patient.birthDate,
        "metadata.chief_complaint": visit.notes.diagnosis,
        // A pasted key: decided in code, never sent to jev.
        "metadata.api_key": "sk-live-0123456789abcdef0123456789abcdef",
      },
      processInput: () => ({ "input.value": JSON.stringify(visit) }),
    }
  );
}
