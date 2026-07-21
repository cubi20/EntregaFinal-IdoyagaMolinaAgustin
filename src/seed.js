// Script de carga inicial: llena la base con productos de ejemplo para poder
// probar la paginación, los filtros y el ordenamiento.
// Uso:  npm run seed
import "dotenv/config";
import mongoose from "mongoose";
import connectDB from "./config/database.js";
import ProductModel from "./models/product.model.js";

const products = [
  { title: "Notebook Lenovo IdeaPad 3", description: "Ryzen 5, 16GB RAM, SSD 512GB", code: "NB-001", price: 899000, stock: 12, category: "notebooks" },
  { title: "Notebook Asus VivoBook 15", description: "Intel i5 12va gen, 8GB RAM, SSD 512GB", code: "NB-002", price: 1050000, stock: 7, category: "notebooks" },
  { title: "Notebook HP Pavilion 14", description: "Intel i7, 16GB RAM, SSD 1TB", code: "NB-003", price: 1480000, stock: 4, category: "notebooks" },
  { title: "MacBook Air M2", description: "Chip M2, 8GB RAM unificada, SSD 256GB", code: "NB-004", price: 2150000, stock: 0, status: false, category: "notebooks" },
  { title: "Monitor Samsung 24\"", description: "Full HD 75Hz, panel IPS", code: "MO-001", price: 235000, stock: 20, category: "monitores" },
  { title: "Monitor LG UltraGear 27\"", description: "QHD 165Hz, 1ms, panel IPS", code: "MO-002", price: 615000, stock: 9, category: "monitores" },
  { title: "Monitor AOC 22\"", description: "Full HD 75Hz, HDMI y VGA", code: "MO-003", price: 178000, stock: 15, category: "monitores" },
  { title: "Monitor Dell UltraSharp 32\"", description: "4K UHD, USB-C, cobertura sRGB 99%", code: "MO-004", price: 1290000, stock: 0, status: false, category: "monitores" },
  { title: "Teclado mecánico Redragon Kumara", description: "Switch red, RGB, layout español", code: "PE-001", price: 62000, stock: 30, category: "perifericos" },
  { title: "Mouse Logitech G203", description: "8000 DPI, RGB Lightsync", code: "PE-002", price: 38500, stock: 42, category: "perifericos" },
  { title: "Auriculares HyperX Cloud II", description: "Sonido envolvente 7.1 con micrófono", code: "PE-003", price: 145000, stock: 11, category: "perifericos" },
  { title: "Webcam Logitech C920", description: "Full HD 1080p, micrófono estéreo", code: "PE-004", price: 128000, stock: 6, category: "perifericos" },
  { title: "Mousepad XL", description: "90x40cm, base antideslizante", code: "PE-005", price: 19500, stock: 55, category: "perifericos" },
  { title: "Placa de video RTX 4060", description: "8GB GDDR6, ray tracing", code: "CO-001", price: 785000, stock: 5, category: "componentes" },
  { title: "Procesador Ryzen 5 5600X", description: "6 núcleos, 12 hilos, 3.7GHz", code: "CO-002", price: 295000, stock: 8, category: "componentes" },
  { title: "Memoria RAM Kingston Fury 16GB", description: "DDR4 3200MHz, disipador", code: "CO-003", price: 92000, stock: 25, category: "componentes" },
  { title: "SSD NVMe Samsung 980 1TB", description: "Lectura hasta 3500MB/s", code: "CO-004", price: 165000, stock: 18, category: "componentes" },
  { title: "Fuente Corsair CV650", description: "650W, certificación 80 Plus Bronze", code: "CO-005", price: 118000, stock: 0, status: false, category: "componentes" },
  { title: "Silla gamer Redragon Coeus", description: "Reclinable, apoyabrazos 3D", code: "MU-001", price: 420000, stock: 6, category: "muebles" },
  { title: "Escritorio gamer 120cm", description: "Superficie de carbono, pasacables", code: "MU-002", price: 275000, stock: 10, category: "muebles" },
  { title: "Soporte de monitor doble", description: "Brazo articulado, VESA 75/100", code: "MU-003", price: 89000, stock: 14, category: "muebles" },
  { title: "Router TP-Link Archer AX23", description: "WiFi 6 AX1800, 4 antenas", code: "RE-001", price: 132000, stock: 13, category: "redes" },
  { title: "Switch TP-Link 8 puertos", description: "Gigabit, no administrable", code: "RE-002", price: 47000, stock: 21, category: "redes" },
  { title: "Access Point Ubiquiti U6 Lite", description: "WiFi 6, alimentación PoE", code: "RE-003", price: 198000, stock: 3, category: "redes" },
];

const seed = async () => {
  await connectDB();

  // Se limpia la colección para que el seed sea repetible
  await ProductModel.deleteMany({});

  // Cada producto usa la imagen de su categoría, servida desde /public/img
  const withThumbnails = products.map((product) => ({
    ...product,
    thumbnails: [`/img/${product.category}.svg`],
  }));

  const created = await ProductModel.insertMany(withThumbnails);

  console.log(`Se cargaron ${created.length} productos de ejemplo.`);
  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(`Error al cargar los productos: ${error.message}`);
  await mongoose.disconnect();
  process.exit(1);
});
