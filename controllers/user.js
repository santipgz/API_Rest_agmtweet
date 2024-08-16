//Importar dependencias y modulos
const bcrypt = require("bcrypt")
const mongoosePaginate = require("mongoose-pagination")
const fs = require("fs")
const path = require("path")

//Importar modelos
const User = require("../models/user")
const Publication = require("../models/publication")
const Follow = require("../models/follow")

//Importar servicios
const jwt = require("../services/jwt")
const followService = require("../services/followServices")

//Acciones de prueba
const pruebaUser = (req, res) => {
    return res.status(200).send({
        message: "Mensaje enviado desde controllers/user.js",
        usuario: req.user
    });
}

//Registro de usuarios
const register = (req, res) => {

    //Recoger datos de la petición

    let params = req.body

    //Comprobar que me llegan todos los obligatorios

    if (!params.name || !params.email || !params.password || !params.nick) {
        return res.status(400).json({
            status: "error",
            message: "Faltan datos obligatorios por enviar"
        });
    }

    //Control usuarios duplicados (si tienen mismo email o mismo nick)

    User.find({
        $or: [
            { email: params.email.toLowerCase() },
            { nick: params.nick.toLowerCase() },
        ]
    }).exec(async (error, users) => {
        if (error) return res.status(500).json({ status: "error", message: "Error en la consula de usuarios duplicados" })
        if (users && users.length >= 1) {
            return res.status(200).send({
                status: "success",
                message: "El usuario ya existe",
            });
        }

        //Cifrar la contraseña, uso dependencia bcrypt

        let passwordCifrada = await bcrypt.hash(params.password, 10)
        params.password = passwordCifrada

        //Crear objeto de usuario

        let user_to_save = new User(params)

        //Guardar user en db

        user_to_save.save((error, userStored) => {
            if (error || !userStored) return res.status(500).json({ status: "error", message: "Error al guardar el usuario" })

            //Devolver resultado

            return res.status(200).json({
                status: "success",
                message: "Usuario registrado correctamente",
                user: userStored
            });

        })


    })










}

//Login de usuarios
const login = (req, res) => {

    // Recoger parametros body
    let params = req.body;
    console.log(params)

    if (!params.email || !params.password) {
        return res.status(400).send({
            status: "error",
            message: "Faltan datos por enviar-login"
        });
    }

    // Buscar en la bbdd si existe
    User.findOne({ email: params.email })
        .exec((error, user) => {

            if (error || !user) return res.status(404).send({ status: "error", message: "No existe el usuario" });

            // Comprobar la contraseña cifrandola, ya que en la bd esta cifrada
            const passwordCifrada = bcrypt.compareSync(params.password, user.password);

            if (!passwordCifrada) {
                return res.status(400).send({
                    status: "error",
                    message: "No te has identificado correctamente"
                })
            }

            // Conseguir Token
            const token = jwt.createToken(user);

            // Devolver Datos del usuario
            return res.status(200).send({
                status: "success",
                message: "Te has identificado correctamente",
                user: {
                    id: user._id,
                    name: user.name,
                    nick: user.nick
                },
                token
            });
        });
}

//Profile de un usuario por id, recibe parametro id
const profile = (req, res) => {
    // Recibir el parametro del id de usuario por la url
    const id = req.params.id;

    // Consulta para sacar los datos del usuario
    User.findById(id)
        .select({ password: 0, role: 0 })
        .exec(async (error, userProfile) => {
            if (error || !userProfile) {
                return res.status(404).send({
                    status: "error",
                    message: "El usuario no existe o hay un error"
                });
            }

            // Info de seguimiento
            const followInfo = await followService.followThisUser(req.user.id, id);

            // Devolver el resultado 
            return res.status(200).send({
                status: "success",
                user: userProfile,
                following: followInfo.following,
                follower: followInfo.follower
            });

        });

}

//Listado de usuarios paginado, recibe paremtro page
const list = (req, res) => {
    // Controlar en que pagina estamos
    let page = 1;
    if (req.params.page) {
        page = req.params.page;
    }
    page = parseInt(page);

    // Consulta con mongoose paginate
    let itemsPerPage = 2;

    User.find().select("-password -email -role -__v").sort('_id').paginate(page, itemsPerPage, async (error, users, total) => {

        if (error || !users) {
            return res.status(404).send({
                status: "error",
                message: "No hay usuarios disponibles",
                error
            });
        }

        //Sacar un array de ids de los usuarios que me siguen y los que sigo como victor
        let followUserIds = await followService.followUserIds(req.user.id);

        // Devolver el resultado (posteriormente info follow)
        return res.status(200).send({
            status: "success",
            users,
            user_following: followUserIds.following,
            user_follow_me: followUserIds.followers,
            page,
            itemsPerPage,
            total,
            pages: Math.ceil(total / itemsPerPage),

        });
    });

}

//Actualiza cualquier parametro de un usuario, necesario token,email y nick
const update = (req, res) => {
    // Recoger info del usuario a actualizar
    let userIdentity = req.user;
    let userToUpdate = req.body;

    // Eliminar campos sobrantes
    delete userToUpdate.iat;
    delete userToUpdate.exp;
    delete userToUpdate.role;
    delete userToUpdate.image;

    // Comprobar si el usuario ya existe
    User.find({
        $or: [
            { email: userToUpdate.email.toLowerCase() },
            { nick: userToUpdate.nick.toLowerCase() }
        ]
    }).exec(async (error, users) => {

        if (error) return res.status(500).json({ status: "error", message: "Error en la consulta de usuarios" });

        let userIsset = false;
        users.forEach(user => {
            if (user && user._id != userIdentity.id) userIsset = true;
        });

        if (userIsset) {
            return res.status(200).send({
                status: "success",
                message: "El usuario ya existe"
            });
        }

        // Cifrar la contraseña
        if (userToUpdate.password) {
            let pwd = await bcrypt.hash(userToUpdate.password, 10);
            userToUpdate.password = pwd;

        } else {
            delete userToUpdate.password;
        }

        // Buscar y actualizar 
        try {
            let userUpdated = await User.findByIdAndUpdate({ _id: userIdentity.id }, userToUpdate, { new: true });

            if (!userUpdated) {
                return res.status(400).json({ status: "error", message: "Error al actualizar" });
            }

            // Devolver respuesta
            return res.status(200).send({
                status: "success",
                message: "Metodo de actualizar usuario",
                user: userUpdated
            });

        } catch (error) {
            return res.status(500).send({
                status: "error",
                message: "Error al actualizar",
            });
        }

    });
}

//Subida de imagenes/archivos, lo usamos para insertar avatar
const upload = (req, res) => {

    // Recoger el fichero de imagen y comprobar que existe
    if (!req.file) {
        return res.status(404).send({
            status: "error",
            message: "Petición no incluye la imagen"
        });
    }

    // Conseguir el nombre del archivo
    let image = req.file.originalname;

    // Sacar la extension del archivo
    const imageSplit = image.split("\.");
    const extension = imageSplit[1];

    // Comprobar extension, solo acepto png,jpg,jpge,gif
    if (extension != "png" && extension != "jpg" && extension != "jpeg" && extension != "gif") {

        // Borrar archivo subido
        const filePath = req.file.path;
        const fileDeleted = fs.unlinkSync(filePath);

        // Devolver respuesta negativa
        return res.status(400).send({
            status: "error",
            message: "Extensión del fichero invalida"
        });
    }

    // Si si es correcta, guardar imagen en bd
    User.findOneAndUpdate({ _id: req.user.id }, { image: req.file.filename }, { new: true }, (error, userUpdated) => {
        if (error || !userUpdated) {
            return res.status(500).send({
                status: "error",
                message: "Error en la subida del avatar"
            })
        }

        // Devolver respuesta
        return res.status(200).send({
            status: "success",
            user: userUpdated,
            file: req.file,
        });
    });

}

//Obtener el avatar, devuelve la imagen directamente
const avatar = (req, res) => {
    // Obtener el parametro de la url
    const file = req.params.file;

    // Montar el path real de la imagen
    const filePath = "./uploads/avatares/" + file;

    // Comprobar que existe el avatar
    fs.stat(filePath, (error, exists) => {

        if (!exists) {
            return res.status(404).send({
                status: "error",
                message: "No existe la imagen"
            });
        }

        // Devolver un file
        return res.sendFile(path.resolve(filePath));
    });

}

//Contador de seguidores, seguidos y publicaciones. Util para mostrar cuantos usuarios sigo, me siguen y cuantas publicaciones tengo
const counters = async (req, res) => {

    let userId = req.user.id;

    if (req.params.id) {
        userId = req.params.id;
    }

    try {
        const following = await Follow.count({ "user": userId });

        const followed = await Follow.count({ "followed": userId });

        const publications = await Publication.count({ "user": userId });

        return res.status(200).send({
            userId,
            following: following,
            followed: followed,
            publications: publications
        });
    } catch (error) {
        return res.status(500).send({
            status: "error",
            message: "Error en los contadores",
            error
        });
    }
}

//Exportar acciones
module.exports = {
    pruebaUser,
    register,
    login,
    profile,
    list,
    update,
    upload,
    avatar,
    counters
}