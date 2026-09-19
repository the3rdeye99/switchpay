import { initCommand } from "./commands/init.js";

async function main() {
  const [, , command] = process.argv;

  switch (command) {
    case "init":
      await initCommand();
      break;
    case undefined:
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${command}\n`);
      printHelp();
      process.exitCode = 1;
  }
}

function printHelp(): void {
  console.log(`
switchpay — unified payment SDK for Paystack and Flutterwave

Usage:
  npx switchpay init    Scaffold Switchpay into the current Next.js project
`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
