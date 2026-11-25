import { expect } from "chai";
import request from "supertest";
import app from "../src/app.js";
import { createSampleProducts, createCart, resetDatabase } from "./helpers.js";

// Handlebars escapa "=" y "&" dentro de los atributos ("&#x3D;" y "&amp;");
// el navegador los lee igual. Se decodifican para comparar las URLs.
const decode = (html) => html.replaceAll("&#x3D;", "=").replaceAll("&amp;", "&");

describe("Vistas (Handlebars)", () => {
  let products;

  beforeEach(async () => {
    await resetDatabase();
    products = await createSampleProducts();
  });

  describe("/products (index.handlebars)", () => {
    it("muestra los productos con su paginación", async () => {
      const res = await request(app).get("/products");
      const html = decode(res.text);

      expect(res.status).to.equal(200);
      expect(html).to.include("12 producto(s) · página 1 de 2");
      for (const product of products.slice(0, 10)) expect(html).to.include(product.title);
      expect(html).not.to.include("Mousepad");
      expect(html).to.include('href="/products?page=2"');
    });

    it("cada producto tiene link a su detalle y botón para agregarlo al carrito directamente", async () => {
      const res = await request(app).get("/products");
      const html = decode(res.text);

      for (const product of products.slice(0, 10)) {
        expect(html).to.include(`href="/products/${product._id}"`);
        expect(html).to.include(`class="btn add-to-cart" data-id="${product._id}"`);
      }
    });

    it("respeta los mismos query params que la API (query, sort y limit)", async () => {
      const res = await request(app).get("/products?query=category:monitores&sort=asc&limit=2");
      const html = decode(res.text);

      expect(html).to.include("4 producto(s) · página 1 de 2");
      expect(html.indexOf("Monitor C")).to.be.greaterThan(-1);
      expect(html.indexOf("Monitor C")).to.be.lessThan(html.indexOf("Monitor A"));
      expect(html).not.to.include("Notebook A");
      expect(html).to.include('href="/products?limit=2&sort=asc&query=category%3Amonitores&page=2"');
    });
  });

  describe("/products/:pid (detalle)", () => {
    it("muestra el producto con descripción, precio, categoría y botón de agregar al carrito", async () => {
      const product = products[4];
      const res = await request(app).get(`/products/${product._id}`);
      const html = decode(res.text);

      expect(res.status).to.equal(200);
      expect(html).to.include(product.title);
      expect(html).to.include(product.description);
      expect(html).to.include("235.000,00");
      expect(html).to.include(product.category);
      expect(html).to.include(`<dd>${product.stock}</dd>`);
      expect(html).to.include(`class="btn add-to-cart" data-id="${product._id}"`);
    });

    it("muestra una página de error si el producto no existe", async () => {
      const res = await request(app).get("/products/6553a1b2c3d4e5f6a7b8c9d0");

      expect(res.status).to.equal(404);
      expect(res.text).to.include("No existe un producto");
    });
  });

  describe("/carts/:cid", () => {
    it("lista SÓLO los productos que pertenecen a ese carrito", async () => {
      const cart = await createCart([
        { product: products[0]._id, quantity: 2 },
        { product: products[9]._id, quantity: 1 },
      ]);
      await createCart([{ product: products[4]._id, quantity: 5 }]);

      const res = await request(app).get(`/carts/${cart._id}`);
      const html = decode(res.text);

      expect(res.status).to.equal(200);
      expect(html).to.include("Notebook A");
      expect(html).to.include("Mouse");
      expect(html).not.to.include("Monitor A");
      expect(html).to.include("Total (3 unidad(es))");
      expect(html).to.include("1.838.500,00");
    });

    it("muestra una página de error si el carrito no existe", async () => {
      const res = await request(app).get("/carts/6553a1b2c3d4e5f6a7b8c9d0");

      expect(res.status).to.equal(404);
      expect(res.text).to.include("No existe un carrito");
    });
  });
});
