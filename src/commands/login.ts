import chalk from "chalk";
import { loginWithBrowser } from "../services/auth.js";
import { AppError } from "../http.js";

async function main() {
  process.stderr.write(chalk.cyan("Abriendo Plaza Vea en el browser...\n"));
  process.stderr.write(chalk.dim("  Tienes 3 minutos para iniciar sesión.\n\n"));

  try {
    const ok = await loginWithBrowser();
    if (ok) {
      process.stderr.write(chalk.green("✔ Sesión guardada en ~/.config/plazavea/session.json\n"));
    } else {
      process.stderr.write(chalk.red("✖ Timeout: no se detectó login en 3 minutos.\n"));
      process.exit(1);
    }
  } catch (e) {
    const msg = e instanceof AppError ? e.message : String(e);
    process.stderr.write(chalk.red(`✖ ${msg}\n`));
    process.exit(1);
  }
}

main();
