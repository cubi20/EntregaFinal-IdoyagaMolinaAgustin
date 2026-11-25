import { expect } from "chai";
import mongoose from "mongoose";
import request from "supertest";
import app from "../src/app.js";
import CartModel from "../src/models/cart.model.js";
import { createSampleProducts, createCart, resetDatabase } from "./helpers.js";

const NONEXISTENT_ID = "6553a1b2c3d4e5f6a7b8c9d0";

// Resume las líneas de un carrito como { título: cantidad }
const summary = (lines) =>
  Object.fromEntries(lines.map((line) => [line.product.title, line.quantity]));

describe("API de carritos (/api/carts)", () => {
  let products;
  let notebook;
  let monitor;
  let mouse;

  beforeEach(async () => {
    await resetDatabase();
    products = await createSampleProducts();
    [notebook, monitor, mouse] = [products[0], products[4], products[9]];
  });

  it("POST / crea un carrito con id autogenerado y sin productos", async () => {
    const res = await request(app).post("/api/carts");

    expect(res.status).to.equal(201);
    expect(res.body.payload._id).to.be.a("string");
    expect(res.body.payload.products).to.deep.equal([]);
  });

  it("POST /:cid/products/:pid agrega el producto y, si ya estaba, suma la cantidad", async () => {
    const cart = await createCart();
    const url = `/api/carts/${cart._id}/products/${notebook._id}`;

    await request(app).post(url);
    const res = await request(app).post(url).send({ quantity: 2 });

    expect(res.status).to.equal(200);
    expect(res.body.payload.products).to.have.lengthOf(1);
    expect(summary(res.body.payload.products)).to.deep.equal({ "Notebook A": 3 });
  });

  it("GET /:cid trae los productos completos con populate, guardando sólo el id en la base", async () => {
    const cart = await createCart([{ product: notebook._id, quantity: 2 }]);

    const res = await request(app).get(`/api/carts/${cart._id}`);

    // Respuesta: el producto viene desglosado con toda su información
    expect(res.status).to.equal(200);
    expect(res.body.payload).to.have.lengthOf(1);
    expect(res.body.payload[0].quantity).to.equal(2);
    expect(res.body.payload[0].product).to.include({
      _id: String(notebook._id),
      title: "Notebook A",
      description: "Notebook de prueba A",
      price: 900000,
      category: "notebooks",
    });

    // Base de datos: en el array products sólo está la referencia (ObjectId)
    const stored = await CartModel.findById(cart._id).lean();
    expect(stored.products[0].product).to.be.instanceOf(mongoose.Types.ObjectId);
    expect(Object.keys(stored.products[0]).sort()).to.deep.equal(["product", "quantity"]);
  });

  it("DELETE /:cid/products/:pid elimina del carrito sólo el producto seleccionado", async () => {
    const cart = await createCart([
      { product: notebook._id, quantity: 1 },
      { product: monitor._id, quantity: 3 },
    ]);

    const res = await request(app).delete(`/api/carts/${cart._id}/products/${notebook._id}`);

    expect(res.status).to.equal(200);
    expect(summary(res.body.payload.products)).to.deep.equal({ "Monitor A": 3 });
  });

  it("PUT /:cid actualiza todos los productos del carrito con un arreglo de productos", async () => {
    const cart = await createCart([{ product: notebook._id, quantity: 5 }]);

    const res = await request(app)
      .put(`/api/carts/${cart._id}`)
      .send({
        products: [
          { product: String(monitor._id), quantity: 2 },
          { product: String(mouse._id), quantity: 1 },
        ],
      });

    expect(res.status).to.equal(200);
    expect(summary(res.body.payload.products)).to.deep.equal({ "Monitor A": 2, Mouse: 1 });
  });

  it("PUT /:cid también acepta el arreglo directo en el body", async () => {
    const cart = await createCart();

    const res = await request(app)
      .put(`/api/carts/${cart._id}`)
      .send([{ product: String(mouse._id), quantity: 4 }]);

    expect(res.status).to.equal(200);
    expect(summary(res.body.payload.products)).to.deep.equal({ Mouse: 4 });
  });

  it("PUT /:cid/products/:pid actualiza SÓLO la cantidad, con la cantidad de req.body", async () => {
    const cart = await createCart([
      { product: notebook._id, quantity: 1 },
      { product: monitor._id, quantity: 3 },
    ]);

    const res = await request(app)
      .put(`/api/carts/${cart._id}/products/${notebook._id}`)
      .send({ quantity: 7 });

    expect(res.status).to.equal(200);
    expect(summary(res.body.payload.products)).to.deep.equal({ "Notebook A": 7, "Monitor A": 3 });

    // El producto en sí no se modifica
    const product = await request(app).get(`/api/products/${notebook._id}`);
    expect(product.body.payload).to.include({ price: 900000, stock: 5 });
  });

  it("DELETE /:cid elimina todos los productos del carrito (el carrito sigue existiendo)", async () => {
    const cart = await createCart([
      { product: notebook._id, quantity: 1 },
      { product: monitor._id, quantity: 3 },
    ]);

    const res = await request(app).delete(`/api/carts/${cart._id}`);
    expect(res.status).to.equal(200);
    expect(res.body.payload.products).to.deep.equal([]);

    const after = await request(app).get(`/api/carts/${cart._id}`);
    expect(after.status).to.equal(200);
    expect(after.body.payload).to.deep.equal([]);
  });

  it("responde 404 si el carrito o el producto no existen, y 400 si el id no es válido", async () => {
    const cart = await createCart();

    const cases = [
      [request(app).get(`/api/carts/${NONEXISTENT_ID}`), 404],
      [request(app).get("/api/carts/123"), 400],
      [request(app).post(`/api/carts/${cart._id}/products/${NONEXISTENT_ID}`), 404],
      [request(app).delete(`/api/carts/${cart._id}/products/${notebook._id}`), 404],
      [request(app).delete(`/api/carts/${NONEXISTENT_ID}`), 404],
    ];

    for (const [pending, statusCode] of cases) {
      const res = await pending;
      expect(res.status).to.equal(statusCode);
      expect(res.body.status).to.equal("error");
    }
  });

  it("valida la cantidad: tiene que ser un entero mayor o igual a 1", async () => {
    const cart = await createCart([{ product: notebook._id, quantity: 1 }]);
    const url = `/api/carts/${cart._id}/products/${notebook._id}`;

    for (const quantity of [0, -2, 2.5, "muchos"]) {
      const res = await request(app).put(url).send({ quantity });
      expect(res.status, `quantity: ${quantity}`).to.equal(400);
    }

    const withoutQuantity = await request(app).put(url).send({});
    expect(withoutQuantity.status).to.equal(400);
  });

  it("PUT /:cid no modifica el carrito si algún producto del arreglo no existe", async () => {
    const cart = await createCart([{ product: notebook._id, quantity: 1 }]);

    const res = await request(app)
      .put(`/api/carts/${cart._id}`)
      .send({ products: [{ product: NONEXISTENT_ID, quantity: 1 }] });

    expect(res.status).to.equal(404);

    const after = await request(app).get(`/api/carts/${cart._id}`);
    expect(summary(after.body.payload)).to.deep.equal({ "Notebook A": 1 });
  });
});
