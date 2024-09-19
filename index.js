const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/chatbot', { useNewUrlParser: true, useUnifiedTopology: true });

// User model
const User = mongoose.model('User', {
  name: String,
  email: String,
  password: String,
  phoneNumber: String,
  bankAccountNumber: String,
  hasCreditCard: Boolean,
  hasDebitCard: Boolean
});

// ChatSession model
const ChatSession = mongoose.model('ChatSession', {
  userId: mongoose.Schema.Types.ObjectId,
  startTime: Date,
  endTime: Date
});

// Chat model
const Chat = mongoose.model('Chat', {
  sessionId: mongoose.Schema.Types.ObjectId,
  sender: String,
  message: String,
  timestamp: Date
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

// Session configuration
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'pass'
  },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email: email });
      if (!user) {
        return done(null, false, { message: 'Incorrect email.' });
      }
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login');
}
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false
  }));
  app.use(flash()); // Add this line to initialize connect-flash
// Login route
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash() }); // Pass flash messages to the view
  });

app.post('/login', (req, res, next) => {
passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
    req.flash('error', 'Invalid email or password'); // Add flash message for errors
    return res.redirect('/login');
    }
    
    req.logIn(user, (err) => {
    if (err) return next(err);
    req.flash('success', 'You have logged in successfully'); // Add flash message for success
    return res.redirect('/'); // Change this to the appropriate redirect URL
    });
})(req, res, next);
});
  

// Register route
app.get('/register', (req, res) => {
  res.render("register");
});

app.post('/register', async (req, res) => {
  const { email, password } = req.body;

  // Check if the email already exists in the database
  const userExists = await User.findOne({ email: email });

  if (userExists) {
    // Send back a response that email already exists
    return res.render('register', { 
      error: 'Email already exists! Please login instead.'
    });
  }

  // Proceed with the rest of the registration logic
  const newUser = new User({
    email,
    password: await bcrypt.hash(password, 10) // Hashing password
  });

  await newUser.save();
  res.redirect('/login'); // Redirect to login after successful registration
});

// Home route (protected)
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
      // Assuming req.user contains user information
      const username = req.user.name; // Adjust this according to your user model
      const chatbotName = "ChatBot"; // Define your chatbot name here
      
      res.render('index', { username, chatbotName });
    } else {
      res.redirect('/login');
    }
  });
  
// Index route
app.get('/index', isAuthenticated, (req, res) => {
  res.render('index', { user: req.user }); // Passing user data to index page
});

// Chat page
app.get("/chatpage", isAuthenticated, async (req, res) => {
  let chatSession;
  if (req.query.sessionId) {
    chatSession = await ChatSession.findById(req.query.sessionId);
  } else {
    chatSession = new ChatSession({
      userId: req.user._id,
      startTime: new Date(),
      endTime: null
    });
    await chatSession.save();
  }
  res.render("chatpage", { user: req.user, sessionId: chatSession._id });
});

// Chat post request
app.post("/chat", isAuthenticated, async (req, res) => {
  const { message, sessionId } = req.body;
  const newChat = new Chat({
    sessionId: sessionId,
    sender: 'You',
    message: message,
    timestamp: new Date()
  });
  await newChat.save();

  // Simulate bot response (replace with actual bot logic)
  const botResponse = new Chat({
    sessionId: sessionId,
    sender: 'Bot',
    message: `Bot response to: ${message}`,
    timestamp: new Date()
  });
  await botResponse.save();

  res.json({ success: true, response: botResponse.message });
});

// End chat session
app.post("/end-chat", isAuthenticated, async (req, res) => {
  const { sessionId } = req.body;
  
  const chatMessages = await Chat.find({ sessionId });
  if (chatMessages.length === 0) {
    // No messages sent, delete the session
    await ChatSession.findByIdAndDelete(sessionId);
  } else {
    // Messages were sent, end the session
    await ChatSession.findByIdAndUpdate(sessionId, { endTime: new Date() });
  }

  res.json({ success: true });
});

// Chat history
app.get('/history', isAuthenticated, async (req, res) => {
  const chatSessions = await ChatSession.find({ userId: req.user._id }).sort('-startTime');
  res.render("history", { chatSessions: chatSessions, user: req.user });
});

app.get('/history/:sessionId', isAuthenticated, async (req, res) => {
  const sessionId = req.params.sessionId;
  const chatSession = await ChatSession.findById(sessionId);
  if (!chatSession || chatSession.userId.toString() !== req.user._id.toString()) {
    return res.status(403).send('Unauthorized');
  }
  const chats = await Chat.find({ sessionId: sessionId }).sort('timestamp');
  res.render("chat-history", { chats: chats, user: req.user, sessionId: sessionId });
});

// Delete chat history
app.post('/history/delete', isAuthenticated, async (req, res) => {
  const { sessionId } = req.body;
  await ChatSession.findByIdAndDelete(sessionId);
  await Chat.deleteMany({ sessionId });
  res.json({ success: true });
});

// Resume chat history
app.post('/history/resume', isAuthenticated, async (req, res) => {
  const { sessionId } = req.body;
  const chatSession = await ChatSession.findById(sessionId);
  if (!chatSession || chatSession.userId.toString() !== req.user._id.toString()) {
    return res.status(403).send('Unauthorized');
  }
  res.redirect(`/chatpage?sessionId=${sessionId}`);
});

// Logout route
app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

// Start the server
app.listen(4000, () => console.log('Server started on port 4000'));
