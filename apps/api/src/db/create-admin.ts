import "dotenv/config";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { pool } from "./pool.js";

async function readHidden(prompt: string): Promise<string> {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so the password can be entered privately.");
  }

  process.stdout.write(prompt);
  return await new Promise((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk: Buffer) => {
      for (const character of chunk.toString()) {
        if (character === "\u0003") {
          finish(new Error("Admin setup cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            process.stdout.write("\b \b");
          }
          continue;
        }
        if (character >= " " && character <= "~") {
          value += character;
          process.stdout.write("*");
        }
      }
    };
    input.setRawMode(true);
    input.resume();
    input.on("data", onData);
  });
}

async function main() {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const email = (await prompt.question("Admin email: ")).trim().toLowerCase();
  prompt.close();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error("Enter a valid email address.");
  }

  const password = await readHidden("Admin password (12+ characters, hidden): ");
  if (password.length < 12 || password.length > 200) {
    throw new Error("Admin password must be between 12 and 200 characters.");
  }
  const confirmation = await readHidden("Confirm password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (email, password_hash, display_name, role)
     VALUES ($1, $2, $3, 'admin')`,
    [email, passwordHash, email.split("@")[0]],
  );
  console.log(`Created admin account for ${email}.`);
}

try {
  await main();
} finally {
  await pool.end();
}
