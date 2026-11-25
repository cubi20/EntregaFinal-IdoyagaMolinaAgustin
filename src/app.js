import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import { fileURLToPath } from "url";

import productsRouter from "./routes/products.router.js";
import cartsRouter from "./routes/carts.router.js";
import viewsRouter from "./routes/views.router.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorHandler.js";

// Configuración de la app de Express. Este módulo sólo arma la app: la
// conexión a MongoDB y el arranque del servidor están en server.js, así la
// app se puede importar desde los tests sin levantar un servidor real.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Middlewares para leer JSON y datos de formularios, y servir archivos estáticos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// Motor de plantillas Handlebars, con los helpers que usan las vistas
app.engine(
  "handlebars",
  engine({
    helpers: {
      // Primera imagen del producto; si no tiene, una imagen por defecto
      thumbnail: (thumbnails) =>
        Array.isArray(thumbnails) && thumbnails.length > 0
          ? thumbnails[0]
          : "/img/placeholder.svg",
      // Formatea un número como precio en pesos argentinos
      money: (value) =>
        new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          maximumFractionDigits: 2,
        }).format(Number(value) || 0),
    },
  })
);
app.set("view engine", "handlebars");
app.set("views", path.join(__dirname, "views"));

// Rutas de la API REST
app.use("/api/products", productsRouter);
app.use("/api/carts", cartsRouter);

// Rutas de vistas (catálogo, detalle, carrito y tiempo real)
app.use("/", viewsRouter);

// 404 para cualquier ruta no contemplada y manejo centralizado de errores:
// la API responde JSON con { status: "error", message } y las vistas, una página.
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
