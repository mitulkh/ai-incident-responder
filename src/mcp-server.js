import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import * as z from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "data");
const PORT = 3001;

const app = express();

app.use(cors());
app.use(express.json());

async function loadJson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function saveJson(filename, data) {
  const filePath = path.join(DATA_DIR, filename);

  await fs.writeFile(
    filePath,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );
}

function createMcpServer() {
  const server = new McpServer({
    name: "incident-responder-tools",
    version: "1.0.0",
  });

  server.registerTool(
    "get_active_incidents",
    {
      title: "Get Active Incidents",
      description:
        "Returns currently open production incidents requiring investigation.",
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async () => {
      const incidents = await loadJson("incidents.json");

      const activeIncidents = incidents.filter(
        (incident) => incident.status === "OPEN"
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(activeIncidents, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_service_metrics",
    {
      title: "Get Service Metrics",
      description:
        "Returns recent production metrics for a specified service, including error rate and database timeout.",
      inputSchema: z.object({
        service: z
          .string()
          .describe("Name of the service to inspect."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async ({ service }) => {
      const metrics = await loadJson("metrics.json");

      const serviceMetrics = metrics.filter(
  (metric) =>
    metric.service === service &&
    metric.phase !== "POST_ROLLBACK"
);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(serviceMetrics, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_recent_deployments",
    {
      title: "Get Recent Deployments",
      description:
        "Returns recent deployments for a specified service.",
      inputSchema: z.object({
        service: z
          .string()
          .describe("Name of the service to inspect."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async ({ service }) => {
      const deployments = await loadJson("deployments.json");

      const serviceDeployments = deployments.filter(
        (deployment) => deployment.service === service
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(serviceDeployments, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_deployment_details",
    {
      title: "Get Deployment Details",
      description:
        "Returns detailed information about a specific deployment.",
      inputSchema: z.object({
        deploymentId: z
          .string()
          .describe("Deployment ID to inspect."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async ({ deploymentId }) => {
      const deployments = await loadJson("deployments.json");

      const deployment = deployments.find(
        (item) => item.deploymentId === deploymentId
      );

      if (!deployment) {
        return {
          content: [
            {
              type: "text",
              text: `Deployment ${deploymentId} was not found.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(deployment, null, 2),
          },
        ],
      };
    }
  );

  server.registerTool(
    "get_incident_diagnostic_data",
    {
      title: "Get Incident Diagnostic Data",
      description:
        "Returns the incident, metrics, and deployment data required to perform a production incident diagnostic in a sandbox.",
      inputSchema: z.object({
        incidentId: z
          .string()
          .describe("Incident ID to analyze."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async ({ incidentId }) => {
      const incidents = await loadJson("incidents.json");
      const metrics = await loadJson("metrics.json");
      const deployments = await loadJson("deployments.json");

      const incident = incidents.find(
        (item) => item.incidentId === incidentId
      );

      if (!incident) {
        return {
          content: [
            {
              type: "text",
              text: `Incident ${incidentId} was not found.`,
            },
          ],
          isError: true,
        };
      }

      const serviceMetrics = metrics.filter(
  (item) =>
    item.service === incident.service &&
    item.phase !== "POST_ROLLBACK"
);

      const serviceDeployments = deployments.filter(
        (item) => item.service === incident.service
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                incident,
                metrics: serviceMetrics,
                deployments: serviceDeployments,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "rollback_deployment",
    {
      title: "Rollback Deployment",
      description:
        "Rolls back an active production deployment. This is a destructive remediation action and requires explicit user approval.",
      inputSchema: z.object({
        deploymentId: z
          .string()
          .describe("Deployment ID to roll back."),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
      },
    },
    async ({ deploymentId }) => {
      const deployments = await loadJson("deployments.json");

      const deployment = deployments.find(
        (item) => item.deploymentId === deploymentId
      );

      if (!deployment) {
        return {
          content: [
            {
              type: "text",
              text: `Deployment ${deploymentId} was not found.`,
            },
          ],
          isError: true,
        };
      }

      if (deployment.status !== "ACTIVE") {
        return {
          content: [
            {
              type: "text",
              text: `Deployment ${deploymentId} cannot be rolled back because its current status is ${deployment.status}.`,
            },
          ],
          isError: true,
        };
      }

      deployment.status = "ROLLED_BACK";
      deployment.rolledBackAt = new Date().toISOString();

      await saveJson("deployments.json", deployments);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                action: "ROLLBACK",
                deploymentId: deployment.deploymentId,
                service: deployment.service,
                version: deployment.version,
                status: deployment.status,
                rolledBackAt: deployment.rolledBackAt,
                message:
                  `Deployment ${deployment.deploymentId} was successfully rolled back.`,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "verify_recovery",
    {
      title: "Verify Service Recovery",
      description:
        "Checks whether a service has recovered after remediation by examining deployment state and simulated post-remediation production metrics.",
      inputSchema: z.object({
        service: z
          .string()
          .describe("Service whose recovery should be verified."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },
    async ({ service }) => {
      const incidents = await loadJson("incidents.json");
      const metrics = await loadJson("metrics.json");
      const deployments = await loadJson("deployments.json");

      const incident = incidents.find(
        (item) =>
          item.service === service &&
          item.status === "OPEN"
      );

      const serviceDeployments = deployments.filter(
        (item) => item.service === service
      );

      const latestDeployment = [...serviceDeployments].sort(
        (a, b) =>
          new Date(b.deployedAt).getTime() -
          new Date(a.deployedAt).getTime()
      )[0];

      if (!latestDeployment) {
        return {
          content: [
            {
              type: "text",
              text: `No deployments were found for service ${service}.`,
            },
          ],
          isError: true,
        };
      }

      const rollbackCompleted =
        latestDeployment.status === "ROLLED_BACK";

      if (!rollbackCompleted) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  service,
                  recovered: false,
                  deploymentId: latestDeployment.deploymentId,
                  deploymentStatus: latestDeployment.status,
                  message:
                    "Recovery cannot be confirmed because the latest deployment has not been rolled back.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const recoveryMetric = metrics.find(
        (item) =>
          item.service === service &&
          item.phase === "POST_ROLLBACK"
      );

      if (!recoveryMetric) {
        return {
          content: [
            {
              type: "text",
              text: `No post-rollback recovery metric was found for service ${service}.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
  service,
  recovered: true,
  incidentId: incident?.incidentId ?? null,
  incidentStatus: incident?.status ?? null,
  mitigationStatus: "MITIGATED",
  rolledBackDeployment:
    latestDeployment.deploymentId,
  deploymentStatus:
    latestDeployment.status,
  postRollbackMetrics:
    recoveryMetric,
  comparison: {
    incidentErrorRate:
      incident?.errorRate ?? null,
    recoveredErrorRate:
      recoveryMetric.errorRate,
    dbTimeoutMs:
      recoveryMetric.dbTimeoutMs,
  },
  message:
    "Service recovery is confirmed and the incident is mitigated. The incident record remains OPEN until it is explicitly resolved.",
},
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "incident-responder-mcp",
  });
});

app.post("/mcp", async (req, res) => {
  try {
    const server = createMcpServer();

    const transport =
      new NodeStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

    res.on("close", () => {
      transport.close().catch(() => {});
    });

    await server.connect(transport);
    await transport.handleRequest(
      req,
      res,
      req.body
    );
  } catch (error) {
    console.error("MCP request failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(
    `Incident MCP server listening on http://127.0.0.1:${PORT}/mcp`
  );
});