const mongoose=require('mongoose')
//order schema should be similar to the other order schema

const orderSchema=new mongoose.Schema({
    custId:{
        type: String,
        required: true
    },
    retailerId:{
        type: String,
        required: true
    },
    retailerName:{
        type: String,
        required: true
    },
    isSigned:{
        type: Boolean,
        default: false
    },
    custAddr:{
        type: String,
        required: true
    },
    cost:{
        type: String,
        required: true
    },
    custPhone:{
        type: String,
        required: true
    },
    retailerPhone:{
        type: String,
        required: true
    },
    orderDate:{
        type: Date,
        default: Date.now()
    }
})

const PackageSchema=new mongoose.Schema({
    custId:{
        type:String,
        required:true,
        unique:true
    },
    riderId:{
        type:String,
        required:true,
        unique:true
    },
    isSigned:{
        type: Boolean,
        default: false
    },
    orders:[orderSchema]

})

const Package=mongoose.model('Package',PackageSchema)
module.exports=Package