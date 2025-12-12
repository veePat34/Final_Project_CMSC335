const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const app = express();
const portNumber = 7003;

app.use(express.urlencoded({ extended: true }));
app.use("/css", express.static(path.join(__dirname, "css")));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "template"));

//Connecting to MongoDB using Mongoose
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_CONNECTION_STRING);
    console.log("MongoDB connected");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
})();

//Document fields in journalEntries Collection
const Entry = mongoose.model(
  "Entry",
  new mongoose.Schema({
    title: String,
    body: String,
    date: String, 
    createdAt: { type: Date, default: Date.now },
    includeAstronomy: Boolean,
    astronomyImage: String
  }),
  "journalEntries"
);

//Home Page
app.get("/", (req, res) => {
  res.render("index");
});

//Viewing all entries page
app.get("/entries", async (req, res) => {
  const entries = await Entry.find().sort({ createdAt: -1 });
  res.render("all", { entries });
});

//Add entry page
app.get("/entries/add", (req, res) => {
  res.render("add");
});

//Submit entry form
app.post("/entries/add", async (req, res) => {
  try {
    //Gets all information
    const { title, body, entryDate, includeAstronomy, timezone } = req.body;

    //Sets year, month, and day based on day user specified in form
    const [year, month, day] = entryDate.split("-").map(Number);

    //Gets the journal entry date user specificed in form
    const userSelectedDate = new Date(Date.UTC(year, month - 1, day));
    userSelectedDate.setMinutes(userSelectedDate.getMinutes() - timezone);

    //Sets userToday to the user's actual timezone 
    const now = new Date();
    const userToday = new Date(now.getTime() - timezone * 60000);
    userToday.setHours(0, 0, 0, 0);

    //Prevents users creating entries for future dates
    if (userSelectedDate > userToday) {
      return res.render("futureDate", { entryDate });
    }

    //Prevents duplicate entries for a date
    const existingEntry = await Entry.findOne({ date: entryDate });
    if (existingEntry) {
      return res.render("sameDate", { entryDate });
    }

    //Uses NASA APOD API to get astronomical image of the day
    let astronomyImage = "";
    if (includeAstronomy) {
      try {
        const nasaUrl = `https://api.nasa.gov/planetary/apod?api_key=${process.env.NASA_KEY}&date=${entryDate}`;
        const response = await fetch(nasaUrl);
        const json = await response.json();
        astronomyImage = json.url;
      } catch (err) {
        console.error("NASA API error:", err.message);
      }
    }

    //Saves entry information in a document
    const newEntry = await Entry.create({
      title,
      body,
      date: entryDate,
      createdAt: userSelectedDate,
      includeAstronomy: !!includeAstronomy,
      astronomyImage
    });
    res.render("confirmation", { entryDate, entryId: newEntry._id });

  } catch (err) {
    console.error(err);
    res.send("An error occurred. Please try again.");
  }
});

//View past entries
app.get("/entries/:id", async (req, res) => {
  const entry = await Entry.findById(req.params.id);
  res.render("entry", { entry });
});

app.listen(portNumber);
console.log(`main URL http://localhost:${portNumber}/`);