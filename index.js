const express = require("express");
const ejs = require("ejs");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const app = express();

mongoose.connect("mongodb://localhost:27017/ExpenseTracker", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const profileSchema = new mongoose.Schema({
  name: String,
  income: Number,
  budget: Number,
  saving: Number,
});

const Profile = mongoose.model("Profiles", profileSchema);

app.get("/", (req, res) => {
  res.render("dashboard");
});

app.get("/expense", (req, res) => {
  res.render("expense");
});

app.get("/profile", (req, res) => {
  Profile.find()
    .then((foundProfile) => {
      res.render("profile", {
        Profiles: foundProfile,
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

app.get("/:page", (req, res) => {
  const requestedTitle = req.params.page.replace("-", " ");

  if (requestedTitle === "expense") {
    res.redirect("/expense");
  } else if (requestedTitle === "profile") {
    res.redirect("/profile");
  } else {
    res.redirect("/");
  }
});

// ALL FUNCTION OF PROFILE PAGE SUCH AS DELETE EDIT AND SAVE

app.post("/profile", (req, res) => {
  const name = req.body.name;
  const income = req.body.income;
  const budget = req.body.budget;
  const saving = req.body.saving;

  const profile = new Profile({
    name: name,
    income: income,
    budget: budget,
    saving: saving,
  });

  profile
    .save()
    .then(() => {
      res.redirect("/profile");
    })
    .catch((err) => {
      console.log(err);
    });
});

// EDIT

app.post("/edit", (req, res) => {
  const _id = req.body.id;

  Profile.findById(_id)
    .then((founditem) => {
      res.render("edit", {
        found: founditem,
      });
    })
    .catch((err) => {
      console.log(err);
    });
});

// SAVE

app.post("/save", (req, res) => {
  Profile.findByIdAndDelete(req.body.id)
    .then(() => {
      const name = req.body.name;
      const income = req.body.income;
      const budget = req.body.budget;
      const saving = req.body.saving;

      const profile = new Profile({
        name: name,
        income: income,
        budget: budget,
        saving: saving,
      });

      profile
        .save()
        .then(() => {
          res.redirect("/profile");
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => {
      console.log(err);
    });
});

// DELETE

app.post("/delete", (req, res) => {
  const _id = req.body.id;

  Profile.findByIdAndDelete(_id)
    .then(() => {
      console.log("item was deleted successfully.");
      res.redirect("/profile");
    })
    .catch((err) => {
      console.log(err);
    });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("server is started on port 3000 !!");
});
