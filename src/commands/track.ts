import chalk from "chalk";
import { trackAdd, trackCheck, trackHistory, trackList, trackRemove } from "../services/tracker.js";

async function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";

  if (!sub || sub === "--help") {
    process.stderr.write(
      [
        chalk.bold("Uso: plaza track <subcomando>"),
        "  add <productId> [--alert S/X]  — seguir precio de un producto",
        "  list                           — productos rastreados",
        "  check                          — refrescar precios y ver cambios",
        "  remove <productId>             — dejar de rastrear",
        "  history <productId>            — historial de precios",
        "",
      ].join("\n"),
    );
    process.exit(0);
  }

  try {
    if (sub === "add") {
      const productId = args[1];
      if (!productId) {
        process.stderr.write(chalk.red("Falta productId. Uso: plaza track add <productId>\n"));
        process.exit(1);
      }
      const alertIdx = args.indexOf("--alert");
      const alertPrice = alertIdx !== -1 ? Number.parseFloat(args[alertIdx + 1] ?? "") : undefined;

      process.stderr.write(chalk.dim(`Agregando ${productId} al radar de precios...\n`));
      const result = await trackAdd(productId, alertPrice);
      if (!result) {
        process.stderr.write(chalk.red(`✖ Producto ${productId} no encontrado.\n`));
        process.exit(1);
      }
      if (outputJson) {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      } else {
        const price = result.history[0]?.price ?? 0;
        process.stdout.write(
          `${chalk.green("✔")} ${result.name} — S/${price.toFixed(2)}${alertPrice ? chalk.yellow(` (alerta: S/${alertPrice.toFixed(2)})`) : ""}\n`,
        );
      }
      return;
    }

    if (sub === "list") {
      const tracked = trackList();
      if (tracked.length === 0) {
        process.stdout.write(
          chalk.dim("Sin productos rastreados. Usa: plaza track add <productId>\n"),
        );
        return;
      }
      if (outputJson) {
        process.stdout.write(`${JSON.stringify(tracked, null, 2)}\n`);
        return;
      }
      process.stdout.write(
        `${"ProductId".padEnd(15)}  ${"Nombre".padEnd(35)}  ${"Precio".padStart(8)}  Alerta\n`,
      );
      process.stdout.write(`${"─".repeat(75)}\n`);
      for (const p of tracked) {
        const last = p.history[p.history.length - 1];
        const price = last?.price ?? 0;
        const alert = p.alert !== undefined ? `S/${p.alert.toFixed(2)}` : "—";
        process.stdout.write(
          `${p.productId.padEnd(15)}  ${p.name.slice(0, 35).padEnd(35)}  ${`S/${price.toFixed(2)}`.padStart(8)}  ${alert}\n`,
        );
      }
      return;
    }

    if (sub === "check") {
      process.stderr.write(chalk.dim("Verificando precios...\n"));
      const { alerts } = await trackCheck((name, price, diff) => {
        const arrow = diff > 0 ? chalk.red("↑") : diff < 0 ? chalk.green("↓") : chalk.dim("=");
        const diffStr = diff !== 0 ? ` (${diff > 0 ? "+" : ""}${diff.toFixed(2)})` : "";
        process.stderr.write(
          `  ${arrow} ${name.slice(0, 40).padEnd(40)} S/${price.toFixed(2)}${diffStr}\n`,
        );
      });
      if (alerts.length > 0) {
        process.stdout.write(chalk.yellow("\n⚠ Alertas de precio:\n"));
        for (const a of alerts) process.stdout.write(`  ${chalk.yellow(a)}\n`);
      } else {
        process.stdout.write(chalk.dim("\nSin alertas activas.\n"));
      }
      return;
    }

    if (sub === "remove") {
      const productId = args[1];
      if (!productId) {
        process.stderr.write(chalk.red("Falta productId.\n"));
        process.exit(1);
      }
      const name = trackRemove(productId);
      if (!name) {
        process.stderr.write(chalk.red(`✖ ${productId} no está siendo rastreado.\n`));
        process.exit(1);
      }
      process.stdout.write(`${chalk.green("✔")} ${name} eliminado del radar.\n`);
      return;
    }

    if (sub === "history") {
      const productId = args[1];
      if (!productId) {
        process.stderr.write(chalk.red("Falta productId.\n"));
        process.exit(1);
      }
      const hist = trackHistory(productId);
      if (!hist) {
        process.stderr.write(chalk.red(`✖ ${productId} no encontrado.\n`));
        process.exit(1);
      }
      if (outputJson) {
        process.stdout.write(`${JSON.stringify(hist, null, 2)}\n`);
        return;
      }
      process.stdout.write(`${chalk.bold(hist.name)}\n`);
      process.stdout.write(
        `${"Fecha".padEnd(12)}  ${"Precio".padStart(8)}  ${"Precio lista".padStart(12)}\n`,
      );
      process.stdout.write(`${"─".repeat(40)}\n`);
      for (const h of hist.history) {
        process.stdout.write(
          `${h.date.padEnd(12)}  ${`S/${h.price.toFixed(2)}`.padStart(8)}  ${`S/${h.listPrice.toFixed(2)}`.padStart(12)}\n`,
        );
      }
      return;
    }

    process.stderr.write(chalk.red(`Subcomando desconocido: ${sub}\n`));
    process.exit(1);
  } catch (e) {
    process.stderr.write(chalk.red(`✖ ${e instanceof Error ? e.message : String(e)}\n`));
    process.exit(1);
  }
}

main();
