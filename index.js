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

const expenseSchema = new mongoose.Schema({
  profile: String,
  expense: String,
  date: String,
  price: Number,
  des: String,
  profileId: String,
});

const Profile = mongoose.model("Profiles", profileSchema);
const Expense = mongoose.model(" Expenses", expenseSchema);

app.get("/", (req, res) => {
  res.render("dashboard");
});

app.get("/expense", (req, res) => {
  Profile.find()
    .then((foundProfile) => {
      Expense.find()
        .then((foundExpense) => {
          res.render("expense", {
            Profiles: foundProfile,
            Expense: foundExpense,
          });
        })
        .catch((err) => {
          console.log(err);
        });
    })
    .catch((err) => {
      console.log(err);
    });
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
  const _id = req.body.id?.trim(); // Ensure id is trimmed and valid
  const referer = req.get("Referer");

  // Validate if _id is a valid ObjectId
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    console.error("Invalid ID format:", _id);
    return res.status(400).send("Invalid ID provided.");
  }

  // Determine which collection to delete from
  const model = referer === "http://localhost:3000/expense" ? Expense : Profile;

  model
    .findByIdAndDelete(_id)
    .then((deletedItem) => {
      if (!deletedItem) {
        console.error("Item not found with ID:", _id);
        return res.status(404).send("Item not found.");
      }

      if (model === Profile) {
        Expense.deleteMany({ profileId: _id })
          .then(() => {
            console.log("Associated expenses deleted.");
          })
          .catch((err) => {
            console.log(err);
          });
      };

      // Redirect to the appropriate page
      const redirectUrl =
        referer === "http://localhost:3000/expense" ? "/expense" : "/profile";
      res.redirect(redirectUrl);
    })
    .catch((err) => {
      console.error("Error deleting item:", err);
      res.status(500).send("Internal Server Error.");
    });
});   

// EXPENSE SECTION

app.post("/expense", (req, res) => {
  const profile = req.body.profile;
  const expenseType = req.body.expenseType;
  const date = req.body.date;
  const amount = req.body.amount;
  const des = req.body.description;

  const [name, budget, id] = profile.split(",");

  const remainingBudget = budget - amount;

  const expense = new Expense({
    profile: name,
    expense: expenseType,
    date: date,
    price: amount,
    des: des,
    profileId: id.replace(/\s/g, ""),
  });

  expense.save();

  Profile.findOneAndUpdate(
    { name: name },
    { $set: { budget: remainingBudget } }
  )
    .then(() => {
      res.redirect("/expense");
    })
    .catch((err) => {
      console.log(err);
    });
});

app.listen(process.env.PORT || 3000, () => {
  console.log("server is started on port 3000 !!");
});
