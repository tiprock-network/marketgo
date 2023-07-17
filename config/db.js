const mongoose=require('mongoose')

const connect_db=async ()=>{
    try{
        const conn=mongoose.connect(process.env.MONGODB_URI)
        //check the connection object
        console.log(`MarketGo connected to MongoDB successfully`.cyan.underline)
    }catch(err){
        console.log(err)
        process.exit(1)
    }
}

module.exports=connect_db