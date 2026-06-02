import chalk from "chalk";
import { requireSession } from "../config.js";
import { AppError } from "../http.js";
import { getAddresses, simulateStock } from "../services/cart.js";

async function main() {
  const args = process.argv.slice(2);
  const outputJson = args.includes("--output") && args[args.indexOf("--output") + 1] === "json";
  const skuIdx = args.indexOf("--sku");
  const addrIdx = args.indexOf("--address");

  requireSession();

  if (skuIdx === -1) {
    process.stderr.write(chalk.red("Uso: plazavea simulate --sku <skuId> [--address <índice>]\n"));
    process.stderr.write(chalk.dim("  Ejemplo: plazavea simulate --sku 10275386\n"));
    process.stderr.write(
      chalk.dim("  Para ver tus direcciones: plazavea simulate --list-addresses\n"),
    );
    process.exit(1);
  }

  // Listar direcciones guardadas
  if (args.includes("--list-addresses")) {
    const addresses = await getAddresses();
    if (addresses.length === 0) {
      process.stdout.write(
        chalk.yellow("Sin direcciones guardadas. Agrega una en plazavea.com.pe.\n"),
      );
      return;
    }
    process.stdout.write(chalk.bold("Tus direcciones guardadas:\n"));
    addresses.forEach((a, i) => {
      process.stdout.write(`  [${i}] ${a.neighborhood} — ${a.street} ${a.number}, ${a.city}\n`);
    });
    return;
  }

  const skuId = args[skuIdx + 1];
  const addressIndex = addrIdx !== -1 ? Number.parseInt(args[addrIdx + 1] ?? "0") : 0;

  if (!skuId) {
    process.stderr.write(chalk.red("Falta valor para --sku\n"));
    process.exit(1);
  }

  try {
    // Resolver índice → addressId (simulate matchea por id estable, no por índice)
    const addresses = await getAddresses();
    const chosen = addresses[addressIndex];
    if (!chosen) {
      process.stderr.write(
        chalk.red(`Dirección ${addressIndex} no existe. Tienes ${addresses.length} guardadas.\n`),
      );
      process.exit(1);
    }
    process.stderr.write(
      chalk.dim(`Verificando stock para SKU ${skuId} en ${chosen.neighborhood}...\n`),
    );
    const result = await simulateStock(skuId, chosen.addressId);

    if (outputJson) {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      return;
    }

    const addrLabel = result.address
      ? `${result.address.neighborhood}, ${result.address.city}`
      : "dirección desconocida";

    if (result.available) {
      const estimate = result.shippingEstimate === "0d" ? "hoy" : (result.shippingEstimate ?? "—");
      process.stdout.write(
        chalk.green(`✔ Disponible en tu local — ${addrLabel}\n`) +
          chalk.dim(`  Entrega: ${result.slaName} (${estimate})\n`) +
          (result.polygon ? chalk.dim(`  Almacén: ${result.polygon}\n`) : ""),
      );
    } else {
      process.stdout.write(
        chalk.red(`✖ Sin stock en tu local — ${addrLabel}\n`) +
          chalk.dim("  El stock global puede mostrarlo disponible pero no hay en tu local.\n"),
      );
    }
  } catch (e) {
    const msg = e instanceof AppError ? e.message : e instanceof Error ? e.message : String(e);
    process.stderr.write(chalk.red(`✖ ${msg}\n`));
    if (e instanceof AppError && e.isSessionExpired) {
      process.stderr.write(chalk.dim("  Ejecuta: plazavea login\n"));
    }
    process.exit(1);
  }
}

main();
