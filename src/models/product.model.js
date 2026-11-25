import mongoose from "mongoose";
import mongoosePaginate from "mongoose-paginate-v2";

// Esquema de productos. Conserva exactamente los mismos campos que se venían
// usando con la persistencia en archivos, ahora validados por Mongoose.
const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "El campo title es obligatorio"], trim: true },
    description: {
      type: String,
      required: [true, "El campo description es obligatorio"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "El campo code es obligatorio"],
      unique: true,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "El campo price es obligatorio"],
      min: [0, "El precio no puede ser negativo"],
    },
    status: { type: Boolean, default: true },
    stock: {
      type: Number,
      required: [true, "El campo stock es obligatorio"],
      min: [0, "El stock no puede ser negativo"],
      validate: {
        validator: Number.isInteger,
        message: "El stock debe ser un número entero",
      },
    },
    category: {
      type: String,
      required: [true, "El campo category es obligatorio"],
      trim: true,
      lowercase: true,
    },
    thumbnails: { type: [String], default: [] },
  },
  { versionKey: false }
);

// Índices para que los filtros de la consigna (categoría y disponibilidad)
// y el ordenamiento por precio no hagan un scan completo de la colección.
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ price: 1 });

// Plugin que agrega el método paginate() al modelo: es el que resuelve
// limit, page, sort y el resto de los datos de paginación de la consigna.
productSchema.plugin(mongoosePaginate);

const ProductModel = mongoose.model("Product", productSchema);

export default ProductModel;
