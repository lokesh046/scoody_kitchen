// Keep sentence punctuation out of display headings while preserving ellipses and decimals.
export function withoutHeadingFullStops(title: string): string {
  return title.replace(/(?<!\.)\.(?!\.)(?=\s|$)/g, '');
}
