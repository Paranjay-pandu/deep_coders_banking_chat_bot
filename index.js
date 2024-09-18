const express = require('express')
const path = require('path')
const app = express()

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.set("view engine", "ejs")
app.use(express.static(path.join(__dirname, "public")))

app.get('/', (req, res)=>{
    res.render('index')
})
app.get('/login', (req, res)=>{
    res.render("login")
})
app.get('/register', (req,res)=>{
    res.render("register")
})
app.get("/chatpage", (req,res)=>{
    res.render("chatpage")
})
app.get('/history', (req, res)=>{
    res.render("history")
})
app.listen(4000)