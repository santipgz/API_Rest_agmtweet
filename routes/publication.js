const express = require("express");
const router = express.Router();
const multer = require("multer");
const PublicationController = require("../controllers/publication")
const check = require("../middlewares/auth");


//Configuracion de subida de archivos
const storage = multer.diskStorage({
    destination: (req,file,cb) => {
        cb(null, "./uploads/publications/")
    },
    filename : (req, file, cb) =>{
        cb(null, "publication-"+Date.now()+"-"+file.originalname)
    }
})

const uploads = multer({storage})
//Definir rutas

router.get("/prueba-publication",PublicationController.pruebaPublication )
router.post("/save", check.auth, PublicationController.save)
router.get("/detail/:id", check.auth, PublicationController.detail)
router.delete("/remove/:id", check.auth, PublicationController.remove)
router.get("/user/:id/:page?", check.auth, PublicationController.user)
router.post("/upload/:id", [check.auth, uploads.single("archivo")], PublicationController.upload);
router.get("/media/:file", PublicationController.media);
router.get("/feed/:page?", check.auth, PublicationController.feed);

//Exportar ruter

module.exports = router;