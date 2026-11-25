import mongoose from "mongoose";

// Sub-esquema de cada línea del carrito. En "product" se guarda SÓLO el
// ObjectId del producto (ref al modelo Product), tal como pide la consigna:
// almacenamos únicamente el id y lo desglosamos con populate al consultarlo.
const cartProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Cada línea del carrito necesita el id del producto"],
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "La cantidad debe ser mayor o igual a 1"],
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: "La cantidad debe ser un número entero",
      },
    },
  },
  { _id: false }
);

const cartSchema = new mongoose.Schema(
  {
    products: { type: [cartProductSchema], default: [] },
  },
  { versionKey: false }
);

const CartModel = mongoose.model("Cart", cartSchema);

export default CartModel;
