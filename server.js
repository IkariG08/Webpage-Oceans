const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const app = express();
const bodyParser = require("body-parser");
const https = require("https");

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.engine("ejs", require("ejs").renderFile);


// Conéctate a MongoDB Atlas
mongoose.connect("mongodb+srv://Giorgio-admin:cardenas29160810@cluster0.tkjjasv.mongodb.net/WebpageOceans?retryWrites=true&w=majority", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});



// Definir un esquema para los usuarios
const userSchema = new mongoose.Schema({
  name: String,
  lname: String,
  email: String,
  password: String,
});


// Crear el modelo de usuario
const User = mongoose.model("registeredusers", userSchema);



// Configuración de sesión
app.use(session({
  secret: 'tu_secreto',
  resave: false,
  saveUninitialized: true
}));

const requireLogin = async (req, res, next) => {
  if (req.session.isLoggedIn) {
    try {
      // Obtener información del usuario actual desde MongoDB
      const currentUser = await User.findOne({ email: req.session.email });

      // Verificar si el usuario está definido
      if (currentUser) {
        // Agregar la información del usuario a res.locals
        res.locals.user = currentUser;

        // Permitir el acceso
        return next();
      }
    } catch (error) {
      console.error("Could not find users in database", error.message);
    }
  }

  // El usuario no está autenticado o no se encontró en la lista, redirige al formulario de login
  res.redirect("/login");
};



app.get("/", (req, res) => {
  res.render("index");
});

app.get("/help", (req, res) => {
  res.render("help");
});


app.get("/login", (req, res) => {
  res.render("login");
});

// Ruta de procesamiento de inicio de sesión
app.get("/login/process", async (req, res) => {
  const { email, password } = req.query;

  try {
    // Buscar al usuario en la base de datos
    const user = await User.findOne({ email, password });

    if (user) {
      // Establecer la sesión como iniciada
      req.session.isLoggedIn = true;
      req.session.email = email;

      // Redirigir a la página de perfil después del inicio de sesión exitoso
      res.redirect("/profile");
    } else {
      // Mostrar mensaje de error si el usuario no existe
      res.render("login", { error: "User not found. Please check your data and try again." });
    }
  } catch (error) {
    console.error("Login error", error.message);
    res.status(500).send("Server error while trying login");
  }
});


app.get("/register", (req, res) => {
  res.render("register");
});


// Ruta de procesamiento de registro
app.get("/register/process", async (req, res) => {
  const { name, lname, email, password } = req.query;

  // Validar que los campos no estén vacíos
  if (!name || !lname || !email || !password) {
    return res.render("register", {error: "Please fill all the blanks"});
  }

  try {
    // Verificar si el usuario ya está registrado
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.render("register", {error: "This user is already registered"});
    }

    // Crear un nuevo usuario
    const newUser = new User({
      name,
      lname,
      email,
      password,
    });

    // Guardar el usuario en la base de datos
    await newUser.save();

    // Redirigir a la página de perfil después del registro
    console.log("Usuario registrado exitosamente");
    res.redirect("/login");
  } catch (error) {
    console.error("Register error: ", error.message);
    res.status(500).send("Server error while trying to register");
  }
});



// Ruta protegida - Web Carbon Calculator
app.get("/webcarb", requireLogin, (req, res) => {
  res.render("webcarb");
});



// Ruta protegida - Profile
app.get("/profile", requireLogin, (req, res) => {
  res.render("profile");
});



// Ruta para guardar cambios en la configuración del usuario
app.post("/save_settings", requireLogin, async (req, res) => {
  const currentUser = res.locals.user;

  const { firstname, lastname, email } = req.body;

  try {
    // Buscar al usuario en la base de datos
    const user = await User.findOne({ email: currentUser.email });

    if (user) {
      // Actualizar los campos
      user.name = firstname || user.name;
      user.lname = lastname || user.lname;

      // Guardar los cambios en la base de datos
      await user.save();

      // Redirigir a la página de perfil después de guardar los cambios
      res.redirect("/profile");
    } else {
      // Mostrar mensaje de error si el usuario no existe
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error while trying to save new info: ", error.message);
    res.status(500).send("Internal server error");
  }
});

app.post("/logout", requireLogin, (req, res) => {
  // Destruir la sesión
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error: ", err);
      res.status(500).send("Logout error");
    } else {
      // Redirigir a la página de inicio después de cerrar sesión
      res.redirect("/");
    }
  });
});

// Ruta para eliminar la cuenta
app.post("/del_acc", requireLogin, async (req, res) => {
  const currentUser = res.locals.user;

  try {
    // Eliminar al usuario de la base de datos
    await User.deleteOne({ email: currentUser.email });

    // Destruir la sesión
    req.session.destroy((err) => {
      if (err) {
        console.error("Delete account error: ", err);
        res.status(500).send("Delete account error");
      } else {
        // Redirigir a la página de inicio después de eliminar la cuenta y cerrar sesión
        res.redirect("/");
      }
    });
  } catch (error) {
    console.error("Delete account error: ", error.message);
    res.status(500).send("Delete account error");
  }
});


app.get("/webcarb/result", (req, res) => {
  // Obtener la URL del parámetro de la consulta
  const url = req.query.urlform;

  // Verificar si la URL está presente
  if (!url) {
    return res.send("Please input an URL");
  }

  // Hacer una solicitud a la API de websitecarbon.com
  https.get(`https://api.websitecarbon.com/site?url=${url}`, (apiRes) => {
    let data = "";

    // Recibir la respuesta de la API
    apiRes.on("data", (chunk) => {
      data += chunk;
    });

    // Una vez que se haya recibido toda la respuesta
    apiRes.on("end", () => {
      // Parsear los datos JSON
      const result = JSON.parse(data);

      // Renderizar la plantilla con los resultados
      res.render("webcarb", { result });
      console.log("URL registrada exitosamente")
    });
  }).on("error", (err) => {
    console.error("API call error: ", err.message);
    res.send("There was an error while trying to get your website's data. Please try another one.");
  });
});




app.listen(3000, (err) => {
  console.log("Listening on port 3000");
});
