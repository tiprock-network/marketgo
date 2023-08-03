const express=require('express')
const colors=require('colors')//to make my console beautiful
const flash=require('connect-flash')//show error and success messages
const session=require('express-session')
const passport=require('passport')
const mongodb_connection=require('./config/db')//connection to the database itself
//override form method and add DELETE or PUT
const methodoverride=require('method-override')
const dotenv=require('dotenv')//environmental varibales
dotenv.config()
//call the database
mongodb_connection()
//app server
const app=express()
//bring in passport config
require('./config/passport')(passport)

//set the view engine to EJS
//middleware
app.set('view engine','ejs')
app.use(methodoverride('_method'))
app.use(express.urlencoded({extended:false})) //to get data from the form with req.body
app.use(session({
    secret:process.env.SECRET_KEY,
    resave:true,
    saveUninitialized:true,
    cookie:{
        maxAge:30*60*1000, //we want 30 minutes(30*60*1000) but set now at 5 hours(300*60*1000)
    }
}))
//passport goes here- no where else
app.use(passport.initialize())
app.use(passport.session())
app.use(flash())

//global variables- they will help us pass success and error messages in between routes
app.use((req,res,next)=>{
    res.locals.success_msg=req.flash('success_msg')
    res.locals.error_msg=req.flash('error_msg')
    res.locals.error=req.flash('error')
    next()
})

app.use(express.static('public'))
//routes
const userInfo=require('./routes/userRoute')
const { ensureAuthenticated } = require('./config/auth')



//main route
app.get('/',ensureAuthenticated,(req,res)=>{
    res.redirect('/dashboard')
})

//customer account dashboard
app.use('/dashboard',userInfo)

//login and signup main index route page
app.use('/',userInfo)

//the port of http server
const PORT=process.env.PORT||5001

app.listen(PORT,()=>{
    console.log(`App server started on PORT: ${PORT}...`)
})
