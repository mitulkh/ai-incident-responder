# AI Production Incident Responder

> An autonomous production incident response agent built with **TrueForge**, **Model Context Protocol (MCP)**, sandbox-based diagnostics, and human-approved remediation.

Built for **The Agent Harness Hackathon by TrueFoundry / WeMakeDevs**.

---

## Problem

Production incidents are expensive and stressful.

When an alert fires, an engineer often has to manually:

1. identify the affected service,
2. inspect production metrics,
3. correlate recent deployments,
4. analyze configuration changes,
5. determine a likely root cause,
6. decide whether remediation is safe,
7. execute the remediation,
8. verify that the service actually recovered.

This process can consume valuable incident-response time.

**AI Production Incident Responder** demonstrates how an agent can automate the investigation while keeping dangerous production actions under explicit human control.

---

## What the Agent Does

Given a production incident such as:

```text
INC-1001
Payment failure rate increased significantly
Service: payment-service
Severity: CRITICAL
Error rate: 18.7%

the TrueForge agent can autonomously:

retrieve incident information through MCP,
inspect production service metrics,
inspect recent deployments,
identify the deployment most closely correlated with the incident,
use an actual sandbox to perform independent diagnostic calculations,
form an evidence-based root-cause hypothesis,
recommend a remediation,
pause for explicit human approval,
execute rollback only after approval,
verify service recovery using post-remediation metrics.
Demo Scenario

The included deterministic simulation represents a payment-service production incident.

Before the incident
Error rate:       1.9%
Database timeout: 5000 ms
Deployment
DEP-1803
Version: v1.8.3
Deployment time: 16:40 UTC

Changes:
- Database timeout changed from 5000 ms to 1000 ms
- Payment retry configuration updated
Incident
Incident start:   16:45 UTC
Error rate:       18.7%
Database timeout: 1000 ms

The deployment occurred only 5 minutes before the incident.

The sandbox calculates:

Pre-incident error rate:          1.9%
Incident error rate:             18.7%
Absolute increase:               16.8 percentage points
Relative increase:               884.21%
Database timeout reduction:      4000 ms
Deployment-to-incident interval: 5 minutes

The agent therefore identifies DEP-1803 as the most likely root cause with high confidence.

Human-in-the-Loop Safety

Rollback is intentionally exposed as a destructive MCP tool:

rollback_deployment
readOnlyHint: false
destructiveHint: true

The agent is instructed not to execute destructive remediation without explicit user approval.

The workflow stops at:

Investigation complete
        |
        v
Rollback recommended
        |
        v
HUMAN APPROVAL REQUIRED
        |
     +--+--+
     |     |
   Reject Approve
     |     |
     |     v
     |   rollback_deployment
     |     |
     |     v
     |   verify_recovery
     |
     v
No destructive action

A rejected action must not trigger rollback.

Architecture
Why TrueForge

This project uses TrueForge as the agent harness rather than treating the LLM as a standalone chatbot.

TrueForge coordinates:

MCP-connected tools,
tool execution,
sandbox execution,
multi-step investigation,
human approval before remediation,
agent reasoning across the incident lifecycle.

The agent performs actions instead of merely suggesting what an engineer could do next.

MCP Server

The project exposes a real MCP endpoint:

http://127.0.0.1:3001/mcp

Health endpoint:

http://127.0.0.1:3001/health

Transport:

Streamable HTTP

The server uses the official Model Context Protocol SDK.

MCP Tools
1. get_active_incidents

Returns currently open production incidents.

Read-only: Yes
Destructive: No
2. get_service_metrics

Returns current investigation metrics for a service.

During investigation it intentionally exposes only:

PRE_INCIDENT
INCIDENT

Future post-remediation data is not exposed to the investigation agent.

3. get_recent_deployments

Returns deployment history for the affected service.

Read-only: Yes
Destructive: No
4. get_deployment_details

Returns configuration changes associated with a deployment.

Read-only: Yes
Destructive: No
5. get_incident_diagnostic_data

Returns incident, metrics, and deployment evidence required for independent sandbox diagnostics.

Read-only: Yes
Destructive: No
6. rollback_deployment

Performs the simulated production rollback.

Read-only: No
Destructive: Yes
Human approval required

It changes the deployment from:

ACTIVE

to:

ROLLED_BACK

and persists a rolledBackAt timestamp.

7. verify_recovery

Verifies service recovery only after rollback has completed.

Before rollback:

{
  "recovered": false,
  "deploymentStatus": "ACTIVE"
}

After approved rollback:

{
  "recovered": true,
  "deploymentStatus": "ROLLED_BACK",
  "mitigationStatus": "MITIGATED"
}

No Future-Evidence Leakage

The simulation contains a deterministic post-rollback metric so the demo is repeatable.

However, investigation tools intentionally hide:

POST_ROLLBACK

until remediation has occurred.

This prevents the agent from using future recovery evidence to justify a rollback decision.

verify_recovery is the only workflow that consumes the simulated post-remediation metric after confirming that the deployment has been rolled back.

Service Recovery vs Incident Resolution

The project intentionally distinguishes:

Service recovered  !=  Incident formally resolved

After rollback, the service can be marked:

MITIGATED

while INC-1001 remains:

OPEN

until a separate incident-management action explicitly resolves it.

This avoids silently changing incident lifecycle state simply because infrastructure metrics recovered.

Sandbox Diagnostics

The root-cause analysis is not based only on LLM reasoning.

TrueForge executes diagnostic code inside an actual sandbox.

The sandbox independently calculates:

pre-incident error rate,
incident error rate,
absolute error-rate increase,
relative error-rate increase,
database timeout before the incident,
database timeout during the incident,
timeout reduction,
closest deployment,
exact deployment-to-incident time difference.

Example result:

1.9% -> 18.7%

Absolute increase:
16.8 percentage points

Relative increase:
884.21%

Timeout:
5000 ms -> 1000 ms

Deployment correlation:
DEP-1803 -> incident starts 5 minutes later

This gives the agent evidence independent of free-form language-model reasoning.

End-to-End Agent Flow
Production incident
        |
        v
TrueForge Agent
        |
        v
MCP incident data
        |
        v
Metrics + deployments
        |
        v
Actual sandbox diagnostics
        |
        v
Evidence-based RCA
        |
        v
DEP-1803 identified
        |
        v
Human approval checkpoint
        |
        v
Approved rollback
        |
        v
rollback_deployment
        |
        v
verify_recovery
        |
        v
18.7% -> 2.1%
        |
        v
Service mitigated
Recovery Verification

After approved rollback, the deterministic recovery simulation reports:

Error rate:
18.7% -> 2.1%

Database timeout:
1000 ms -> 5000 ms

Deployment:
DEP-1803 ACTIVE -> ROLLED_BACK

The agent does not assume that rollback worked.

It explicitly calls:

verify_recovery

before reporting mitigation.

Project Structure
ai-incident-responder/
|
|-- README.md
|-- package.json
|-- package-lock.json
|
|-- scripts/
|   `-- reset-demo.js
|
`-- src/
    |-- mcp-server.js
    |
    `-- data/
        |-- incidents.json
        |-- metrics.json
        `-- deployments.json
Tech Stack
Node.js
JavaScript
Express
Zod
Model Context Protocol SDK
TrueForge
TrueForge Sandbox
Streamable HTTP MCP transport
GitHub
Qodo Merge
Local Setup
Requirements
Node.js 22+
npm
WSL2/Linux recommended for TrueForge local sandbox execution
TrueForge
Git

Clone the repository:

git clone https://github.com/mitulkh/ai-incident-responder.git

cd ai-incident-responder

Install dependencies:

npm install
Reset the Demo

Before every demonstration:

node scripts/reset-demo.js

Expected state:

Demo state reset successfully.
INC-1001     -> OPEN
DEP-1803     -> ACTIVE
Error rate   -> 18.7%
DB timeout   -> 1000ms
Recovery     -> 2.1% simulated post-rollback metric ready

This ensures the demo starts from the same deterministic state each time.

Start the MCP Server
node src/mcp-server.js

Expected:

Incident MCP server listening on http://127.0.0.1:3001/mcp

Verify health:

curl http://127.0.0.1:3001/health

Expected:

{
  "status": "ok",
  "service": "incident-responder-mcp"
}
Connect TrueForge

Configure the MCP connector in TrueForge:

Name:
incident-responder-mcp

URL:
http://127.0.0.1:3001/mcp

Authentication:
None

TrueForge should discover the MCP tools automatically.

Example Agent Prompt
Investigate production incident INC-1001 completely and safely
mitigate it if the evidence supports rollback.

Use the available MCP tools to retrieve production evidence.

Use the actual sandbox to independently analyze:
- pre-incident error rate
- incident error rate
- relative error increase
- timeout change
- deployment closest to the incident
- exact deployment-to-incident time difference

Determine the likely root cause.

If rollback is recommended:
- ask for explicit human approval
- do not infer or simulate approval
- do not execute rollback if approval is rejected
- do not claim rollback occurred unless the MCP tool executes

After approved remediation:
- call verify_recovery
- report whether the service recovered
Safety Properties

The implementation demonstrates several safety boundaries:

Investigation tools are read-only.
Destructive actions are explicitly annotated.
Rollback requires human approval.
Recovery is verified independently.
Recovery cannot be claimed while the implicated deployment remains active.
Future recovery metrics are hidden from investigation tools.
Service mitigation does not automatically resolve the incident record.
Demo state can be reset deterministically.
Failure-Safe Recovery Check
- Rollback is rejected unless the affected service has an OPEN incident.

Calling verify_recovery before rollback produces:

{
  "service": "payment-service",
  "recovered": false,
  "deploymentId": "DEP-1803",
  "deploymentStatus": "ACTIVE",
  "message": "Recovery cannot be confirmed because the latest deployment has not been rolled back."
}

This prevents false recovery claims.

Qodo Code Review Evidence

Qodo is installed on this GitHub repository and is used to review the submission-hardening pull request.

Representative PR:

PR LINK WILL BE ADDED AFTER QODO REVIEW

Any valid Qodo findings identified during the review will be addressed before merge. The final submission will include the public pull-request link and a short explanation of the review outcome.

Current Scope

This hackathon version uses deterministic JSON-backed production data so that the entire incident lifecycle can be demonstrated reliably.

The architecture is designed so that these simulated sources can later be replaced by real production integrations such as:

Grafana / Prometheus
Kubernetes
deployment platforms
PagerDuty
incident-management systems
centralized logging platforms

without changing the high-level agent workflow.

Future Improvements

Potential production extensions include:

live Grafana / Prometheus metric queries,
Kubernetes rollout inspection,
log correlation,
multiple incident types,
restart and rollback policies,
richer remediation approval policies,
incident timeline persistence,
automated postmortem generation,
Slack / PagerDuty notifications,
multi-agent incident investigation.
Hackathon Goal

The goal is not to build another observability chatbot.

The goal is to demonstrate an agent harness for production incident response where AI can investigate autonomously, perform real diagnostic computation, and execute production actions while preserving a clear human safety boundary.

AI investigates.
Sandbox verifies.
Human decides.
MCP executes.
Agent confirms recovery.
