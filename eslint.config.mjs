import nextPlugin from "eslint-config-next";

const config = [
  ...nextPlugin,
  {
    ignores: [".next/**", "node_modules/**", "prisma/migrations/**"]
  }
];

export default config;
