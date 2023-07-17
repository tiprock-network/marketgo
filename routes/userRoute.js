const express=require('express')
const router=express.Router()
//import request library
const request=require('request')
//acquire user model
const User=require('../model/userModel')
//the order model
const Order=require('../model/orderModel')
//import moment
const moment=require('moment')
//bcrypt is used to hash password
const bcrypt=require('bcryptjs')
const passport=require('passport')
const {ensureAuthenticated}=require('../config/auth')//protects routes
//Mpesa Credentials
const CONSUMER_KEY=process.env.CONSUMER_KEY
const CONSUMER_SECRET=process.env.CONSUMER_SECRET
const SHORT_CODE=process.env.SHORT_CODE
const MPESA_PASS_KEY=process.env.MPESA_PASS_KEY

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
    const message = req.query.message;//message from transaction
    res.render('dashboard',{
        id:req.user.userTransactionId,
        fname:firstname, name:req.user.userName, 
        budget:formatter.format(req.user.userBalance),
        userType:req.user.userType,
        orders:order,
        custPurchases:orderPurchase,
        sum:totalCost,
        transactionMsg:message
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

//Mpesa Checkout
router.get('/pay',ensureAuthenticated, async (req,res)=>{
    
    //get the data from database
    const order=await Order.find({custId:req.user.userTransactionId});
    const totalCost = order.reduce((sum, order) =>{
        if (!order.isSigned) {
            return (sum + parseInt(order.cost));
          }
          return sum;
    }, 0)
    console.log(totalCost)
   
    //STK PUSH
    generateAccessToken()
    .then((access_token)=>{
        const URL='https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        const Auth='Bearer '+access_token
        let timestamp=moment().format('YYYYMMDDHHmmss')
        //generate password
        const password= new Buffer.from(SHORT_CODE+MPESA_PASS_KEY+timestamp).toString('base64')
        //call back URL must be https
        //PartyA should be entity collecting the money to disburse it
        request({
            url:URL,
            method:'POST',
            headers:{
                Authorization:Auth
            },
            json:{
                BusinessShortCode: SHORT_CODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: "CustomerPayBillOnline",
                Amount: totalCost,
                PartyA: "254758885970",
                PartyB: "174379",
                PhoneNumber: req.user.userPhone,
                CallBackURL: process.env.CALLBACK_URL,
                AccountReference: "Market Go",
                TransactionDesc: "Mitumba Package" 
            }
        },async(error,response,body)=>{
            if(error) reject(error);
            else{
                
                try{
                    // Check if the ResponseCode is "0" for success
                    if (body.ResponseCode === "0") {
                        // Update the isSigned field to true
                        for (const o of order) {
                        o.isSigned = true;
                        await o.save();
                        }
                        res.redirect('/dashboard')
                    } else {
                        // Handle the case where ResponseCode is not "0"
                        // For example, you might want to perform some error handling or logging
                        //put this in a beutiful page
                        const message = `Transaction failed. ${body.errorMessage}`;
                        res.redirect(`/dashboard?message=${encodeURIComponent(message)}`)
                        console.log(body)
                    }
                }catch(err){
                    console.log(error)
                }
                //this response contains information of transaction
                //save part of this in the database later in orders
                
            }
        })

    })
})

/*router.get('/accessToken',(req,res)=>{
    generateAccessToken()
    .then((access_token)=>{
        res.send('Access Token: '+access_token);
        res.end()
    })
    .catch(console.log())
})*/




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

//generate Mpesa Access token
function generateAccessToken(){
    const consumerKey=CONSUMER_KEY
    const consumerSecret=CONSUMER_SECRET
    const URL='https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    const Auth='Basic '+new Buffer.from(consumerKey+':'+consumerSecret).toString('base64')
    return new Promise((response,reject)=>{
        request({
            url:URL,
            headers:{
                Authorization: Auth
            },
        },function (error,res,body){
            let jsonBody=JSON.parse(body);
            if(error) reject(error);
            else{
                const access_token=jsonBody.access_token
                response(access_token);
            }
        })
    })
}


//export router to server.js
module.exports=router