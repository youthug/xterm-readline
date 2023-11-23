import { Terminal } from "xterm";

export interface CompletionOptions {
  prefix: string | string[] | RegExp;
  strict?: boolean;
  completions: string[];
}

export interface CompletionResult {
  result?: string;
  completions: string[];
}

export class CompletionHandler {
  private definedCompletions: Record<string, CompletionOptions> = {};

  public addCompletionHandler(completions: string[], replace?: boolean): void;

  public addCompletionHandler(
    completions: string[],
    key?: string,
    replace?: boolean
  ): void;

  public addCompletionHandler(
    options: CompletionOptions,
    replace?: boolean
  ): void;

  public addCompletionHandler(
    options: CompletionOptions,
    key?: string,
    replace?: boolean
  ): void;

  public addCompletionHandler(
    options: string[] | CompletionOptions,
    key?: boolean | string,
    replace?: boolean
  ) {
    if (Array.isArray(options)) options = { prefix: "", completions: options };
    if (typeof key === "boolean") {
      replace = key;
      key = "";
    }
    if (key === undefined) key = "";

    if (this.definedCompletions[key] && !replace) {
      const { completions } = options;
      completions.unshift(
        ...this.definedCompletions[key].completions.filter(
          (i) => !completions.includes(i)
        )
      );
    }
    this.definedCompletions[key] = options;
  }

  public complete(value: string): CompletionResult | undefined {
    const completionsArr = Object.values(this.definedCompletions);
    const matched: Set<string> = new Set();

    completionsArr.forEach(({ prefix, strict = false, completions }) => {
      const compVal = getComparingVal(value, strict);

      if (!prefix) {
        completions.forEach((i) => {
          if (!compVal.trim() || getComparingVal(i, strict).startsWith(compVal))
            matched.add(i);
        });
        return;
      }

      if (
        // array
        (Array.isArray(prefix) &&
          !prefix.some((i) =>
            getComparingVal(i, strict).startsWith(compVal)
          )) ||
        // string
        (typeof prefix === "string" &&
          getComparingVal(prefix, strict).startsWith(compVal)) ||
        // regexp
        (prefix instanceof RegExp && prefix.test(value))
      ) {
        completions.forEach((i) => {
          if (getComparingVal(i, strict).startsWith(compVal)) matched.add(i);
        });
      }
    });

    const sorted = Array.from(matched).sort();
    return {
      result: findLongestPrefix(sorted),
      completions: sorted,
    };
  }
}

export function handleCompletionsOutput(
  completions: string[],
  term: Terminal | undefined
) {
  const { cols = 80, rows = 10 } = term || {};

  const maxLen = Math.max(...completions.map((i) => i.length));
  const printWidth = maxLen + 2;
  const itemsEachRow = Math.max(Math.floor(cols / printWidth), 1);

  const currentPage = completions.slice(
    0,
    Math.min(
      completions.length,
      ((rows * itemsEachRow < completions.length ? rows - 1 : rows) - 1) *
        itemsEachRow
    )
  );

  let printText = currentPage
    .reduce((acc, cur) => {
      const lastRow = acc.at(-1);
      if (lastRow && lastRow.length < itemsEachRow) lastRow.push(cur);
      else acc.push([cur]);
      return acc;
    }, [] as string[][])
    .map((g) =>
      g
        .map((i, index) =>
          index === g.length - 1 ? i : i.padEnd(printWidth, " ")
        )
        .join("")
    )
    .join("\r\n");

  const hiddenCount = completions.length - currentPage.length;
  if (hiddenCount) printText += `\r\n...and ${hiddenCount} more`;

  return "\r\n" + printText + "\r\n";
}

function getComparingVal(value: string, strict: boolean) {
  return strict ? value : value.toLowerCase();
}

function findLongestPrefix(words: string[]) {
  // check border cases size 1 array and empty first word
  if (!words[0] || words.length === 1) return words[0] || "";

  const [first, ...rest] = words;

  let i = 0;
  // while all words have the same character at position i, increment i
  while (first[i] && rest.every((w) => w[i] === first[i])) i++;

  // prefix is the substring from the beginning to the last successfully checked i
  return first.slice(0, i);
}