// The backend (FastAPI) answers a rejected input with `detail` as a LIST of
// objects ({type, loc, msg, input, ctx}), not a string. Screens render
// `err.response.data.detail` straight into <Text>, and React crashes on an object
// child ("Objects are not valid as a React child"). This turns any `detail` into
// plain text so every existing call site keeps working unchanged.

const GENERIC = 'Something went wrong. Please check the details you entered and try again.';

function prettyField(loc: unknown): string {
  if (!Array.isArray(loc)) return '';
  const last = [...loc].reverse().find((part) => typeof part === 'string' && part !== 'body');
  return typeof last === 'string' ? last.replace(/_/g, ' ') : '';
}

function cleanMessage(msg: string): string {
  // pydantic prefixes custom validator errors with "Value error, "
  return msg.replace(/^Value error,\s*/i, '').trim();
}

function describeItem(item: unknown): string {
  if (typeof item === 'string') return item;
  if (item && typeof item === 'object') {
    const obj = item as { msg?: unknown; message?: unknown; loc?: unknown };
    const raw =
      typeof obj.msg === 'string' ? obj.msg : typeof obj.message === 'string' ? obj.message : '';
    if (raw) {
      const msg = cleanMessage(raw);
      const field = prettyField(obj.loc);
      return field ? `${field}: ${msg}` : msg;
    }
  }
  return '';
}

/** Like readableDetail, but keeps "no detail" as undefined so `a || b || 'fallback'` chains still work. */
export function optionalDetail(detail: unknown): string | undefined {
  if (detail === undefined || detail === null || detail === '') return undefined;
  return readableDetail(detail);
}

/** Returns `detail` unchanged when it is already a string; otherwise readable text. */
export function readableDetail(detail: unknown): string {
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map(describeItem).filter(Boolean);
    return parts.length ? parts.join('\n') : GENERIC;
  }
  const single = describeItem(detail);
  return single || GENERIC;
}
