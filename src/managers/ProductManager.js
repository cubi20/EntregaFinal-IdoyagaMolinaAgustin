import ProductModel from "../models/product.model.js";
import CartModel from "../models/cart.model.js";
import { BadRequestError, NotFoundError } from "../utils/errors.js";
import {
  assertValidObjectId,
  isEmpty,
  parsePositiveInteger,
  toNumber,
} from "../utils/validators.js";

// ---------------------------------------------------------------------------
// Query params de GET /api/products
// ---------------------------------------------------------------------------

// Traduce "true" / "false" al booleano del campo status
const parseStatusValue = (value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new BadRequestError('El filtro status sólo acepta "true" o "false"');
};

// Traduce el query param `query` a un filtro de Mongo.
// La consigna pide poder buscar por CATEGORÍA o por DISPONIBILIDAD:
//   - "category:notebooks"  /  "notebooks"            -> filtra por categoría
//   - "status:true" / "true" / "disponible"           -> sólo disponibles
//   - "status:false" / "false" / "no-disponible"      -> sólo no disponibles
//   - sin query                                       -> búsqueda general (sin filtro)
const buildFilter = (query) => {
  if (isEmpty(query)) return {};

  const value = String(query).trim().toLowerCase();

  // Sintaxis explícita "campo:valor" (ej: category:notebooks, status:true)
  if (value.includes(":")) {
    const separator = value.indexOf(":");
    const field = value.slice(0, separator).trim();
    const fieldValue = value.slice(separator + 1).trim();

    if (field === "category" && fieldValue) return { category: fieldValue };
    if (field === "status") return { status: parseStatusValue(fieldValue) };

    throw new BadRequestError(
      `Filtro no soportado: "${query}". Usá category:<categoría> o status:true / status:false`
    );
  }

  // Atajos de disponibilidad
  if (value === "true" || value === "disponible") return { status: true };
  if (value === "false" || value === "no-disponible") return { status: false };

  // Cualquier otro valor se interpreta como una categoría
  return { category: value };
};

// Traduce el query param `sort` a un ordenamiento de Mongo.
// asc/desc ordenan por precio; si no se envía, no se ordena.
// Se agrega _id como desempate para que, entre productos con el mismo precio,
// el orden sea siempre el mismo y la paginación no repita ni saltee elementos.
const buildSort = (sort) => {
  if (isEmpty(sort)) return undefined;

  const direction = String(sort).trim().toLowerCase();
  if (direction === "asc") return { price: 1, _id: 1 };
  if (direction === "desc") return { price: -1, _id: 1 };

  throw new BadRequestError('El parámetro sort sólo acepta "asc" o "desc"');
};

// ---------------------------------------------------------------------------
// Validación de los datos de un producto (alta y modificación)
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ["title", "description", "code", "price", "stock", "category"];

const parseText = (value, field) => {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new BadRequestError(`El campo ${field} debe ser un texto`);
  }
  const text = String(value).trim();
  if (!text) throw new BadRequestError(`El campo ${field} no puede estar vacío`);
  return text;
};

const parseNonNegativeNumber = (value, field, { integer = false } = {}) => {
  const number = toNumber(value);
  if (typeof number !== "number" || !Number.isFinite(number)) {
    throw new BadRequestError(`El campo ${field} debe ser un número`);
  }
  if (number < 0) throw new BadRequestError(`El campo ${field} no puede ser negativo`);
  if (integer && !Number.isInteger(number)) {
    throw new BadRequestError(`El campo ${field} debe ser un número entero`);
  }
  return number;
};

const parseBoolean = (value, field) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new BadRequestError(`El campo ${field} debe ser true o false`);
};

const parseThumbnails = (value) => {
  const list = Array.isArray(value) ? value : [value];
  if (!list.every((item) => typeof item === "string")) {
    throw new BadRequestError("El campo thumbnails debe ser un arreglo de rutas (strings)");
  }
  return list.map((item) => item.trim()).filter(Boolean);
};

// Valida y normaliza el body. Con partial = true (PUT) los campos son opcionales.
// Los campos que no son del producto (incluidos _id e id) se ignoran: el id
// nunca se actualiza ni se elimina.
const parseProductData = (data, { partial = false } = {}) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new BadRequestError("El body debe ser un objeto con los datos del producto");
  }

  if (!partial) {
    const missing = REQUIRED_FIELDS.filter((field) => isEmpty(data[field]));
    if (missing.length > 0) {
      throw new BadRequestError(`Faltan campos obligatorios: ${missing.join(", ")}`);
    }
  }

  const product = {};
  for (const field of ["title", "description", "code", "category"]) {
    if (data[field] !== undefined) product[field] = parseText(data[field], field);
  }
  if (data.price !== undefined) product.price = parseNonNegativeNumber(data.price, "price");
  if (data.stock !== undefined) {
    product.stock = parseNonNegativeNumber(data.stock, "stock", { integer: true });
  }
  if (data.status !== undefined) product.status = parseBoolean(data.status, "status");
  if (data.thumbnails !== undefined) product.thumbnails = parseThumbnails(data.thumbnails);

  return product;
};

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

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
    const options = {
      // Si no se recibe limit, es 10. Si no se recibe page, es 1.
      limit: parsePositiveInteger(limit, "limit", 10),
      page: parsePositiveInteger(page, "page", 1),
      // Objetos planos, con los mismos campos que GET /:pid (sin agregar un "id" extra)
      lean: true,
      leanWithId: false,
    };

    const sortCriteria = buildSort(sort);
    if (sortCriteria) options.sort = sortCriteria;

    const result = await ProductModel.paginate(buildFilter(query), options);

    // Pedir una página que no existe es un error, no una página vacía
    if (result.totalPages > 0 && options.page > result.totalPages) {
      throw new NotFoundError(
        `La página ${options.page} no existe: hay ${result.totalPages} página(s) con ese criterio`
      );
    }
    return result;
  }

  // Devuelve las categorías existentes, para armar el filtro de las vistas.
  async getCategories() {
    const categories = await ProductModel.distinct("category");
    return categories.sort();
  }

  async getProductById(pid) {
    assertValidObjectId(pid, "producto");

    const product = await ProductModel.findById(pid).lean();
    if (!product) throw new NotFoundError(`No existe un producto con el id ${pid}`);
    return product;
  }

  async addProduct(productData) {
    const product = parseProductData(productData);

    // El código no puede repetirse (misma regla que en las entregas anteriores)
    if (await ProductModel.exists({ code: product.code })) {
      throw new BadRequestError(`Ya existe un producto con el código ${product.code}`);
    }

    const newProduct = await ProductModel.create(product);
    return newProduct.toObject();
  }

  async updateProduct(pid, updates) {
    assertValidObjectId(pid, "producto");

    const changes = parseProductData(updates, { partial: true });
    if (Object.keys(changes).length === 0) {
      throw new BadRequestError(
        "No se envió ningún campo para actualizar (title, description, code, price, status, stock, category, thumbnails)"
      );
    }

    // Si se intenta cambiar el código, se valida que no pertenezca a otro producto
    if (changes.code && (await ProductModel.exists({ code: changes.code, _id: { $ne: pid } }))) {
      throw new BadRequestError(`Ya existe un producto con el código ${changes.code}`);
    }

    const updatedProduct = await ProductModel.findByIdAndUpdate(pid, changes, {
      returnDocument: "after",
      runValidators: true,
    }).lean();

    if (!updatedProduct) throw new NotFoundError(`No existe un producto con el id ${pid}`);
    return updatedProduct;
  }

  async deleteProduct(pid) {
    assertValidObjectId(pid, "producto");

    const deletedProduct = await ProductModel.findByIdAndDelete(pid).lean();
    if (!deletedProduct) throw new NotFoundError(`No existe un producto con el id ${pid}`);

    // Un producto que ya no existe no puede quedar en ningún carrito
    await CartModel.updateMany(
      { "products.product": deletedProduct._id },
      { $pull: { products: { product: deletedProduct._id } } }
    );

    return deletedProduct;
  }
}

export default ProductManager;
