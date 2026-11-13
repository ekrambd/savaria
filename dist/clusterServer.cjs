var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/server/clusterServer.ts
var import_node_cluster = __toESM(require("node:cluster"), 1);
var import_node_os = __toESM(require("node:os"), 1);
var import_node_path = __toESM(require("node:path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config({ path: ".env.local" });
var numCPUs = process.env.WORKER_COUNT ? parseInt(process.env.WORKER_COUNT, 10) : Math.min(import_node_os.default.cpus().length, 4);
if (import_node_cluster.default.isPrimary || import_node_cluster.default.isMaster) {
  console.log("====================================================");
  console.log("\u{1F680} NOOR ENTERPRISE MULTI-SERVER CLUSTER MANAGER");
  console.log(`\u26A1 Primary PID ${process.pid} is online`);
  console.log(`\u26A1 Forking ${numCPUs} worker processes (Detected ${import_node_os.default.cpus().length} CPU cores)...`);
  console.log("====================================================\n");
  const workers = [];
  for (let i = 0; i < numCPUs; i++) {
    const worker = import_node_cluster.default.fork({ WORKER_ID: `${i + 1}` });
    workers.push(worker);
  }
  import_node_cluster.default.on("online", (worker) => {
    console.log(`[Cluster] Worker #${worker.process.pid} is online & ready to serve traffic`);
  });
  import_node_cluster.default.on("exit", (worker, code, signal) => {
    console.warn(`[Cluster] \u26A0\uFE0F Worker #${worker.process.pid} died (code: ${code}, signal: ${signal}). Auto-healing and respawning new worker...`);
    const newWorker = import_node_cluster.default.fork();
    workers.push(newWorker);
  });
  const shutdown = () => {
    console.log("\n[Cluster] Graceful shutdown initiated. Terminating workers...");
    for (const worker of Object.values(import_node_cluster.default.workers || {})) {
      if (worker) {
        worker.kill("SIGTERM");
      }
    }
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
} else {
  const serverPath = import_node_path.default.join(process.cwd(), "dist/server.cjs");
  import(serverPath).catch(() => {
    import(import_node_path.default.join(process.cwd(), "server.ts")).catch((err) => {
      console.error("[Worker] Failed to start server instance:", err);
    });
  });
}
//# sourceMappingURL=clusterServer.cjs.map
