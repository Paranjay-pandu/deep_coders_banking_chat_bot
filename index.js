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
    req.flash('success', 'You have registered successfully'); // Add flash message for success
    return res.redirect('/'); // Change this to the appropriate redirect URL
    });
})(req, res, next);
});
  

// Register route
app.get('/register', (req, res) => {
  res.render("register");
});

const { body, validationResult } = require('express-validator');

app.post('/register', [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('no').isMobilePhone().withMessage('Valid phone number is required'),
  body('bank_no').notEmpty().trim().withMessage('Bank account number is required'),
  body('credit').isIn(['yes', 'no']).withMessage('Credit card information is required'),
  body('debit').isIn(['yes', 'no']).withMessage('Debit card information is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('register', { 
      error: errors.array()[0].msg,
      formData: req.body
    });
  }

  const { name, email, no, bank_no, credit, debit, password } = req.body;

  try {
    // Check if the email already exists in the database
    const userExists = await User.findOne({ email: email });

    if (userExists) {
      return res.render('register', { 
        error: 'Email already exists! Please login instead.',
        formData: req.body
      });
    }

    // Proceed with the registration
    const newUser = new User({
      name,
      email,
      phoneNumber: no,
      bankAccountNumber: bank_no,
      hasCreditCard: credit === 'yes',
      hasDebitCard: debit === 'yes',
      password: await bcrypt.hash(password, 10) // Hashing password
    });

    await newUser.save();
    res.redirect('/login'); // Redirect to login after successful registration
  } catch (error) {
    console.error(error);
    res.render('register', { 
      error: 'An error occurred during registration. Please try again.',
      formData: req.body
    });
  }
});

// Home route (protected)
app.get('/', isAuthenticated, (req, res) => {
  // Extract user details
  const username = req.user.name; // Assuming req.user has a 'name' property
  const email = req.user.email;   // Assuming req.user has an 'email' property
  const chatbotName = "ChatBot";
  // Pass user details along with other data to the view
  res.render('index', { username, chatbotName, user: req.user });
});

  
// // Index route
// app.get('/index', isAuthenticated, (req, res) => {
//   res.render('index', { user: req.user }); // Passing user data to index page
// });

// Chat page
app.get("/chatpage", isAuthenticated, async (req, res) => {
    let chatSession;
  
    try {
      // Check if sessionId is provided as a query parameter
      if (req.query.sessionId) {
        chatSession = await ChatSession.findById(req.query.sessionId);
  
        // Handle case where session is not found
        if (!chatSession) {
          return res.status(404).send('Chat session not found');
        }
      } else {
        // Create a new chat session if none exists
        chatSession = new ChatSession({
          userId: req.user._id,
          startTime: new Date(),
          endTime: null
        });
        await chatSession.save();
      }
  
      // Fetch chats associated with this session and sort by timestamp
      const chats = await Chat.find({ sessionId: chatSession._id }).sort('timestamp');
  
      // Render the chat page and pass chat history and sessionId
      res.render("chatpage", { user: req.user, sessionId: chatSession._id, chats });
  
    } catch (err) {
      console.error('Error retrieving or creating chat session:', err);
      res.status(500).send('Internal Server Error');
    }
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
  
    // Redirect to chat page with the session ID
    res.redirect(`/chatpage?sessionId=${sessionId}`);
  });
  

app.get('/logout', (req, res, next) => {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/login');
  });
});

app.get('/profile', isAuthenticated,(req, res)=>{
  res.render("profile", {user: req.user})
})

app.post('/edit-profile', isAuthenticated, [
  body('name').notEmpty().trim().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phoneNumber').isMobilePhone().withMessage('Valid phone number is required'),
  body('bankAccountNumber').notEmpty().trim().withMessage('Bank account number is required'),
  body('hasCreditCard').isBoolean().withMessage('Credit card information is required'),
  body('hasDebitCard').isBoolean().withMessage('Debit card information is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phoneNumber, bankAccountNumber, hasCreditCard, hasDebitCard } = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(req.user._id, {
      name,
      email,
      phoneNumber,
      bankAccountNumber,
      hasCreditCard,
      hasDebitCard
    }, { new: true });

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'An error occurred while updating the profile.' });
  }
});

// Start the server
app.listen(4000, () => console.log('Server started on port 4000'));
