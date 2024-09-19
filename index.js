const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
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
app.use(express.urlencoded({extended: true}));
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

app.get('/', (req, res) => {
  res.render('index', { user: req.user });
});

app.get('/login', (req, res) => {
  res.render("login");
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/chatpage',
  failureRedirect: '/login',
  failureFlash: true
}));

app.get('/register', (req, res) => {
  res.render("register");
});

app.post('/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newUser = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
      phoneNumber: req.body.no,
      bankAccountNumber: req.body.bank_no,
      hasCreditCard: req.body.credit === 'yes',
      hasDebitCard: req.body.debit === 'yes'
    });
    await newUser.save();
    res.redirect('/login');
  } catch (error) {
    res.redirect('/register');
  }
});

app.get("/chatpage", isAuthenticated, async (req, res) => {
  let chatSession = await ChatSession.findOne({ userId: req.user._id, endTime: null });
  if (!chatSession) {
    chatSession = new ChatSession({
      userId: req.user._id,
      startTime: new Date(),
      endTime: null
    });
    await chatSession.save();
  }
  res.render("chatpage", { user: req.user, sessionId: chatSession._id });
});

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

app.post("/end-chat", isAuthenticated, async (req, res) => {
  const { sessionId } = req.body;
  await ChatSession.findByIdAndUpdate(sessionId, { endTime: new Date() });
  res.json({ success: true });
});

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

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.listen(4000, () => console.log('Server started on port 4000'));