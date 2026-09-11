import type { ProjectFile } from "./types";
export function wordCount(files: ProjectFile[]) {
  return (
    files
      .filter((file) => file.name.endsWith(".tex"))
      .map((file) =>
        file.content
          .replace(/(?<!\\)%[^\n]*/g, "")
          .replace(
            /\\(?:documentclass|usepackage|label|ref|cite|bibliography|bibliographystyle|includegraphics|input|definecolor|hypersetup)(?:\[[^\]]*\])?(?:\{[^}]*\})+/g,
            "",
          )
          .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, "")
          .replace(/[{}$&_^~<>0-9=+*/\\-]/g, " "),
      )
      .join(" ")
      .match(/[\p{L}]+(?:['’][\p{L}]+)?/gu)?.length || 0
  );
}
export function outline(files: ProjectFile[]) {
  return files
    .filter((file) => file.name.endsWith(".tex"))
    .flatMap((file) =>
      file.content.split("\n").flatMap((text, index) => {
        const match = text.match(
          /^\s*\\(chapter|section|subsection|subsubsection)\*?\{([^}]+)\}/,
        );
        return match
          ? [
              {
                fileId: file.id,
                line: index + 1,
                label: match[2],
                level:
                  match[1] === "subsection"
                    ? 1
                    : match[1] === "subsubsection"
                      ? 2
                      : 0,
              },
            ]
          : [];
      }),
    );
}
export interface BibEntry {
  key: string;
  type: string;
  title: string;
  author: string;
  year: string;
  raw: string;
}
export function parseBib(source: string): BibEntry[] {
  const entries: BibEntry[] = [];
  const start = /@(\w+)\s*\{\s*([^,\s]+)\s*,/g;
  let match;
  while ((match = start.exec(source))) {
    let depth = 1;
    let end = start.lastIndex;
    for (; end < source.length && depth; end++) {
      if (source[end] === "{" && source[end - 1] !== "\\") depth++;
      if (source[end] === "}" && source[end - 1] !== "\\") depth--;
    }
    const raw = source.slice(match.index, end);
    const field = (name: string) => {
      const found = new RegExp(name + '\\s*=\\s*([{"])', "i").exec(raw);
      if (!found) return "";
      const from = found.index + found[0].length;
      let i = from,
        level = 1;
      if (found[1] === '"') {
        for (; i < raw.length && !(raw[i] === '"' && raw[i - 1] !== "\\"); i++);
      } else {
        for (; i < raw.length; i++) {
          if (raw[i] === "{" && raw[i - 1] !== "\\") level++;
          if (raw[i] === "}" && raw[i - 1] !== "\\" && --level === 0) break;
        }
      }
      return raw.slice(from, i).replace(/[{}]/g, "");
    };
    if (!["comment", "preamble", "string"].includes(match[1].toLowerCase()))
      entries.push({
        key: match[2],
        type: match[1],
        title: field("title") || match[2],
        author: field("author"),
        year: field("year"),
        raw,
      });
    start.lastIndex = end;
  }
  return entries;
}
