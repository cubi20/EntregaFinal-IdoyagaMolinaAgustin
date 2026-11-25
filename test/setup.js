import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

// Configuración común a todos los tests (root hooks de Mocha).
// Por defecto se levanta un MongoDB en memoria, así no hace falta tener una
// base instalada. Para usar otra base, definir MONGO_URI_TEST (OJO: esa base
// se vacía en cada test, tiene que ser una base sólo para pruebas).
process.env.NODE_ENV = "test";

let memoryServer;

export const mochaHooks = {
  async beforeAll() {
    let uri = process.env.MONGO_URI_TEST;

    if (!uri) {
      memoryServer = await MongoMemoryServer.create();
      uri = memoryServer.getUri("entregaFinalTest");
    }

    await mongoose.connect(uri);
  },

  async afterAll() {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (memoryServer) await memoryServer.stop();
  },
};
