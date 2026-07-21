import "dotenv/config";
import express from "express";
import { engine } from "express-handlebars";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/database.js";
import productsRouter from "./routes/products.router.js";
import cartsRouter from "./routes/carts.router.js";
import viewsRouter from "./routes/views.router.js";
import { initSocket } from "./sockets/socketManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 8080;

// Conexión a MongoDB: a partir de esta entrega es la persistencia del proyecto
await connectDB();

// Middlewares para leer JSON y datos de formularios, y servir archivos estáticos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

// Motor de plantillas Handlebars, con los helpers que usan las vistas
app.engine(
  "handlebars",
  engine({
    helpers: {
      eq: (a, b) => a === b,
      // Primera imagen del producto; si no tiene, una imagen por defecto
      thumbnail: (thumbnails) =>
        Array.isArray(thumbnails) && thumbnails.length > 0
          ? thumbnails[0]
          : "/img/placeholder.svg",
      multiply: (a, b) => a * b,
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

// 404 para cualquier ruta no contemplada
app.use((req, res) => {
  res.status(404).render("error", {
    title: "Página no encontrada",
    message: `La ruta ${req.originalUrl} no existe.`,
  });
});

// Manejador de errores general
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).render("error", {
    title: "Error del servidor",
    message: error.message,
  });
});

// Se crea el servidor HTTP y sobre él se inicializa el de websockets.
// La instancia de socket.io NO se inyecta en la app de Express ni viaja por
// los middlewares: la administra el módulo socketManager con un patrón
// singleton, y los routers sólo consumen las funciones que ese módulo expone.
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
