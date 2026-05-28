import type { z } from "zod";

import type { runPlaygroundInputSchema } from "./schemas";

export type RunPlaygroundInput = z.output<typeof runPlaygroundInputSchema>;
