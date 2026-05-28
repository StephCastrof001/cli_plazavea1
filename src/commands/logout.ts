import chalk from "chalk";
import { logout } from "../services/auth.js";

async function main() {
  logout();
  process.stderr.write(chalk.green("✔ Sesión eliminada.\n"));
}

main();
