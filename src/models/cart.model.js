import mongoose from "mongoose";

// Sub-esquema de cada línea del carrito. En "product" se guarda SÓLO el
// ObjectId del producto (ref al modelo Product), tal como pide la consigna:
// almacenamos únicamente el id y lo desglosamos con populate al consultarlo.
const cartProductSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    quantity: { type: Number, required: true, min: 1, default: 1 },
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
