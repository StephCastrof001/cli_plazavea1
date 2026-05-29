import chalk from "chalk";
import { AppError } from "../http.js";
import { simulateStock } from "../services/cart.js";

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";
  const skuIdx = args.indexOf("--sku");
  const postalIdx = args.indexOf("--postal");

  if (skuIdx === -1 || postalIdx === -1) {
    process.stderr.write(chalk.red("Uso: plaza simulate --sku <skuId> --postal <código_postal>\n"));
    process.stderr.write(chalk.dim("  Ejemplo: plaza simulate --sku 123456 --postal 15001\n"));
    process.exit(1);
  }

  const skuId = args[skuIdx + 1];
  const postalCode = args[postalIdx + 1];

  if (!skuId || !postalCode) {
    process.stderr.write(chalk.red("Faltan valores para --sku o --postal\n"));
    process.exit(1);
  }

  try {
    process.stderr.write(
      chalk.dim(`Verificando stock local para SKU ${skuId} en CP ${postalCode}...\n`),
    );
    const result = await simulateStock(skuId, postalCode);

    if (outputJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    if (result.available) {
      process.stdout.write(
        chalk.green(`✔ Disponible en tu local — CP ${postalCode} (seller: ${result.seller})\n`),
      );
    } else {
      process.stdout.write(
        chalk.red(`✖ Sin stock en tu local — CP ${postalCode} (seller: ${result.seller})\n`),
      );
      process.stdout.write(
        chalk.dim("  El stock global puede mostrar disponibilidad pero no hay en tu local.\n"),
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
