import mongoose from "mongoose";

// URI por defecto: una instancia local de MongoDB
const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/entregaFinal";

// Conexión a MongoDB, que a partir de esta entrega es la persistencia principal
// del proyecto (reemplaza al sistema de archivos usado en las entregas previas).
// La URI se toma de la variable de entorno MONGO_URI (archivo .env).
const connectDB = async (uri = process.env.MONGO_URI || DEFAULT_MONGO_URI) => {
  try {
    await mongoose.connect(uri);
    console.log("Conectado a MongoDB");
  } catch (error) {
    console.error(`Error al conectar a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
