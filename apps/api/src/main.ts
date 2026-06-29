import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app/app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true
  });

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "127.0.0.1");
}

void bootstrap();
