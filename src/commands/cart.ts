import chalk from "chalk";
import { getCart } from "../services/cart.js";
import { AppError } from "../http.js";

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";

  try {
    const cart = await getCart();

    if (outputJson) {
      process.stdout.write(JSON.stringify(cart, null, 2) + "\n");
      return;
    }

    if (cart.items.length === 0) {
      process.stderr.write(chalk.yellow("El carrito está vacío.\n"));
      return;
    }

    const col = (s: string, w: number) => s.substring(0, w).padEnd(w);
    process.stdout.write(
      chalk.bold(col("Idx", 5) + col("Producto", 38) + col("Cant", 6) + col("Precio", 10) + col("Total", 10) + "Estado\n")
    );
    process.stdout.write("─".repeat(80) + "\n");

    cart.items.forEach((item, i) => {
      const statusStr =
        item.availability === "withoutStock"
          ? chalk.red("Sin stock")
          : item.availability === "cannotBeDelivered"
            ? chalk.yellow("No entregable")
            : chalk.green("OK");

      process.stdout.write(
        col(String(i), 5) +
        col(item.name, 38) +
        col(String(item.quantity), 6) +
        col(`S/ ${item.sellingPrice.toFixed(2)}`, 10) +
        col(`S/ ${item.total.toFixed(2)}`, 10) +
        statusStr + "\n"
      );
    });

    process.stdout.write("─".repeat(80) + "\n");
    process.stdout.write(chalk.bold(`Total: ${chalk.green(`S/ ${cart.totalValue.toFixed(2)}`)}`));
    if (cart.shippingValue > 0) {
      process.stdout.write(`  Envío: S/ ${cart.shippingValue.toFixed(2)}`);
    }
    process.stdout.write("\n");

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
