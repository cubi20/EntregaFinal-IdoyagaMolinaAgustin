import mongoose from "mongoose";
import { BadRequestError } from "./errors.js";

// Verifica que el id tenga el formato de un ObjectId de MongoDB (24 caracteres
// hexadecimales). Si no lo tiene, es un error del cliente (400), no un 404.
export const assertValidObjectId = (id, entity) => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new BadRequestError(`"${id}" no es un id de ${entity} válido`);
  }
};

// ¿El valor vino vacío? (no enviado, null o string en blanco)
export const isEmpty = (value) =>
  value === undefined || value === null || String(value).trim() === "";

// Convierte a número un valor que puede venir como number o como string
// (los query params y algunos formularios llegan siempre como texto).
export const toNumber = (value) =>
  typeof value === "string" && value.trim() !== "" ? Number(value) : value;

// Lee un entero mayor o igual a 1. Si no se envió, devuelve el valor por defecto.
export const parsePositiveInteger = (value, name, defaultValue) => {
  if (isEmpty(value)) {
    if (defaultValue === undefined) {
      throw new BadRequestError(`Falta el campo ${name}`);
    }
    return defaultValue;
  }

  const number = toNumber(value);
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) {
    throw new BadRequestError(`${name} debe ser un número entero mayor o igual a 1`);
  }
  return number;
};
