const mongoose=require('mongoose')
const genTransId=require('./generateCustomId')


const userSchema=new mongoose.Schema({
    userTransactionId:{
        type:String,
        default:genTransId()
    },
    userEmail:{
        type:String,
        required:true
    },
    userName:{
        type:String,
        required:true
    },
    userType:{
        type:String,
        required:true
    },
    userGender:{
        type:String,
        required:true
    },
    userPhone:{
        type:String,
        required:true
    },
    userAddr:{
        type:String,
        required:true
    },
    userPass:{
        type:String,
        required:true
    },
    userBalance:{
        type:Number,
        default:0.00
    },
    userDate:{
        type:Date,
        default:Date.now()
    }
})

const User=mongoose.model('User',userSchema)

module.exports=User