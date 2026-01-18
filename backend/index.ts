import { startWebServer } from "./server";

const PORT = parseInt(process.env.PORT || "4174", 10);
const HOST = process.env.HOST || "0.0.0.0";

console.log(`Starting web-terminal server on http://${HOST}:${PORT}`);
await startWebServer(HOST, PORT);
