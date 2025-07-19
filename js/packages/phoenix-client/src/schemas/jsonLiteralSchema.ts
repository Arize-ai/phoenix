import z from "zod";

/**
 * The zod schema for JSON literal primitives
 * @see {@link https://zod.dev/?id=json-type|Zod Documentation}
 */
export const literalSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type Literal = z.infer<typeof literalSchema>;
export type JSONLiteral =
  | Literal
  | { [key: string]: JSONLiteral }
  | JSONLiteral[];

/**
 * The zod schema for JSON
 * @see {@link https://zod.dev/?id=json-type|Zod Documentation}
 */
export const jsonLiteralSchema: z.ZodType<JSONLiteral> = z.lazy(() =>
  z.union([
    literalSchema,
    z.array(jsonLiteralSchema),
    z.record(jsonLiteralSchema),
  ])
);
