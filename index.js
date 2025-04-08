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
  income:  { type: Number, default: 0, min: 0 },
  budget:  { type: Number, default: 0, min: 0 },
  remainingBudget: Number
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

app.get("/", async (req, res) => {
  try {
    const profiles = await Profile.find();

    const profileData = await Promise.all(profiles.map(async (profile) => {
      const expenses = await Expense.find({ profileId: profile._id }); 

      // Object to store total sum per category
      const expenseSummary = {
        travel: 0,
        shopping: 0,
        food: 0,
        other: 0
      };

      // Summing up expenses by category
      expenses.forEach(expense => {
        if (expense.expense.toLowerCase() === "travel") {
          expenseSummary.travel += expense.price;
        } else if (expense.expense.toLowerCase() === "shopping") {
          expenseSummary.shopping += expense.price;
        } else if (expense.expense.toLowerCase() === "other") {
          expenseSummary.other += expense.price;
        } else {
          expenseSummary.food += expense.price;
        }
      });
         // Calculate percentage of each expense category out of budget
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
        percentages: expensePercentages, // Added percentages for all categories
      };
    }));
    
    // Render dashboard after data is ready
    res.render("dashboard", { profiles: profileData });

  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).send("Internal Server Error");
  }
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
      res.render("profile", { Profiles: [] });
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

  const profile = new Profile({
    name: name,
    income: income,
    budget: budget,
    remainingBudget: budget
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
  const name = req.body.name;
  const income = req.body.income;
  const budget = req.body.budget;

  Profile.updateOne(
    { _id: req.body.id }, // Filter condition
    {
      $set: {
        name: name,
        income: income,
        budget: budget,
        },
    }
  )
    .then(() => {
      res.redirect("/profile");
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
      }

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

  const [name, budget, id, remaBudget] = profile.split(",");

  const remainingBudget = remaBudget - amount;

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
    { $set: { remainingBudget: remainingBudget } }
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
