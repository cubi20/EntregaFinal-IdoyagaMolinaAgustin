import { Router } from "express";
import ProductManager from "../managers/ProductManager.js";
import { emitProductsUpdate } from "../sockets/socketManager.js";
import { buildPageLink } from "../utils/pagination.js";

const router = Router();
const productManager = new ProductManager();

// GET / - Lista los productos con paginación, filtros y ordenamiento.
// Query params (todos opcionales):
//   limit -> cantidad de elementos por página (default 10)
//   page  -> página solicitada (default 1)
//   sort  -> asc | desc, ordena por precio (si no viene, no ordena)
//   query -> filtro por categoría o por disponibilidad (si no viene, trae todo)
router.get("/", async (req, res, next) => {
  try {
    const { limit, page, sort, query } = req.query;

    const result = await productManager.getPaginatedProducts({ limit, page, sort, query });

    // Links directos (URL completa) a la página previa y a la siguiente.
    // Conservan limit, sort y query para no perder el filtro al paginar.
    const baseUrl = `${req.protocol}://${req.get("host")}${req.baseUrl}`;

    res.status(200).json({
      status: "success",
      payload: result.docs,
      totalPages: result.totalPages,
      prevPage: result.prevPage,
      nextPage: result.nextPage,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
      prevLink: result.hasPrevPage ? buildPageLink(baseUrl, req.query, result.prevPage) : null,
      nextLink: result.hasNextPage ? buildPageLink(baseUrl, req.query, result.nextPage) : null,
    });
  } catch (error) {
    next(error);
  }
});

// GET /:pid - Trae sólo el producto con el id proporcionado
router.get("/:pid", async (req, res, next) => {
  try {
    const product = await productManager.getProductById(req.params.pid);
    res.status(200).json({ status: "success", payload: product });
  } catch (error) {
    next(error);
  }
});

// POST / - Agrega un nuevo producto (id autogenerado por MongoDB)
router.post("/", async (req, res, next) => {
  try {
    const newProduct = await productManager.addProduct(req.body);

    // El router no recibe ni manipula la instancia de io: sólo llama a la
    // función que expone el socketManager (singleton). Así, al crear un
    // producto por HTTP, la vista de tiempo real también se sincroniza.
    await emitProductsUpdate();

    res.status(201).json({ status: "success", payload: newProduct });
  } catch (error) {
    next(error);
  }
});

// PUT /:pid - Actualiza un producto sin modificar ni eliminar su id
router.put("/:pid", async (req, res, next) => {
  try {
    const updatedProduct = await productManager.updateProduct(req.params.pid, req.body);

    await emitProductsUpdate();

    res.status(200).json({ status: "success", payload: updatedProduct });
  } catch (error) {
    next(error);
  }
});

// DELETE /:pid - Elimina el producto con el pid indicado (y lo saca de los carritos)
router.delete("/:pid", async (req, res, next) => {
  try {
    const deletedProduct = await productManager.deleteProduct(req.params.pid);

    // Al eliminar por HTTP también se sincroniza la vista de tiempo real
    await emitProductsUpdate();

    res.status(200).json({ status: "success", payload: deletedProduct });
  } catch (error) {
    next(error);
  }
});

export default router;
