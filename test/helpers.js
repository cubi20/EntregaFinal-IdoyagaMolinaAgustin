import ProductModel from "../src/models/product.model.js";
import CartModel from "../src/models/cart.model.js";

// 12 productos de prueba: 3 categorías, 4 productos por categoría y
// 3 sin disponibilidad (status: false). Con limit 10 por defecto, son 2 páginas.
export const SAMPLE_PRODUCTS = [
  { title: "Notebook A", description: "Notebook de prueba A", code: "NB-1", price: 900000, stock: 5, category: "notebooks" },
  { title: "Notebook B", description: "Notebook de prueba B", code: "NB-2", price: 1050000, stock: 3, category: "notebooks" },
  { title: "Notebook C", description: "Notebook de prueba C", code: "NB-3", price: 1480000, stock: 2, category: "notebooks" },
  { title: "Notebook D", description: "Notebook de prueba D", code: "NB-4", price: 2150000, stock: 0, status: false, category: "notebooks" },
  { title: "Monitor A", description: "Monitor de prueba A", code: "MO-1", price: 235000, stock: 20, category: "monitores" },
  { title: "Monitor B", description: "Monitor de prueba B", code: "MO-2", price: 615000, stock: 9, category: "monitores" },
  { title: "Monitor C", description: "Monitor de prueba C", code: "MO-3", price: 178000, stock: 15, category: "monitores" },
  { title: "Monitor D", description: "Monitor de prueba D", code: "MO-4", price: 1290000, stock: 0, status: false, category: "monitores" },
  { title: "Teclado", description: "Teclado de prueba", code: "PE-1", price: 62000, stock: 30, category: "perifericos" },
  { title: "Mouse", description: "Mouse de prueba", code: "PE-2", price: 38500, stock: 42, category: "perifericos" },
  { title: "Auriculares", description: "Auriculares de prueba", code: "PE-3", price: 145000, stock: 11, category: "perifericos" },
  { title: "Mousepad", description: "Mousepad de prueba", code: "PE-4", price: 19500, stock: 0, status: false, category: "perifericos" },
];

// Deja la base vacía antes de cada test
export const resetDatabase = async () => {
  await Promise.all([ProductModel.deleteMany({}), CartModel.deleteMany({})]);
};

// Inserta los productos de prueba y los devuelve en el orden de carga
export const createSampleProducts = async () => {
  const products = await ProductModel.insertMany(SAMPLE_PRODUCTS);
  return products.map((product) => product.toObject());
};

// Crea un carrito directamente en la base con las líneas indicadas
export const createCart = async (lines = []) => {
  const cart = await CartModel.create({ products: lines });
  return cart.toObject();
};
