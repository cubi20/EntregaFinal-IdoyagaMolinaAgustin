import mongoose from "mongoose";
import ProductModel from "../models/product.model.js";

// Traduce el query param `query` a un filtro de Mongo.
// La consigna pide poder buscar por CATEGORÍA o por DISPONIBILIDAD:
//   - "category:notebooks"  /  "notebooks"        -> filtra por categoría
//   - "status:true" / "true" / "disponible"       -> filtra por disponibilidad
//   - sin query                                   -> búsqueda general (sin filtro)
const buildFilter = (query) => {
  if (!query) return {};

  const value = String(query).trim().toLowerCase();
  if (!value) return {};

  // Sintaxis explícita "campo:valor" (ej: category:notebooks, status:true)
  if (value.includes(":")) {
    const [field, raw] = value.split(":");
    if (field === "status") return { status: raw === "true" };
    if (field === "category") return { category: raw };
  }

  // Atajos de disponibilidad
  if (value === "true" || value === "disponible") return { status: true };
  if (value === "false" || value === "no-disponible") return { status: false };

  // Cualquier otro valor se interpreta como una categoría
  return { category: value };
};

// Traduce el query param `sort` a un ordenamiento de Mongo.
// asc/desc ordenan por precio; cualquier otro valor no ordena nada.
const buildSort = (sort) => {
  if (sort === "asc") return { price: 1 };
  if (sort === "desc") return { price: -1 };
  return undefined;
};

// Manager de productos sobre MongoDB. Mantiene la misma interfaz pública que
// la versión con archivos: la lógica de negocio no cambia, sólo su persistencia.
class ProductManager {
  // Lista completa de productos. La usan los websockets para sincronizar
  // la vista de tiempo real.
  async getProducts() {
    return await ProductModel.find().lean();
  }

  // Lista paginada + filtrada + ordenada. Resuelve limit, page, sort y query.
  async getPaginatedProducts({ limit, page, sort, query } = {}) {
    const parsedLimit = Number.parseInt(limit, 10);
    const parsedPage = Number.parseInt(page, 10);

    const options = {
      // Si no se recibe limit, es 10. Si no se recibe page, es 1.
      limit: Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10,
      page: Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1,
      lean: true,
    };

    const sortCriteria = buildSort(sort);
    if (sortCriteria) options.sort = sortCriteria;

    return await ProductModel.paginate(buildFilter(query), options);
  }

  // Devuelve las categorías existentes, para armar el filtro de las vistas.
  async getCategories() {
    return await ProductModel.distinct("category");
  }

  async getProductById(pid) {
    if (!mongoose.isValidObjectId(pid)) {
      throw new Error(`No existe un producto con el id ${pid}`);
    }

    const product = await ProductModel.findById(pid).lean();
    if (!product) {
      throw new Error(`No existe un producto con el id ${pid}`);
    }
    return product;
  }

  async addProduct(productData) {
    const { title, description, code, price, status, stock, category, thumbnails } =
      productData ?? {};

    if (
      !title ||
      !description ||
      !code ||
      price === undefined ||
      stock === undefined ||
      !category
    ) {
      throw new Error(
        "Faltan campos obligatorios: title, description, code, price, stock y category son requeridos"
      );
    }

    // El código no puede repetirse (misma regla que en las entregas anteriores)
    const codeExists = await ProductModel.exists({ code: String(code) });
    if (codeExists) {
      throw new Error(`Ya existe un producto con el código ${code}`);
    }

    const newProduct = await ProductModel.create({
      title: String(title),
      description: String(description),
      code: String(code),
      price: Number(price),
      status: status !== undefined ? Boolean(status) : true,
      stock: Number(stock),
      category: String(category),
      thumbnails: Array.isArray(thumbnails) ? thumbnails : [],
    });

    return newProduct.toObject();
  }

  async updateProduct(pid, updates) {
    if (!mongoose.isValidObjectId(pid)) {
      throw new Error(`No existe un producto con el id ${pid}`);
    }

    // Nunca se actualiza ni se elimina el id del producto
    const { _id, id, ...allowedUpdates } = updates ?? {};

    // Si se intenta cambiar el código, se valida que no pertenezca a otro producto
    if (allowedUpdates.code) {
      const codeOwner = await ProductModel.exists({
        code: String(allowedUpdates.code),
        _id: { $ne: pid },
      });
      if (codeOwner) {
        throw new Error(`Ya existe un producto con el código ${allowedUpdates.code}`);
      }
    }

    const updatedProduct = await ProductModel.findByIdAndUpdate(pid, allowedUpdates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updatedProduct) {
      throw new Error(`No existe un producto con el id ${pid}`);
    }
    return updatedProduct;
  }

  async deleteProduct(pid) {
    if (!mongoose.isValidObjectId(pid)) {
      throw new Error(`No existe un producto con el id ${pid}`);
    }

    const deletedProduct = await ProductModel.findByIdAndDelete(pid).lean();
    if (!deletedProduct) {
      throw new Error(`No existe un producto con el id ${pid}`);
    }
    return deletedProduct;
  }
}

export default ProductManager;
