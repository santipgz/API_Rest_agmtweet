const mongoose = require("mongoose");
require('dotenv').config();

const connection = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log("Conectado correctamente a bd: agmtweetdb");
    } catch (error) {
        console.log(error);
        throw new Error("No se ha podido conectar a la base de datos !!");
    }
};

module.exports = connection;
