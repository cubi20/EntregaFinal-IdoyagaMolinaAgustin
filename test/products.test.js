import { expect } from "chai";
import request from "supertest";
import app from "../src/app.js";
import CartModel from "../src/models/cart.model.js";
import { createSampleProducts, createCart, resetDatabase } from "./helpers.js";

const RESPONSE_KEYS = [
  "status",
  "payload",
  "totalPages",
  "prevPage",
  "nextPage",
  "page",
  "hasPrevPage",
  "hasNextPage",
  "prevLink",
  "nextLink",
];

const prices = (payload) => payload.map((product) => product.price);

describe("API de productos (/api/products)", () => {
  let products;

  beforeEach(async () => {
    await resetDatabase();
    products = await createSampleProducts();
  });

  describe("GET / con paginación, filtros y ordenamiento", () => {
    it("devuelve el objeto con el formato pedido, con limit 10 y page 1 por defecto", async () => {
      const res = await request(app).get("/api/products");

      expect(res.status).to.equal(200);
      expect(res.body).to.have.all.keys(...RESPONSE_KEYS);
      expect(res.body.status).to.equal("success");
      expect(res.body.payload).to.have.lengthOf(10);
      expect(res.body.page).to.equal(1);
      expect(res.body.totalPages).to.equal(2);
      expect(res.body.prevPage).to.equal(null);
      expect(res.body.nextPage).to.equal(2);
      expect(res.body.hasPrevPage).to.equal(false);
      expect(res.body.hasNextPage).to.equal(true);
      expect(res.body.prevLink).to.equal(null);
      expect(res.body.nextLink).to.match(/^http:\/\/.+\/api\/products\?page=2$/);
    });

    it("limit devuelve sólo la cantidad de elementos solicitada", async () => {
      const res = await request(app).get("/api/products?limit=5");

      expect(res.body.payload).to.have.lengthOf(5);
      expect(res.body.totalPages).to.equal(3);
    });

    it("page devuelve la página solicitada", async () => {
      const res = await request(app).get("/api/products?limit=5&page=3");

      expect(res.body.page).to.equal(3);
      expect(res.body.payload).to.have.lengthOf(2);
      expect(res.body.payload.map((p) => p.title)).to.deep.equal(["Auriculares", "Mousepad"]);
      expect(res.body.hasPrevPage).to.equal(true);
      expect(res.body.prevPage).to.equal(2);
      expect(res.body.prevLink).to.match(/\/api\/products\?limit=5&page=2$/);
      expect(res.body.hasNextPage).to.equal(false);
      expect(res.body.nextPage).to.equal(null);
      expect(res.body.nextLink).to.equal(null);
    });

    it("sin sort no realiza ningún ordenamiento (respeta el orden de carga)", async () => {
      const res = await request(app).get("/api/products?limit=20");

      expect(res.body.payload.map((p) => p.title)).to.deep.equal(products.map((p) => p.title));
    });

    it("sort=asc ordena por precio de menor a mayor", async () => {
      const res = await request(app).get("/api/products?limit=20&sort=asc");

      const expected = [...prices(products)].sort((a, b) => a - b);
      expect(prices(res.body.payload)).to.deep.equal(expected);
    });

    it("sort=desc ordena por precio de mayor a menor", async () => {
      const res = await request(app).get("/api/products?limit=20&sort=desc");

      const expected = [...prices(products)].sort((a, b) => b - a);
      expect(prices(res.body.payload)).to.deep.equal(expected);
    });

    it("query busca por categoría (category:<categoría> o sólo la categoría)", async () => {
      for (const query of ["category:monitores", "monitores", "Monitores"]) {
        const res = await request(app).get(`/api/products?query=${query}`);

        expect(res.body.status).to.equal("success");
        expect(res.body.payload).to.have.lengthOf(4);
        expect(res.body.payload.every((p) => p.category === "monitores")).to.equal(true);
      }
    });

    it("query busca por disponibilidad (status:true / status:false)", async () => {
      const available = await request(app).get("/api/products?query=status:true&limit=20");
      const unavailable = await request(app).get("/api/products?query=status:false&limit=20");

      expect(available.body.payload).to.have.lengthOf(9);
      expect(available.body.payload.every((p) => p.status === true)).to.equal(true);
      expect(unavailable.body.payload).to.have.lengthOf(3);
      expect(unavailable.body.payload.every((p) => p.status === false)).to.equal(true);
    });

    it("combina filtro, orden y paginación, y los links conservan limit, sort y query", async () => {
      const res = await request(app).get(
        "/api/products?query=category:notebooks&sort=desc&limit=2&page=1"
      );

      expect(prices(res.body.payload)).to.deep.equal([2150000, 1480000]);
      expect(res.body.totalPages).to.equal(2);

      const nextLink = new URL(res.body.nextLink);
      expect(nextLink.pathname).to.equal("/api/products");
      expect(Object.fromEntries(nextLink.searchParams)).to.deep.equal({
        limit: "2",
        sort: "desc",
        query: "category:notebooks",
        page: "2",
      });

      // El link es directo: se puede usar tal cual para pedir la página siguiente
      const next = await request(app).get(nextLink.pathname + nextLink.search);
      expect(prices(next.body.payload)).to.deep.equal([1050000, 900000]);
      expect(next.body.nextLink).to.equal(null);
    });

    it("responde status: error con parámetros inválidos o una página que no existe", async () => {
      const cases = [
        ["/api/products?sort=precio", 400],
        ["/api/products?limit=0", 400],
        ["/api/products?page=abc", 400],
        ["/api/products?query=title:mouse", 400],
        ["/api/products?page=5", 404],
      ];

      for (const [url, statusCode] of cases) {
        const res = await request(app).get(url);
        expect(res.status, url).to.equal(statusCode);
        expect(res.body.status, url).to.equal("error");
        expect(res.body.message, url).to.be.a("string");
      }
    });
  });

  describe("GET, POST, PUT y DELETE de un producto", () => {
    it("GET /:pid devuelve sólo el producto con ese id", async () => {
      const res = await request(app).get(`/api/products/${products[0]._id}`);

      expect(res.status).to.equal(200);
      expect(res.body.payload.title).to.equal("Notebook A");
    });

    it("GET /:pid responde 404 si no existe y 400 si el id no es válido", async () => {
      const notFound = await request(app).get("/api/products/6553a1b2c3d4e5f6a7b8c9d0");
      const invalid = await request(app).get("/api/products/123");

      expect(notFound.status).to.equal(404);
      expect(invalid.status).to.equal(400);
    });

    it("POST / crea el producto con id autogenerado y status true por defecto", async () => {
      const res = await request(app).post("/api/products").send({
        title: "Webcam",
        description: "Webcam Full HD",
        code: "PE-9",
        price: 128000,
        stock: 6,
        category: "perifericos",
        thumbnails: ["/img/perifericos.svg"],
      });

      expect(res.status).to.equal(201);
      expect(res.body.payload).to.include({ title: "Webcam", status: true, price: 128000 });
      expect(res.body.payload._id).to.be.a("string");
    });

    it("POST / valida campos obligatorios, tipos y que el código no se repita", async () => {
      const missing = await request(app).post("/api/products").send({ title: "Sin datos" });
      const badPrice = await request(app)
        .post("/api/products")
        .send({ ...products[0], _id: undefined, code: "X-1", price: "caro" });
      const repeated = await request(app)
        .post("/api/products")
        .send({ ...products[0], _id: undefined });

      expect(missing.status).to.equal(400);
      expect(missing.body.message).to.include("Faltan campos obligatorios");
      expect(badPrice.status).to.equal(400);
      expect(repeated.status).to.equal(400);
      expect(repeated.body.message).to.include("NB-1");
    });

    it("PUT /:pid actualiza los campos enviados sin modificar el id", async () => {
      const pid = String(products[0]._id);
      const res = await request(app)
        .put(`/api/products/${pid}`)
        .send({ _id: "6553a1b2c3d4e5f6a7b8c9d0", price: 850000, stock: 4 });

      expect(res.status).to.equal(200);
      expect(res.body.payload._id).to.equal(pid);
      expect(res.body.payload).to.include({ price: 850000, stock: 4, title: "Notebook A" });
    });

    it("PUT /:pid rechaza valores inválidos con 400", async () => {
      const res = await request(app)
        .put(`/api/products/${products[0]._id}`)
        .send({ price: -10 });

      expect(res.status).to.equal(400);
      expect(res.body.status).to.equal("error");
    });

    it("DELETE /:pid elimina el producto y lo saca de los carritos que lo tenían", async () => {
      const [deleted, kept] = products;
      const cart = await createCart([
        { product: deleted._id, quantity: 2 },
        { product: kept._id, quantity: 1 },
      ]);

      const res = await request(app).delete(`/api/products/${deleted._id}`);
      expect(res.status).to.equal(200);

      const after = await request(app).get(`/api/products/${deleted._id}`);
      expect(after.status).to.equal(404);

      const storedCart = await CartModel.findById(cart._id).lean();
      expect(storedCart.products.map((line) => String(line.product))).to.deep.equal([
        String(kept._id),
      ]);
    });
  });
});
