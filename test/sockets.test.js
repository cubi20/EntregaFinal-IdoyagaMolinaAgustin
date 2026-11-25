import { expect } from "chai";
import { createServer } from "http";
import request from "supertest";
import { io as connectClient } from "socket.io-client";
import app from "../src/app.js";
import { initSocket, getIO } from "../src/sockets/socketManager.js";
import { createSampleProducts, resetDatabase } from "./helpers.js";

// Espera el próximo evento que emita el servidor
const nextEvent = (socket, event) =>
  new Promise((resolve) => socket.once(event, resolve));

describe("Websockets (/realtimeproducts)", () => {
  let httpServer;
  let baseUrl;
  let client;

  before((done) => {
    httpServer = createServer(app);
    initSocket(httpServer);
    httpServer.listen(0, () => {
      baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
      done();
    });
  });

  after((done) => {
    getIO().close(() => done());
  });

  beforeEach(async () => {
    await resetDatabase();
    await createSampleProducts();

    // Cada test conecta un cliente nuevo y recibe la lista inicial
    client = connectClient(baseUrl, { transports: ["websocket"], forceNew: true });
    const initialList = await nextEvent(client, "products");
    expect(initialList).to.have.lengthOf(12);
  });

  afterEach(() => client.disconnect());

  it("newProduct crea el producto y emite la lista actualizada", async () => {
    const update = nextEvent(client, "products");
    client.emit("newProduct", {
      title: "Producto en vivo",
      description: "Creado por websocket",
      code: "WS-1",
      price: 1000,
      stock: 1,
      category: "varios",
    });

    const list = await update;
    expect(list).to.have.lengthOf(13);
    expect(list.map((p) => p.title)).to.include("Producto en vivo");
  });

  it("deleteProduct elimina el producto y emite la lista actualizada", async () => {
    const [first] = (await request(app).get("/api/products?limit=1")).body.payload;

    const update = nextEvent(client, "products");
    client.emit("deleteProduct", first._id);

    const list = await update;
    expect(list).to.have.lengthOf(11);
    expect(list.map((p) => p._id)).not.to.include(first._id);
  });

  it("informa con errorMessage si el producto enviado no es válido", async () => {
    const error = nextEvent(client, "errorMessage");
    client.emit("newProduct", { title: "Incompleto" });

    expect(await error).to.include("Faltan campos obligatorios");
  });

  it("un alta hecha por la API HTTP también actualiza a los clientes conectados", async () => {
    const update = nextEvent(client, "products");
    await request(baseUrl).post("/api/products").send({
      title: "Alta por HTTP",
      description: "Creado con POST /api/products",
      code: "HTTP-1",
      price: 500,
      stock: 2,
      category: "varios",
    });

    const list = await update;
    expect(list.map((p) => p.title)).to.include("Alta por HTTP");
  });
});
