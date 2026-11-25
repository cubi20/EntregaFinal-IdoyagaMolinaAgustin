import CartModel from "../models/cart.model.js";
import ProductModel from "../models/product.model.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import { assertValidObjectId, parsePositiveInteger } from "../utils/validators.js";

// Formato esperado por PUT /api/carts/:cid, para los mensajes de error
const CART_PRODUCTS_FORMAT = '[{ "product": "<id del producto>", "quantity": <cantidad> }]';

// Manager de carritos sobre MongoDB. Mantiene la interfaz de las entregas
// anteriores y suma los métodos que pide la consigna final.
class CartManager {
  // Busca el carrito (documento de Mongoose, para poder modificarlo y guardarlo)
  async #findCartOrFail(cid) {
    assertValidObjectId(cid, "carrito");

    const cart = await CartModel.findById(cid);
    if (!cart) throw new NotFoundError(`No existe un carrito con el id ${cid}`);
    return cart;
  }

  // Valida que el producto exista antes de sumarlo a un carrito
  async #assertProductExists(pid) {
    assertValidObjectId(pid, "producto");

    if (!(await ProductModel.exists({ _id: pid }))) {
      throw new NotFoundError(`No existe un producto con el id ${pid}`);
    }
  }

  // Posición del producto dentro del array products del carrito (-1 si no está)
  #findLineIndex(cart, pid) {
    return cart.products.findIndex((line) => line.product.toString() === String(pid));
  }

  async createCart() {
    const newCart = await CartModel.create({ products: [] });
    return newCart.toObject();
  }

  // GET /:cid -> trae el carrito con los productos COMPLETOS.
  // En la base sólo está guardado el ObjectId de cada producto; el populate
  // lo desglosa con toda su información.
  async getCartById(cid) {
    assertValidObjectId(cid, "carrito");

    const cart = await CartModel.findById(cid).populate("products.product").lean();
    if (!cart) throw new NotFoundError(`No existe un carrito con el id ${cid}`);

    // Si un producto se borró de la base por fuera de la API, el populate
    // devuelve null: esa línea se descarta para no devolver datos rotos.
    cart.products = cart.products.filter((line) => line.product !== null);
    return cart;
  }

  // POST /:cid/products/:pid -> agrega el producto. Si ya estaba, suma la cantidad.
  async addProductToCart(cid, pid, quantity) {
    const amount = parsePositiveInteger(quantity, "quantity", 1);
    const cart = await this.#findCartOrFail(cid);
    await this.#assertProductExists(pid);

    const index = this.#findLineIndex(cart, pid);
    if (index === -1) {
      cart.products.push({ product: pid, quantity: amount });
    } else {
      cart.products[index].quantity += amount;
    }

    await cart.save();
    return await this.getCartById(cid);
  }

  // DELETE /:cid/products/:pid -> saca del carrito el producto seleccionado.
  async removeProductFromCart(cid, pid) {
    const cart = await this.#findCartOrFail(cid);
    assertValidObjectId(pid, "producto");

    const index = this.#findLineIndex(cart, pid);
    if (index === -1) {
      throw new NotFoundError(`El producto ${pid} no está en el carrito ${cid}`);
    }

    cart.products.splice(index, 1);
    await cart.save();
    return await this.getCartById(cid);
  }

  // PUT /:cid -> reemplaza TODOS los productos del carrito por el arreglo recibido.
  async updateCartProducts(cid, products) {
    const cart = await this.#findCartOrFail(cid);

    if (!Array.isArray(products)) {
      throw new BadRequestError(`Se espera un arreglo de productos con el formato ${CART_PRODUCTS_FORMAT}`);
    }

    const lines = [];
    for (const item of products) {
      if (!item || typeof item !== "object") {
        throw new BadRequestError(`Cada elemento debe tener el formato ${CART_PRODUCTS_FORMAT}`);
      }

      // Se acepta el id suelto o el producto completo (como lo devuelve GET /:cid)
      const productId =
        item.product && typeof item.product === "object" ? item.product._id : item.product;
      assertValidObjectId(productId, "producto");

      const quantity = parsePositiveInteger(item.quantity, "quantity", 1);

      // Si el mismo producto viene repetido en el arreglo, se acumulan cantidades
      const existing = lines.find((line) => line.product === String(productId));
      if (existing) {
        existing.quantity += quantity;
      } else {
        lines.push({ product: String(productId), quantity });
      }
    }

    // Todos los productos tienen que existir (una sola consulta para todo el arreglo)
    const ids = lines.map((line) => line.product);
    const found = await ProductModel.find({ _id: { $in: ids } }, { _id: 1 }).lean();
    const foundIds = new Set(found.map((product) => String(product._id)));
    const missing = ids.find((id) => !foundIds.has(id));
    if (missing) throw new NotFoundError(`No existe un producto con el id ${missing}`);

    cart.products = lines;
    await cart.save();
    return await this.getCartById(cid);
  }

  // PUT /:cid/products/:pid -> actualiza SÓLO la cantidad de ejemplares,
  // con la cantidad que llega en req.body.
  async updateProductQuantity(cid, pid, quantity) {
    const amount = parsePositiveInteger(quantity, "quantity");
    const cart = await this.#findCartOrFail(cid);
    assertValidObjectId(pid, "producto");

    const index = this.#findLineIndex(cart, pid);
    if (index === -1) {
      throw new NotFoundError(`El producto ${pid} no está en el carrito ${cid}`);
    }

    cart.products[index].quantity = amount;
    await cart.save();
    return await this.getCartById(cid);
  }

  // DELETE /:cid -> vacía el carrito (elimina todos sus productos).
  // El carrito sigue existiendo, sólo queda sin productos.
  async clearCart(cid) {
    const cart = await this.#findCartOrFail(cid);

    cart.products = [];
    await cart.save();
    return await this.getCartById(cid);
  }
}

export default CartManager;
