const dotenv = require('dotenv').config()

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash"); //no role of lowdash when working with db
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

// let users = [];
const homeContent = "Welcome to MyReads! Write gist of books you've read and keep track of learnings from the books. You can make list of books to read or maybe bookmark them and further compile your thoughts here to enhance your book reading and learning experience!<br/>Your personal blogs made from Compose section will be displayed here.";

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/readifyDB", { useNewUrlParser: true });

//BLOGS
const blogsSchema = {
  title: String,
  content: String
}

const Blog = mongoose.model("Blog", blogsSchema);
const defaultBlog = new Blog({
    title: "Book Name",
    content:"Create, Style and Delete your own book review",
});


//------------------ITEMS N LISTS MODEL----------------
const itemsSchema = {
    name: String
}

const Item = mongoose.model("Item", itemsSchema);
const item1 = new Item({
    name: "Make your personal book list",
});
const item2 = new Item({
    name: "Use checkbox and button to edit list",
});
const item3 = new Item({
    name: "Make multiple list with different titles!",
});

const defaultItems = [item1, item2, item3];

// const listsSchema = {
//     name: String,
//     items: [itemsSchema]
// };

// const List = mongoose.model("List", listsSchema);

// ------------------------------------USER SCHEMA---------------------------
const profileSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  blogs: [blogsSchema],
  //lists:[listsSchema]
  items:[itemsSchema]
});


profileSchema.plugin(passportLocalMongoose);
profileSchema.plugin(findOrCreate); //FOR GOOGLE AUTH



const User = new mongoose.model("User", profileSchema);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

//FROM PASSPORT OAUTH 2.0---------ONLY FOR GOOGLE AUTH ----------------------------------
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/reads",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);
//route created  @googleconsole /auth/google/reads
app.get("/auth/google/reads",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to reads.
    res.redirect("/home");
  });
//------------------------------GOOGLE AUTH REQUEST ROUTES ENDS-----------------


app.get("/", function (req, res) {
res.render("access");
});

app.get("/login", function (req, res) {
    res.render("login");
});
app.get("/register", function (req, res) {
    res.render("register");
});


app.get("/home", function (req, res) {
  const user_id = req.user.id;
  //finding USER by session id created and tapping into BLOGS SCHEMA IN IT for HOME page rendering
  User.findOne({ _id: user_id }, function (err, foundResults) {
    console.log("GET REQ KE FOUNDRESULT"); 
    console.log(user_id);
    console.log(foundResults);     
  
    if (err) {
      console.log(err);
    } else {
      if (foundResults.blogs.length == 0) {
        //adding default blog
      foundResults.blogs.push(defaultBlog);
      foundResults.save();
        res.redirect("/home")

      } else {
        res.render("home",
          {
            startingContent: homeContent,
            posts: foundResults.blogs,
            user: foundResults._id
          });
      }
    }
    })

});


app.get("/compose", function (req, res) {
  //USER CAN GO TO THIS PAGE ONLY IF AUTHENT----
  if (req.isAuthenticated()) {
    res.render("compose");
  } else {
    res.redirect("/login");
  }
});


app.get("/posts/:user/:postId", function(req, res){
const reqBookId = req.params.postId; //no use of lowdash as it's ID not name!
const userId = req.params.user;

  User.findOne({
    _id: userId,
    'blogs._id': reqBookId  //Array element's id***
  },
    {  /* projection */
      "blogs.$": 1
    },
    function (err, data) {
      console.log("BOOK DATA---->");
      console.log(data);
      console.log(data.blogs[0].content);
     

      res.render("post", {
        title: data.blogs[0].title,
        content: data.blogs[0].content,
        bookId: data.blogs[0]._id
      });

    });
});



app.get('/logout', function (req, res){
  //callback for req.logout(); so redirect only after cookie is destroyed 
    req.session.destroy(function (err) {
    res.redirect('/'); //Inside a callback… bulletproof!
  });
});



//-----------------------POST--------------------------------------------
app.post("/register", function(req, res){

  User.register({username: req.body.username}, req.body.password, function(err, user){
    if (err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/home");
      });
    }
  });

});

app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });

  req.login(user, function(err){
    //err if user is not registered or any other err
      if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/home");
      });
    }
  });

});


app.post("/compose", function (req, res) {
  //Once the user is authenticated and their session gets saved, their user details are saved to req.user.
  const user_id = req.user.id;
        //CREATING NEW DOC AND SAVING IT--USING .save() AS SHORTCUT OF insertMany()
    const freshBlog = new Blog({
         title: req.body.postTitle,
        content: req.body.postBody
    });

    User.findOne({ _id: user_id }, function (err, foundResults) {      
      foundResults.blogs.push(freshBlog);
      console.log("COMPOSE DETAILS--->");
      console.log(user_id);
            console.log(foundResults);
            foundResults.save();
             res.redirect("/home");
         
    })
});


app.post('/deleteblog', function (req, res) {
  let userId = req.user.id;
  let blogId = req.body.blogbtn;
  let flag = req.body.flag;

  console.log(userId);
  console.log(blogId);

    if (flag==="1") {
    
      User.updateOne({ _id: userId }, {
        $pull: {
          blogs: { _id: blogId }
        }
      },{ safe: true },
        function removeConnectionsCB(err, obj){
          if (!err) {
             console.log(obj);
            res.redirect("/home");
          }
        else
          console.log(err);
    }
      );    
    } else {
        res.redirect("/posts/"+userId+"/"+ blogId);
    }
});


  
//UPDATE-> move content to compose page after destroying earlier data
app.post('/updateblog', function (req, res) {
let userId = req.user.id;
  let blogId = req.body.updbtn;
  let title = req.body.reqbooktitle;
  let content = req.body.reqbookcontent;
//   console.log(userId);
//   console.log(blogId);
// console.log(content);
  User.updateOne({ _id: userId }, {
        $pull: {  //pull-> removes element from array
          blogs: { _id: blogId }
        }
      },{ safe: true },
        function removeConnectionsCB(err, obj){
          if (!err) {
             console.log(obj);
            res.render("update", { kindatitle: title, kindacontent: content });
          }
        else
          console.log(err);
    }
      );

});


//-------------------------------GET ROUTE FROM LISTS---------------------
app.get("/lists", function (req, res) {
    
   const user_id = req.user.id;
  User.findOne({ _id: user_id }, function (err, foundResults) {
    if (err) {
      console.log(err);
    } else {
      console.log(foundResults);
    
      if (foundResults.items.length == 0) {
        //adding default blog
        foundResults.items.push(item1);
        foundResults.items.push(item2);
        foundResults.items.push(item3);
        foundResults.save();
        res.redirect("/lists");
      } else {
        res.render("lists",
          { listTitle: "To Read", kindaitems: foundResults.items }
        );
      }
    }
  });

});

app.get("/home", function (req, res) {
  const user_id = req.user.id;
  //finding USER by session id created and tapping into BLOGS SCHEMA IN IT for HOME page rendering
  User.findOne({ _id: user_id }, function (err, foundResults) {
      
  
    if (err) {
      console.log(err);
    } else {
      res.render("home",
        {
          startingContent: homeContent,
          posts: foundResults.blogs,
          user: foundResults._id
        });
    }
    })

});






app.listen(3000, function() {
  console.log("Server started on port 3000");
});