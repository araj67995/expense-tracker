require('dotenv').config();
const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const nodemailer = require("nodemailer");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

app.use(
  session({
    secret: "Hello dear, u are secure.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/ExpenseTracker", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const profileSchema = new mongoose.Schema({
  name: String,
  income: { type: Number, default: 0, min: 0 },
  budget: { type: Number, default: 0, min: 0 },
  remainingBudget: Number,
  month: String,
  userId: String
});

const expenseSchema = new mongoose.Schema({
  profile: String,
  expense: String,
  date: String,
  price: Number,
  des: String,
  userId: String
});

const accountSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String  // <-- Required for Google Strategy to work
});


accountSchema.plugin(passportLocalMongoose, {
  usernameField: "email",
});
accountSchema.plugin(findOrCreate);

const Profile = mongoose.model("Profiles", profileSchema);
const Expense = mongoose.model("Expenses", expenseSchema); // ✅ fixed typo
const Account = mongoose.model("Accounts", accountSchema);

passport.use(Account.createStrategy());

passport.serializeUser(function (account, cb) {
  process.nextTick(function () {
    cb(null, { id: account.id, username: account.username });
  });
});

passport.deserializeUser(function (account, cb) {
  process.nextTick(function () {
    return cb(null, account);
  });
});

passport.use(new GoogleStrategy({
  clientID: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/signin",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
function(accessToken, refreshToken, profile, cb) {
  Account.findOrCreate({ googleId: profile.id }, function (err, user) {
    return cb(err, user);
  });
}
));

// ✅ Middleware to protect routes
function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/signin");
}

// ================== ROUTES ===================

// HOME (dashboard)
app.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
  try {
    const profiles = await Profile.find({userId: req.user.id});

    const profileData = await Promise.all(
      profiles.map(async (profile) => {
        const expenses = await Expense.find({userId: req.user.id});

        const expenseSummary = { travel: 0, shopping: 0, food: 0, other: 0 };
        expenses.forEach((expense) => {
          const type = expense.expense.toLowerCase();
          if (expenseSummary[type] !== undefined) {
            expenseSummary[type] += expense.price;
          } else {
            expenseSummary.food += expense.price;
          }
        });

        const calculatePercentage = (amount, budget) =>
          budget > 0 ? ((amount / budget) * 100).toFixed(2) : 0;

        const expensePercentages = {
          travel: calculatePercentage(expenseSummary.travel, profile.budget),
          shopping: calculatePercentage(expenseSummary.shopping, profile.budget),
          food: calculatePercentage(expenseSummary.food, profile.budget),
          other: calculatePercentage(expenseSummary.other, profile.budget),
        };

        return {
          name: profile.name,
          budget: profile.budget,
          remainingBudget: profile.remainingBudget,
          expenses: expenseSummary,
          percentages: expensePercentages,
        };
      })
    );

    res.render("dashboard", { profiles: profileData });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
} else {
  res.render("home");
}
});

app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/signin", passport.authenticate("google", {
  successRedirect: "/",
  failureRedirect: "/signin"
}));

// LOGIN + SIGNUP + LOGOUT
app.get("/signin", (req, res) => {
  res.render("login");
});


app.post("/signup", (req, res) => {
  console.log("Signup:", req.body.email, req.body.password);

  Account.register({ email: req.body.email }, req.body.password)
    .then((user) => {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/");
      });
    })
    .catch((err) => {
      console.log("Signup Error:", err);
      res.render("login");
    });
});


app.post("/login", (req, res, next) => {
  passport.authenticate("local", function (err, user, info) {
    if (err) return next(err);
    if (!user) return res.status(401).send("Invalid email or password");

    req.logIn(user, function (err) {
      if (err) return next(err);
      return res.redirect("/"); // will be handled by fetch's redirect
    });
  })(req, res, next);
});


app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/signin");
  });
});

// PROFILE ROUTES
app.get("/profile", isLoggedIn, (req, res) => {
  Profile.find({userId: req.user.id})
    .then((foundProfile) => {
      res.render("profile", { Profiles: foundProfile });
    })
    .catch((err) => {
      console.log(err);
      res.render("profile", { Profiles: [] });
    });
});

app.post("/profile", isLoggedIn, (req, res) => {
  const { name, income, budget, month } = req.body;

  const profile = new Profile({
    name,
    income,
    budget,
    remainingBudget: budget,
    month,
    userId: req.user.id
  });

  profile.save()
    .then(() => res.redirect("/profile"))
    .catch((err) => console.log(err));
});

app.post("/edit", isLoggedIn, (req, res) => {
  Profile.findById(req.body.id)
    .then((founditem) => {
      res.render("edit", { found: founditem });
    })
    .catch((err) => console.log(err));
});

app.post("/save", isLoggedIn, (req, res) => {
  const { name, income, budget, remBudget, id } = req.body;

  Profile.updateOne(
    { _id: id },
    { $set: { name, income, budget, remainingBudget: remBudget } }
  )
    .then(() => res.redirect("/profile"))
    .catch((err) => console.log(err));
});

app.post("/delete", isLoggedIn, (req, res) => {
  const _id = req.body.id?.trim();
  const referer = req.get("Referer");

  if (!mongoose.Types.ObjectId.isValid(_id)) {
    console.error("Invalid ID:", _id);
    return res.status(400).send("Invalid ID");
  }

  const model = referer.includes("/expense") ? Expense : Profile;

  model.findByIdAndDelete(_id)
    .then((deletedItem) => {
      if (!deletedItem) return res.status(404).send("Item not found");

      if (model === Profile) {
        Expense.deleteMany({ profileId: _id }).catch((err) => console.log(err));
      }

      res.redirect(referer.includes("/expense") ? "/expense" : "/profile");
    })
    .catch((err) => res.status(500).send("Internal Server Error"));
});

// EXPENSE ROUTES
app.get("/expense", isLoggedIn, (req, res) => {
  Profile.find({userId: req.user.id})
    .then((foundProfile) => {
      Expense.find({userId: req.user.id})
        .then((foundExpense) => {
          res.render("expense", {
            Profiles: foundProfile,
            Expense: foundExpense,
          });
        })
        .catch((err) => console.log(err));
    })
    .catch((err) => console.log(err));
});

app.post("/expense", isLoggedIn, (req, res) => {
  const [name, budget, id, remaBudget] = req.body.profile.split(",");
  const { expenseType, date, amount, description } = req.body;

  const remainingBudget = remaBudget - amount;

  const expense = new Expense({
    profile: name,
    expense: expenseType,
    date,
    price: amount,
    des: description,
    userId: req.user.id,
  });

  expense.save();

  Profile.findOneAndUpdate(
    { name, userId: req.user.id },
    { $set: { remainingBudget: remainingBudget } }
  )
    .then(() => res.redirect("/expense"))
    .catch((err) => console.log(err));
});

app.post("/month", isLoggedIn, async (req, res) => {
  const selectedMonth = req.body.month;

  try {
    const profiles = await Profile.find({ month: selectedMonth });

    const profileData = await Promise.all(
      profiles.map(async (profile) => {
        const expenses = await Expense.find({userId: req.user.id});

        const expenseSummary = { travel: 0, shopping: 0, food: 0, other: 0 };
        expenses.forEach((expense) => {
          const type = expense.expense.toLowerCase();
          if (expenseSummary[type] !== undefined) {
            expenseSummary[type] += expense.price;
          } else {
            expenseSummary.food += expense.price;
          }
        });

        const calculatePercentage = (amount, budget) =>
          budget > 0 ? ((amount / budget) * 100).toFixed(2) : 0;

        const expensePercentages = {
          travel: calculatePercentage(expenseSummary.travel, profile.budget),
          shopping: calculatePercentage(expenseSummary.shopping, profile.budget),
          food: calculatePercentage(expenseSummary.food, profile.budget),
          other: calculatePercentage(expenseSummary.other, profile.budget),
        };

        return {
          name: profile.name,
          budget: profile.budget,
          remainingBudget: profile.remainingBudget,
          expenses: expenseSummary,
          percentages: expensePercentages,
        };
      })
    );

    res.render("dashboard", { profiles: profileData });
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Create a transporter using Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'araj67995@gmail.com',
        pass: 'ktoj lusg lbtd egze'
    }
});

app.post('/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Email to admin
        const adminMailOptions = {
            from: 'araj67995@gmail.com',
            to: 'araj67995@gmail.com',
            subject: `New Contact Form Submission: ${subject}`,
            html: `
                <h2>New Contact Form Submission</h2>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `
        };

        // Confirmation email to user
        const userMailOptions = {
            from: 'araj67995@gmail.com',
            to: email,
            subject: 'Thank you for contacting ExpenseTracker',
            html: `
                <h2>Thank you for contacting us!</h2>
                <p>Dear ${name},</p>
                <p>We have received your message and will get back to you as soon as possible.</p>
                <p>Here's a copy of your message:</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
                <br>
                <p>Best regards,</p>
                <p>The ExpenseTracker Team</p>
            `
        };

        // Send both emails
        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(userMailOptions);

        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ message: 'Failed to send message' });
    }
});

// LISTEN
app.listen(process.env.PORT || 3000, () => {
  console.log("Server is started on port 3000!");
});
