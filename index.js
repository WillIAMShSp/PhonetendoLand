const Express = require("express");
const app = Express();
const path = require("node:path");

const port = process.env.PORT || 5555;

app.use(Express.static(path.join(__dirname, "public")));

app.listen(port, () => {
  console.log(`listening on port: ${port} `);
});
