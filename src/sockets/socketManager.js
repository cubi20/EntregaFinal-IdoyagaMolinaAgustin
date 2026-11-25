import { Server } from "socket.io";
import ProductManager from "../managers/ProductManager.js";

const productManager = new ProductManager();

// Instancia única (singleton) del servidor de websockets.
// Vive acá adentro y NO se inyecta en la app de Express ni viaja por los
// middlewares: de esa forma el resto del proyecto no depende de una variable
// global y sólo consume las funciones que este módulo expone.
let io = null;

// Los mensajes de conexión no se muestran mientras corren los tests
const log = (message) => {
  if (process.env.NODE_ENV !== "test") console.log(message);
};

// Inicializa el servidor de websockets sobre el servidor HTTP ya creado.
export const initSocket = (httpServer) => {
  if (io) return io; // si ya fue inicializado, se reutiliza la misma instancia

  io = new Server(httpServer);

  io.on("connection", async (socket) => {
    log(`Cliente conectado: ${socket.id}`);

    // Alta de un producto desde el formulario de la vista (por websocket)
    socket.on("newProduct", async (productData) => {
      try {
        await productManager.addProduct(productData);
        await emitProductsUpdate();
      } catch (error) {
        socket.emit("errorMessage", error.message);
      }
    });

    // Baja de un producto desde la vista (por websocket)
    socket.on("deleteProduct", async (pid) => {
      try {
        await productManager.deleteProduct(pid);
        await emitProductsUpdate();
      } catch (error) {
        socket.emit("errorMessage", error.message);
      }
    });

    socket.on("disconnect", () => {
      log(`Cliente desconectado: ${socket.id}`);
    });

    // Al conectarse, se le manda la lista actual de productos
    try {
      socket.emit("products", await productManager.getProducts());
    } catch (error) {
      socket.emit("errorMessage", "No se pudo obtener la lista de productos");
    }
  });

  return io;
};

// Acceso controlado a la instancia, por si alguna vez hace falta el objeto io.
export const getIO = () => {
  if (!io) throw new Error("El servidor de websockets no fue inicializado");
  return io;
};

// Única función que necesitan los routers HTTP: emite la lista actualizada de
// productos a todos los clientes. Los routers no tocan `io` directamente.
export const emitProductsUpdate = async () => {
  if (!io) return;
  io.emit("products", await productManager.getProducts());
};
