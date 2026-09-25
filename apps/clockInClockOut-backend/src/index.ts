import express from "express";
import { prisma } from "@smartbusiness/database";

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
  });
});

app.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany();

  res.json(users);
});

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});