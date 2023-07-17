const express=require('express')
const router=express.Router()
//acquire user model
const User=require('../model/userModel')
//the order model
const Order=require('../model/orderModel')
//bcrypt is used to hash password
const bcrypt=require('bcryptjs')
const passport=require('passport')
const {ensureAuthenticated}=require('../config/auth')//protects routes

//create route to dashboard
router.get('/',ensureAuthenticated,async (req,res)=>{
    const formatter=new Intl.NumberFormat('en-US',{ minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const order=await Order.find({retailerId:req.user.id});
    const orderPurchase= await Order.find({custId:req.user.userTransactionId})
    const totalCost = orderPurchase.reduce((sum, order) =>{
        if (!order.isSigned) {
            return sum + parseFloat(order.cost);
          }
          return sum;
    }, 0)
    let firstname=(req.user.userName).split(' ')[0]
    res.render('dashboard',{
        id:req.user.userTransactionId,
        fname:firstname, name:req.user.userName, 
        budget:formatter.format(req.user.userBalance),
        userType:req.user.userType,
        orders:order,
        custPurchases:orderPurchase,
        sum:totalCost
    });
})

router.get('/login',(req,res)=>{
    res.render('login')
})

router.get('/signup',(req,res)=>{
    res.render('signup')
})

//add order
router.post('/order',ensureAuthenticated,(req,res)=>{
    //const customer= await User.find({userTransactionId:order.custId});
    const {custid,cost}=req.body
    let errs=[]
    if(!custid || custid.length<18)errs.push({message:'Customer transaction Id input needs to be valid.'});
    else{
        User.findOne({userTransactionId:custid})
        .then((user)=>{
            if(user){
                const order=new Order({
                    custId:user.userTransactionId,
                    retailerId:req.user.id,
                    retailerName:req.user.userName,
                    custAddr:user.userAddr,
                    cost:cost,
                    custPhone:user.userPhone,
                    retailerPhone:req.user.userPhone
                })

                order.save().then(user=>{
                    res.redirect('/dashboard')
                    req.flash('success_msg','Order made successfully.')
                })
            }else{
                errs.push({message:'Sorry, but this user does not exist.'})  
                res.render('/dashboard',{errs})
            }
        }

        )
        
    }

})


//registration
router.post('/signup',(req,res)=>{
    const{uemail,uname,userGender,userType,uphone,uaddr,upass}=req.body
    let errs=[];

    //check required fields
    if(!uemail||!uname||!userGender||!userType||!uphone||!uaddr||!upass){
        errs.push({message:'Kindly fill in all fields.'})
    }

    //later do a password match

    //length of password
    if(upass.length<8){
        errs.push({message:'Password should be above 8 characters.'})
    }

    if(errs.length>0) res.render('signup',{errs})
    else {
        //after passing validation
        //check if user exists
        User.findOne({email:uemail})
        .then(user=>{
            if(user){
                errs.push({message:'A similar user already exists.'})  
                res.render('signup',{errs})
            }else{
                //if the user is unique, we create a new user using model
                const newUser=new User({
                    userEmail:uemail,
                    userName:uname,
                    userGender:userGender,
                    userPhone:uphone,
                    userType:userType,
                    userAddr:uaddr,
                    userPass:upass
                })

                //console.log(newUser)

                //hash password
                //generate salt
                bcrypt.genSalt(10, (err,salt)=>bcrypt.hash(newUser.userPass,salt,(err,hash)=>{
                    if(err) throw err;
                    //set object password to hashed value
                    newUser.userPass=hash

                    //save the user
                    newUser.save()
                    .then(user=>{
                        req.flash('success_msg','You have successfully registered.')
                        res.redirect('/login')
                    })
                    .catch(err=>console.log(err))
                }))
            }
        })
    }

    
})


router.get('/commitfunds',ensureAuthenticated ,(req,res)=>{
   res.render('commitfunds',{user:req.user});
})

//update funds in account by committing the funds
//Mpesa Is Required to check for Account Balance
router.post('/commitfunds',ensureAuthenticated,async (req,res)=>{
   try{
        let user=req.user
        user.userBalance=req.body.amount
        await user.save()
        res.redirect('/dashboard')

    
   }catch(error){
    console.log(error)
   }
})

router.get('/checkout',(req,res)=>{
    res.send('<h1>Checkout Page</h1>')
    res.end()
})



//login using passport
router.post('/login',(req,res,next)=>{
    passport.authenticate('local',{
        successRedirect:'/dashboard',
        failureRedirect:'/login',
        failureFlash: true
    })(req,res,next);
})

//logout a user
//create a link on dashboard for this
router.get('/logout',(req,res)=>{
    req.logOut()
    req.flash('success_msg','You are now logged out.')
    res.redirect('/')
})


//export router to server.js
module.exports=router