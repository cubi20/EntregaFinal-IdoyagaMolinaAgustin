import { Router } from "express";
import ProductManager from "../managers/ProductManager.js";
import CartManager from "../managers/CartManager.js";
import { buildPageLink } from "../utils/pagination.js";

const router = Router();
const productManager = new ProductManager();
const cartManager = new CartManager();

// Arma las opciones del filtro `query`: categorías reales de la base
// más los dos atajos de disponibilidad que pide la consigna.
const buildQueryOptions = (categories, current = "") => {
  const options = [
    { value: "", label: "Todas las categorías" },
    { value: "status:true", label: "Sólo disponibles" },
    { value: "status:false", label: "Sin disponibilidad" },
    ...categories.map((category) => ({
      value: `category:${category}`,
      label: `Categoría: ${category}`,
    })),
  ];

  return options.map((option) => ({ ...option, selected: option.value === current }));
};

const buildSelectOptions = (values, current = "") =>
  values.map((option) => ({ ...option, selected: option.value === current }));

// Opciones de "productos por página". Si en la URL vino otro limit (ej: ?limit=6),
// se suma como opción para que el selector muestre el valor que se está usando.
const buildLimitOptions = (current = "") => {
  const options = [
    { value: "", label: "10 por página" },
    { value: "5", label: "5 por página" },
    { value: "20", label: "20 por página" },
    { value: "50", label: "50 por página" },
  ];

  if (current && !options.some((option) => option.value === current)) {
    options.push({ value: current, label: `${current} por página` });
  }
  return buildSelectOptions(options, current);
};

// GET / - La home es el catálogo paginado
router.get("/", (req, res) => res.redirect("/products"));

// GET /products - Catálogo con paginación, filtros y ordenamiento.
// Consume los mismos query params que la API: limit, page, sort y query.
router.get("/products", async (req, res, next) => {
  try {
    const { limit = "", page, sort = "", query = "" } = req.query;

    const result = await productManager.getPaginatedProducts({ limit, page, sort, query });
    const categories = await productManager.getCategories();

    // Números de página para la barra de paginación
    const pages = Array.from({ length: result.totalPages }, (_, i) => ({
      number: i + 1,
      isCurrent: i + 1 === result.page,
      link: buildPageLink("/products", req.query, i + 1),
    }));

    res.render("index", {
      title: "Productos",
      products: result.docs,
      hasProducts: result.docs.length > 0,
      queryOptions: buildQueryOptions(categories, query),
      sortOptions: buildSelectOptions(
        [
          { value: "", label: "Sin ordenar" },
          { value: "asc", label: "Precio: menor a mayor" },
          { value: "desc", label: "Precio: mayor a menor" },
        ],
        sort
      ),
      limitOptions: buildLimitOptions(limit),
      pagination: {
        page: result.page,
        totalPages: result.totalPages,
        totalDocs: result.totalDocs,
        hasPrevPage: result.hasPrevPage,
        hasNextPage: result.hasNextPage,
        prevLink: result.hasPrevPage ? buildPageLink("/products", req.query, result.prevPage) : null,
        nextLink: result.hasNextPage ? buildPageLink("/products", req.query, result.nextPage) : null,
        pages,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /products/:pid - Detalle completo del producto, con botón de agregar al carrito
router.get("/products/:pid", async (req, res, next) => {
  try {
    const product = await productManager.getProductById(req.params.pid);
    res.render("productDetail", { title: product.title, product });
  } catch (error) {
    next(error);
  }
});

// GET /carts/:cid - Muestra SÓLO los productos que pertenecen a ese carrito
router.get("/carts/:cid", async (req, res, next) => {
  try {
    const cart = await cartManager.getCartById(req.params.cid);

    // Cada línea se arma con su subtotal para mostrarla en la vista
    const items = cart.products.map((item) => ({
      product: item.product,
      quantity: item.quantity,
      subtotal: item.product.price * item.quantity,
    }));

    const total = items.reduce((acc, item) => acc + item.subtotal, 0);
    const units = items.reduce((acc, item) => acc + item.quantity, 0);

    res.render("cart", {
      title: "Mi carrito",
      cartId: String(cart._id),
      items,
      total,
      units,
      isEmpty: items.length === 0,
    });
  } catch (error) {
    next(error);
  }
});

// GET /realtimeproducts - Lista en tiempo real, manejada íntegramente por websockets
router.get("/realtimeproducts", (req, res) => {
  res.render("realTimeProducts", { title: "Productos en tiempo real" });
});

export default router;
