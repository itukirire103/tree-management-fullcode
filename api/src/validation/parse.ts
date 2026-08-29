import type { ZodType, z } from "zod";
import { ValidationError } from "../errors.js";

// req.bodyをzodスキーマでパースし、失敗時はValidationError(→400)を投げる。
// crud.tsの共通ルーター/個別ルート双方から使う小さな共通ヘルパー。
export function parseOrThrow<T extends ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join(" / ");
    throw new ValidationError(message);
  }
  return result.data;
}
