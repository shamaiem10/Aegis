import { createApp } from "./createApp";

const port = Number(process.env.PORT) || 8080;
createApp().listen(port, "0.0.0.0", () => {
  console.log(`pk-resource-inventory-api listening on :${port}`);
});
