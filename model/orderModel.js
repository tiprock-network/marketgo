const mongoose=require('mongoose')
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
    custAddr:{
        type: String,
        required: true
    },
    isSigned:{
        type: Boolean,
        default: false
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

const Order=mongoose.model('Order',orderSchema)
module.exports=Order