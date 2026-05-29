import chalk from "chalk";
import { loginWithBrowser } from "../services/auth.js";
import { saveConfig } from "../config.js";
import { AppError } from "../http.js";

async function main() {
  const args = process.argv.slice(2);
  const manualIdx = args.indexOf("--manual");

  // --manual "<header Cookie completo>"
  // Pega el valor de la línea "Cookie:" desde Network tab de DevTools.
  // Formato: "name1=value1; name2=value2; ..."
  if (manualIdx !== -1) {
    const raw = args.slice(manualIdx + 1).join(" ").trim();
    if (!raw) {
      process.stderr.write(chalk.red('Uso: plaza login --manual "name1=val1; name2=val2; ..."\n'));
      process.stderr.write(chalk.dim("  Copia la línea Cookie: del Network tab de DevTools.\n"));
      process.exit(1);
    }

    const cookies = raw
      .split(";")
      .map((pair) => pair.trim())
      .filter((pair) => pair.includes("="))
      .map((pair) => {
        const eq = pair.indexOf("=");
        return {
          name: pair.slice(0, eq).trim(),
          value: pair.slice(eq + 1).trim(),
          domain: ".plazavea.com.pe",
          path: "/",
          secure: true,
        };
      });

    if (cookies.length === 0) {
      process.stderr.write(chalk.red("✖ No se pudo parsear ninguna cookie del texto pegado.\n"));
      process.exit(1);
    }

    saveConfig({ cookies, savedAt: new Date().toISOString() });
    const names = cookies.map((c) => c.name).join(", ");
    process.stderr.write(chalk.green(`✔ ${cookies.length} cookies guardadas: ${names}\n`));

    const hasAuth = cookies.some((c) =>
      ["VtexIdclientAutCookie", "vtex_session"].includes(c.name),
    );
    if (!hasAuth) {
      process.stderr.write(
        chalk.yellow("⚠ No se detectó VtexIdclientAutCookie ni vtex_session. Puede que falte la cookie de login.\n"),
      );
    }
    return;
  }

  // Modo browser (Playwright)
  process.stderr.write(chalk.cyan("Abriendo Plaza Vea en el browser...\n"));
  process.stderr.write(chalk.dim("  Tienes 3 minutos para iniciar sesión.\n\n"));

  try {
    const ok = await loginWithBrowser();
    if (ok) {
      process.stderr.write(chalk.green("✔ Sesión guardada en ~/.config/plazavea/session.json\n"));
    } else {
      process.stderr.write(chalk.red("✖ Timeout: no se detectó login en 3 minutos.\n"));
      process.exit(1);
    }
  } catch (e) {
    const msg = e instanceof AppError ? e.message : String(e);
    process.stderr.write(chalk.red(`✖ ${msg}\n`));
    process.exit(1);
  }
}

main();
