import chalk from "chalk";

// Forzar colores ANSI en non-TTY (Claude Code Bash tool)
process.env.FORCE_COLOR = "1";

const pvRed = chalk.hex("#E30613"); // rojo de marca Plaza Vea
const dim = chalk.dim;

const ASCII = `
${pvRed("  ██████╗ ██╗      █████╗ ███████╗ █████╗     ██╗   ██╗███████╗ █████╗")}
${pvRed("  ██╔══██╗██║     ██╔══██╗╚══███╔╝██╔══██╗    ██║   ██║██╔════╝██╔══██╗")}
${pvRed("  ██████╔╝██║     ███████║  ███╔╝ ███████║    ██║   ██║█████╗  ███████║")}
${pvRed("  ██╔═══╝ ██║     ██╔══██║ ███╔╝  ██╔══██║    ╚██╗ ██╔╝██╔══╝  ██╔══██║")}
${pvRed("  ██║     ███████╗██║  ██║███████╗██║  ██║     ╚████╔╝ ███████╗██║  ██║")}
${pvRed("  ╚═╝     ╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝      ╚═══╝  ╚══════╝╚═╝  ╚═╝")}`;

// Banner síncrono — sin async, line count predecible (patrón rappi/antigravity)
export function printBanner(version?: string) {
  console.log(ASCII);
  if (version) {
    console.log(`\n  ${dim(`v${version}  ·  Servidor MCP para retail VTEX — Plaza Vea`)}`);
  }
  console.log();
}

// Dashboard de estado — async, solo cuando el usuario quiere el status
export async function showStatus() {
  const { getConfig, configAgeLabel } = await import("../config.js");
  const { getCart } = await import("../services/cart.js");
  const { trackList } = await import("../services/tracker.js");

  const loggedIn = getConfig().cookies.length > 0;

  if (!loggedIn) {
    console.log(`  ${chalk.red("Sesión:")}  ✗ Inactiva ${dim("(usa: plaza login)")}\n`);
    return;
  }

  console.log(
    `  ${chalk.white.bold("Sesión:")}  ${chalk.green("✓ Activa")} ${dim(`(${configAgeLabel()})`)}`,
  );

  try {
    const cart = await getCart();
    const items = cart.items.length;
    console.log(
      `  ${chalk.white.bold("Carrito:")} ${chalk.cyan(`${items} ítems`)} ${dim(`(S/${cart.totalValue.toFixed(2)})`)}`,
    );
  } catch {
    console.log(`  ${chalk.white.bold("Carrito:")} ${chalk.red("error al cargar")}`);
  }

  const tracked = trackList();
  const alerts = tracked.filter(
    (t) =>
      t.alert !== undefined &&
      (t.history[t.history.length - 1]?.price ?? Number.POSITIVE_INFINITY) <= t.alert,
  ).length;
  const badge = alerts > 0 ? chalk.bgYellow.black(` ${alerts} alertas `) : dim("todo ok");
  console.log(
    `  ${chalk.white.bold("Radar:")}   ${chalk.cyan(`${tracked.length} productos`)} — ${badge}\n`,
  );
}
