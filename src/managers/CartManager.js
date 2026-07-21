import mongoose from "mongoose";
import CartModel from "../models/cart.model.js";
import ProductModel from "../models/product.model.js";

// Manager de carritos sobre MongoDB. Mantiene la interfaz de las entregas
// anteriores y suma los métodos que pide la consigna final.
class CartManager {
  #assertValidId(id, tipo) {
    if (!mongoose.isValidObjectId(id)) {
      throw new Error(`No existe un ${tipo} con el id ${id}`);
    }
  }

  // Busca el carrito y lanza error si no existe. Uso interno.
  async #findCartOrFail(cid) {
    this.#assertValidId(cid, "carrito");

    const cart = await CartModel.findById(cid);
    if (!cart) {
      throw new Error(`No existe un carrito con el id ${cid}`);
    }
    return cart;
  }

  async createCart() {
    const newCart = await CartModel.create({ products: [] });
    return newCart.toObject();
  }

  // GET /:cid -> trae el carrito con los productos COMPLETOS.
  // En la base sólo está guardado el ObjectId de cada producto; el populate
  // lo desglosa con toda su información.
  async getCartById(cid) {
    this.#assertValidId(cid, "carrito");

    const cart = await CartModel.findById(cid).populate("products.product").lean();
    if (!cart) {
      throw new Error(`No existe un carrito con el id ${cid}`);
    }
    return cart;
  }

  // Agrega el producto al carrito. Si ya estaba, incrementa la cantidad.
  async addProductToCart(cid, pid, quantity = 1) {
    const cart = await this.#findCartOrFail(cid);
    await this.#assertProductExists(pid);

    const amount = Number(quantity) > 0 ? Number(quantity) : 1;
    const line = cart.products.find((p) => p.product.toString() === String(pid));

    if (line) {
      line.quantity += amount;
    } else {
      cart.products.push({ product: pid, quantity: amount });
    }

    await cart.save();
    return await this.getCartById(cid);
  }

  // DELETE /:cid/products/:pid -> saca del carrito el producto seleccionado.
  async removeProductFromCart(cid, pid) {
    const cart = await this.#findCartOrFail(cid);
    this.#assertValidId(pid, "producto");

    const index = cart.products.findIndex((p) => p.product.toString() === String(pid));
    if (index === -1) {
      throw new Error(`El producto ${pid} no está en el carrito ${cid}`);
    }

    cart.products.splice(index, 1);
    await cart.save();
    return await this.getCartById(cid);
  }

  // PUT /:cid -> reemplaza TODOS los productos del carrito por el arreglo recibido.
  async updateCartProducts(cid, products) {
    const cart = await this.#findCartOrFail(cid);

    if (!Array.isArray(products)) {
      throw new Error(
        "Se espera un arreglo de productos con el formato [{ product, quantity }]"
      );
    }

    const normalized = [];
    for (const item of products) {
      const productId = item?.product ?? item?.pid ?? item?._id;
      const quantity = item?.quantity === undefined ? 1 : Number(item.quantity);

      await this.#assertProductExists(productId);

      if (!Number.isFinite(quantity) || quantity < 1) {
        throw new Error(
          `La cantidad del producto ${productId} debe ser un número mayor o igual a 1`
        );
      }

      // Si el mismo producto viene repetido en el arreglo, se acumulan cantidades
      const existing = normalized.find((p) => p.product.toString() === String(productId));
      if (existing) {
        existing.quantity += quantity;
      } else {
        normalized.push({ product: productId, quantity });
      }
    }

    cart.products = normalized;
    await cart.save();
    return await this.getCartById(cid);
  }

  // PUT /:cid/products/:pid -> actualiza SÓLO la cantidad de ejemplares.
  async updateProductQuantity(cid, pid, quantity) {
    const cart = await this.#findCartOrFail(cid);
    this.#assertValidId(pid, "producto");

    const amount = Number(quantity);
    if (!Number.isFinite(amount) || amount < 1) {
      throw new Error("La cantidad debe ser un número mayor o igual a 1");
    }

    const line = cart.products.find((p) => p.product.toString() === String(pid));
    if (!line) {
      throw new Error(`El producto ${pid} no está en el carrito ${cid}`);
    }

    line.quantity = amount;
    await cart.save();
    return await this.getCartById(cid);
  }

  // DELETE /:cid -> vacía el carrito (elimina todos sus productos).
  async clearCart(cid) {
    const cart = await this.#findCartOrFail(cid);

    cart.products = [];
    await cart.save();
    return await this.getCartById(cid);
  }

  // Valida que el producto exista antes de sumarlo o modificarlo en un carrito.
  async #assertProductExists(pid) {
    this.#assertValidId(pid, "producto");

    const exists = await ProductModel.exists({ _id: pid });
    if (!exists) {
      throw new Error(`No existe un producto con el id ${pid}`);
    }
  }
}

export default CartManager;
