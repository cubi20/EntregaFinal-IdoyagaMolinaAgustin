import mongoose from "mongoose";

// URI de conexión: se toma de la variable de entorno MONGO_URI (archivo .env).
// Si no está definida, se usa una instancia local de MongoDB por defecto.
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/entregaFinal";

// Conexión a MongoDB, que a partir de esta entrega es la persistencia principal
// del proyecto (reemplaza al sistema de archivos usado en las entregas previas).
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Conectado a MongoDB");
  } catch (error) {
    console.error(`Error al conectar a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
