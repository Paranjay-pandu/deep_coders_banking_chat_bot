
# Chatbot Application with Authentication and Chat History

This is a web-based chatbot application built with **Node.js**, **Express.js**, and **Passport.js** for user authentication, along with **MongoDB** for storing user and chat session data. It allows users to register, login, and engage in chat sessions with the ability to view and manage chat histories.

Here's a disclaimer you can use:

**Disclaimer:** In order for the application to function as intended, ensure that the following requirements are met:
- MongoDB database connection
- Node.js and npm installed
- All necessary packages installed as mentioned in `package.json`
- Active network connection

## Features
- **User Authentication**:
  - Register and login with secure password storage using **bcrypt.js**.
  - Session management with **express-session**.
  
- **Chatbot**:
  - Chat sessions are stored and linked to users.
  - View, resume, and delete chat history.

- **Logout**:
  - Securely log out, ending user sessions.

## Project Structure

```
/models
  - User.js              # MongoDB user schema
  - ChatSession.js       # Chat sessions schema
  - Chat.js              # Chat messages schema
/public                  # Static files (CSS, JS, etc.)
/views
  - index.ejs            # Home page template
  - login.ejs            # Login page
  - register.ejs         # Registration page
  - chatpage.ejs         # Chat interface
  - history.ejs          # Chat history page
  - Profile.ejs          # Profile page for user to view and edit their information
app.js                   # Main application file
package.json             # Dependencies and scripts
```

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Paranjay-pandu/deep_coders_banking_chat_bot).git
   cd deep_coders_banking_chat_bot
   ```

2. **Install dependencies**: (As in package.json file)
   ```bash
   npm install
   ```

3. **Configure MongoDB**: Update the MongoDB connection string in `app.js`:(change this as per the mongodb connection)
   ```javascript
   mongoose.connect('mongodb://localhost:27017/chatbot', { useNewUrlParser: true, useUnifiedTopology: true });
   ```

4. **Run the application**:
   ```bash
   npx nodemon .
   ```
   The application will be available at `http://localhost:4000`.(change this in the index.js file if required)

## Key Routes

- **Register**: `/register` (POST) - Register new users.
- **Login**: `/login` (POST) - Authenticate existing users.
- **Chat**: `/chatpage` (GET) - Start or resume a chat session.
- **History**: `/history` (GET) - View chat history.
- **Logout**: `/logout` (GET) - Log out and terminate session.
- **chat-history**: `/chat-history` (GET) - to view past chat history
- **profile**L `/profile` (GET) - for the user to view and edit their profile

## Future Enhancements
- Integrate a machine learning chatbot for dynamic responses.
- Add real-time chat functionality using **Socket.io**.(or integrate in any other way if found effecient)

