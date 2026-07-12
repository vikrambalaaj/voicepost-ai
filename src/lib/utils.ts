import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanJsonString(str: string): string {
  let insideString = false;
  let escaped = false;
  let clean = "";

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '"' && !escaped) {
      insideString = !insideString;
    }

    if (insideString) {
      if (char === '\n') {
        clean += '\\n';
      } else if (char === '\r') {
        clean += '\\r';
      } else if (char === '\t') {
        clean += '\\t';
      } else {
        clean += char;
      }
    } else {
      if (char === '*') {
        // Skip asterisks outside of strings (e.g. Markdown bolding of JSON elements like **"value"**)
        continue;
      }
      clean += char;
    }

    // Update escaped flag for next character
    if (char === '\\' && !escaped) {
      escaped = true;
    } else {
      escaped = false;
    }
  }

  return clean;
}

