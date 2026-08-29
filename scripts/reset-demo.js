import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../src/data");

const incidents = [
  {
    incidentId: "INC-1001",
    service: "payment-service",
    severity: "CRITICAL",
    status: "OPEN",
    summary: "Payment failure rate increased significantly",
    errorRate: 18.7,
    startedAt: "2026-08-27T16:45:00Z"
  }
];

const metrics = [
  {
    service: "payment-service",
    timestamp: "2026-08-27T16:40:00Z",
    phase: "PRE_INCIDENT",
    errorRate: 1.9,
    dbTimeoutMs: 5000
  },
  {
    service: "payment-service",
    timestamp: "2026-08-27T16:50:00Z",
    phase: "INCIDENT",
    errorRate: 18.7,
    dbTimeoutMs: 1000
  },
  {
    service: "payment-service",
    timestamp: "2026-08-27T17:05:00Z",
    phase: "POST_ROLLBACK",
    errorRate: 2.1,
    dbTimeoutMs: 5000
  }
];

const deployments = [
  {
    deploymentId: "DEP-1801",
    service: "payment-service",
    version: "v1.8.1",
    deployedAt: "2026-08-20T10:00:00Z",
    status: "ROLLED_BACK",
    changes: [
      "Minor payment logging improvements"
    ]
  },
  {
    deploymentId: "DEP-1802",
    service: "payment-service",
    version: "v1.8.2",
    deployedAt: "2026-08-24T10:00:00Z",
    status: "ROLLED_BACK",
    changes: [
      "Connection pool tuning"
    ]
  },
  {
    deploymentId: "DEP-1803",
    service: "payment-service",
    version: "v1.8.3",
    deployedAt: "2026-08-27T16:40:00Z",
    status: "ACTIVE",
    changes: [
      "Database timeout changed from 5000ms to 1000ms",
      "Payment retry configuration updated"
    ]
  }
];

async function writeJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);

  await fs.writeFile(
    filePath,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
}

async function resetDemo() {
  await writeJson("incidents.json", incidents);
  await writeJson("metrics.json", metrics);
  await writeJson("deployments.json", deployments);

  console.log("Demo state reset successfully.");
  console.log("INC-1001     -> OPEN");
  console.log("DEP-1803     -> ACTIVE");
  console.log("Error rate   -> 18.7%");
  console.log("DB timeout   -> 1000ms");
  console.log("Recovery     -> 2.1% simulated post-rollback metric ready");
}

resetDemo().catch((error) => {
  console.error("Failed to reset demo state:", error);
  process.exit(1);
});