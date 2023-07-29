const express=require('express')
const router=express.Router()
//import request library
const request=require('request')
//acquire user model
const User=require('../model/userModel')
//the order model
const Order=require('../model/orderModel')
//package model
const Package=require('../model/packageModel')
//import moment
const moment=require('moment')
//bcrypt is used to hash password
const bcrypt=require('bcryptjs')
const passport=require('passport')
const {ensureAuthenticated}=require('../config/auth')//protects routes by using passport
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')

//for generating pdfs
const PDFkit=require('pdfkit')

//require file path modules
const fs=require('fs')
const path=require('path')

//Mpesa Credentials
const CONSUMER_KEY=process.env.CONSUMER_KEY
const CONSUMER_SECRET=process.env.CONSUMER_SECRET
const SHORT_CODE=process.env.SHORT_CODE
const MPESA_PASS_KEY=process.env.MPESA_PASS_KEY

//Twilio Credentials
const TWILIO_AUTH_TOKEN=process.env.TWILIO_AUTH_TOKEN
const TWILIO_ACCOUNT_SID=process.env.TWILIO_ACCOUNT_SID
const TWILIO_PHONE_NUMBER=process.env.TWILIO_PHONE_NUMBER
//import twilio for messaging
const twilio_client=require('twilio')(TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN)

//create route to dashboard
router.get('/',ensureAuthenticated,async (req,res)=>{
    const formatter=new Intl.NumberFormat('en-US',{ minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const order=await Order.find({retailerId:req.user.id});
    const orders=await Order.find({retailerId:req.user.id});
    const orderPurchase= await Package.find({custId:req.user.userTransactionId})
    const package=await Package.find({riderId:req.user.userTransactionId})
    let totalCost = 0;

    for (const purchase of orderPurchase) {
        const purchaseTotalCost = purchase.orders.reduce((sum, order) => {
        if (!order.isSigned) {
            return sum + parseFloat(order.cost);
        }
        return sum;
        }, 0);

        totalCost += purchaseTotalCost;
    }

    //calculate expected revenue
    // Calculate totals
    let totalrevenue = 0;
    
    for (const order of orders) {
      totalrevenue += parseFloat(order.cost);
    }

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
        revenue:totalrevenue,
        transactionMsg:message,
        packages:package
    });
})

//profile

router.get('/profile',ensureAuthenticated,(req,res)=>{
    const user=req.user
    res.render('profile',{user})
})

//create route to print the receipt and statement
//get the table
router.get('/statement',ensureAuthenticated, async (req,res)=>{
    const orderPurchase= await Package.find({custId:req.user.userTransactionId})
    //calculate totals
    let totalCost = 0;

    for (const purchase of orderPurchase) {
        const purchaseTotalCost = purchase.orders.reduce((sum, order) => {
        if (!order.isSigned) {
            return sum + parseFloat(order.cost);
        }
        return sum;
        }, 0);

        totalCost += purchaseTotalCost;
    }
    //render the statement information
    res.render('statement',{
        userType:req.user.userType,
        custPurchases:orderPurchase,
        sum: totalCost
    })
})

//retailer statement
//get the table
router.get('/statement-retailer',ensureAuthenticated, async (req,res)=>{
    const orders = await Order.find({ retailerId: req.user.id });

    // Calculate totals
    let totalCost = 0;
    
    for (const order of orders) {
      totalCost += parseFloat(order.cost);
    }
    
    //render the statement information
    res.render('statement',{
        userType:req.user.userType,
        custPurchases:orders,
        sum: totalCost
    })
})

//generate statement in PDF Format
router.get('/generate-pdf', ensureAuthenticated, async (req, res) => {
    try {
        const orderPurchase = await Package.find({ custId: req.user.userTransactionId });

        //calculate totals
        let totalCost = 0;

        for (const purchase of orderPurchase) {
            const purchaseTotalCost = purchase.orders.reduce((sum, order) => {
                if (!order.isSigned) {
                    return sum + parseFloat(order.cost);
                }
                return sum;
            }, 0);

            totalCost += purchaseTotalCost;
        }

        //create new PDF Document
        const statementPdf = new PDFkit({ size: 'letter', layout: 'landscape' });

        //create appropriate headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${req.user.userName}-statement.pdf"`);
        statementPdf.pipe(res);

        // Add content to the PDF
        statementPdf.fontSize(18).text(`${req.user.userName} Account Statement Unpaid: KES.${totalCost}`, { align: 'center' });
        statementPdf.moveDown();

        //put in the data from the packages
        if (orderPurchase.length > 0) {
            orderPurchase.forEach(function (purchase) {
                if (purchase.isSigned || !purchase.isSigned) {
                    const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    purchase.orders.forEach(function (order) {
                        if (order.isSigned) {
                            try {
                                // Print data as a list
                                statementPdf.fontSize(10).text(`Package Id: ${order.custId}`, { align: 'left' });
                                statementPdf.fontSize(10).text(`Customer Id: ${order.id}`, { align: 'left' });
                                statementPdf.fontSize(10).text(`Item Id: ${order.retailerId}`, { align: 'left' });
                                statementPdf.fontSize(10).text(`Retailer Id: ${order.retailerName}`, { align: 'left' });
                                statementPdf.fontSize(10).text(`Rider Id: ${purchase.riderId}`, { align: 'left' });
                                statementPdf.fontSize(10).text(`Cost: KES.${formatter.format(order.cost)}`, { align: 'left' });
                                statementPdf.fontSize(10).text(`Customer Phone: ${order.custPhone}`, { align: 'left' });
                                statementPdf.fontSize(10).text(`Date: ${formatDate(order.orderDate)}`, { align: 'left' });
                                statementPdf.fontSize(10).text(`Signed: ${order.isSigned}`, { align: 'left' });
                                statementPdf.moveDown();
                            } catch (err) {
                                console.log(err);
                                res.status(500).send('Error generating Statement');
                            }
                        }
                    });
                }
            });
        }

        // Finalize and close the document PDF
        statementPdf.end();
    } catch (err) {
        console.log(err);
        res.status(500).send('Error generating Statement');
    }
});

// Helper function to format the date as needed
function formatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString(undefined, options);
}

//generate customer receipt
//generate statement in PDF Format
router.get('/generate-receipt', ensureAuthenticated, async (req, res) => {
    try {
      const orderPurchase = await Package.find({ custId: req.user.userTransactionId });
      // Get the current date
      const currentDate = new Date();
      // Calculate totals
      let totalCost = 0;
  
      for (const purchase of orderPurchase) {
        const purchaseTotalCost = purchase.orders.reduce((sum, order) => {
          if (order.isSigned && isSameDate(order.orderDate, currentDate)) {
            return sum + parseFloat(order.cost);
          }
          return sum;
        }, 0);
  
        totalCost += purchaseTotalCost;
      }

     
  
      // Create new PDF Document
      const statementPdf = new PDFkit({ size: 'letter', layout: 'portrait' });
  
      // Create appropriate headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${req.user.userName}-receipt-${Date.now()}.pdf"`);
      statementPdf.pipe(res);
  
      // Add content to the PDF
      //when logo changes change the image in routes
      const logoPath = './public/images/marketgologo.png'; 
      statementPdf.image(logoPath, 10, 10, { width: 100 }); // Add your logo image here
      statementPdf.fontSize(18).text(`Market Go Delivery Receipt: ${req.user.userName}`, { align: 'center' });
      statementPdf.moveDown();
  
      // Put in the data from the packages
      

        // Put in the data from the packages for today's orders
        if (orderPurchase.length > 0) {
        orderPurchase.forEach(function (purchase) {
            if (purchase.isSigned || !purchase.isSigned) {
            const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            statementPdf.fontSize(10).text(`Package Id: ${purchase.id}  Rider Id:${purchase.riderId}`, { align: 'left' });
            statementPdf.moveDown();
            purchase.orders.forEach(function (order) {
                if (order.isSigned && isSameDate(order.orderDate, currentDate)) {
                try {
                    // Print data as a list for today's orders only
                    statementPdf.fontSize(10).text(`Order Id: ${order.id}`, { align: 'left' });
                    statementPdf.fontSize(10).text(`Cost: KES.${formatter.format(order.cost)}`, { align: 'left' });
                    statementPdf.fontSize(10).text(`Date: ${receiptformatDate(order.orderDate)}`, { align: 'left' });
                    statementPdf.moveDown();
                } catch (err) {
                    console.log(err);
                    res.status(500).send('Error generating Statement');
                }
                }
            });
            }
        });
        }
      // Print the total cost at the bottom in bold and large font
      statementPdf.fontSize(16).text(`Total Cost: KES.${totalCost.toFixed(2)}`, { align: 'right', bold: true });
  
      // Finalize and close the document PDF
      statementPdf.end();
    } catch (err) {
      console.log(err);
      res.status(500).send('Error generating Statement');
    }
  });
  
  // Helper function to format the date as needed with hours and minutes
  function receiptformatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(date).toLocaleDateString(undefined, options);
  }

  // Helper function to check if two dates are the same (ignores time)
function isSameDate(date1, date2) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

//end of previous route

//generate delivery list
//generate statement in PDF Format
router.get('/delivery-list', ensureAuthenticated, async (req, res) => {
    try {
      const orderPurchase = await Package.find({ riderId: req.user.userTransactionId });
      // Get the current date
      const currentDate = new Date();
  
      // Create new PDF Document
      const statementPdf = new PDFkit({ size: 'letter', layout: 'portrait' });
  
      // Create appropriate headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${req.user.userName}-deliverylist-${Date.now()}.pdf"`);
      statementPdf.pipe(res);
  
      // Add content to the PDF
      //when logo changes change the image in routes
      const logoPath = './public/images/marketgologo.png'; 
      statementPdf.image(logoPath, 10, 10, { width: 100 }); // Add your logo image here
      statementPdf.fontSize(18).text(`Market Go Delivery. Rider: ${req.user.userName}`, { align: 'center' });
      statementPdf.moveDown();
  
      // Put in the data from the packages
      

        // Put in the data from the packages for today's orders
        if (orderPurchase.length > 0) {
        orderPurchase.forEach(function (purchase) {
            if (purchase.isSigned || !purchase.isSigned) {
            const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            statementPdf.fontSize(10).text(`Package Id: ${purchase.id}  Rider Id:${purchase.riderId}`, { align: 'left' });
            statementPdf.moveDown();
            purchase.orders.forEach(function (order) {
                if (order.isSigned && isSameDate(order.orderDate, currentDate)) {
                try {
                    // Print data as a list for today's orders only
                    statementPdf.fontSize(10).text(`Order Id: ${order.id}`, { align: 'left' });
                    statementPdf.fontSize(10).text(`Customer Id: ${order.custPhone}`, { align: 'left' });
                    statementPdf.fontSize(10).text(`Address/ Location: ${order.custAddr}`, { align: 'left' });
                    statementPdf.fontSize(10).text(`Cost: KES.${formatter.format(order.cost)}`, { align: 'left' });
                    statementPdf.fontSize(10).text(`Date: ${receiptformatDate(order.orderDate)}`, { align: 'left' });
                    statementPdf.moveDown();
                } catch (err) {
                    console.log(err);
                    res.status(500).send('Error generating Statement');
                }
                }
            });
            }
        });
        }
      
  
      // Finalize and close the document PDF
      statementPdf.end();
    } catch (err) {
      console.log(err);
      res.status(500).send('Error generating Statement');
    }
  });
  
  // Helper function to format the date as needed with hours and minutes
  function receiptformatDate(date) {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(date).toLocaleDateString(undefined, options);
  }

  // Helper function to check if two dates are the same (ignores time)
function isSameDate(date1, date2) {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

//end of previous route

router.get('/generate-trader-statement', ensureAuthenticated, async (req, res) => {
    try {
      const orders = await Order.find({ retailerId: req.user.id });
  
      // Calculate totals
      let totalCost = 0;
      for (const order of orders) {
        totalCost += parseFloat(order.cost);
      }
  
      // Create new PDF Document
      const statementPdf = new PDFkit({ size: 'letter', layout: 'landscape' });
  
      // Create appropriate headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${req.user.userName}-statement.pdf"`);
      statementPdf.pipe(res);
  
      // Add content to the PDF
      statementPdf.fontSize(18).text(`${req.user.userName} Account Statement Revenue: KES.${totalCost}`, { align: 'center' });
      statementPdf.moveDown();
  
      // Put in the data from the orders
      if (orders.length > 0) {
        const formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        orders.forEach((order) => {
          statementPdf.fontSize(10).text(`Customer Id: ${order.custId}`, { continued: true });
          statementPdf.text(`Retailer Id: ${order.retailerId}`);
          statementPdf.text(`Retailer Name: ${order.retailerName}`);
          statementPdf.text(`Customer Address: ${order.custAddr}`);
          statementPdf.text(`Cost: KES.${formatter.format(order.cost)}`);
          statementPdf.text(`Customer Phone: ${order.custPhone}`);
          statementPdf.text(`Retailer Phone: ${order.retailerPhone}`);
          statementPdf.text(`Date: ${formatDate(order.orderDate)}`);
          statementPdf.moveDown();
        });
      } else {
        statementPdf.text('No transactions', { align: 'center' });
      }
  
      // Finalize and close the document PDF
      statementPdf.end();
    } catch (err) {
      console.log(err);
      res.status(500).send('Error generating Statement');
    }
  });
//end of route
router.get('/login',(req,res)=>{
    res.render('login')
})

router.get('/signup',(req,res)=>{
    res.render('signup')
})

//add order
router.post('/order',ensureAuthenticated, async (req,res)=>{
    
    const {custid,cost}=req.body
    //rider id
    //utr-XqZ180723230216
    const riders=await User.find({userType:'rider'})
    
    const randomIndex = Math.floor(Math.random() * riders.length);
    const riderId = riders[randomIndex].userTransactionId;

    let errs=[]
    if(!custid || custid.length<18)errs.push({message:'Customer transaction Id input needs to be valid.'});
    else{
        User.findOne({userTransactionId:custid})
        .then(async (user)=>{
            if(user){
                //create new order
                const order=new Order({
                    custId:user.userTransactionId,
                    retailerId:req.user.id,
                    retailerName:req.user.userName,
                    custAddr:user.userAddr,
                    cost:cost,
                    custPhone:user.userPhone,
                    retailerPhone:req.user.userPhone
                })

                //find a package if it exists
                const existingPackage = await Package.findOne({ custId: user.userTransactionId});
                if (existingPackage) {
                    console.log(order)
                    existingPackage.orders.push(order); // Append the new order to the existing package
                    await existingPackage.save(); // Save the updated package
                  } else {
                    const newPackage = new Package({
                      custId: user.userTransactionId,
                      riderId:riderId,
                      orders: [order]
                    });
                  
                    await newPackage.save(); // Save the new package
                  }

                
                //saves order
                await order.save().then(user=>{
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
    const order=await Package.find({custId:req.user.userTransactionId});
    
    let totalCost=0
    for (const purchase of order) {
            const purchaseTotalCost = purchase.orders.reduce((sum, order) => {
            if (!order.isSigned) {
                return sum + parseFloat(order.cost);
            }
            return sum;
            }, 0);

            totalCost += purchaseTotalCost;
        }
    
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
                        Package.updateMany({}, { $set: { isSigned: true, 'orders.$[].isSigned': true } })
                        .then(async () => {
                            
                            for (const purchase of order) {
                                // Get the rider for each order separately
                                const rider = await User.findOne({ userTransactionId: purchase.riderId });
                          
                                if (rider) {
                                  // Each rider is paid 120 shillings
                                  rider.userBalance = rider.userBalance + 120;
                                  
                                  riderName=rider.userName //rider name
                                  riderNumber=rider.userPhone //rider's phonenumber
                                  await rider.save();
                                } else {
                                  console.error(`Rider with ID ${purchase.riderId} not found in the database.`);
                                }
                              }
                            console.log('Documents updated successfully.');
                            
                        })
                        .catch(error => {
                            console.error('Error updating documents:', error);
                            // Handle the error
                        });

                    //send message to phone number using twilio
                    //remeber to add name of rider
                    //twilio fail safe-

                    //get rider number and name
                    for (const purchase of order) {
                        // Get the rider for each order separately
                        const rider = await User.findOne({ userTransactionId: purchase.riderId });
                  
                        if (rider) {
                            // Each rider is paid 120 shillings
                            rider.userBalance = rider.userBalance + 120;
                            
                            // Save the rider's updated balance
                            await rider.save();
                    
                            // Notify the user about the successful payment and package delivery
                            const riderName = rider.userName;
                            const riderNumber = rider.userPhone;
                            const userMessage = `Hi, ${req.user.userName}. You have successfully paid KES.${totalCost} for your mitumba package. Your package will be delivered today by ${riderName} - ${riderNumber}. Thank you for using Market Go.`;
                    
                            // Send a message to the user
                            twilio_client.messages
                              .create({
                                body: userMessage,
                                from: TWILIO_PHONE_NUMBER,
                                to: `+${req.user.userPhone}`
                              })
                              .then(msg => console.log(msg.sid));
                    
                            // Notify the rider about the package delivery
                            const riderMessage = `Hi ${riderName}. You have been assigned to deliver a package. Please ensure timely delivery to the customer.`;
                    
                            // Send a message to the rider
                            twilio_client.messages
                              .create({
                                body: riderMessage,
                                from: TWILIO_PHONE_NUMBER,
                                to: `+${riderNumber}`
                              })
                              .then(msg => console.log(msg.sid));
                          } else {
                            console.error(`Rider with ID ${purchase.riderId} not found in the database.`);
                          }
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
// Logout a user - create a link on the dashboard for this
router.get('/logout', ensureAuthenticated, (req, res) => {
    // Check if the user is authenticated before logging them out
    if (req.isAuthenticated()) {
      // Log the user out
      req.logOut(function(err) {
        if (err) {
          // Handle any potential error that occurred during logout
          console.error('Error during logout:', err);
        }
        // Redirect the user to the home page (or any other page you desire)
        res.redirect('/');
      });
    } else {
      // If the user is not authenticated, simply redirect them to the home page
      res.redirect('/');
    }
  });
  
//send message to support
router.get('/contact-us',(req,res)=>{
    res.render('contact-us')
})
//send user message enquiry
//send reset link
router.post('/contact-us',async (req,res,next)=>{
    const email=req.body.uemail
    const name=req.body.uname
    const subject=req.body.subject
    const message=req.body.message
    
    //check if there are all inputs
    if(email && message && subject && name){
        //res.send(email)
        //check if user exists
       
            //send email using nodemailer to support
            //create a transporter
            const transporter = nodemailer.createTransport({
                host:process.env.SMTP_HOST,
                port: process.env.EMAIL_PORT,
                secure:true,
                auth:{
                    user:process.env.APP_EMAIL,
                    pass:process.env.APP_EMAIL_PASSWORD2
                }
            });

           
             //use an function to send the email
            transporter.sendMail({
                from:`"${name}" <${email}>`,
                to:process.env.APP_EMAIL,
                subject:subject,
                html:`Hi, my name is ${name}. I have the following message. ${message}. My email is, ${email}`
            }).catch(console.error)

            //send notification
            res.send(`
                <div style="margin-top: 5%;">
                <center><p style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 16px; font-weight:600; color:rgb(18, 139, 93);">Email sent successfully to customer support.</p></center>
                <center><img style="height: 120px; width: 125px;" src="./images/rocket-launch.gif"></center>
                </div>
            `
            );
      
        
    }
    else //send notification
    res.send(`
        <div style="margin-top: 5%;">
        <center><p style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 16px; font-weight:600; color:rgb(202, 36, 36);">Oops...something went wrong, kindly try again.</p></center>
        <center><img style="height: 120px; width: 125px;" src="./images/sad.gif"></center>
        </div>
    `
    );
})



//forgot password
//reset send link page
router.get('/resetlink',(req,res,next)=>{
    res.render('resetlink')
})
//send reset link
router.post('/resetlink',async (req,res,next)=>{
    const email=req.body.remail
    const checkUser=await User.findOne({userEmail:email});
    //check of email was sent
    if(email){
        //res.send(email)
        //check if user exists
        if(checkUser){
            //use link once for 15 minutes
            const secret=process.env.AUTH_SECRET+checkUser.userPass;
            //create a payload
            const payload={
                email:checkUser.userEmail,
                id:checkUser.userTransactionId
            }
            //generate token with JWT
            const token=jwt.sign(payload, secret, {expiresIn:'15m'})

            //generate reset link
            const reset_link=`http://${process.env.HOST_NAME}:${process.env.PORT}/resetpassword/${checkUser.userTransactionId}/${token}`;
            //user name
            const uname=checkUser.userName
            //send email using nodemailer with reset link
            //create a transporter
            const transporter = nodemailer.createTransport({
                host:process.env.SMTP_HOST,
                port: process.env.EMAIL_PORT,
                secure:true,
                auth:{
                    user:process.env.APP_EMAIL,
                    pass:process.env.APP_EMAIL_PASSWORD2
                }
            });

            //get html file path
            const htmlpath=path.join(__dirname,'inc','reset.html')
            //read the file
            fs.readFile(htmlpath,'utf8',(error,htmlContent)=>{
                if(error)console.log('Error: ',error)
                else{
                    let modifiedHtml=htmlContent.replace("[USER NAME]",uname);
                    modifiedHtml=modifiedHtml.replace(/\[LINK HERE\]/g,reset_link);
                     //use an function to send the email
                    transporter.sendMail({
                        from:'"Market Go" <marketgo@gmail.com>',
                        to:checkUser.userEmail,
                        subject:'Password Reset Link',
                        html:modifiedHtml
                    }).catch(console.error)

                    //send notification
                    res.send(`
                        <div style="margin-top: 5%;">
                        <center><p style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 16px; font-weight:600; color:rgb(18, 139, 93);">Email sent successfully. Please close this tab and check your email.</p></center>
                        <center><img style="height: 120px; width: 125px;" src="./images/rocket-launch.gif"></center>
                        </div>
                    `
                    );
                }
            })
           
        }else{
            res.send(`
        <div style="margin-top: 5%;">
        <center><p style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 16px; font-weight:600; color:rgb(202, 36, 36);">Sending a reset email failed. It seems that your account does not exist. Go back and try again or signup.</p></center>
        <center><img style="height: 120px; width: 125px;" src="./images/meteorite.gif"></center>
        </div>
    `
    );
        }
        
    }
    else //send notification
    res.send(`
        <div style="margin-top: 5%;">
        <center><p style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; font-size: 16px; font-weight:600; color:rgb(202, 36, 36);">Woow...it seems like you did not input anything. The process has broken, kindly go back.</p></center>
        <center><img style="height: 120px; width: 125px;" src="./images/sad.gif"></center>
        </div>
    `
    );
})

//reset page
router.get('/resetpassword/:id/:token', async (req,res,next)=>{
    const {id, token}=req.params
    //find a user with given id

    await User.findOne({userTransactionId:id})
    .then((account)=>{
        if(account){
            const secret=process.env.AUTH_SECRET+account.userPass;

            try{
                const payload=jwt.verify(token, secret)
                res.render('reset',{id,token})
            }catch(error){
                res.send(error.message)
            }
        }else{
            res.send('No user found.')
        }
    })
    .catch((error=>{
        console.log(error)
    }))
    

})
//reset password
router.post('/resetpassword/:id/:token', async (req,res,next)=>{
    const {id,token}=req.params
    //get submitted data from the form
    const {pass,cpass}=req.body
    //find a user with given id

    await User.findOne({userTransactionId:id})
    .then(async (account)=>{
        if(account){
            const secret=process.env.AUTH_SECRET+account.userPass;

            try{
                const payload=jwt.verify(token, secret)
                //change the password
                account.userPass=pass
               

                 //generate salt
                 bcrypt.genSalt(10, (err,salt)=>bcrypt.hash(account.userPass,salt,(err,hash)=>{
                    if(err) throw err;
                    //set object password to hashed value
                    account.userPass=hash

                    //save the password and send success message
                    account.save()
                    .then(user=>{
                        req.flash('success_msg','You have successfully changed your password.')
                        res.redirect('/login')
                    })
                    .catch(err=>console.log(err))

                    //to log in an API
                    //res.json(account)
                }))
            }catch(error){
                res.send(error.message)
            }
        }else{
            res.send('No user found.')
        }
    })
    .catch((error=>{
        console.log(error)
    }))
    
    
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