//jshint esversion:6

const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const _ = require("lodash"); //no role of lowdash when working with db
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const saltRounds = 10;


const homeContent = "Welcome to MyReads! Write gist of books you've read and keep track of learnings from the books. You can make list of books to read or maybe bookmark them and further compile your thoughts here to enhance your book reading and learning experience!<br/>Your personal blogs made from Compose section will be displayed here.";

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));


mongoose.connect("mongodb://localhost:27017/myreadsDB", { useNewUrlParser: true });

const blogsSchema = {
  title: String,
  content:String
}

const Blog = mongoose.model("Blog", blogsSchema);


app.get("/", function (req, res) {
res.render("access");
});


app.get("/login", function (req, res) {
    res.render("login");
});
app.get("/register", function (req, res) {
    res.render("register");
});


app.get("/blogs", function (req, res) {
  //finding the post in Blogs collection->
  Blog.find({}, function (err, foundResults) {
  if(!err){
    res.render("home", {
    startingContent: homeContent,
    posts: foundResults
    });
 }
    })
 
});

app.get("/compose", function(req, res){
  res.render("compose");
});

app.post("/compose", function(req, res){

  const post = new Blog({
  title: req.body.postTitle,
  content: req.body.postBody
  });
  

  //TO RENDER PAGE ONLY AFTER THE COMPLETE DATA IS SAVED
  //post.save({}, function (err) {   //both will WORK
  post.save(function(err){  
  if (!err) {
      res.redirect("/blogs");
   } 
  });
});


app.get("/posts/:postId", function(req, res){

  //CAN'T USE LOWECASE-LODASH HERE; coz earlier it was Name here but now we are calling by ID!!
const requestedBookId = req.params.postId;
 
    Blog.findOne({ _id: requestedBookId }, function (err, foundResults) {
     
      res.render("post", {
      title: foundResults.title,
      content: foundResults.content,
      bookId: foundResults._id
    });
  });

});

app.post('/deleteblog', function (req, res) {
    let blogId = req.body.blogbtn;
    let flag = req.body.flag;
    if (flag==="1") {
    Blog.findByIdAndRemove(blogId, function (err) {
        console.log("deleted");
        if (!err) {
            res.redirect("/blogs");
        }
    });  
    } else {
        res.redirect("/posts/"+ blogId);
    }
});

// app.post('/updateblog', function (req, res) {
//     let blogId = req.body.updbtn;
//     console.log(blogId);
    
//   Blog.findOne({ _id: blogId }, function (err, foundResults) {
     
//       console.log(foundResults);
//     //   res.render("compose", {
//     //   postTitle: foundResults.title,
//     //   postContent: foundResults.content
//     // //   bookId: foundResults._id
//     // });
//   });


// });




// TODOLIST
//  Items Schema
const itemsSchema = {
    name: String
}
//mongoose model based on Schema
const Item = mongoose.model("Item", itemsSchema);

//creating document from the MODEL
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

//MAKING ANOTHER SCHEMA FOR DIFF LIST NAME AND ITEMS ARR
const listsSchema = {
    name: String,
    items: [itemsSchema]
};

const List = mongoose.model("List", listsSchema);



app.get("/lists", function (req, res) {
   
   Item.find({}, function(err, foundItems){
    //console.log(foundItems);
       if (foundItems.length === 0) {
           //instead if using item1.save()
           Item.insertMany(defaultItems, function (err) {
               if (err) {
                   console.log(err);
               } else {
                   //MAKE DB AND SAVE DOCS IN THAT--AS SOON AS WE USE `node index.js`
                   console.log("stored docs in DB");
               }
           });
           res.redirect("/lists");
       } else {
           res.render("lists", { listTitle: "Reads", kindaitems: foundItems });
       }
});
});

app.get("/lists/:customListName", function (req, res) {
    //console.log(req.params.customListName);
    let customName = _.capitalize(req.params.customListName);
  
     //it's diff from .find
    List.findOne({name:customName}, function (err, resultsData) {
        if (!err) {
            //if resultsData is not there
            if (!resultsData) {
                // console.log("doesn't exists!");
                
                //CREATE DIFFN LIST-BUT TO ADD ITEM IN DIFF LIST:POST REQ
                 const list = new List({
                    name: customName,
                    items: defaultItems
                });
                list.save();

               res.redirect("/lists/"+ customName);
                
            } else {
               // console.log("exists!");
                 res.render("lists", { listTitle: resultsData.name, kindaitems: resultsData.items});
            }
        }
    })
   

});

app.post("/lists", function(req,res){
    var itemName = req.body.item;
    var listName = req.body.btn_list;
        //CREATING NEW DOC AND SAVING IT--USING .save() AS SHORTCUT OF insertMany()
    const freshitem = new Item({
        name: itemName
    });

    List.findOne({ name: listName }, function (err, foundResults) {
        if (listName==="Reads") {
         freshitem.save();
        res.redirect("/lists");
        } else {
            //save item in thta list's item array
           
            foundResults.items.push(freshitem);
            //console.log(foundResults.items);
            foundResults.save();
             res.redirect("/lists/" + listName);
         }
    })
  

});

//DELETE USING CHECKBOX
app.post('/delete', function (req, res) {
    let checkedItemId = req.body.checkbox;
    let currList = req.body.currlistName;

    if (currList === "Reads") {
        Item.findByIdAndRemove(checkedItemId, function (err) {
            //DELETE WON'T WORK W/O THIS CALLBACK FUNCTION
            if (!err) {
                //console.log("Deleted this item");
                res.redirect("/lists");
            }
        });
    } else {
        List.findOneAndUpdate({ name: currList }, { $pull: { items: { _id: checkedItemId } } }, function (err, foundResults) {
            if (!err) {
                res.redirect("/lists/" + currList);
            }
        });
    }
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});
