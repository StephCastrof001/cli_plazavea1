import chalk from "chalk";
import { searchProducts } from "../services/products.js";
import { AppError } from "../http.js";

function formatPrice(n: number): string {
  return `S/ ${n.toFixed(2)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "10") : 10;

  const flagValues = new Set<string>();
  ["--output", "--limit"].forEach((flag) => {
    const idx = args.indexOf(flag);
    if (idx !== -1 && args[idx + 1]) flagValues.add(args[idx + 1] as string);
  });
  const termParts = args.filter((a) => !a.startsWith("--") && !flagValues.has(a));
  const term = termParts.length > 0 ? termParts.join(" ") : undefined;

  if (!term) {
    process.stderr.write(chalk.red("Uso: plaza search <término> [--limit N] [--output json]\n"));
    process.exit(1);
  }

  try {
    process.stderr.write(chalk.dim(`Buscando "${term}"...\n`));
    const results = await searchProducts(term, limit);

    if (outputJson) {
      process.stdout.write(JSON.stringify(results, null, 2) + "\n");
      return;
    }

    if (results.length === 0) {
      process.stderr.write(chalk.yellow("Sin resultados.\n"));
      return;
    }

    // Cabecera
    const col = (s: string, w: number) => s.substring(0, w).padEnd(w);
    process.stdout.write(
      chalk.bold(
        col("SKU", 12) + col("Producto", 42) + col("Regular", 11) +
        col("Oferta", 11) + col("OH", 11) + col("Stock", 8) + "\n"
      )
    );
    process.stdout.write("─".repeat(95) + "\n");

    for (const p of results) {
      const stock = p.inStock ? chalk.green("✔") : chalk.red("✖ global");
      const regular = formatPrice(p.prices.regular);
      const led = p.prices.led ? chalk.yellow(formatPrice(p.prices.led)) : chalk.dim("—");
      const oh = p.prices.oh ? chalk.cyan(formatPrice(p.prices.oh)) : chalk.dim("—");

      process.stdout.write(
        col(p.skuId, 12) +
        col(p.name, 42) +
        col(regular, 11) +
        led.padEnd(p.prices.led ? 11 : 11) + "  " +
        oh.padEnd(p.prices.oh ? 11 : 11) + "  " +
        stock + "\n"
      );
    }

    process.stdout.write(chalk.dim("\n  Stock ⚠ = global (puede variar por local — usa: plaza simulate)\n"));

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
