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
router.get("/", async (req, res) => {
  try {
    const { limit, page, sort, query } = req.query;

    const result = await productManager.getPaginatedProducts({ limit, page, sort, query });

    // Los links conservan limit, sort y query para no perder el filtro al paginar
    const prevLink = buildPageLink("/api/products", req.query, result.prevPage);
    const nextLink = buildPageLink("/api/products", req.query, result.nextPage);

    res.status(200).json({
      status: "success",
      payload: result.docs,
      totalPages: result.totalPages,
      prevPage: result.prevPage,
      nextPage: result.nextPage,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
      prevLink,
      nextLink,
    });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

// GET /:pid - Trae sólo el producto con el id proporcionado
router.get("/:pid", async (req, res) => {
  try {
    const product = await productManager.getProductById(req.params.pid);
    res.status(200).json({ status: "success", payload: product });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
});

// POST / - Agrega un nuevo producto (id autogenerado por MongoDB)
router.post("/", async (req, res) => {
  try {
    const newProduct = await productManager.addProduct(req.body);

    // El router ya no recibe ni manipula la instancia de io: sólo llama a la
    // función que expone el socketManager (singleton). Así, al crear un
    // producto por HTTP, la vista de tiempo real también se sincroniza.
    await emitProductsUpdate();

    res.status(201).json({ status: "success", payload: newProduct });
  } catch (error) {
    res.status(400).json({ status: "error", message: error.message });
  }
});

// PUT /:pid - Actualiza un producto sin modificar ni eliminar su id
router.put("/:pid", async (req, res) => {
  try {
    const updatedProduct = await productManager.updateProduct(req.params.pid, req.body);

    await emitProductsUpdate();

    res.status(200).json({ status: "success", payload: updatedProduct });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
});

// DELETE /:pid - Elimina el producto con el pid indicado
router.delete("/:pid", async (req, res) => {
  try {
    const deletedProduct = await productManager.deleteProduct(req.params.pid);

    // Al eliminar por HTTP también se sincroniza la vista de tiempo real
    await emitProductsUpdate();

    res.status(200).json({ status: "success", payload: deletedProduct });
  } catch (error) {
    res.status(404).json({ status: "error", message: error.message });
  }
});

export default router;
