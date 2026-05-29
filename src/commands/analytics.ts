import chalk from "chalk";
import { AppError } from "../http.js";
import { buildAnalytics, ensureOrderDetails } from "../services/analytics.js";
import { getOrders } from "../services/orders.js";

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";
  const monthIdx = args.indexOf("--month");
  const month = monthIdx !== -1 ? (args[monthIdx + 1] ?? null) : null;
  const topIdx = args.indexOf("--top");
  const topN = topIdx !== -1 ? Number.parseInt(args[topIdx + 1] ?? "10") : 10;

  try {
    process.stderr.write(chalk.dim("Cargando historial de órdenes...\n"));
    const orders = await getOrders(50);

    process.stderr.write(chalk.dim(`Obteniendo detalles (${orders.length} órdenes)...\n`));
    const details = await ensureOrderDetails(
      orders.map((o) => o.orderId),
      (current, total) => {
        process.stderr.write(chalk.dim(`  [${current}/${total}] descargando...\r`));
      },
    );
    process.stderr.write("\n");

    const result = buildAnalytics(details, { month, topN });

    if (outputJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    const period = month ?? "todo el tiempo";
    process.stdout.write(chalk.bold(`\nAnalytics — ${period}\n`));
    process.stdout.write(`${"─".repeat(50)}\n`);
    process.stdout.write(
      `Órdenes: ${result.totalOrders}  |  Gasto total: S/${result.totalSpend.toFixed(2)}  |  Promedio: S/${result.avgOrder.toFixed(2)}\n\n`,
    );

    if (result.byMonth.length > 1) {
      process.stdout.write(chalk.bold("Gasto por mes:\n"));
      for (const m of result.byMonth) {
        const bar = "█".repeat(Math.round(m.spend / 10));
        process.stdout.write(`  ${m.month}  S/${m.spend.toFixed(2).padStart(7)}  ${bar}\n`);
      }
      process.stdout.write("\n");
    }

    process.stdout.write(chalk.bold(`Top ${topN} por gasto:\n`));
    for (const p of result.topBySpend) {
      process.stdout.write(
        `  ${p.name.slice(0, 40).padEnd(40)}  S/${p.spend.toFixed(2).padStart(7)}  (x${p.qty})\n`,
      );
    }

    process.stdout.write(chalk.bold("\nTop 5 más comprados:\n"));
    for (const p of result.topByFrequency) {
      process.stdout.write(
        `  ${p.name.slice(0, 40).padEnd(40)}  ${String(p.orders).padStart(3)} veces  x${p.qty} unid\n`,
      );
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
