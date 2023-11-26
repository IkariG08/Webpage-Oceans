const express = require("express");
const session = require("express-session");
const app = express();
const bodyParser = require("body-parser");
const https = require("https");

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.engine("ejs", require("ejs").renderFile);


// Variable global para almacenar los usuarios registrados
let registeredUsers = [];


// Configuración de sesión
app.use(session({
  secret: 'tu_secreto',
  resave: false,
  saveUninitialized: true
}));

app.get("/", (req, res) => {
  res.render("index");
});

app.get("/help", (req, res) => {
  res.render("help");
});

const requireLogin = (req, res, next) => {
  if (req.session.isLoggedIn) {
    // Obtener información del usuario actual
    const currentUser = registeredUsers.find(user => user.email === req.session.email);

    // Verificar si el usuario está definido
    if (currentUser) {
      // Agregar la información del usuario a res.locals
      res.locals.user = currentUser;

      // Permitir el acceso
      return next();
    }
  }

  // El usuario no está autenticado o no se encontró en la lista, redirige al formulario de login
  res.redirect("/login");
};

// Ruta protegida - Web Carbon Calculator
app.get("/webcarb", requireLogin, (req, res) => {
  res.render("webcarb");
});

app.get("/login", (req, res) => {
  res.render("login");
});

// Ruta de procesamiento de inicio de sesión
app.get("/login/process", (req, res) => {
  const { email, password } = req.query;

  // Buscar al usuario en la variable global
  const user = registeredUsers.find(user => user.email === email && user.password === password);

  if (user) {
    // Establecer la sesión como iniciada
    req.session.isLoggedIn = true;
    req.session.email = email;  // Asegurarse de que la sesión contenga el correo electrónico del usuario

    // Redirigir a la página de perfil después del inicio de sesión exitoso
    res.redirect("/profile");
  } else {
    // Mostrar mensaje de error si el usuario no existe
    res.render("login", { error: "User not found, please check your data" });
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});


// Ruta de procesamiento de registro
app.get("/register/process", (req, res) => {
  const { name, lname, email, password } = req.query;

  // Validar que los campos no estén vacíos (deberías agregar más validaciones)
  if (!name || !lname || !email || !password) {
    return res.send("Please fill all of the blanks");
  }

  // Verificar si el usuario ya está registrado
  const userExists = registeredUsers.find(user => user.email === email);
  if (userExists) {
    return res.send("This email is already registered, please use another one");
  }

  // Guardar al usuario en la variable global
  registeredUsers.push({ name, lname, email, password });

  // Redirigir a la página de perfil después del registro (puedes cambiar la ruta según tu lógica)
  console.log("Usuario registrado exitosamente");
  res.redirect("/login");
});

// Ruta protegida - Profile
app.get("/profile", requireLogin, (req, res) => {
  res.render("profile");
});

// Ruta para procesar la actualización de configuraciones
app.post("/save_settings", requireLogin, (req, res) => {
  const { firstname, lastname, email } = req.body;

  // Validar que los campos no estén vacíos (puedes agregar más validaciones según tu lógica)
  if (!firstname || !lastname || !email) {
    return res.send("Please fill all of the blanks");
  }

  // Obtener el usuario actual desde res.locals
  const currentUser = res.locals.user;

  // Actualizar los campos del usuario actual
  currentUser.name = firstname;
  currentUser.lname = lastname;
  currentUser.email = email;

  // Redirigir a la página de perfil después de guardar las configuraciones
  res.redirect("/profile");
});

app.post("/logout", requireLogin, (req, res) => {
  // Destruir la sesión
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al cerrar sesión:", err);
      res.status(500).send("Error al cerrar sesión");
    } else {
      // Redirigir a la página de inicio después de cerrar sesión
      res.redirect("/");
    }
  });
});

// Ruta para eliminar la cuenta
app.post("/del_acc", requireLogin, (req, res) => {
  // Obtener el usuario actual desde res.locals
  const currentUser = res.locals.user;

  // Eliminar al usuario de la variable global
  registeredUsers = registeredUsers.filter(user => user.email !== currentUser.email);

  // Destruir la sesión
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al eliminar la cuenta y cerrar sesión:", err);
      res.status(500).send("Error al eliminar la cuenta y cerrar sesión");
    } else {
      // Redirigir a la página de inicio después de eliminar la cuenta y cerrar sesión
      res.redirect("/");
    }
  });
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
    console.error("Error al hacer la solicitud a la API:", err.message);
    res.send("Hubo un error al obtener los datos del sitio web");
  });
});




app.listen(3000, (err) => {
  console.log("Listening on port 3000");
});
