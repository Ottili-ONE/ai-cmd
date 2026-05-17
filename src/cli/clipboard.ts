import clipboardy from "clipboardy";
import { ClipboardError } from "../utils/errors.js";

export async function copyToClipboard(command: string): Promise<void> {
  try {
    await clipboardy.write(command);
  } catch (error) {
    throw new ClipboardError(
      "Clipboard unavailable. Command printed below instead.",
      error
    );
  }
}

