import chalk from "chalk";
import { removeFromCart } from "../services/cart.js";
import { AppError } from "../http.js";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";
  const indexStr = args.find((a) => !a.startsWith("--"));

  if (!indexStr || isNaN(parseInt(indexStr))) {
    process.stderr.write(chalk.red("Uso: plaza remove <índice> [--dry-run] [--output json]\n"));
    process.stderr.write(chalk.dim("  Obtén el índice con: plaza cart\n"));
    process.exit(1);
  }

  const index = parseInt(indexStr);

  if (dryRun) {
    process.stdout.write(JSON.stringify({ dryRun: true, index, action: "remove_from_cart" }, null, 2) + "\n");
    return;
  }

  try {
    process.stderr.write(chalk.dim(`Eliminando ítem ${index}...\n`));
    const cart = await removeFromCart(index);
    process.stderr.write(chalk.green(`✔ Ítem eliminado. Quedan ${cart.items.length} productos.\n`));

    if (outputJson) {
      process.stdout.write(JSON.stringify(cart, null, 2) + "\n");
    }

  } catch (e) {
    const msg = e instanceof AppError ? e.message : String(e);
    process.stderr.write(chalk.red(`✖ ${msg}\n`));
    if (e instanceof AppError && e.isSessionExpired) {
      process.stderr.write(chalk.dim("  Ejecuta: plaza login\n"));
    }
    process.exit(1);
  }
}

main();
