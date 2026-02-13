import { type z, ZodError } from "zod";
import { InputError } from "./errors";

export function createOperation<T extends z.ZodType, R>(config: {
  input: T;
  execute: (input: z.infer<T>) => Promise<R>;
}): (input: z.input<T>) => Promise<R>;

export function createOperation<R>(config: {
  input?: undefined;
  execute: () => Promise<R>;
}): () => Promise<R>;

export function createOperation<T extends z.ZodType, R>(config: {
  input?: T;
  execute: (input?: z.infer<T>) => Promise<R>;
}) {
  return async (input?: z.infer<T>) => {
    let parsed: z.infer<T> | undefined;

    try {
      parsed = config.input ? config.input.parse(input) : undefined;
    } catch (e) {
      if (e instanceof ZodError) {
        throw new InputError(e.issues);
      }
      throw e;
    }

    return config.execute(parsed);
  };
}
