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


const homeContent = "Welcome to MyReads! Write gist of books you've read and keep track of learnings from the books in the form of board which you can share with others too. You can make list of books to read or maybe bookmark them and further compile your thoughts here to enhance your book reading and learning experience!<br/>Your personal blogs made and stylized from Compose section will be displayed here with available CRUD functionalities.";
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const d = new Date();

// app.set("trust proxy", 1);

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
  // cookie: {
  //   sameSite: "none",
  //   secure: true,
  //   macAge: 1000*60*60*24*7 //one week
  // }
}));

app.use(passport.initialize());
app.use(passport.session());


//mongoose.connect("mongodb://localhost:27017/readifyDB", { useNewUrlParser: true });

mongoose.connect("mongodb+srv://admin-sanskriti:Test123@cluster0.kolpx.mongodb.net/myReadsDB", { useNewUrlParser: true });

// mongoose.connect("mongodb+srv://admin-sanskriti:Test123@cluster0.kolpx.mongodb.net/?retryWrites=true&w=majority/readifyDB", { useNewUrlParser: true });


//PublicBlog
const sharesSchema = {
  title: String,
  content: String
}

const Share = mongoose.model("Share", sharesSchema);



//BLOGS
const blogsSchema = {
  title: String,
  content: String
}

const Blog = mongoose.model("Blog", blogsSchema);
const defaultBlog = new Blog({
    title: "Book Name",
    content:"Create, Style, Update and Delete your own book reviews. Further you can view other users reviews and share your own reads for others to discover. Keep learning and keep sharing your insghits!",
});


//----------------------------------------ITEMS N LISTS MODEL------------------------------------
const itemsSchema = {
    name: String
}

const Item = mongoose.model("Item", itemsSchema);
const item1 = new Item({
    name: "Make your personal book related list",
});
const item2 = new Item({
    name: "Use checkbox and button to edit list",
});
const item3 = new Item({
    name: "Get last updated detail at top!",
});

const defaultItems = [item1, item2, item3];

// const listsSchema = {
//     name: String,
//     items: [itemsSchema]
// };

// const List = mongoose.model("List", listsSchema);

// ----------------------------------------------------------USER SCHEMA------------------------------------------------------------
const profileSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String,
  lastday: String,
  shares:[sharesSchema],
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

//FROM PASSPORT OAUTH 2.0------------------------------------------------------ONLY FOR GOOGLE AUTH-------------------------------------------

// https://infinite-citadel-00171.herokuapp.com/auth/google/reads
// http://localhost:3000/auth/google/reads

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "/auth/google/reads",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo" //getting info from googleapi rather than google+ acct
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));


app.get("/", function (req, res) {
res.render("access");
});



//FOR ROUTES FROM SIGNUP/LOGIN WITH GOOGLE STRATEGY
app.get("/auth/google",
  passport.authenticate('google', { scope: ["profile"] })
);
//route created  @googleconsole /auth/google/callback
app.get("/auth/google/reads",
  passport.authenticate('google', { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to callback.
    res.redirect("/home");
  });

//------------------------------GOOGLE AUTH REQUEST ROUTES ENDS-----------------





app.get("/login", function (req, res) {
    res.render("login");
});
app.get("/register", function (req, res) {
    res.render("register");
});


app.get("/home", function (req, res) {
  if (req.isAuthenticated()) {

  const user_id = req.user.id;
  //finding USER by session id created and tapping into BLOGS SCHEMA IN IT for HOME page rendering
  User.findOne({ _id: user_id }, function (err, foundResults) {
    // console.log("GET REQ KE FOUNDRESULT"); 
    // console.log(user_id);
    // console.log(foundResults);     
  
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
      
  } else {
    res.redirect("/login");
  }

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
      // console.log("BOOK DATA---->");
      // console.log(data);
      // console.log(data.blogs[0].content);
     

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
            // console.log("COMPOSE DETAILS--->");
            // console.log(user_id);
            // console.log(foundResults);
            foundResults.save();
             res.redirect("/home");
         
    })
});


app.post('/deleteblog', function (req, res) {
  let userId = req.user.id;
  let blogId = req.body.blogbtn;
  let flag = req.body.flag;

  // console.log(userId);
  // console.log(blogId);

    if (flag==="1") {
    
      User.updateOne({ _id: userId }, {
        $pull: {
          blogs: { _id: blogId }
        }
      },{ safe: true },
        function removeConnectionsCB(err, obj){
          if (!err) {
            //  console.log(obj);
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
            //  console.log(obj);
            res.render("update", { kindatitle: title, kindacontent: content });
          }
        else
          console.log(err);
    }
      );

});


//------------------------------------------------------------------GET ROUTE FROM LISTS-----------------------------------------------------
app.get("/lists", function (req, res) {
     
 
  if (req.isAuthenticated()) {

  const user_id = req.user.id;
  User.findOne({ _id: user_id }, function (err, foundResults) {
    if (err) {
      console.log(err);
    } else {
     
    
      if (foundResults.items.length == 0) {
        //adding default blog
        foundResults.items.push(item1);
        foundResults.items.push(item2);
        foundResults.items.push(item3);
        foundResults.save();
        res.redirect("/lists");
      } else {        
        res.render("lists",
          { listTitle: "To Read", kindaitems: foundResults.items, kindaday: foundResults.lastday }
        );
      }
    }
  });
      
  } else {
    res.redirect("/login");
  }

});

//-----------------------------------------------------------------------POST 'N' DELETE ROUTE FROM LISTS---------------------------------------------------

app.post("/lists", function (req, res) {
  
     const user_id = req.user.id;
    const itemName = req.body.item;
    //const listName = req.body.btn_list;
  
  //Updating last visited Day
  const day = d.getDate() + " " + months[d.getMonth()] + ", " + d.getFullYear();

  // This function has 4 parameters i.e.filter, update, options, callback
  User.updateOne({ _id: user_id }, 
    {lastday: day}, function (err, docs) {
    if (err){
        console.log(err)
    }
    else{
        console.log("Updated Docs : ", docs);
    }
}); 
    //CREATING NEW DOC AND SAVING IT--USING .save() AS SHORTCUT OF insertMany()
    const freshitem = new Item({
        name: itemName
    });

  User.findOne({ _id: user_id }, function (err, foundResults) {      
    foundResults.items.push(freshitem);
  
            foundResults.save();
             res.redirect("/lists");
         
    })

});

app.post('/deleteitem', function (req, res) {
  let userId = req.user.id;
  let chItemId = req.body.checkbox;
  // let currList = req.body.currlistName;
  
//Updating last visited Day
  const day = d.getDate() + " " + months[d.getMonth()] + ", " + d.getFullYear();

  User.updateOne({ _id: userId }, 
    {lastday: day}, function (err, docs) {
    if (err){
        console.log(err)
    }
    else{
        console.log("Updated Docs : ", docs);
    }
});

    User.updateOne({ _id: userId }, {
        $pull: {
          items: { _id: chItemId }
        }
      },{ safe: true },
        function removeConnectionsCB(err, obj){
          if (!err) {
             //console.log(obj);
            res.redirect("/lists");
          }
        else
          console.log(err);
    }
      );    
    
});

//-----------------------------------------------------------------------GET 'N' POST ROUTE FROM SHARED BLOG---------------------------------------------------

//shared page
app.get("/feed", function (req, res) {
    User.find({"shares": { $exists: true, $not: {$size: 0} } }, function(err, foundUsers){
    if (err){
      console.log(err);
    } else {
      if (foundUsers) {
        // console.log("SHARED BLOGS----->");
        // console.log(foundUsers);
        res.render("feed", {usersWithSharedpost: foundUsers});
      }
    }
  });
});

//share btn
app.post("/share", function(req, res){
  let userId = req.user.id;
  // let blogId = req.body.sharebtn;
  let btitle = req.body.posttitle;
  let bcontent = req.body.postcontent;
       
    const freshSharedblog = new Share({
         title: btitle,
        content: bcontent
    });

    User.findOne({ _id: userId }, function (err, foundResults) {      
      foundResults.shares.push(freshSharedblog);
      // console.log(foundResults);
      
            foundResults.save();
             res.redirect("/feed");
         
    })
});

let port = process.env.PORT;
if (port == null || port == "") {
 port = 3000; 
}
  

app.listen( port, function() {
  console.log("Server started on port successfully");
});