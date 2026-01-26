// Prisma configuration for SplitChain
import path from "path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: `file:${path.join(__dirname, "prisma/data/splitchain.db")}`,
  },
});
