import mongoose from "mongoose";
import { HttpError } from "../utils/errors.js";

// Las rutas de la API responden siempre JSON; las de vistas, una página HTML.
const isApiRequest = (req) => req.originalUrl.startsWith("/api");

const TITLES = {
  400: "Solicitud inválida",
  404: "No encontrado",
  500: "Error del servidor",
};

// Traduce cualquier error a un código HTTP y un mensaje claro para el cliente.
const normalizeError = (error) => {
  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, message: error.message };
  }

  // Validaciones del schema de Mongoose (campos obligatorios, mínimos, etc.)
  if (error instanceof mongoose.Error.ValidationError) {
    const message = Object.values(error.errors)
      .map((detail) => detail.message)
      .join(". ");
    return { statusCode: 400, message };
  }

  // Un valor que no se puede convertir al tipo del schema (ej: price: "abc")
  if (error instanceof mongoose.Error.CastError) {
    return {
      statusCode: 400,
      message: `El valor "${error.value}" no es válido para el campo ${error.path}`,
    };
  }

  // Índice único duplicado (ej: dos productos con el mismo code)
  if (error?.code === 11000) {
    const [field, value] = Object.entries(error.keyValue ?? {})[0] ?? [];
    return {
      statusCode: 400,
      message: field
        ? `Ya existe un registro con ${field} = ${value}`
        : "Ya existe un registro con ese valor",
    };
  }

  // Body con JSON mal formado (lo detecta express.json())
  if (error?.type === "entity.parse.failed") {
    return { statusCode: 400, message: "El body de la petición no es un JSON válido" };
  }

  return { statusCode: 500, message: "Error interno del servidor" };
};

// Responde 404 para cualquier ruta que no exista
export const notFoundHandler = (req, res) => {
  const message = `La ruta ${req.method} ${req.originalUrl} no existe`;

  if (isApiRequest(req)) {
    return res.status(404).json({ status: "error", message });
  }
  res.status(404).render("error", { title: "Página no encontrada", message });
};

// Manejador de errores general: todos los routers le pasan el error con next(error)
// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, next) => {
  const { statusCode, message } = normalizeError(error);

  // Sólo los errores inesperados se registran completos en la consola
  if (statusCode === 500) console.error(error);

  if (isApiRequest(req)) {
    return res.status(statusCode).json({ status: "error", message });
  }
  res.status(statusCode).render("error", { title: TITLES[statusCode], message });
};
