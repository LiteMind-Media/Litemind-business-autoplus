// Minimal Next.js custom server for WebHostMost panel startup
// Binds only to 127.0.0.1 as required.

const { createServer } = require("http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Allow hosting panel to inject PORT (Node.js selector usually sets it)
const port = parseInt(process.env.PORT || "3000", 10);
// Bind to 0.0.0.0 so reverse proxy / container networking can reach it
const HOST = process.env.HOST || "0.0.0.0";

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res))
      .listen(port, HOST, () => {
        console.log(
          `Next.js app ready (dev=${dev}) listening on ${HOST}:${port} (env PORT=${process.env.PORT || "unset"})`
        );
      })
      .on("error", (e) => {
        console.error("Listen error:", e);
        if (e.code === "EADDRINUSE") {
          console.error(
            `Port ${port} in use. If panel assigns a different port, ensure PORT env var is set to that value.`
          );
        }
        process.exit(1);
      });
  })
  .catch((err) => {
    console.error("Failed to start Next.js server", err);
    process.exit(1);
  });
