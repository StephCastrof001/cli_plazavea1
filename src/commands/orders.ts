import chalk from "chalk";
import { getOrders } from "../services/orders.js";
import { AppError } from "../http.js";

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? "10") : 10;

  try {
    process.stderr.write(chalk.dim("Obteniendo pedidos...\n"));
    const orders = await getOrders(limit);

    if (outputJson) {
      process.stdout.write(JSON.stringify(orders, null, 2) + "\n");
      return;
    }

    if (orders.length === 0) {
      process.stderr.write(chalk.yellow("Sin pedidos encontrados.\n"));
      return;
    }

    const col = (s: string, w: number) => s.substring(0, w).padEnd(w);
    process.stdout.write(
      chalk.bold(col("Pedido", 20) + col("Fecha", 14) + col("Total", 12) + "Estado\n")
    );
    process.stdout.write("─".repeat(65) + "\n");

    for (const o of orders) {
      const date = o.creationDate.substring(0, 10);
      const status = o.statusDescription ?? o.status;
      process.stdout.write(
        col(o.orderId, 20) +
        col(date, 14) +
        col(`S/ ${o.totalValue.toFixed(2)}`, 12) +
        status + "\n"
      );
    }

  } catch (e) {
    const msg = e instanceof AppError ? e.message : String(e);
    process.stderr.write(chalk.red(`✖ ${msg}\n`));
    if (e instanceof AppError && e.isSessionExpired) {
      process.stderr.write(chalk.dim("  Ejecuta: plaza login\n"));
    }
    // orders puede dar 403 — no es error fatal del CLI
    if (e instanceof AppError && e.statusCode === 403) {
      process.stderr.write(chalk.dim("  El endpoint de pedidos puede requerir cuenta verificada.\n"));
    }
    process.exit(1);
  }
}

main();
