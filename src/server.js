import "dotenv/config";
import { createServer } from "http";

import app from "./app.js";
import connectDB from "./config/database.js";
import { initSocket } from "./sockets/socketManager.js";

const PORT = process.env.PORT || 8080;

// Conexión a MongoDB: a partir de esta entrega es la persistencia del proyecto
await connectDB();

// Se crea el servidor HTTP y sobre él se inicializa el de websockets.
// La instancia de socket.io NO se inyecta en la app de Express ni viaja por
// los middlewares: la administra el módulo socketManager con un patrón
// singleton, y los routers sólo consumen las funciones que ese módulo expone.
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
