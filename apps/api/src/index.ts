import { createServer } from "node:http";

const port = Number(process.env.API_PORT ?? 3000);

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ name: "law-analyzer-api", status: "ok" }));
});

server.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
