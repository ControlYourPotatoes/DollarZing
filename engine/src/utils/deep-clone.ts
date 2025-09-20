export interface CloneOptions {
  /** Truncate strings longer than this length. */
  maxStringLength?: number;
  /**
   * Redaction predicate. Return true to replace the value with "[REDACTED]".
   * Receives the JSON-style path (only string keys) to the property, the key, and the value.
   */
  redactPredicate?: (path: string[], key: string, value: unknown) => boolean;
}

interface CloneFrame {
  parent: any;
  key: string | number;
  value: unknown;
  path: string[];
}

function clonePrimitive(value: unknown, options: CloneOptions): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  switch (typeof value) {
    case "string": {
      if (
        options.maxStringLength !== undefined &&
        value.length > options.maxStringLength
      ) {
        return `${value.slice(0, options.maxStringLength)}…`;
      }
      return value;
    }
    case "number":
      return Number.isFinite(value) ? value : null;
    case "bigint":
      return Number.isFinite(Number(value)) ? Number(value) : value.toString();
    case "boolean":
    case "object":
      return value;
    default:
      return value;
  }
}

export function deepClone<T = unknown>(input: T, options: CloneOptions = {}): T {
  const rootHolder: { result: unknown } = { result: undefined };
  const stack: CloneFrame[] = [
    { parent: rootHolder, key: "result", value: input, path: [] },
  ];
  const seen = new WeakMap<object, any>();

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const { parent, key, value, path } = frame;

    if (value === null || typeof value !== "object") {
      parent[key as any] = clonePrimitive(value, options);
      continue;
    }

    if (seen.has(value as object)) {
      parent[key as any] = seen.get(value as object);
      continue;
    }

    if (Array.isArray(value)) {
      const clone: unknown[] = new Array(value.length);
      parent[key as any] = clone;
      seen.set(value, clone);

      for (let index = value.length - 1; index >= 0; index -= 1) {
        const item = value[index];
        if (
          item === undefined ||
          typeof item === "function" ||
          typeof item === "symbol"
        ) {
          clone[index] = null;
          continue;
        }

        stack.push({
          parent: clone,
          key: index,
          value: item,
          path,
        });
      }
      continue;
    }

    const clone: Record<string, unknown> = {};
    parent[key as any] = clone;
    seen.set(value as object, clone);

    for (const [propKey, propValue] of Object.entries(value)) {
      if (
        propValue === undefined ||
        typeof propValue === "function" ||
        typeof propValue === "symbol"
      ) {
        continue;
      }

      if (options.redactPredicate?.([...path, propKey], propKey, propValue)) {
        clone[propKey] = "[REDACTED]";
        continue;
      }

      stack.push({
        parent: clone,
        key: propKey,
        value: propValue,
        path: [...path, propKey],
      });
    }
  }

  return rootHolder.result as T;
}

