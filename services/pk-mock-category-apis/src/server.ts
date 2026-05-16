import { createApp } from "./createApp";

const PORT = Number(process.env.PORT) || 8080;

const app = createApp();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`pk-mock-category-apis listening on 0.0.0.0:${PORT}`);
});
