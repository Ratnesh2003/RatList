require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");

// Importing for passport Login
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth2');
const session = require('express-session');
const findOrCreate = require('mongoose-findorcreate');
const { default: mongoose } = require("mongoose");

const app = express();

// Accessing CSS and Images
app.use(express.static(__dirname + "/public"));

// Setting EJS
app.set('view engine', 'ejs');

// To extract data from the form
app.use(bodyParser.urlencoded({ extended: true }));

// Initializing session
app.use(session({
    secret: "This is my first web application.",
    resave: false,
    saveUninitialized: false,
}))

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.MONGODB_URI);

// Defining User Schema
const userSchema = new mongoose.Schema({
    id: {
        type: String,
        default: null
    },
    username: {
        type: String,
        required: [true, "Email required"],
        unique: [true, "Email already registerd"]
    },
    firstName: String,
    lastName: String,
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

// use static authenticate method of model in LocalStrategy
passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
passport.serializeUser(function (user, cb) {
    process.nextTick(function () {
        cb(null, { id: user.id, username: user.username, name: user.displayName });
    });
});

passport.deserializeUser(function (user, cb) {
    process.nextTick(function () {
        return cb(null, user);
    });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://ratlist.herokuapp.com/auth/google/redirect",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},

    async (request, accessToken, refreshToken, profile, done) => {
        const id = profile.id;
        const username = profile.emails[0].value;
        const firstName = profile.name.givenName;
        const lastName = profile.name.familyName;

        const currentUser = await User.findOne({ username });
        console.log(currentUser);

        if (!currentUser) {

            const newUser = new User({
                id, username, firstName, lastName
            });
            console.log(newUser);

            newUser.save()
            return done(null, newUser);
        }

        return done(null, currentUser);
    }
));


// Creating  Tasks Schema


const taskSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    task: {
        type: String,
        required: true
    },
    completion: {
        type: String,
        default: "incomplete"
    }
});

const Task = new mongoose.model("Task", taskSchema);


app.get("/login", function (req, res) {

    if(req.isAuthenticated()){
        res.redirect("/");
    } else {
        res.render("login");
    }
    
})

app.get("/auth/google",
    passport.authenticate("google", {
        scope:
            ["email", "profile"]
    }
    ));

app.get("/auth/google/redirect",
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
        res.redirect("/");
    });

// Render home page
app.get("/", async function (req, res) {
    if (req.isAuthenticated()) {
        const userData = await Task.find({ username: req.user.username });
        if (userData != null) {
            taskList = userData;
        }

        res.render("home", { taskList: taskList, sort: "All" });
        taskList = [];
    } else {
        res.redirect("/login");
    }
})

//Render only completed tasks
app.get("/completedTasks", async function(req, res){
    if (req.isAuthenticated()) {
        const userData = await Task.find({ username: req.user.username, completion: "finished" });
        if (userData != null) {
            taskList = userData;
        }
        res.render("home", { taskList: taskList, sort: "Completed" });
        taskList = [];
    } else {
        res.redirect("/login");
    }
});

// Render only incomplete tasks
app.get("/pendingTasks", async function(req, res){
    if (req.isAuthenticated()) {
        const userData = await Task.find({ username: req.user.username, completion: "incomplete" });
        if (userData != null) {
            taskList = userData;
        }
        res.render("home", { taskList: taskList, sort: "Pending" });
        taskList = [];
    } else {
        res.redirect("/login");
    }
});

// Delete task
app.get("/deleteTask/:_id", function (req, res) {
    const { _id } = req.params;
    Task.deleteOne({ _id }, function (err, cont) {
        if (err) {
            console.log("ERR: \n", err);
        } else {
            console.log("SUCCESS DELETE \n", cont);
        }
    })
    res.redirect("/");
});

// Task completed
app.get("/completeTask/:_id", async function (req, res) {
    const { _id } = req.params;
    const currentTask = await Task.findOne({ _id });
    if (currentTask.completion === "finished") {
        Task.updateOne({ _id }, { completion: "incomplete" }, function (err, cont) {
            if (err) {
                console.log("ERR: \n", err);
            } else {
                console.log("SUCCESS COMPLETE \n", cont);
            }
        });
    } else {
        Task.updateOne({ _id }, { completion: "finished" }, function (err, cont) {
            if (err) {
                console.log("ERR: \n", err);
            } else {
                console.log("SUCCESS COMPLETE \n", cont);
            }
        });
    }



    res.redirect("/");
})


// Logout request
app.get("/logout", function (req, res) {
    req.logout(function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log("Logout successfull");
        }
    })
    res.redirect("/login");
});



// POST Method to add task to the DB
app.post("/", async function (req, res) {

    // New task function
    function createNewTask() {
        const newTask = new Task({
            username: req.user.username,
            task: req.body.addTask,
        });
        newTask.save();
    }
    createNewTask();
    res.redirect("/")

})

// Listening port and server start message
app.listen(process.env.PORT || 3000, function () {
    console.log("Server is started on port 3000.");
})