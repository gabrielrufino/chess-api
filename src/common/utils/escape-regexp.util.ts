export function escapeRegExp(string: string): string {
  return string
    .replace(/[|\\{}()[\]^$+*?.]/g, '\\$&') // $& means the whole matched string
    .replace(/-/g, '\\x2d'); // hyphen has special meaning inside character classes
}
