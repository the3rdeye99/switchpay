import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

/**
 * Prompts the user for a yes/no confirmation. Defaults to "no" on empty
 * input, since this is used to guard destructive actions (file overwrites).
 */
export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(`${message} (y/N) `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    rl.close();
  }
}
