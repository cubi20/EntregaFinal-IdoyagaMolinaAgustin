// Errores propios de la aplicación. Cada uno lleva el código HTTP con el que
// se tiene que responder, así los managers no conocen a Express pero los
// routers saben si el problema fue del cliente (400), si el recurso no
// existe (404) o si fue un error inesperado del servidor (500).
export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
  }
}

// 400: los datos enviados no son válidos (id mal formado, campos faltantes, etc.)
export class BadRequestError extends HttpError {
  constructor(message) {
    super(400, message);
  }
}

// 404: el recurso pedido no existe
export class NotFoundError extends HttpError {
  constructor(message) {
    super(404, message);
  }
}
