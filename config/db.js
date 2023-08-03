const mongoose=require('mongoose')//we pull mongoose from wherever it was

const connect_db=async ()=>{
    try{
        const conn=mongoose.connect(process.env.MONGODB_URI)//connection to the database - remote instance of the database inside the MongoDB Atlas cluster
        //check the connection object
        console.log(`MarketGo connected to MongoDB successfully`.cyan.underline)
    }catch(err){
        console.log(err)
        process.exit(1)
    }
}

module.exports=connect_db