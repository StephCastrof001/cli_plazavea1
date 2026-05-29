import chalk from "chalk";
import { AppError } from "../http.js";
import { addToCart } from "../services/cart.js";

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";
  const qtyIdx = args.indexOf("--quantity");
  const quantity = qtyIdx !== -1 ? Number.parseInt(args[qtyIdx + 1] ?? "1") : 1;
  const skuId = args.find((a) => !a.startsWith("--") && a !== args[args.indexOf("--quantity") + 1]);

  if (!skuId) {
    process.stderr.write(
      chalk.red("Uso: plaza add <skuId> [--quantity N] [--dry-run] [--output json]\n"),
    );
    process.stderr.write(chalk.dim("  Obtén el skuId con: plaza search <término>\n"));
    process.exit(1);
  }

  if (dryRun) {
    process.stdout.write(
      `${JSON.stringify({ dryRun: true, skuId, quantity, action: "add_to_cart" }, null, 2)}\n`,
    );
    return;
  }

  try {
    process.stderr.write(chalk.dim(`Agregando SKU ${skuId} x${quantity}...\n`));
    const cart = await addToCart(skuId, quantity);

    // Verificar si VTEX lo agregó pero sin stock (Solución B — DM-001)
    const addedItem = cart.items.find((i) => i.id === skuId);
    if (!addedItem) {
      process.stderr.write(
        chalk.red("✖ VTEX aceptó el request pero el producto no aparece en el carrito.\n"),
      );
      process.exit(1);
    }
    if (addedItem.availability === "withoutStock") {
      process.stderr.write(
        chalk.yellow("⚠ Agregado al carrito, pero sin stock en tu local. Fallará al pagar.\n"),
      );
      process.stderr.write(
        chalk.dim(`  Verifica: plaza simulate --sku ${skuId} --postal <TU_CP>\n`),
      );
    } else {
      process.stderr.write(chalk.green(`✔ ${addedItem.name} x${quantity} agregado al carrito.\n`));
    }

    if (outputJson) {
      process.stdout.write(`${JSON.stringify(cart, null, 2)}\n`);
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
