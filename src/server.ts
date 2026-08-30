import { createApp } from "./app.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = createApp();

app.listen(port, "0.0.0.0", () => {
  console.log(`Keel is listening on http://0.0.0.0:${port}`);
});
