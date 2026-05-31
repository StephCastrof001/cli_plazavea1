/**
 * `plaza buy <término>` — búsqueda interactiva → selección → add al carrito
 * Flujo: search → lista numerada → readline → plaza add <skuId>
 */
import { createInterface } from "node:readline";
import chalk from "chalk";
import { AppError } from "../http.js";
import { addToCart } from "../services/cart.js";
import { searchProducts } from "../services/products.js";

function formatPrice(n: number): string {
  return `S/${n.toFixed(2)}`;
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? Number.parseInt(args[limitIdx + 1] ?? "8") : 8;
  const flagValues = new Set<string>();
  if (limitIdx !== -1 && args[limitIdx + 1]) flagValues.add(args[limitIdx + 1] as string);
  const termParts = args.filter((a) => !a.startsWith("--") && !flagValues.has(a));
  const term = termParts.join(" ");

  if (!term) {
    process.stderr.write(chalk.red("Uso: plaza buy <término> [--limit N]\n"));
    process.stderr.write(chalk.dim("  Ejemplo: plaza buy arroz costeño\n"));
    process.exit(1);
  }

  try {
    process.stderr.write(chalk.dim(`Buscando "${term}"...\n`));
    const products = await searchProducts(term, limit);

    if (products.length === 0) {
      process.stderr.write(chalk.yellow("Sin resultados.\n"));
      process.exit(0);
    }

    // Lista numerada
    console.log();
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const regular = chalk.white(formatPrice(p.prices.regular));
      const led = p.prices.led ? chalk.yellow(` → ${formatPrice(p.prices.led)}`) : "";
      const oh = p.prices.oh ? chalk.cyan(` OH:${formatPrice(p.prices.oh)}`) : "";
      const stock = p.inStock ? chalk.green("✔") : chalk.red("✖ sin stock global");
      const num = chalk.bold(`  ${String(i + 1).padStart(2)}.`);
      const name = p.name.slice(0, 50).padEnd(50);
      console.log(`${num} ${name}  ${regular}${led}${oh}  ${stock}`);
    }

    console.log();
    const answer = await prompt(chalk.bold("  Número (0 para cancelar): "));

    const idx = Number.parseInt(answer);
    if (!idx || idx < 1 || idx > products.length) {
      process.stderr.write(chalk.dim("Cancelado.\n"));
      process.exit(0);
    }

    const selected = products[idx - 1];
    if (!selected) {
      process.stderr.write(chalk.red("Selección inválida.\n"));
      process.exit(1);
    }

    const qtyAnswer = await prompt(chalk.bold("  Cantidad [1]: "));
    const quantity = Number.parseInt(qtyAnswer || "1");
    if (Number.isNaN(quantity) || quantity < 1) {
      process.stderr.write(chalk.red("Cantidad inválida.\n"));
      process.exit(1);
    }

    process.stderr.write(chalk.dim(`Agregando ${selected.name} x${quantity}...\n`));
    const cart = await addToCart(selected.skuId, quantity);

    const addedItem = cart.items.find((i) => i.id === selected.skuId);
    if (!addedItem) {
      process.stderr.write(
        chalk.red("✖ VTEX aceptó el request pero el producto no apareció en el carrito.\n"),
      );
      process.exit(1);
    }

    if (addedItem.availability === "withoutStock") {
      process.stderr.write(
        chalk.yellow(
          `⚠ ${addedItem.name} en carrito — sin stock local. Verifica antes de pagar:\n`,
        ),
      );
      process.stderr.write(chalk.dim(`  plaza simulate --sku ${selected.skuId}\n`));
    } else {
      process.stderr.write(chalk.green(`✔ ${addedItem.name} x${quantity} agregado al carrito.\n`));
    }

    process.stderr.write(
      chalk.dim(`  Carrito: ${cart.items.length} ítems — S/${cart.totalValue.toFixed(2)} total\n`),
    );
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
