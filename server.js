// server.js -- A simple Express.js web server for serving a React.js app
//Uses ES6 syntax! We transpile it using Babel. Please see this tutorial:
//https://medium.com/@wlto/how-to-deploy-an-express-application-with-react-front-end-on-aws-elastic-beanstalk-880ff7245008


///////////////////
//MONGOOSE SET-UP//
///////////////////
import mongoose from "mongoose";
const connectStr = "mongodb+srv://dbAdmin:matthews@localtest.km1f8.mongodb.net/newDB?retryWrites=true&w=majority";
mongoose.set('useFindAndModify', false);

mongoose
  .connect(connectStr, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(
    () => {
      console.log(`Connected to ${connectStr}.`);
    },
    err => {
      console.error(`Error connecting to ${connectStr}: ${err}`);
    }
  );

//Define schema that maps to a document in the Users collection in the appdb
//database.
const Schema = mongoose.Schema;

const ingredientSchema = new Schema({
  calories : {type: Number, required: true},
  name : {type: String, required: true},
  pictureURL : String,
  quantityString : {type: String, required: true},
  quantity : {type: Number, required: true},
  unit : {type: String, required: true},
  expiration : {type: String, required: false}
});

const recipeSchema = new Schema({
  name : {type: String, required: true},
  pictureURL : String,
  ingredients : [ingredientSchema],
  directions : {type:Array, required: true},
  cookTime : {type: Number, required: true},
  favorited: {type: Boolean, required: true, default: false},
  dateAdded: {type: String, required: true}
});

const grocerySchema = new Schema({
  associatedUserId : {type: String, required: true },
  ingredients: [ingredientSchema]
  //this shcema will support foods we need go get from the grocery store
});

const pantrySchema = new Schema({
  associatedUserId: {type: String, required: true},
  ingredients: [ingredientSchema]
});


const userSchema = new Schema({
  id : {type: String, required: true},
  passhash : String,
  salt: String,
  displayName : {type:String, required:true},
  authStrategy : {type: String, required: true},
  profileImageURL: {type: String, required: true},
  securityQuestion: String, 
  securityAnswer: {type: String, required: function(){
      return this.securityQuestion ? true : false 
  } },
  recipes : [recipeSchema],
  pantry: [ingredientSchema],
  groceryList: [ingredientSchema]
});

import crypto from 'crypto'

// uses 1000 iterations, length of 64, and sha512 function
let hashOptions = [
    1000,
    64,
    'sha512'
]

// virtual property password
userSchema.virtual('password').
    get(function() {
        return this.passhash
    }).
    set(function(newPassword) {
        // create unique salt for the user
        this.salt = crypto.randomBytes(16).toString('hex');

        // hashing user's password
        this.passhash = crypto.pbkdf2Sync(newPassword, this.salt, ...hashOptions).toString(`hex`);
    })

// method for validating the hashed / salted password for users
userSchema.methods.validatePassword = function(password) {
    // hashes the password argument, checks against stored password
    var passhash = crypto.pbkdf2Sync(password, this.salt, ...hashOptions).toString(`hex`);
    return this.password === passhash; 
}


const User = mongoose.model("User", userSchema);

/////////////////
//PASSPORT SET-UP
/////////////////

const LOCAL_PORT = 8081;
const DEPLOY_URL = "http://localhost:8081";
import passport from "passport";


import passportGithub from 'passport-github';
const GithubStrategy = passportGithub.Strategy;

//
passport.use(new GithubStrategy({
  clientID: "a075012c4b08543f42a8",
  clientSecret: "8dde6978090028aee37c72df9ea7ce268678b6d3",
  callbackURL: DEPLOY_URL + "/auth/github/callback"
},
//The following function is called after user authenticates with github
async (accessToken, refreshToken, profile, done) => {
  console.log("User authenticated through GitHub! In passport callback.");
  //Our convention is to build userId from displayName and provider
  const userId = `${profile.username}@${profile.provider}`;
  //See if document with this unique userId exists in database 
  let currentUser = await User.findOne({id: userId});
  if (!currentUser) { //Add this user to the database
      currentUser = await new User({
      id: userId,
      displayName: profile.displayName,
      authStrategy: profile.provider,
      profileImageURL: profile.photos[0].value
    }).save();
}
return done(null,currentUser);
}))

import passportGoogle from 'passport-google-oauth2';
const GoogleStrategy = passportGoogle.Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: "513700040808-lndjcubr19lm72bra49n3c7j2fooailu.apps.googleusercontent.com",
      clientSecret: "NevQ353WYtJ8g7re9grmsuQ-",
      callbackURL: DEPLOY_URL + "/auth/google/callback"
    },

    //The following function is called after user authenticates with github
    async (accessToken, refreshToken, profile, done) => {
      console.log("User authenticated through Google! In passport callback.");
      //Our convention is to build userId from username and provider
      console.log("profile");
      console.log(JSON.stringify(profile));
      const userId = `${profile.id}@${profile.provider}`;
      //See if document with this unique userId exists in database
      let currentUser = await User.findOne({ id: userId });
      console.log(profile.photos[0].value);
      if (!currentUser) {
        //Add this user to the database
        currentUser = await new User({
          id: userId,
          displayName: profile.displayName,
          authStrategy: profile.provider,
          profileImageURL: profile.photos[0].value
        }).save();
      }
      return done(null, currentUser);
    }
  )
);

import passportLocal from "passport-local";
const LocalStrategy = passportLocal.Strategy;
passport.use(
  new LocalStrategy(
    { passReqToCallback: true },
    //Called when user is attempting to log in with local username and password.
    //userId contains the email address entered into the form and password
    //contains the password entered into the form.
    async (req, userId, password, done) => {
      let thisUser;
      console.log(userId)
      console.log(password)
      try {
        thisUser = await User.findOne({ id: userId });
        if (thisUser) {
          if (thisUser.validatePassword(password)) {
            return done(null, thisUser);
          } else {
            req.authError =
              "The password is incorrect. Please try again" +
              " or reset your password.";

            return done(null, false);
          }
        } else {
          //userId not found in DB
          req.authError =
            "There is no account with email " + userId + ". Please try again.";
          return done(null, false);
        }
      } catch (err) {
        return done(err);
      }
    }
  )
);

//Serialize the current user to the session
passport.serializeUser((user, done) => {
  console.log("In serializeUser.");
  console.log("Contents of user param: " + JSON.stringify(user));
  done(null, user.id);
});

//Deserialize the current user from the session
//to persistent storage.
passport.deserializeUser(async (userId, done) => {
  console.log("In deserializeUser.");
  console.log("Contents of user param: " + userId);
  let thisUser;
  try {
    thisUser = await User.findOne({id: userId});
    if (thisUser) {
      console.log("User with id " + userId + " found in DB. User object will be available in server routes as req.user.")
      done(null,thisUser);
    } else {
      done(new error("Error: Could not find user with id " + userId + " in DB, so user could not be deserialized to session."));
    }
  } catch (err) {
    done(err);
  }
});

import session from "express-session";
import regeneratorRuntime from "regenerator-runtime/runtime.js";
import path from "path";
import express from "express";

import md5 from "md5";
const PORT = process.env.HTTP_PORT || LOCAL_PORT;
const app = express();

app
  .use(
    session({
      secret: "yourLibrary",
      resave: false,
      saveUninitialized: false,
      cookie: { maxAge: 1000 * 60 }
    })
  )
  .use(express.static(path.join(__dirname, "client/build")))
  .use(passport.initialize())
  .use(passport.session());

app.listen(PORT, () => {
  console.log(`Server listening at port ${PORT}.`);
});

/////////////////////
//EXPRESS APP ROUTES
/////////////////////

//AUTHENTICATE route: Uses passport to authenticate with GitHub.
//Should be accessed when user clicks on 'Login with GitHub' button on
//Log In page.

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile"]
  })
);

//CALLBACK route: GitHub will call this route after the
//OAuth authentication process is complete.
//req.isAuthenticated() tells us whether authentication was successful.

app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    console.log("auth/google/callback reached.");
    res.redirect("/"); //sends user back to login screen;
    //req.isAuthenticated() indicates status
  }
);

app.get(
  "/auth/github",
  passport.authenticate("github", )
);

//CALLBACK route: GitHub will call this route after the
//OAuth authentication process is complete.
//req.isAuthenticated() tells us whether authentication was successful.

app.get(
  "/auth/github/callback",
  passport.authenticate("github", { failureRedirect: "/" }),
  (req, res) => {
    console.log("auth/github/callback reached.");
    res.redirect("/"); //sends user back to login screen;
    //req.isAuthenticated() indicates status
  }
);

//LOGOUT route: Use passport's req.logout() method to log the user out and
//redirect the user to the main app page. req.isAuthenticated() is toggled to false.

app.get("/auth/logout", (req, res) => {
  console.log("/auth/logout reached. Logging out");
  req.logout();
  res.redirect("/");
});

//TEST route: Tests whether user was successfully authenticated.
//Should be called from the React.js client to set up app state.

app.get('/auth/test', (req, res) => {
  console.log("auth/test reached.");
  const isAuth = req.isAuthenticated();
  if (isAuth) {
      console.log("User is authenticated");
      console.log("User object in req.user: " + JSON.stringify(req.user));
  } else {
      //User is not authenticated.
      console.log("User is not authenticated");
  }
  //Return JSON object to client with results.
  res.json({isAuthenticated: isAuth, user: req.user});
});

//LOGIN route: Attempts to log in user using local strategy
app.post(
  "/auth/login",
  passport.authenticate("local", { failWithError: true }),
  (req, res) => {
    console.log("/auth/login route reached: successful authentication.");
    //Redirect to app's main page; the /auth/test route should return true
    res.status(200).send("Login successful");
  },
  (err, req, res, next) => {
    console.log("/auth/login route reached: unsuccessful authentication");
    //res.sendStatus(401);
    if (req.authError) {
      console.log("req.authError: " + req.authError);
      res.status(401).send(req.authError);
    } else {
      res
        .status(401)
        .send(
          "Unexpected error occurred when attempting to authenticate. Please try again."
        );
    }
    //Note: Do NOT redirect! Client will take over.
  }
);

const bodyParser = require("body-parser");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/////////////////////////////////////
//EXPRESS APP ROUTES FOR USER Docs //
/////////////////////////////////////

//USERS/userId route (GET): Attempts to return the data of a user 
//in users collection.
//GIVEN: 
//  id of the user is passed as route parameter.
//  Fields and values to be updated are passed as body as JSON object 
//RETURNS: 
//  Success: status = 200 with user data as JSON object
//  Failure: status = 400 with error message
app.get('/users/:userId', async(req, res, next) => {
  console.log("in /users route (GET) with userId = " + JSON.stringify(req.params.userId));
  try {
    let thisUser = await User.findOne({id: req.params.userId});
    if (!thisUser) {
      return res.status(400).message("No user account with specified userId was found in database.");
    } else {
      return res.status(200).json(JSON.stringify(thisUser));
    }
  } catch (err) {
    console.log()
    return res.status(400).message("Unexpected error occurred when looking up user in database: " + err);
  }
});

//USERS/userId route (POST): Attempts to add a new user in the users 
//collection. 
//GIVEN: 
//  id of the user to add is passed as route parameter.
//  user data to be added are passed as body as JSON object.
//VALID DATA:
//  'password' field MUST be present
//  The following fields are optional: 
//  displayName', 'profileImageURL', 'securityQuestion', 'securityAnswer'
//RETURNS: 
//  Success: status = 200
//  Failure: status = 400 with an error message

app.post('/users/:userId',  async (req, res, next) => {
  console.log("in /users route (POST) with params = " + JSON.stringify(req.params) +
    " and body = " + JSON.stringify(req.body));  
  console.log(req.hasOwnProperty('body'));
  if (!req.body.hasOwnProperty("password")) {
    //Body does not contain correct properties
    return res.status(400).send("/users POST request formulated incorrectly. " + 
      "It must contain 'password' as field in message body.")
  }
  try {
    let thisUser = await User.findOne({id: req.params.userId});
    console.log("thisUser: " + JSON.stringify(thisUser));

    if (thisUser) { //account already exists
      res.status(400).send("There is already an account with email '" + req.params.userId + "'.  Please choose a different email.");
    } else { //account available -- add to database
      thisUser = await new User({
        id: req.params.userId,
        password: req.body.password,
        displayName: req.params.userId,
        authStrategy: 'local',
        profileImageURL: req.body.hasOwnProperty("profileImageURL") ? req.body.profileImageURL : `https://www.gravatar.com/avatar/${md5(req.params.userId)}`,
        securityQuestion: req.body.hasOwnProperty("securityQuestion") ? 
          req.body.securityQuestion : "",
        securityAnswer: req.body.hasOwnProperty("securityAnswer") ? 
          req.body.securityAnswer : "",
        recipes: []
      }).save();

      return res.status(200).send("New account for '" + req.params.userId + "' successfully created.");
    }
  } catch (err) {
    console.log(err);

    return res.status(400).send("Unexpected error occurred when adding or looking up user in database. " + err);    
  }
});

//USERS/userId route (PUT): Attempts to update a user in the users collection. 
//GIVEN: 
//  id of the user to update is passed as route parameter.
//  Fields and values to be updated are passed as body as JSON object.  
//VALID DATA:
//  Only the following fields may be included in the message body:
//  password, displayName, profileImageURL, securityQuestion, securityAnswer
//RETURNS: 
//  Success: status = 200
//  Failure: status = 400 with an error message
app.put('/users/:userId',  async (req, res, next) => {
  console.log("in /users PUT with userId = " + JSON.stringify(req.params) + 
    " and body = " + JSON.stringify(req.body));
  if (!req.params.hasOwnProperty("userId"))  {
    return res.status(400).send("users/ PUT request formulated incorrectly." +
        "It must contain 'userId' as parameter.");
  }
  const validProps = ['password', 'displayName', 'profileImageURL', 'securityQuestion', 'securityAnswer'];
  for (const bodyProp in req.body) {
    if (!validProps.includes(bodyProp)) {
      return res.status(400).send("users/ PUT request formulated incorrectly." +
        "Only the following props are allowed in body: " +
        "'password', 'displayName', 'profileImageURL', 'securityQuestion', 'securityAnswer'");
    } 
  }
  try {
        let user = await User.findOne({id: req.params.userId}) 
        user.set(req.body)
        if (!user) { //Should never happen!
          res.status(400).send("User account exists in database but data could not be updated. Password must be different");
        } else {
          await user.save()
          res.status(200).send("User data successfully updated.")
        }
      } catch (err) {
        res.status(400).send("Unexpected error occurred when updating user data in database: " + err);
      }
});

///////////////////////////////////////
//EXPRESS APP ROUTES FOR Recipe Docs //
///////////////////////////////////////

//recipes/userId route (GET): Attempts to return all recipes associated with userId
//GIVEN: 
//  id of the user whose recipes are sought is passed as route parameter.
//RETURNS: 
//  Success: status = 200 with array of recipes as JSON object
//  Failure: status = 400 with error message
app.get('/recipes/:userId', async(req, res) => {
  console.log("in /recipes route (GET) with userId = " + JSON.stringify(req.params.userId));
  try {
    let thisUser = await User.findOne({id: req.params.userId});
    if (!thisUser) {
      return res.status(400).message("No user account with specified userId was found in database.");
    } else {
      return res.status(200).json(JSON.stringify(thisUser.recipes));
    }
  } catch (err) {
    console.log()
    return res.status(400).message("Unexpected error occurred when looking up user in database: " + err);
  }
});

app.get('/pantry/:userId', async(req, res) => {
  console.log("in /pantry route (GET) with userId = " + JSON.stringify(req.params.userId));
  try{
    let thisUser = await User.findOne({id: req.params.userId});
    if(!thisUser){
      return res.status(400).message("How did you get here");
    } else{
      if(thisUser.pantry){
        return res.status(200).json(JSON.stringify(thisUser.pantry));
      }
      else{
        //Jacob notes: i want to tell the page this user doesn't have a thing initialized yet and we should fix that (for old users)
        return res.status(400).message("User doesn't have a pantry list yet, please intilize for them (even if it's empty)");
      }
        
      //this may be empty if a user has no list initialized
        
    }
  }catch(err){
      console.log();
      return res.status(400).message("Unexpected error occured when looking up user in database for pantry: " + err);
  }
});

app.get('/groceryList/:userId', async(req,res) => {
  console.log("in /groceryList route (GET) with userId = " + JSON.stringify(req.params.userId));
  try{
    let thisUser = await User.findOne({id: req.params.userId});
    if(!thisUser){
      return res.status(400).message("How did you get here");
    } else{
      //this may be empty if a user has no list initialized
        if(thisUser.groceryList){
          return res.status(200).json(JSON.stringify(thisUser.groceryList));
        }
        else{
          return res.status(400).message("User doesn't have a grocery list yet, please intilize for them (even if it's empty)")
        }
        
    }
  }catch(err){
      console.log();
      return res.status(400).message("Unexpected error occured when looking up user in database for grocery list: " + err);
  }
});

//we will need the same thing but for the funciton below so that we can update/post pantry/grocery list for a userID
app.post('/pantry/:userId', async(req, res, next) => {
  console.log("in /pantry (POST) route with params = " + JSON.stringify(req.params) + " and body = " + JSON.stringify(req.body));
  /*if(!req.body.hasOwnProperty("list")){
    return res.status(400).message("POST request on /pantry was not formulated correctly. Body must contain property: list");
  }*/
  try {
    let status = await User.updateOne(
    {id: req.params.userId},
    {$set: {pantry: req.body}});
    if (status.nModified != 1) { //Should never happen!
      res.status(400).send("Unexpected error occurred when updating pantry in database. Pantry was not uodated.");
    } else {
      res.status(200).send("pantry successfully updated in database.");
    }
  } catch (err) {
    console.log(err);
    return res.status(400).send("Unexpected error occurred when updating pantry in database: " + err);
  } 
});

app.post('/groceryList/:userId', async(req, res, next) => {
  console.log("in /groceryList (POST) route with params = " + JSON.stringify(req.params) + " and body = " + JSON.stringify(req.body));
  /*if(!req.body.hasOwnProperty("list")){
    return res.status(400).message("POST request on /groceryList was not formulated correctly. Body must contain property: list");
  }*/
  try {
    let status = await User.updateOne(
    {id: req.params.userId},
    {$set: {groceryList: req.body}});
    if (status.nModified != 1) { //Should never happen!
      res.status(400).send("Unexpected error occurred when adding groceries to database. Grocery List was not uodated.");
    } else {
      res.status(200).send("pantry successfully updated in database.");
    }
  } catch (err) {
    console.log(err);
    return res.status(400).send("Unexpected error occurred when updating grocery list in database: " + err);
  } 
});

//recipes/userId/ (POST): Attempts to add new recipe to database
//GIVEN:
//  id of the user whose recipe is to be added is passed as 
//  route parameter
//  JSON object containing recipe to be added is passed in request body
//VALID DATA:
//  user id must correspond to user in Users collection
//  Body object MUST contain only the following fields:
//  name, pictureURL, ingredients, directions, dateAdded, favorited
//RETURNS:
//  Success: status = 200
//  Failure: status = 400 with error message
app.post('/recipes/:userId', async (req, res, next) => {
  console.log("in /recipes (POST) route with params = " + 
              JSON.stringify(req.params) + " and body = " + 
              JSON.stringify(req.body));
  if (!req.body.hasOwnProperty("name") || 
      !req.body.hasOwnProperty("pictureURL") || 
      !req.body.hasOwnProperty("favorited") ||
      !req.body.hasOwnProperty("dateAdded") || 
      !req.body.hasOwnProperty("ingredients") ||
      !req.body.hasOwnProperty("cookTime") ||
      !req.body.hasOwnProperty("directions")) {
    //Body does not contain correct properties
    return res.status(400).send("POST request on /recipes formulated incorrectly." +
      "Body must contain all 6 required fields: name, pictureURL, ingredients, directions, dateAdded, favorited.");
  }
  try {
    let status = await User.updateOne(
    {id: req.params.userId},
    {$push: {recipes: req.body}});
    if (status.nModified != 1) { //Should never happen!
      res.status(400).send("Unexpected error occurred when adding recipe to database. recipe was not added.");
    } else {
      res.status(200).send("recipe successfully added to database.");
    }
  } catch (err) {
    console.log(err);
    return res.status(400).send("Unexpected error occurred when adding recipe to database: " + err);
  } 
});

//recipes/userId/recipeId (PUT): Attempts to update data for an existing recipe
//GIVEN:
//  id of the user whose recipe is to be updated is passed as first 
//  route parameter
//  id of recipe to be updated is passed as second route parameter
//  JSON object containing data to be updated is passed in request body
//VALID DATA:
//  user id must correspond to user in Users collection
//  recipe id must correspond to a user's recipe. (Use recipes/ GET route to obtain a
//  list of all of user's recipes, including their unique ids)
//  Body object may contain only the following 6 fields:
//  name, pictureURL, ingredients, directions, dateAdded, favorited
//RETURNS:
//  Success: status = 200
//  Failure: status = 400 with error message
app.put('/recipes/:userId/:recipeId', async (req, res, next) => {
  console.log("in /recipes (PUT) route with params = " + 
              JSON.stringify(req.params) + " and body = " + 
              JSON.stringify(req.body));
  const validProps = ['name', 'ingredients', 'directions', 'cookTime', 'pictureURL', 'favorited', 'dateAdded'];
  let bodyObj = {...req.body};
  delete bodyObj._id; 
  console.log(bodyObj);
  for (const bodyProp in bodyObj) {
    if (!validProps.includes(bodyProp)) {
      return res.status(400).send("recipes/ PUT request formulated incorrectly." +
        "Only the following props are allowed in body: " +
        "'name', 'dateAdded', 'pictureURL', 'favorited', 'expiration', 'ingredients', 'directions', *" +
        bodyProp + "* is not an allowed prop.");
    } else {
      bodyObj["recipes.$." + bodyProp] = bodyObj[bodyProp];
      delete bodyObj[bodyProp];
    }
  }
  try {
    let status = await User.updateOne(
      {"id": req.params.userId,
      "recipes._id": mongoose.Types.ObjectId(req.params.recipeId)}
      ,{"$set" : bodyObj}
    );
    res.status(200).send("recipe successfully updated in database.");
  } catch (err) {
    console.log(err);
    return res.status(400).send("Unexpected error occurred when updating recipe in database: " + err);
  } 
});

app.put('/pantry/:userId/:pantryId', async (req, res, next) => {
  console.log("in /pantry (PUT) route with params = " + 
              JSON.stringify(req.params) + " and body = " + 
              JSON.stringify(req.body));
  const validProps = ['name', 'calories', 'pictureURL', 'quantity', 'unit', 'expiration'];
  let bodyObj = {...req.body};
  delete bodyObj._id; 
  console.log(bodyObj);
  for (const bodyProp in bodyObj) {
    if (!validProps.includes(bodyProp)) {
      return res.status(400).send("pantry/ PUT request formulated incorrectly." +
        "Only the following props are allowed in body: " +
        "'name', 'calories', 'pictureURL', 'quantity', 'unit', 'expiration', *" +
        bodyProp + "* is not an allowed prop.");
    } else {
      bodyObj["pantry.$." + bodyProp] = bodyObj[bodyProp];
      delete bodyObj[bodyProp];
    }
  }
  try {
    let status = await User.updateOne(
      {"id": req.params.userId,
      "pantry._id": mongoose.Types.ObjectId(req.params.pantryId)}
      ,{"$set" : bodyObj}
    );
    res.status(200).send("recipe successfully updated in database.");
  } catch (err) {
    console.log(err);
    return res.status(400).send("Unexpected error occurred when updating recipe in database: " + err);
  } 
});

//recipes/userId/recipeId (DELETE): Attempts to delete an existing recipe
//GIVEN:
//  id of the user whose recipe is to be deleted is passed as first 
//  route parameter
//  id of recipe to be deleted is passed as second route parameter
//VALID DATA:
//  user id must correspond to user in Users collection
//  recipe id must correspond to a unique id of a user's recipe. 
//  (Use recipes/ GET route to obtain a list of all of user's 
//  recipes, including their unique ids)
//RETURNS:
//  Success: status = 200
//  Failure: status = 400 with error message
app.delete('/recipes/:userId/:recipeId', async (req, res, next) => {
  console.log("in /recipes (DELETE) route with params = " + 
              JSON.stringify(req.params)); 
  try {
    let status = await User.updateOne(
      {id: req.params.userId},
      {$pull: {recipes: {_id: mongoose.Types.ObjectId(req.params.recipeId)}}});
    if (status.nModified != 1) { //Should never happen!
      res.status(400).send("Unexpected error occurred when deleting recipe from database. recipe was not deleted.");
    } else {
      res.status(200).send("recipe successfully deleted from database.");
    }
  } catch (err) {
    console.log(err);
    return res.status(400).send("Unexpected error occurred when deleting recipe from database: " + err);
  } 
});

app.delete('/pantry/:userId/:pantryId', async (req, res, next) => {
  console.log("in /recipes (DELETE) route with params = " + 
              JSON.stringify(req.params)); 
  try {
    let status = await User.updateOne(
      {id: req.params.userId},
      {$pull: {pantry: {_id: mongoose.Types.ObjectId(req.params.pantryId)}}});
    if (status.nModified != 1) { //Should never happen!
      res.status(400).send("Unexpected error occurred when deleting recipe from database. recipe was not deleted.");
    } else {
      res.status(200).send("recipe successfully deleted from database.");
    }
  } catch (err) {
    console.log(err);
    return res.status(400).send("Unexpected error occurred when deleting recipe from database: " + err);
  } 
});

app.delete('/groceryList/:userId/:groceryId', async (req, res, next) => {
  console.log("in /recipes (DELETE) route with params = " + 
              JSON.stringify(req.params)); 
  try {
    let status = await User.updateOne(
      {id: req.params.userId},
      {$pull: {groceryList: {_id: mongoose.Types.ObjectId(req.params.groceryId)}}});
    if (status.nModified != 1) { //Should never happen!
      res.status(400).send("Unexpected error occurred when deleting recipe from database. recipe was not deleted.");
    } else {
      res.status(200).send("recipe successfully deleted from database.");
    }
  } catch (err) {
    console.log(err);
    return res.status(400).send("Unexpected error occurred when deleting recipe from database: " + err);
  } 
});

