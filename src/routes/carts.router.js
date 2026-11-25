import { Router } from "express";
import CartManager from "../managers/CartManager.js";

const router = Router();
const cartManager = new CartManager();

// POST / - Crea un nuevo carrito con id autogenerado y array de productos vacío
router.post("/", async (req, res, next) => {
  try {
    const newCart = await cartManager.createCart();
    res.status(201).json({ status: "success", payload: newCart });
  } catch (error) {
    next(error);
  }
});

// GET /:cid - Lista los productos del carrito indicado, COMPLETOS.
// En la base se guarda sólo el id de cada producto; el populate del manager
// los desglosa con toda su información.
router.get("/:cid", async (req, res, next) => {
  try {
    const cart = await cartManager.getCartById(req.params.cid);
    res.status(200).json({ status: "success", payload: cart.products });
  } catch (error) {
    next(error);
  }
});

// POST /:cid/products/:pid - Agrega el producto al carrito.
// Si ya estaba, incrementa la cantidad en lugar de duplicar la línea.
// Opcionalmente acepta { "quantity": n } en el body (por defecto suma 1).
// Se mantiene además la ruta en singular (/product/:pid) de la primera entrega.
router.post(["/:cid/products/:pid", "/:cid/product/:pid"], async (req, res, next) => {
  try {
    const updatedCart = await cartManager.addProductToCart(
      req.params.cid,
      req.params.pid,
      req.body?.quantity
    );
    res.status(200).json({ status: "success", payload: updatedCart });
  } catch (error) {
    next(error);
  }
});

// DELETE /:cid/products/:pid - Elimina del carrito el producto seleccionado
router.delete("/:cid/products/:pid", async (req, res, next) => {
  try {
    const updatedCart = await cartManager.removeProductFromCart(
      req.params.cid,
      req.params.pid
    );
    res.status(200).json({ status: "success", payload: updatedCart });
  } catch (error) {
    next(error);
  }
});

// PUT /:cid - Actualiza TODOS los productos del carrito con un arreglo de productos
router.put("/:cid", async (req, res, next) => {
  try {
    // Se acepta tanto { "products": [...] } como el arreglo directo en el body
    const products = Array.isArray(req.body) ? req.body : req.body?.products;

    const updatedCart = await cartManager.updateCartProducts(req.params.cid, products);
    res.status(200).json({ status: "success", payload: updatedCart });
  } catch (error) {
    next(error);
  }
});

// PUT /:cid/products/:pid - Actualiza SÓLO la cantidad de ejemplares del
// producto, con la cantidad que llegue por req.body: { "quantity": n }
router.put("/:cid/products/:pid", async (req, res, next) => {
  try {
    const updatedCart = await cartManager.updateProductQuantity(
      req.params.cid,
      req.params.pid,
      req.body?.quantity
    );
    res.status(200).json({ status: "success", payload: updatedCart });
  } catch (error) {
    next(error);
  }
});

// DELETE /:cid - Elimina todos los productos del carrito (lo vacía)
router.delete("/:cid", async (req, res, next) => {
  try {
    const updatedCart = await cartManager.clearCart(req.params.cid);
    res.status(200).json({ status: "success", payload: updatedCart });
  } catch (error) {
    next(error);
  }
});

export default router;
