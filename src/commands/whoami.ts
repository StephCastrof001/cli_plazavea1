import chalk from "chalk";
import { CONFIG_PATH, configAge, configAgeLabel, configExists } from "../config.js";

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";

  const hasSession = configExists();
  const age = configAge();
  const ageLabel = configAgeLabel();
  const ttlWarning = age < Number.POSITIVE_INFINITY && age > 20 * 60 * 1000; // >20 min → puede estar expirada

  if (outputJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          hasSession,
          configAge: ageLabel,
          configPath: CONFIG_PATH,
          mayBeExpired: ttlWarning,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (!hasSession) {
    process.stderr.write(chalk.red("✖ Sin sesión activa.\n"));
    process.stderr.write(chalk.dim("  Ejecuta: plaza login\n"));
    process.exit(1);
  }

  process.stdout.write(chalk.green("✔ Sesión presente\n"));
  process.stdout.write(`${chalk.bold("  Config: ") + chalk.dim(CONFIG_PATH)}\n`);
  process.stdout.write(`${chalk.bold("  Guardada: ") + ageLabel}\n`);

  if (ttlWarning) {
    process.stderr.write(
      chalk.yellow(
        "  ⚠ La sesión puede haber expirado (~30 min TTL). Si hay errores, ejecuta: plaza login\n",
      ),
    );
  }
}

main();
