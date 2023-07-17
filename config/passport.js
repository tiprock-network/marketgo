const LocalStrategy=require('passport-local').Strategy
const mongoose=require('mongoose')
const bcrypt=require('bcryptjs')

const User=require('../model/userModel')
module.exports=function(passport){
    passport.use(
        //both password and email are required fields
        new LocalStrategy({usernameField:'uemail',passwordField:'upass'}, (email,password,done)=>{
            User.findOne({userEmail:email})
            .then(user=>{
                if(!user) return done(null,false,{message:'Sorry, but this email does not belong to an account. Please register or correct your details.'});

                //compare password
                bcrypt.compare(password,user.userPass,(err,isMatch)=>{
                    if(err) throw err;
                    if(isMatch) return done(null,user)
                    else return done(null,false,{message:'It looks like your password is incorrect.'})
                })
            })
            .catch(err=>console.log(err))
        })
    )
//serializing and deserializing the user
passport.serializeUser((user,done)=>{
    done(null,user.id)
})

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err=>done(err,null))
})
}